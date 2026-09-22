const https = require('https');
const fs = require('fs');
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

// ══════════════════════════════════════════════════════════════════════════
// HERBADEX GATE v4 — decides what Herbadex will generate a profile for.
//
// Why the old restrictions never worked: they read herbadex_master_catalog.json
// with fs.readFileSync at request time. Netlify only ships files a function
// require()s, so that read failed silently, every herb came back "unknown"
// and the type rules never ran. The catalog is now require()d, so Netlify
// bundles it (and the build fails loudly if the path is ever wrong).
//
// Checks, first match wins:
//   1. In the catalog (ignores case, apostrophes, hyphens, plural s, and
//      also matches Latin names)            → allowed (unless a blocked type)
//   2. On the hard NON_HERBAL list          → blocked, no API cost
//   3. Supabase already holds a decision:
//        'rejected'                          → blocked, no API cost
//        'pending' (curated list)            → allowed
//        'unclassified' or gate-approved     → allowed
//   4. Otherwise Claude Haiku is asked once whether the name is a herb,
//      mushroom, spice, seed, oil/resin or health-notable fruit/veg.
//        herbal → a spelling/variant of a catalog herb loads that herb;
//                 anything else is generated and saved as 'unclassified'
//        not herbal / unrecognised → saved as 'rejected' (any old profile is
//                 kept inside the row) and blocked with "did you mean ...?"
//      The decision is stored in Supabase, so each name is checked once.
// ══════════════════════════════════════════════════════════════════════════
const GATE_VERSION = 'v4';

let HERB_CATALOG = [];
try {
  const catalogData = require('../../herbadex_master_catalog.json');
  HERB_CATALOG = Array.isArray(catalogData) ? catalogData : (catalogData.herbs || []);
  console.log(`[GATE ${GATE_VERSION}] catalog loaded: ${HERB_CATALOG.length} herbs`);
} catch (e) {
  console.error(`[GATE ${GATE_VERSION}] catalog failed to load:`, e.message);
}

