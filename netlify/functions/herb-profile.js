const https = require('https');
const { URLSearchParams } = require('url');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const { findMissing, deriveFunctionalOverview, REQUIRED_SECTIONS } = require('./profile-validation');
// ── SINGLE-CALL PROFILE (replaces the old Stage 1 / Stage 2 split) ──
// The two-stage design existed to show something fast while a slower
// Sonnet call filled in the rich content in the background — but the
// background half of that only works with Netlify's background-function
// runtime (Pro-plan-only), and on the free plan it was silently dying
// mid-generation, leaving rows stuck at status:'generating' forever with
// no visible error. Per Jerome: drop the background split, do one
// synchronous call for the full profile. Simpler failure mode — it
// either completes and saves, or the request errors out visibly — no
// more silent stuck state to debug. Trade-off: the user's request now
// waits for the *whole* profile, not just the fast essentials.
function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
}

const SYSTEM_PROMPT = `You are the Herbadex -- CHI's herb knowledge engine.

You will be given real reference material retrieved from PubMed, PubMed Central, Wikipedia, Wikidata, and/or Crossref for this herb, or told explicitly that none was found. Base every substantive claim ONLY on that material or on extremely well-established general knowledge (the kind found in any standard reference on the plant) -- never on an unverifiable specific you are inferring or guessing to sound complete. If the material doesn't support a field, or none was found, leave that field null/empty rather than filling it in. A short, honest, partial profile is correct behavior here, not a failure -- do not pad fields to look complete.

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "name": "common name", "latin": "latin binomial, or null if not confident", "category": "primary action category, or null",
  "categoryColor": "#hex", "origin": "native region, or null", "tradition": "primary healing tradition(s), or null",
  "preparations": ["tea","tincture","capsule"], "safetyLevel": "Generally safe | Use with caution | Consult professional | null if not established",
  "summary": "2 sentence overview, warm and plain, or null if nothing reliable to say",
  "functionalOverview": "2-3 sentence in-depth summary of what it does and how people use it, or null",
  "sources": [{"url":"an exact URL copied from the reference material below","title":"short title for it"}],
  "spiritualHistory": { "overview": "3-4 sentence paragraph on cultural/spiritual significance, or null", "timeline": [{"era":"period or culture","text":"one sentence"}] },
  "modernUse": "1-2 paragraph(s) on current research and modern applications, grounded in the material provided -- or null if none was found",
  "compounds": [{"name":"compound name (e.g. baicalein, pabloside)","class":"Flavonoid | Alkaloid | Terpenoid | Saponin | Glycoside | Tannin | Polysaccharide | Phenolic acid","role":"plain English explanation of what it does","mechanism":"1-2 sentences on HOW it works in the body","evidence":"what the reference material actually says backs this compound"}],
  "herbalActions": [{"name":"action name","system":"body system","description":"1-2 sentences","compounds":["compound name"]}],
  "bodyEffects": [{"system":"body system","effect":"short phrase"}],
  "preparation": {"tea":"or null","tincture":"or null","capsule":"or null","topical":"or null","traditional":"or null"},
  "rareFact": "one surprising fact, only if genuinely well-established -- or null",
  "interactions": ["known interaction"]
}
Limits: compounds max 4, herbalActions max 4, bodyEffects max 4, interactions max 3, timeline max 3.
"sources" must only ever contain URLs you were actually given in the reference material below -- never construct, guess, or paraphrase a URL. If no reference material was provided, "sources" must be an empty array.
Arrays (compounds, herbalActions, bodyEffects, interactions) should be empty [] rather than padded with weak or invented entries if the reference material doesn't genuinely support them.
Do not invent a numeric "strength" or confidence score for a compound -- that kind of precision cannot genuinely be measured or sourced, so the schema does not ask for one.
Do not invent user reviews, testimonials, or community experiences -- that content must come from real people, never be generated.
Return ONLY the JSON object. No other text.`;

const MAX_ATTEMPTS = 1;

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

const RESEARCH_USER_AGENT = 'CHI-Herbadex-Bot/1.0 (collectiveherbalintelligence.com; contact via site owner)';
const RESEARCH_TIMEOUT_MS = 5000;

const PLANT_PART_WORDS = ['root','roots','leaf','leaves','bark','seed','seeds','flower','flowers','fruit','berry','berries','extract','powder','oil','rhizome','stem','herb','stalk','stalks','husk','husks','peel','peels','pod','pods'];
function strippedName(name) {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return null;
  const last = words[words.length - 1].toLowerCase();
  return PLANT_PART_WORDS.includes(last) ? words.slice(0, -1).join(' ') : null;
}

function httpsGetJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: RESEARCH_TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
  });
}

function httpsGetText(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers, timeout: RESEARCH_TIMEOUT_MS }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Request timed out')));
  });
}

async function pubmedSearchIds(term, maxResults) {
  const searchParams = new URLSearchParams({
    db: 'pubmed',
    term,
    retmax: String(maxResults),
    retmode: 'json',
    sort: 'relevance'
  });
  const searchData = await httpsGetJson(
    `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams.toString()}`,
    { 'User-Agent': RESEARCH_USER_AGENT }
  );
  return (searchData.esearchresult && searchData.esearchresult.idlist) || [];
}

async function fetchPubMedAbstracts(herbName, maxResults = 4) {
  try {
    const queryFor = (n) => `${n} AND (herb OR plant OR extract OR medicinal OR botanical OR traditional OR pharmacological OR phytochemical)`;
    let ids = await pubmedSearchIds(queryFor(herbName), maxResults);
    const alt = strippedName(herbName);
    if (!ids.length && alt) {
      ids = await pubmedSearchIds(queryFor(alt), maxResults);
    }
    if (!ids.length) return [];

    const fetchParams = new URLSearchParams({
      db: 'pubmed',
      id: ids.join(','),
      rettype: 'abstract',
      retmode: 'text'
    });
    const text = await httpsGetText(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${fetchParams.toString()}`,
      { 'User-Agent': RESEARCH_USER_AGENT }
    );

    const entries = text.split(/\n\d+\.\s/).map(s => s.trim()).filter(Boolean);
    return ids
      .map((id, i) => ({
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        text: (entries[i] || '').slice(0, 1500)
      }))
      .filter(e => e.text);
  } catch (e) {
    return [];
  }
}

async function wikipediaSummaryFor(name) {
  const title = encodeURIComponent(name.trim());
  const data = await httpsGetJson(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${title}`,
    { 'User-Agent': RESEARCH_USER_AGENT, 'Accept': 'application/json' }
  );
  if (!data || data.type === 'disambiguation' || !data.extract) return null;
  return {
    title: data.title,
    url: (data.content_urls && data.content_urls.desktop && data.content_urls.desktop.page) || `https://en.wikipedia.org/wiki/${title}`,
    text: data.extract.slice(0, 1500)
  };
}

async function wikipediaResolveTitle(name) {
  const params = new URLSearchParams({
    action: 'opensearch',
    search: name.trim(),
    limit: '1',
    namespace: '0',
    format: 'json'
  });
  const data = await httpsGetJson(
    `https://en.wikipedia.org/w/api.php?${params.toString()}`,
    { 'User-Agent': RESEARCH_USER_AGENT, 'Accept': 'application/json' }
  );
  return (Array.isArray(data) && Array.isArray(data[1]) && data[1][0]) || null;
}

async function fetchWikipediaSummary(herbName) {
  try {
    const resolved = await wikipediaResolveTitle(herbName).catch(() => null);
    if (resolved) {
      const result = await wikipediaSummaryFor(resolved).catch(() => null);
      if (result) return result;
    }
    const direct = await wikipediaSummaryFor(herbName).catch(() => null);
    if (direct) return direct;
    const alt = strippedName(herbName);
    if (alt) {
      const stripped = await wikipediaSummaryFor(alt).catch(() => null);
      if (stripped) return stripped;
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function fetchPMCArticles(herbName, maxResults = 3) {
  try {
    const queryFor = (n) => `${n} AND (herb OR plant OR extract OR medicinal OR botanical OR traditional)`;
    const searchParams = new URLSearchParams({
      db: 'pmc',
      term: queryFor(herbName),
      retmax: String(maxResults),
      retmode: 'json',
      sort: 'relevance'
    });
    const searchData = await httpsGetJson(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams.toString()}`,
      { 'User-Agent': RESEARCH_USER_AGENT }
    );
    const ids = (searchData.esearchresult && searchData.esearchresult.idlist) || [];
    if (!ids.length) {
      const alt = strippedName(herbName);
      if (alt) {
        return await fetchPMCArticles(alt, maxResults);
      }
      return [];
    }

    const fetchParams = new URLSearchParams({
      db: 'pmc',
      id: ids.join(','),
      rettype: 'abstract',
      retmode: 'text'
    });
    const text = await httpsGetText(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?${fetchParams.toString()}`,
      { 'User-Agent': RESEARCH_USER_AGENT }
    );

    const entries = text.split(/\n\d+\.\s/).map(s => s.trim()).filter(Boolean);
    return ids
      .map((id, i) => ({
        url: `https://www.ncbi.nlm.nih.gov/pmc/articles/PMC${id}/`,
        text: (entries[i] || '').slice(0, 2000)
      }))
      .filter(e => e.text);
  } catch (e) {
    return [];
  }
}

async function fetchWikidataPlantInfo(herbName) {
  try {
    const searchParams = new URLSearchParams({
      action: 'wbsearchentities',
      search: herbName.trim(),
      language: 'en',
      type: 'item',
      limit: '1',
      format: 'json'
    });
    const searchData = await httpsGetJson(
      `https://www.wikidata.org/w/api.php?${searchParams.toString()}`,
      { 'User-Agent': RESEARCH_USER_AGENT }
    );

    const entities = searchData.search || [];
    if (!entities.length) return null;

    const itemId = entities[0].id;

    const itemParams = new URLSearchParams({
      action: 'wbgetentities',
      ids: itemId,
      props: 'info|claims|labels|descriptions',
      languages: 'en',
      format: 'json'
    });
    const itemData = await httpsGetJson(
      `https://www.wikidata.org/w/api.php?${itemParams.toString()}`,
      { 'User-Agent': RESEARCH_USER_AGENT }
    );

    const entity = itemData.entities[itemId];
    if (!entity || !entity.labels || !entity.labels.en) return null;

    const label = entity.labels.en.value;
    const description = entity.descriptions && entity.descriptions.en
      ? entity.descriptions.en.value
      : '';

    const text = `${label}. ${description}`;
    if (!text || text.length < 20) return null;

    return {
      url: `https://www.wikidata.org/wiki/${itemId}`,
      text: text.slice(0, 1500)
    };
  } catch (e) {
    return null;
  }
}

async function fetchCrossrefArticles(herbName, maxResults = 2) {
  try {
    const queryFor = (n) => `("${n}" OR "${n.replace(/\s+/g, '-')}") AND (medicinal OR phytochemical OR pharmacological)`;
    const searchParams = new URLSearchParams({
      query: queryFor(herbName),
      rows: String(maxResults),
      sort: 'relevance'
    });

    const data = await httpsGetJson(
      `https://api.crossref.org/works?${searchParams.toString()}`,
      { 'User-Agent': RESEARCH_USER_AGENT }
    );

    if (!data.message || !Array.isArray(data.message.items)) return [];

    return data.message.items
      .filter(item => item.DOI && (item.abstract || item.title))
      .map(item => {
        const abstractText = item.abstract || (Array.isArray(item.title) ? item.title.join(' ') : item.title) || '';
        return {
          url: `https://doi.org/${item.DOI}`,
          text: abstractText.slice(0, 1500)
        };
      })
      .filter(e => e.text && e.text.length > 50);
  } catch (e) {
    return [];
  }
}

function buildGroundingBlock(pubmedResults, pmcResults, wikiResult, wikidataResult, crossrefResults) {
  const parts = [];
  if (pubmedResults.length) {
    parts.push('PubMed abstracts:\n' + pubmedResults.map(p => `[${p.url}]\n${p.text}`).join('\n\n'));
  }
  if (pmcResults.length) {
    parts.push('PubMed Central articles:\n' + pmcResults.map(p => `[${p.url}]\n${p.text}`).join('\n\n'));
  }
  if (wikiResult) {
    parts.push(`Wikipedia (${wikiResult.url}):\n${wikiResult.text}`);
  }
  if (wikidataResult) {
    parts.push(`Wikidata (${wikidataResult.url}):\n${wikidataResult.text}`);
  }
  if (crossrefResults.length) {
    parts.push('Crossref academic papers:\n' + crossrefResults.map(c => `[${c.url}]\n${c.text}`).join('\n\n'));
  }
  return parts.length ? parts.join('\n\n---\n\n') : null;
}

const WIKIMEDIA_USER_AGENT = RESEARCH_USER_AGENT;
const ACCEPTED_LICENSES = ['cc0', 'ccby', 'ccbysa', 'publicdomain', 'pdself', 'pd'];
function normalizeLicense(s) {
  return (s || '').toLowerCase().replace(/[\s-]+/g, '');
}

function wikimediaSearch(term, maxImages) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `${term} filetype:bitmap`,
      gsrnamespace: '6',
      gsrlimit: String(maxImages * 3),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '800',
      format: 'json'
    });
    const req = https.get(
      `https://commons.wikimedia.org/w/api.php?${params.toString()}`,
      { headers: { 'User-Agent': WIKIMEDIA_USER_AGENT }, timeout: 8000 },
      (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Wikimedia request timed out')));
  });
}

