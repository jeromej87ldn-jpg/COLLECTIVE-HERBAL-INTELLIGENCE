const https = require('https');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const { findMissing, deriveFunctionalOverview, validateCompounds } = require('./profile-validation');

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
}

const SYSTEM_PROMPT = `You are the Herbadex -- CHI's herb knowledge engine.

IMPORTANT DISCLAIMER: Profiles are generated for educational reference only and are NOT medical advice. Users should consult healthcare professionals before using any herbs, especially if pregnant, nursing, or on medications.

Generate a complete, informative herb profile based on well-established herbal knowledge. Include traditional uses, modern applications, preparation methods, safety considerations, and phytochemistry where applicable.

COMPOUND ACCURACY CRITICAL: Only use real, well-established herbal compounds. Never invent compound names. Use ONLY compounds from known herbal references (e.g. curcumin from turmeric, gingerol from ginger, allicin from garlic, inulin from burdock, silymarin from milk thistle). Each compound must be verifiable in herbal/botanical literature.

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "name": "common name",
  "latin": "latin binomial, or null if not confident",
  "category": "primary action category (never null)",
  "categoryColor": "#hex",
  "origin": "native region, or null",
  "tradition": "primary healing tradition(s) (never null)",
  "preparations": ["tea","tincture","capsule"],
  "safetyLevel": "Generally safe | Use with caution | Consult professional (never null)",
  "summary": "2 sentence overview, warm and plain",
  "functionalOverview": "2-3 sentence in-depth summary of what it does and how people use it",
  "sources": [],
  "spiritualHistory": { "overview": "3-4 sentence paragraph on cultural/spiritual significance, or null", "timeline": [{"era":"period or culture","text":"one sentence"}] },
  "modernUse": "1-2 paragraph(s) on current applications and research",
  "compounds": [{"name":"REAL compound name ONLY (e.g. curcumin, gingerol, silymarin, inulin)","class":"Flavonoid | Alkaloid | Terpenoid | Saponin | Glycoside | Tannin | Polysaccharide | Phenolic acid","role":"what it does","mechanism":"1-2 sentences on HOW it works","evidence":"supporting information"}],
  "herbalActions": [{"name":"action name","system":"body system","description":"1-2 sentences","compounds":["REAL compound name"]}],
  "bodyEffects": [{"system":"body system","effect":"short phrase"}],
  "preparation": {"tea":"method or null","tincture":"method or null","capsule":"method or null","topical":"method or null","traditional":"method or null"},
  "rareFact": "one surprising fact, or null",
  "interactions": ["known interaction"],
  "disclaimer": "Educational reference only. Not medical advice. Consult healthcare provider before use."
}

Limits: compounds max 4, herbalActions max 4, bodyEffects max 4, interactions max 3, timeline max 3.
Do not invent testimonials or user reviews -- that data comes only from real users.
Keep sources empty unless you can cite a well-known published reference by name.
MANDATORY FIELDS (never null or empty): category, tradition, safetyLevel.
Return ONLY the JSON object.`;

const MAX_ATTEMPTS = 2;

function extractJson(text) {
  const stripped = text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(stripped);
  } catch (e) {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }
    throw e;
  }
}

async function requestProfile(anthropic, name, attempt = 1, priorMissing = null) {
  let userMessage = `Generate a complete herb profile for: ${name}`;

  if (attempt > 1) {
    userMessage += '\n\nReturn ONLY the JSON object, with no other text before or after it.';
  }
  if (priorMissing && priorMissing.length) {
    userMessage += `\n\nYour previous attempt had invalid structure for: ${priorMissing.join(', ')}. Fix the structure.`;
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }]
  });

  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || !textBlock.text) {
    return { error: 'No text content in model response', stopReason: message.stop_reason };
  }

  let herb;
  try {
    herb = extractJson(textBlock.text);
  } catch (parseErr) {
    if (attempt < MAX_ATTEMPTS) {
      return requestProfile(anthropic, name, attempt + 1, ['valid JSON structure']);
    }
    return { error: 'Model response was not valid JSON', stopReason: message.stop_reason, raw: textBlock.text.trim().slice(0, 300) };
  }

  const missing = findMissing(herb);
  if (missing.length && attempt < MAX_ATTEMPTS) {
    return requestProfile(anthropic, name, attempt + 1, missing);
  }
  herb._missingFields = missing;
  return herb;
}