function normName(s) {
  return String(s || '').toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^\p{L}\p{N}()\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Lookup index: exact common names first, then names without a (qualifier),
// then Latin names — an earlier entry is never overwritten by a later one.
const CATALOG_INDEX = new Map();
for (const h of HERB_CATALOG) { const k = normName(h.name); if (k && !CATALOG_INDEX.has(k)) CATALOG_INDEX.set(k, h); }
for (const h of HERB_CATALOG) { const k = normName(String(h.name || '').replace(/\(.*?\)/g, '')); if (k && !CATALOG_INDEX.has(k)) CATALOG_INDEX.set(k, h); }
for (const h of HERB_CATALOG) { const k = normName(h.latin_name || h.latin); if (k && k.includes(' ') && !CATALOG_INDEX.has(k)) CATALOG_INDEX.set(k, h); }

function findInCatalog(term) {
  const k = normName(term);
  if (!k) return null;
  if (CATALOG_INDEX.has(k)) return CATALOG_INDEX.get(k);
  if (k.endsWith('es') && CATALOG_INDEX.has(k.slice(0, -2))) return CATALOG_INDEX.get(k.slice(0, -2));
  if (k.endsWith('s') && CATALOG_INDEX.has(k.slice(0, -1))) return CATALOG_INDEX.get(k.slice(0, -1));
  return null;
}

function levSimilarity(a, b) {
  const m = a.length, n = b.length;
  const L = Math.max(m, n);
  if (!L) return 1;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return (L - prev[n]) / L;
}

// Closest catalog herb — used only for the "did you mean" suggestion and for
// matching a name the classifier has ALREADY confirmed is herbal. It is never
// used on its own to decide something is a herb: tested against 27,000 common
// English words, spelling similarity passes hundreds of them as herbs
// ("love"→Clove, "morning"→Moringa, "need"→Neem).
function closestCatalogHerb(term) {
  const q = normName(term);
  let best = null, bestScore = 0;
  for (const h of HERB_CATALOG) {
    const n = normName(h.name);
    let s = levSimilarity(q, n);
    for (const w of n.split(' ')) { if (w.length > 3) s = Math.max(s, levSimilarity(q, w) * 0.95); }
    if (s > bestScore) { bestScore = s; best = h; }
  }
  return { herb: best, score: bestScore };
}

const BLOCKED_TYPES = ['staple_food', 'meat', 'grain', 'vegetable_staple'];

// Obvious non-herbal words, blocked without any API call. Only applies to
// names NOT in the catalog, so catalog herbs such as garlic and onion are safe.
const NON_HERBAL = new Set([
  'chicken','beef','pork','turkey','lamb','fish','salmon','tuna','shrimp','egg','eggs','bacon','ham','sausage','steak','meat',
  'rice','wheat','corn','oats','oat','barley','quinoa','rye','millet','flour','bread','pasta','noodles','cereal',
  'potato','potatoes','onions','tomato','tomatoes','lettuce','spinach','cabbage','cucumber','carrot','carrots',
  'milk','cheese','yogurt','butter','cream','sugar','salt','chocolate','candy','cake','pizza','burger','chips','soda','beer','wine',
  'computer','laptop','phone','iphone','tablet','keyboard','mouse','screen','monitor','printer','camera','television','tv','radio','internet','website','email','app',
  'car','bus','train','plane','boat','bike','truck','road','house','home','door','window','table','chair','bed','sofa',
  'ring','necklace','bracelet','watch','earrings','jewelry','jewellery','diamond','gold','silver','money','cash','bank',
  'cat','cats','dog','dogs','horse','cow','pig','sheep','bird','rat','mice',
  'shirt','shoes','hat','coat','dress','bag','book','pen','pencil','paper',
  'hello','hi','test','testing','yes','no','ok','okay','thanks','please','lol'
]);

const CLASSIFIER_PROMPT = `You are the gatekeeper for Herbadex, a reference library of plant and fungal medicine.

Herbadex covers: medicinal herbs; culinary herbs and spices; medicinal or edible mushrooms and other fungi; medicinal seeds; plant oils, resins, gums and saps; natural substances used in traditional medicine (e.g. propolis, shilajit); and fruits or vegetables notable for health or medicinal use (e.g. amla, moringa, bitter melon, pomegranate, garlic, beetroot).

Decide whether the search term names something in that scope. It may be a common name, a local or traditional name in any language or tradition (Ayurvedic, Chinese, Caribbean, African, Amazonian, Native American, etc.), a Latin binomial, a misspelling of any of these, or such a name followed by a preparation word (tea, root, oil, powder).

"herbal": it clearly names something in scope.
"not_herbal": it names anything else — objects, technology, animals, people, places, brands, body parts, symptoms, diseases, emotions, meat, dairy, grains and everyday staple foods eaten mainly as food (rice, bread, chicken, cheese, sugar), or ordinary words.
"unsure": you do not recognise it as a real plant, fungus or natural medicinal substance.

Return ONLY JSON: {"verdict":"herbal"|"not_herbal"|"unsure","canonical_name":"standard English common name if herbal, otherwise null"}`;

async function classifyName(anthropic, term) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    system: CLASSIFIER_PROMPT,
    messages: [{ role: 'user', content: `Search term: ${term}` }]
  }, { timeout: 8000, maxRetries: 1 });
  const textBlock = message.content.find(b => b.type === 'text');
  const out = extractJson(textBlock ? textBlock.text : '');
  const verdict = ['herbal', 'not_herbal', 'unsure'].includes(out.verdict) ? out.verdict : 'unsure';
  const canonical = typeof out.canonical_name === 'string' ? out.canonical_name.trim() : '';
  return { verdict, canonical };
}

