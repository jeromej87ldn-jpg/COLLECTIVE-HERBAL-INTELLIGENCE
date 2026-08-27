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

const SYSTEM_PROMPT = `You are the Herbadex — CHI's herb knowledge engine.
Provide a complete, rich herb profile. Return ONLY valid JSON, no markdown fences, no explanation:
{
  "name": "common name", "latin": "latin binomial", "category": "primary action category",
  "categoryColor": "#hex", "origin": "native region", "tradition": "primary healing tradition(s)",
  "preparations": ["tea","tincture","capsule"], "safetyLevel": "Generally safe | Use with caution | Consult professional",
  "summary": "2 sentence overview, warm and plain",
  "functionalOverview": "2-3 sentence in-depth summary of what it does and how people use it",
  "source": "a real, verifiable citation or null if not genuinely confident one exists — never invent one",
  "spiritualHistory": { "overview": "3-4 sentence paragraph on cultural/spiritual significance", "timeline": [{"era":"period or culture","text":"one sentence"}] },
  "modernUse": "1-2 paragraph(s) on current research and modern applications",
  "compounds": [{"name":"compound name (e.g. baicalein, pabloside)","class":"Flavonoid | Alkaloid | Terpenoid | Saponin | Glycoside | Tannin | Polysaccharide | Phenolic acid","role":"plain English explanation of what it does (e.g. 'supports calming and anti-inflammatory effects')","mechanism":"1-2 sentences on HOW it works in the body (e.g. 'acts on GABA receptors to reduce nervous system activation')","evidence":"scientific evidence, traditional use records, or research studies backing this compound"}],
  "herbalActions": [{"name":"action name","system":"body system","description":"1-2 sentences","compounds":["compound name"]}],
  "bodyEffects": [{"system":"body system","effect":"short phrase"}],
  "preparation": {"tea":"or null","tincture":"or null","capsule":"or null","topical":"or null","traditional":"or null"},
  "rareFact": "one surprising fact, one sentence",
  "interactions": ["known interaction"]
}
Limits: compounds max 4, herbalActions max 4, bodyEffects max 4, interactions max 3, timeline max 3.
Do not invent user reviews, testimonials, or community experiences -- that content must come from real people, never be generated.
CRITICAL: Every compound MUST have ALL fields filled in -- name, class, role (plain English), mechanism (how it works), and evidence. Never leave fields empty or use placeholder text. Do not invent a numeric "strength" or confidence score for a compound -- that kind of precision cannot genuinely be measured or sourced, so the schema does not ask for one.
Return ONLY the JSON object. No other text.`;

// Field-completeness rules (REQUIRED_TEXT, REQUIRED_SECTIONS, findMissing,
// deriveFunctionalOverview) now live in ./profile-validation.js — pulled out
// so that logic has zero dependencies and can be unit-tested directly with
// plain node, without needing the Anthropic/Supabase SDKs or live API keys.

// Single attempt: this whole call has to finish inside one synchronous
// request/response, and a second full Sonnet call stacked onto the first
// is the other place (besides the now-removed always-on validation call)
// where a first-time generation could run past Netlify's function time
// limit. A profile that comes back with a gap isn't stuck — the heal-on-read
// path above already re-generates it the next time anyone views it, so this
// just moves the retry from "inside the same slow request" to "on the next,
// separate, fast-enough request."
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

// ── IMAGES (sourced, never AI-generated) ──
// NOT CURRENTLY CALLED from the handler below — an earlier version awaited
// this inline on every request (including cache hits), which risked
// blowing Netlify's function timeout on a handler that's deliberately
// single-call/synchronous (see note at top of file) and broke profile
// loading entirely. Left defined here, ready to be wired into a proper
// non-blocking path (e.g. a separate endpoint the frontend calls after
// the profile itself has already rendered) rather than inline again.
// A wrong-looking generated plant photo is a misidentification risk, so
// images come from Wikimedia Commons only, filtered to public-domain/CC
// licenses. Plants of the World Online (POWO) has no simple public
// image-search API, so it isn't wired in automatically — imagesNote flags
// herbs that need a manual POWO check when Wikimedia turns up nothing.
const WIKIMEDIA_USER_AGENT = 'CHI-Herbadex-Bot/1.0 (collectiveherbalintelligence.com; contact via site owner)';
// Wikimedia's real LicenseShortName values are space-separated — "CC BY-SA
// 4.0", "CC BY 3.0", "Public domain" — not hyphenated "CC-BY-SA" the way an
// earlier version of this list assumed. That mismatch silently rejected
// almost every real CC-licensed image. Matching is now done against a
// space/hyphen-stripped version of the license string so format
// variations ("CC BY-SA", "CC-BY-SA", "cc by sa") all match the same way.
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
      continue; // network hiccup or nothing found — try the next term
    }
    const pages = (data.query && data.query.pages) || {};
    for (const page of Object.values(pages)) {
      const info = (page.imageinfo && page.imageinfo[0]) || null;
      if (!info) continue;
      const meta = info.extmetadata || {};
      const licenseShort = (meta.LicenseShortName && meta.LicenseShortName.value) || '';
      if (!ACCEPTED_LICENSES.some(lic => normalizeLicense(licenseShort).includes(lic))) continue; // skip anything not public-domain/CC
      const artist = ((meta.Artist && meta.Artist.value) || 'Unknown').replace(/<[^>]+>/g, '').trim();
      const credit = `${artist} — ${licenseShort || 'Unknown license'} — Wikimedia Commons`;
      // thumburl is the properly-sized (800px-wide) rendition requested via
      // iiurlwidth; info.url is the raw original file, which can be huge
      // and slow to load. Fall back to the original only if no thumbnail
      // was generated (e.g. the source file is already small).
      results.push({ url: info.thumburl || info.url || '', credit });
      if (results.length >= maxImages) break;
    }
    if (results.length) break; // found via Latin name — no need to also try common name
  }
  return results;
}