// ── Verified sources ──────────────────────────────────────────────────
// Fetch REAL citation links (Wikipedia + PubMed) for a herb. Only URLs that
// actually resolved get attached — nothing is invented. Every lookup fails
// silently and returns [], so profile delivery is never blocked by this.
function fetchJsonQuick(url, ms) {
  return new Promise((resolve) => {
    let done = false;
    const finish = v => { if (!done) { done = true; resolve(v); } };
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => { try { ctrl.abort(); } catch (e) {} finish(null); }, ms);
      fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } })
        .then(r => (r && r.ok ? r.json() : null))
        .then(j => { clearTimeout(t); finish(j); })
        .catch(() => { clearTimeout(t); finish(null); });
    } catch (e) { finish(null); }
  });
}

async function fetchVerifiedSources(commonName, latinName) {
  const out = [];
  try {
    // Wikipedia — try the latin binomial first, fall back to the common name
    for (const title of [latinName, commonName].filter(Boolean)) {
      const j = await fetchJsonQuick('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(title), 3000);
      if (j && j.type !== 'disambiguation' && j.content_urls && j.content_urls.desktop && j.content_urls.desktop.page) {
        out.push({ url: j.content_urls.desktop.page, title: 'Wikipedia — ' + (j.title || title) });
        break;
      }
    }
    // PubMed — up to 2 relevant papers naming the herb in title/abstract
    const term = encodeURIComponent('"' + (latinName || commonName) + '"[Title/Abstract]');
    const es = await fetchJsonQuick('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=2&sort=relevance&term=' + term, 3000);
    const ids = es && es.esearchresult && Array.isArray(es.esearchresult.idlist) ? es.esearchresult.idlist : [];
    if (ids.length) {
      const sum = await fetchJsonQuick('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=' + ids.join(','), 3000);
      for (const id of ids) {
        const rec = sum && sum.result && sum.result[id];
        out.push({ url: 'https://pubmed.ncbi.nlm.nih.gov/' + id + '/', title: rec && rec.title ? String(rec.title).replace(/<[^>]+>/g, '').slice(0, 90) : 'PubMed ' + id });
      }
    }
  } catch (e) { /* best-effort only */ }
  return out;
}

// Merge verified links into existing sources without overwriting anything —
// keeps every existing entry that already has a URL, then appends new ones.
function mergeSources(existing, verified) {
  const kept = Array.isArray(existing) ? existing.filter(s => s && s.url) : [];
  const seen = new Set(kept.map(s => s.url));
  for (const v of verified || []) { if (!seen.has(v.url)) { kept.push(v); seen.add(v.url); } }
  return kept;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { herbName, previewApiKey, excludedHerb, issues } = JSON.parse(event.body || '{}');
    if (!herbName || !herbName.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'herbName is required' }) };
    }
    const name = herbName.trim().toLowerCase();
    const serverKey = process.env.ANTHROPIC_API_KEY;
    const apiKey = serverKey || previewApiKey;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY' }) };
    }
    const anthropic = new Anthropic({ apiKey });

    let cachedRow = null;
    if (supabase) {
      try {
        const { data: row } = await supabase
          .from('herbs')
          .select('data, status')
          .eq('name', name)
          .maybeSingle();
        cachedRow = row;
      } catch (cacheErr) {
        console.error('Supabase read failed:', cacheErr.message);
      }
    }

    if (cachedRow && cachedRow.status === 'complete' && cachedRow.data && cachedRow.data.name) {
      // Check if profile is complete (has original required fields — new fields optional for backwards compat)
      const requiredFields = ['category', 'safetyLevel', 'modernUse', 'compounds', 'herbalActions', 'bodyEffects', 'preparation', 'interactions'];
      const isIncomplete = requiredFields.some(f => !cachedRow.data[f] || (Array.isArray(cachedRow.data[f]) && cachedRow.data[f].length === 0) || (typeof cachedRow.data[f] === 'object' && cachedRow.data[f] !== null && Object.keys(cachedRow.data[f]).length === 0) || (typeof cachedRow.data[f] === 'string' && !cachedRow.data[f].trim()));

      if (isIncomplete) {
        console.log(`Profile incomplete for ${name}, regenerating...`);
        // Fall through to generation logic
      } else {
        const before = cachedRow.data.functionalOverview;
        deriveFunctionalOverview(cachedRow.data);
        validateCompounds(cachedRow.data);
        let healed = cachedRow.data.functionalOverview !== before;

        // Backfill verified citation links (Wikipedia/PubMed) for cached
        // rows that have none — runs once per herb, then it's saved.
        const hasLinkedSources = Array.isArray(cachedRow.data.sources) && cachedRow.data.sources.some(s => s && s.url);
        if (!hasLinkedSources) {
          const verified = await fetchVerifiedSources(name, cachedRow.data.latin);
          if (verified.length) {
            cachedRow.data.sources = mergeSources(cachedRow.data.sources, verified);
            healed = true;
          }
        }

        if (healed) {
          supabase.from('herbs').upsert({ name, status: 'complete', data: cachedRow.data }).then(
            () => {}, e => console.error('healed-row save failed:', e.message)
          );
        }
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'X-Cache': healed ? 'repaired' : 'hit' },
          body: JSON.stringify(cachedRow.data)
        };
      }
    }

    // If herb exists but is pending (in the 2,500 list), generate it now
    if (cachedRow && cachedRow.status === 'pending') {
      console.log(`Generating pending herb: ${name}`);
      // Fall through to generation logic below
    }

    let isHerb = true;
    try {
      const check = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: `Is "${name}" primarily known and used as a medicinal herb, culinary herb/spice, or traditional herbal remedy plant (examples: ashwagandha, chamomile, turmeric, echinacea, ginger, rosemary)?
Answer "no" if it is mainly a staple food eaten as a vegetable, fruit, grain, meat, or everyday produce item rather than for herbal/medicinal use (examples: cabbage, potato, chicken, apple, rice, lettuce) — even if it has a minor folk remedy use.
Answer ONLY "yes" or "no", nothing else.`
        }]
      });
      const verdictBlock = check.content.find(b => b.type === 'text');
      const verdict = (verdictBlock && verdictBlock.text || '').trim().toLowerCase();
      if (verdict.startsWith('no')) isHerb = false;
    } catch (validationErr) {
      console.error('Herb validation check failed, proceeding anyway:', validationErr.message);
    }

    if (!isHerb) {
      if (supabase) {
        supabase.from('herbs').delete().eq('name', name).then(
          () => {}, e => console.error('bad-cache cleanup failed:', e.message)
        );
      }
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'not_an_herb',
          message: `"${herbName.trim()}" doesn't look like a recognized herb, spice, or traditional herbal remedy plant — it reads more like a staple food item. Herbadex only generates profiles for herbal/medicinal plants. If this looks wrong, try the plant's common herbal name.`
        })
      };
    }

    const herb = await requestProfile(anthropic, name);

    if (herb.error) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Generation failed: ' + herb.error }) };
    }

    deriveFunctionalOverview(herb);
    validateCompounds(herb);

    // Attach verified citation links — only URLs that actually resolved.
    // Existing linked sources are kept; nothing is overwritten.
    try { herb.sources = mergeSources(herb.sources, await fetchVerifiedSources(name, herb.latin)); } catch (e) {}

    if (!herb.disclaimer) {
      herb.disclaimer = 'Educational reference only. Not medical advice. Consult healthcare provider before use.';
    }

    herb.images = [];
    herb.generatedAt = new Date().toISOString();

    if (supabase) {
      try {
        await supabase.from('herbs').upsert({ name, status: 'complete', data: herb });
      } catch (e) {
        console.error('Supabase write failed:', e.message);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(herb)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