function gateBlock(rawName, extraNote) {
  const { herb, score } = closestCatalogHerb(rawName);
  const message = herb && score >= 0.5
    ? `We don't recognise "${rawName}" as an herb — did you mean ${herb.name}?`
    : `We don't recognise "${rawName}" as an herb — try checking the spelling, or browse The Herbarium.`;
  if (extraNote) console.log(`[GATE ${GATE_VERSION}] blocked "${rawName}" — ${extraNote}`);
  return {
    ok: false,
    response: {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', 'X-Herbadex-Gate': GATE_VERSION },
      body: JSON.stringify({ error: 'not_an_herb', message, suggestion: herb && score >= 0.5 ? herb.name : null, gate: GATE_VERSION })
    }
  };
}

async function rememberRejection(key, verdict, previousRow) {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('herbs').upsert({
      name: key,
      status: 'rejected',
      data: { _gate: verdict, checkedAt: new Date().toISOString(), previous: previousRow ? previousRow.data || null : null }
    }, { onConflict: 'name' });
    if (error) {
      // Status value not accepted by the table — at least stop serving a junk profile.
      console.error(`[GATE ${GATE_VERSION}] could not save 'rejected' for "${key}": ${error.message}`);
      if (previousRow) await supabase.from('herbs').delete().eq('name', key);
    }
  } catch (e) {
    console.error(`[GATE ${GATE_VERSION}] rejection save failed:`, e.message);
  }
}