async function fetchHerbImages(latinName, commonName, maxImages = 1) {
  const results = [];
  for (const term of [latinName, commonName].filter(Boolean)) {
    let data;
    try {
      data = await wikimediaSearch(term, maxImages);
    } catch (e) {
      continue;
    }
    const pages = (data.query && data.query.pages) || {};
    for (const page of Object.values(pages)) {
      const info = (page.imageinfo && page.imageinfo[0]) || null;
      if (!info) continue;
      const meta = info.extmetadata || {};
      const licenseShort = (meta.LicenseShortName && meta.LicenseShortName.value) || '';
      if (!ACCEPTED_LICENSES.some(lic => normalizeLicense(licenseShort).includes(lic))) continue;
      const artist = ((meta.Artist && meta.Artist.value) || 'Unknown').replace(/<[^>]+>/g, '').trim();
      const credit = `${artist} — ${licenseShort || 'Unknown license'} — Wikimedia Commons`;
      results.push({ url: info.thumburl || info.url || '', credit });
      if (results.length >= maxImages) break;
    }
    if (results.length) break;
  }
  return results;
}

function buildUserMessage(name, excludedHerb, issues, groundingBlock) {
  let base;
  if (excludedHerb && issues && issues.length > 0) {
    base = `The user rejected: ${excludedHerb}. They're looking for an herb that helps with: ${issues.join(', ')}. Find a different, complementary herb that addresses these issues better than ${excludedHerb}. Provide the profile for: ${name}`;
  } else {
    base = `Provide the profile for: ${name}`;
  }
  if (groundingBlock) {
    return `${base}\n\nREFERENCE MATERIAL (real, retrieved just now -- ground your answer in this, and only cite these exact URLs in "sources" where relevant):\n\n${groundingBlock}`;
  }
  return `${base}\n\nNo reference material could be retrieved from PubMed, PubMed Central, Wikipedia, Wikidata, or Crossref for this herb. Only include fields you are confident reflect extremely well-established, standard-reference-level knowledge. Leave everything else null rather than filling in unverifiable specifics. "sources" must be an empty array.`;
}

