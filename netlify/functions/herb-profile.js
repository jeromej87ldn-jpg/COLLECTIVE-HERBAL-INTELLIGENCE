const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

// ── STAGE 1 — fast essentials, ordinary synchronous call ──
// Option 4: back to two calls, but BOTH are plain client-driven requests —
// no background function, no 202/poll-for-'generating' limbo. The browser
// calls this endpoint first and renders it immediately, then calls
// herb-profile-stage2.js (also plain/synchronous) right after for the
// richer content. If Stage 2 fails or times out, the user still has a
// complete-enough profile on screen from this call — no blank page, no
// 504 covering the whole thing.
function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
}

const STAGE1_PROMPT = `You are the Herbadex — CHI's herb knowledge engine.
Provide the essentials of a herb profile. Return ONLY valid JSON, no markdown fences, no explanation:
{
  "name": "common name", "latin": "latin binomial", "category": "primary action category",
  "categoryColor": "#hex", "origin": "native region", "tradition": "primary healing tradition(s)",
  "preparations": ["tea","tincture","capsule"], "safetyLevel": "Generally safe | Use with caution | Consult professional",
  "summary": "2 sentence overview, warm and plain",
  "functionalOverview": "2-3 sentence in-depth summary of what it does and how people use it",
  "source": "a real, verifiable citation or null if not genuinely confident one exists — never invent one",
  "compounds": [{"name":"compound","class":"Flavonoid | Alkaloid | Terpenoid | Saponin | Glycoside | Tannin | Polysaccharide | Phenolic acid","role":"short phrase","strength":0-100}],
  "herbalActions": [{"name":"action name","system":"body system","description":"1-2 sentences"}],
  "bodyEffects": [{"system":"body system","effect":"short phrase"}],
  "preparation": {"tea":"or null","tincture":"or null","capsule":"or null","topical":"or null","smoke":"or null","traditional":"or null"},
  "interactions": ["known interaction"]
}
Limits: compounds max 4, herbalActions max 4, bodyEffects max 4, interactions max 3.
Return ONLY the JSON object. No other text.`;

// Only the three sections Jerome explicitly said must never come back
// empty. Text fields aren't chased with a retry here — Stage 1 has to stay
// fast, and functionalOverview has a deterministic fallback below anyway.
const REQUIRED_SECTIONS = ['herbalActions', 'compounds', 'bodyEffects'];
const MAX_ATTEMPTS = 2;

function findMissingSections(h) {
  return REQUIRED_SECTIONS.filter(f => !Array.isArray(h[f]) || h[f].length === 0);
}

// If functionalOverview came back empty, build a serviceable one from
// summary instead of showing "not recorded". (Stage 2 has no modernUse
// fallback source available yet at this point — Stage 1 only has summary.)
function deriveFunctionalOverview(h) {
  if (h.functionalOverview && h.functionalOverview.trim()) return;
  if (h.summary && h.summary.trim()) h.functionalOverview = h.summary.trim();
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
    return `The user rejected: ${excludedHerb}. They're looking for an herb that helps with: ${issues.join(', ')}. Find a different, complementary herb that addresses these issues better than ${excludedHerb}. Provide the essentials for: ${name}`;
  }
  return `Provide the essentials for: ${name}`;
}

async function requestStage1(anthropic, userMessage, attempt = 1) {
  let content = userMessage;
  if (attempt > 1) content += '\n\nReturn ONLY the JSON object, with no other text before or after it. Make sure herbalActions, compounds, and bodyEffects are all populated.';

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1800,
    system: STAGE1_PROMPT,
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
    if (attempt < MAX_ATTEMPTS) return requestStage1(anthropic, userMessage, attempt + 1);
    return { error: 'Model response was not valid JSON', stopReason: message.stop_reason, raw: textBlock.text.trim().slice(0, 300) };
  }

  if (findMissingSections(herb).length && attempt < MAX_ATTEMPTS) {
    return requestStage1(anthropic, userMessage, attempt + 1);
  }
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

    // ── 1. CACHE CHECK ────────────────────────────────────────────────
    if (supabase) {
      try {
        const { data: row } = await supabase
          .from('herbs')
          .select('data, status')
          .eq('name', name)
          .maybeSingle();

        if (row && row.status === 'complete' && row.data && row.data.name) {
          // Full profile already exists — nothing for Stage 2 to add.
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

        if (row && row.status === 'partial' && row.data && row.data.name) {
          // Stage 1 already ran for this herb (maybe an earlier visit's
          // Stage 2 call never finished). Reuse it instead of paying for
          // another Anthropic call — client will still call Stage 2.
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'X-Cache': 'partial' },
            body: JSON.stringify({ ...row.data, stage2Pending: true })
          };
        }
      } catch (cacheErr) {
        console.error('Supabase read failed:', cacheErr.message);
      }
    }

    // ── 2. GENERATE STAGE 1 ─────────────────────────────────────────────
    const apiKey = serverKey || previewApiKey;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY' }) };
    }
    const anthropic = new Anthropic({ apiKey });

    const userMsg = buildUserMessage(name, excludedHerb, issues);
    const herb = await requestStage1(anthropic, userMsg);

    if (herb.error) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Generation failed: ' + herb.error }) };
    }

    deriveFunctionalOverview(herb);

    if (supabase) {
      try {
        await supabase.from('herbs').upsert({ name, status: 'partial', data: herb });
      } catch (e) {
        console.error('Supabase write failed:', e.message);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...herb, stage2Pending: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