async function checkHerbGate(rawName, anthropic) {
  const key = rawName.trim().toLowerCase();

  // Herb names only need letters, spaces and a little punctuation. Anything
  // else (<, >, /, =, digits-only, very long text) is blocked with no API cost.
  if (key.length < 2 || key.length > 60 || !/\p{L}/u.test(key) || !/^[\p{L}\p{M}\p{N}\s'’`().,&-]+$/u.test(key)) {
    return gateBlock(rawName.slice(0, 60), 'not a plausible name');
  }

  // 1. Catalog
  const catalogHerb = findInCatalog(rawName);
  if (catalogHerb) {
    const type = catalogHerb.type || 'unknown';
    if (BLOCKED_TYPES.includes(type)) return gateBlock(rawName, `catalog type ${type}`);
    return { ok: true, name: String(catalogHerb.name).trim().toLowerCase(), saveStatus: 'complete', route: 'catalog' };
  }

  // 2. Hard non-herbal list
  if (NON_HERBAL.has(normName(rawName))) {
    let row = null;
    if (supabase) { try { ({ data: row } = await supabase.from('herbs').select('status, data').eq('name', key).maybeSingle()); } catch (e) {} }
    if (!row || row.status !== 'rejected') await rememberRejection(key, 'non_herbal_list', row);
    return gateBlock(rawName, 'non-herbal list');
  }

  // 3. Decision already stored in Supabase
  let row = null;
  if (supabase) {
    try {
      const { data, error } = await supabase.from('herbs').select('status, data').eq('name', key).maybeSingle();
      if (error) console.error(`[GATE ${GATE_VERSION}] row lookup failed:`, error.message);
      else row = data;
    } catch (e) { console.error(`[GATE ${GATE_VERSION}] row lookup failed:`, e.message); }
  }
  if (row) {
    if (row.status === 'rejected') return gateBlock(rawName, 'previously rejected');
    if (row.status === 'pending') return { ok: true, name: key, saveStatus: 'complete', route: 'curated' };
    if (row.status === 'unclassified') return { ok: true, name: key, saveStatus: 'unclassified', route: 'unclassified' };
    if (row.data && row.data._gate === 'herbal') return { ok: true, name: key, saveStatus: 'complete', route: 'approved' };
  }

  // 4. Ask the classifier once
  let result;
  try {
    result = await classifyName(anthropic, rawName.trim());
  } catch (e) {
    console.error(`[GATE ${GATE_VERSION}] classifier failed for "${rawName}":`, e.message);
    return {
      ok: false,
      response: {
        statusCode: 503,
        headers: { 'Content-Type': 'application/json', 'X-Herbadex-Gate': GATE_VERSION },
        body: JSON.stringify({ error: 'check_failed', message: `We couldn't check "${rawName.trim()}" right now — please try again in a moment.`, gate: GATE_VERSION })
      }
    };
  }

  if (result.verdict !== 'herbal') {
    await rememberRejection(key, result.verdict, row);
    return gateBlock(rawName, `classifier said ${result.verdict}`);
  }

  // Herbal. Is it a spelling or variant of something already in the catalog?
  const canonical = result.canonical && result.canonical.length <= 60 && /\p{L}/u.test(result.canonical) ? result.canonical : '';
  if (canonical) {
    let match = findInCatalog(canonical);
    if (!match) {
      const { herb, score } = closestCatalogHerb(canonical);
      if (herb && score >= 0.85) match = herb;
    }
    if (match) {
      console.log(`[GATE ${GATE_VERSION}] "${rawName}" → catalog herb "${match.name}"`);
      return { ok: true, name: String(match.name).trim().toLowerCase(), saveStatus: 'complete', route: 'catalog-alias' };
    }
  }

  // Herbal, not in the catalog. Keep an existing profile if there is one.
  if (row && row.data && row.data.name) {
    try {
      const { error } = await supabase.from('herbs').update({ data: { ...row.data, _gate: 'herbal' } }).eq('name', key);
      if (error) console.error(`[GATE ${GATE_VERSION}] approval flag save failed:`, error.message);
    } catch (e) {}
    return { ok: true, name: key, saveStatus: row.status === 'unclassified' ? 'unclassified' : 'complete', route: 'approved' };
  }

  console.log(`[GATE ${GATE_VERSION}] "${rawName}" is herbal but not in the catalog — generating as unclassified`);
  return { ok: true, name: canonical ? canonical.toLowerCase() : key, saveStatus: 'unclassified', route: 'unclassified' };
}
// ══════════════════════ END HERBADEX GATE v4 ══════════════════════════════

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
    let name = herbName.trim().toLowerCase();
    const serverKey = process.env.ANTHROPIC_API_KEY;
    const apiKey = serverKey || previewApiKey;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY' }) };
    }
    const anthropic = new Anthropic({ apiKey });

    // HERBADEX GATE v4 — runs before the cache so cached junk is never served.
    const gate = await checkHerbGate(herbName, anthropic);
    if (!gate.ok) return gate.response;
    name = gate.name;

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

    if (cachedRow && (cachedRow.status === 'complete' || cachedRow.status === 'unclassified') && cachedRow.data && cachedRow.data.name) {
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
          supabase.from('herbs').upsert({ name, status: cachedRow.status, data: cachedRow.data }, { onConflict: 'name' }).then(
            () => {}, e => console.error('healed-row save failed:', e.message)
          );
        }
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'X-Cache': healed ? 'repaired' : 'hit', 'X-Herbadex-Gate': `${GATE_VERSION}/${gate.route}` },
          body: JSON.stringify(cachedRow.data)
        };
      }
    }

    // If herb exists but is pending (in the 2,500 list), generate it now
    if (cachedRow && cachedRow.status === 'pending') {
      console.log(`Generating pending herb: ${name}`);
      // Fall through to generation logic below
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

    herb._gate = 'herbal';
    if (gate.saveStatus === 'unclassified') herb._unclassified = true;

    if (supabase) {
      try {
        let { error: saveErr } = await supabase.from('herbs').upsert({ name, status: gate.saveStatus, data: herb }, { onConflict: 'name' });
        if (saveErr && gate.saveStatus !== 'complete') {
          console.error(`[GATE ${GATE_VERSION}] could not save status '${gate.saveStatus}' (${saveErr.message}) — saving as 'complete' so the profile is still cached`);
          ({ error: saveErr } = await supabase.from('herbs').upsert({ name, status: 'complete', data: herb }, { onConflict: 'name' }));
        }
        if (saveErr) console.error('Supabase write failed:', saveErr.message);
      } catch (e) {
        console.error('Supabase write failed:', e.message);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'X-Herbadex-Gate': `${GATE_VERSION}/${gate.route}` },
      body: JSON.stringify(herb)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