async function requestProfile(anthropic, name, userMessage, attempt = 1, priorMissing = null) {
  let content = userMessage;
  if (attempt > 1) content += '\n\nReturn ONLY the JSON object, with no other text before or after it.';
  if (priorMissing && priorMissing.length) {
    content += `\n\nYour previous attempt had invalid structure for: ${priorMissing.join(', ')}. Fix the structure -- do not use this as a reason to add unverified content to any field.`;
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content }]
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
      return requestProfile(anthropic, name, userMessage, attempt + 1, ['valid JSON structure']);
    }
    return { error: 'Model response was not valid JSON', stopReason: message.stop_reason, raw: textBlock.text.trim().slice(0, 300) };
  }

  const missing = findMissing(herb);
  if (missing.length && attempt < MAX_ATTEMPTS) {
    return requestProfile(anthropic, name, userMessage, attempt + 1, missing);
  }
  herb._missingFields = missing;
  return herb;
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
      const before = cachedRow.data.functionalOverview;
      deriveFunctionalOverview(cachedRow.data);
      let healed = cachedRow.data.functionalOverview !== before;

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

    const [pubmedResults, pmcResults, wikiResult, wikidataResult, crossrefResults] = await Promise.all([
      fetchPubMedAbstracts(name),
      fetchPMCArticles(name),
      fetchWikipediaSummary(name),
      fetchWikidataPlantInfo(name),
      fetchCrossrefArticles(name)
    ]);
    const groundingBlock = buildGroundingBlock(pubmedResults, pmcResults, wikiResult, wikidataResult, crossrefResults);

    const userMsg = buildUserMessage(name, excludedHerb, issues, groundingBlock);
    const herb = await requestProfile(anthropic, name, userMsg);

    if (herb.error) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Generation failed: ' + herb.error }) };
    }

    deriveFunctionalOverview(herb);

    const realUrls = new Set([
      ...pubmedResults.map(p => p.url),
      ...pmcResults.map(p => p.url),
      ...(wikiResult ? [wikiResult.url] : []),
      ...(wikidataResult ? [wikidataResult.url] : []),
      ...crossrefResults.map(c => c.url)
    ]);
    herb.sources = Array.isArray(herb.sources) ? herb.sources.filter(s => s && realUrls.has(s.url)) : [];

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
