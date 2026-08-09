const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

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
  "compounds": [{"name":"compound","class":"Flavonoid | Alkaloid | Terpenoid | Saponin | Glycoside | Tannin | Polysaccharide | Phenolic acid","role":"short phrase","strength":0-100,"mechanism":"1-2 sentences","evidence":"evidence or traditional note"}],
  "herbalActions": [{"name":"action name","system":"body system","description":"1-2 sentences","compounds":["compound name"]}],
  "bodyEffects": [{"system":"body system","effect":"short phrase"}],
  "preparation": {"tea":"or null","tincture":"or null","capsule":"or null","topical":"or null","smoke":"or null","traditional":"or null"},
  "rareFact": "one surprising fact, one sentence",
  "interactions": ["known interaction"],
  "forumSeed": [{"user":"Name","initials":"XX","rating":5,"comment":"realistic experience"},{"user":"Name","initials":"XX","rating":4,"comment":"realistic experience"}]
}
Limits: compounds max 4, herbalActions max 4, bodyEffects max 4, interactions max 3, timeline max 3, forumSeed exactly 2.
Return ONLY the JSON object. No other text.`;

// herbalActions/compounds/bodyEffects have no fallback now that there's
// no Stage 1 — if they're empty here, they're empty everywhere. Same for
// spiritualHistory/modernUse, which were always Stage-2-only content.
// functionalOverview is NOT in this list, even though it's a real field —
// it overlaps enough with summary/modernUse that the model sometimes
// treats it as redundant and skips it. Rather than spend a retry chasing
// a field we can reliably derive, deriveFunctionalOverview() below builds
// one from modernUse (or summary) whenever it comes back empty.
const REQUIRED_TEXT = ['name', 'latin', 'category', 'summary', 'safetyLevel'];
const REQUIRED_SECTIONS = ['herbalActions', 'compounds', 'bodyEffects'];
const REQUIRED_TEXT_SECTIONS = {
  spiritualHistory: h => h.spiritualHistory && h.spiritualHistory.overview && h.spiritualHistory.overview.trim(),
  modernUse: h => h.modernUse && h.modernUse.trim()
};
// Capped low (unlike the untimed browser tool's 3 attempts) because this
// whole call has to finish inside one synchronous request/response —
// every retry adds its full generation time to that same window.
const MAX_ATTEMPTS = 2;

function findMissing(h) {
  const missing = [];
  REQUIRED_TEXT.forEach(f => { if (!h[f] || !String(h[f]).trim()) missing.push(f); });
  REQUIRED_SECTIONS.forEach(f => { if (!Array.isArray(h[f]) || h[f].length === 0) missing.push(f); });
  Object.entries(REQUIRED_TEXT_SECTIONS).forEach(([f, check]) => { if (!check(h)) missing.push(f); });
  if (!h.preparation || Object.values(h.preparation).every(v => !v)) missing.push('preparation');
  return missing;
}

// If functionalOverview came back empty, build a serviceable one instead
// of showing "not recorded" — modernUse's opening is the closest existing
// content to what functionalOverview is meant to say, with summary as a
// second fallback if modernUse is somehow also missing.
function deriveFunctionalOverview(h) {
  if (h.functionalOverview && h.functionalOverview.trim()) return;
  if (h.modernUse && h.modernUse.trim()) {
    const sentences = h.modernUse.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
    h.functionalOverview = sentences.slice(0, 2).join(' ');
  } else if (h.summary && h.summary.trim()) {
    h.functionalOverview = h.summary.trim();
  }
}

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

    // ── 1. VALIDATE IT'S ACTUALLY AN HERB ────────────────────────────
    // This runs BEFORE the cache check, on every request, not just fresh
    // generations. That's deliberate: rows generated before this gate
    // existed (e.g. "cabbage") are already sitting in the cache as
    // fully-formed fake profiles, and a cache-hit path that skips
    // validation would keep serving them forever. Running the gate first
    // means a bad legacy row gets caught — and deleted — the next time
    // anyone searches it, instead of needing a manual database fix.
    // Cost/latency trade-off: one extra cheap Haiku call on every search,
    // including hits for real cached herbs. Worth it for a tool whose
    // whole premise is trustworthy dosing/safety info.
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

    // ── 2. CACHE CHECK ────────────────────────────────────────────────
    if (supabase) {
      try {
        const { data: row } = await supabase
          .from('herbs')
          .select('data, status')
          .eq('name', name)
          .maybeSingle();

        if (row && row.status === 'complete' && row.data && row.data.name) {
          // Heal-on-read: older cached rows (generated before this fallback
          // existed) can still be missing functionalOverview. Patch it here
          // too, not just on fresh generations, and persist the fix so this
          // row doesn't need healing again next time.
          const before = row.data.functionalOverview;
          deriveFunctionalOverview(row.data);
          if (row.data.functionalOverview !== before) {
            supabase.from('herbs').upsert({ name, status: 'complete', data: row.data }).then(
              () => {}, e => console.error('healed-row save failed:', e.message)
            );
          }
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'X-Cache': 'hit' },
            body: JSON.stringify(row.data)
          };
        }
        // No more 'generating' status to check for — a request either
        // hasn't started, is running right now (this same call), or is
        // done. Nothing gets left in limbo between requests anymore.
      } catch (cacheErr) {
        console.error('Supabase read failed:', cacheErr.message);
      }
    }

    // ── 3. GENERATE (single synchronous call — no background dispatch) ──
    const userMsg = buildUserMessage(name, excludedHerb, issues);
    const herb = await requestProfile(anthropic, name, userMsg);

    if (herb.error) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Generation failed: ' + herb.error }) };
    }

    deriveFunctionalOverview(herb);
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