function buildUserMessage(name, excludedHerb, issues) {
  if (excludedHerb && issues && issues.length > 0) {
    return `The user rejected: ${excludedHerb}. They're looking for an herb that helps with: ${issues.join(', ')}. Find a different, complementary herb that addresses these issues better than ${excludedHerb}. Provide the profile for: ${name}`;
  }
  return `Provide the profile for: ${name}`;
}

async function requestProfile(anthropic, name, userMessage, attempt = 1, priorMissing = null) {
  let content = userMessage;
  if (attempt > 1) content += '\n\nReturn ONLY the JSON object, with no other text before or after it.';
  if (priorMissing && priorMissing.length) {
    content += `\n\nYour previous attempt left these fields empty: ${priorMissing.join(', ')}. Make sure every one of those is fully populated this time — herbalActions and modernUse especially must not be empty.`;
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
  herb._missingFields = missing; // kept visible even on the final attempt rather than silently dropped
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

    // ── 1. CACHE CHECK (moved ahead of validation) ────────────────────
    // Checking the cache first means a repeat view of an already-good herb
    // costs one fast Supabase read and NOTHING else — no Haiku call, no
    // Sonnet call. That's the overwhelming majority of requests (anyone
    // re-opening a herb someone already generated), so this is the single
    // biggest lever for staying comfortably under Netlify's function time
    // limit. Previously validation ran on every request, including cache
    // hits, which stacked an extra API round-trip onto even the fastest
    // path and made an otherwise-instant cached view vulnerable to the
    // same timeout risk as a fresh generation.
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
      // Heal-on-read: older cached rows (generated before this fallback
      // existed) can still be missing functionalOverview. Patch it here
      // too, not just on fresh generations, and persist the fix so this
      // row doesn't need healing again next time.
      const before = cachedRow.data.functionalOverview;
      deriveFunctionalOverview(cachedRow.data);
      let healed = cachedRow.data.functionalOverview !== before;

      // Heal-on-read, part 2 -- REMOVED. This used to run a full,
      // synchronous Sonnet repair call on every cache-hit view whenever
      // herbalActions/compounds/bodyEffects (REQUIRED_SECTIONS) was empty
      // on the cached row -- true for a lot of pre-this-schema rows. That
      // turned an ordinary cached view into a 15-30s wait, and sometimes
      // a Netlify 504, on what's supposed to be the fast path (one DB
      // read). Gaps in cached data are shown via the frontend's
      // chi-fallbacks.js placeholders instead. Herbs can still be
      // repaired individually -- just not automatically on every view.

      // Image healing removed from this synchronous path — an external
      // Wikimedia call here, on every cache-hit view, risked pushing
      // requests past Netlify's function timeout (this handler is
      // deliberately single-call/synchronous; see note at top of file).
      // Images need a non-blocking approach — see fetchHerbImages below,
      // currently unused pending that redesign.

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
    // No more 'generating' status to check for — a request either hasn't
    // started, is running right now (this same call), or is done. Nothing
    // gets left in limbo between requests anymore.

    // ── 2. VALIDATE IT'S ACTUALLY AN HERB ─────────────────────────────
    // Only reached on a genuine cache miss now — no point spending a Haiku
    // call re-validating something already confirmed good and sitting in
    // the cache (see reordering note above). This still catches legacy bad
    // rows (e.g. "cabbage") the moment anyone re-searches them, since the
    // cache-hit branch above only returns early for status:'complete' —
    // anything else falls through to here and gets checked before a Sonnet
    // call would ever be spent generating a fake profile for it.
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
      if (verdict.startsWith('no')) {
        // Self-heal: if a bad profile for this name is already cached
        // (generated before this gate existed), remove it so it can't
        // keep being served on some other code path later.
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
      // If the check itself errors or returns something unparseable, we
      // fail open (proceed) rather than blocking a real herb search
      // because of a flaky classification call.
    } catch (validationErr) {
      console.error('Herb validation check failed, proceeding anyway:', validationErr.message);
    }

    // ── 3. GENERATE (single synchronous call — no background dispatch) ──
    const userMsg = buildUserMessage(name, excludedHerb, issues);
    const herb = await requestProfile(anthropic, name, userMsg);

    if (herb.error) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Generation failed: ' + herb.error }) };
    }

    deriveFunctionalOverview(herb);

    // Image fetch removed from this synchronous path for the same reason as
    // the cache-hit path above — see fetchHerbImages, currently unused.
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
