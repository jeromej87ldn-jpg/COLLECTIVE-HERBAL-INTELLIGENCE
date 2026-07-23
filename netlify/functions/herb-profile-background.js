const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

// SUPABASE_URL is sometimes stored with a trailing /rest/v1/ path (a REST
// endpoint URL) rather than the bare project URL the JS client expects.
// Normalise it so createClient always gets the bare project URL.
function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
}

const SYSTEM_PROMPT = `You are the Herbadex — CHI's deep herb knowledge engine.
You provide a rich but CONCISE profile of any herb requested.
The SPIRITUAL and ENERGETIC history is THE MAIN FEATURE — prioritise it, but keep every field tight.
Go deep into ancient use, shamanic and religious traditions, folklore, mythology — in a compact way.
Also cover: modern research, active compounds, preparation methods, body system effects.

IMPORTANT: You must return complete, valid JSON that fits comfortably within 1400 output tokens.
Prioritise finishing valid JSON over exhaustive depth. Do not exceed the array/field limits below.

Return ONLY valid JSON:
{
  "name": "common name",
  "latin": "latin binomial",
  "category": "primary action category",
  "categoryColor": "#hex",
  "origin": "native region",
  "tradition": "primary healing tradition(s)",
  "preparations": ["tea","tincture","capsule","etc"],
  "safetyLevel": "Generally safe | Use with caution | Consult professional",
  "summary": "2 sentence overview",
  "functionalOverview": "2-3 sentence in-depth summary, plain and grounded (not mystical), on what the herb actually does, what it's commonly used for, and how it helps people",
  "source": "a real, verifiable citation for functionalOverview — a specific study, textbook, monograph or pharmacopoeia (e.g. 'Commission E Monograph' or a named clinical trial/journal). Use null if you are not genuinely confident a real citation exists — never invent one",
  "spiritualHistory": {
    "overview": "1 concise but rich paragraph (3-4 sentences) on the herb's spiritual, shamanic, religious and cultural significance",
    "timeline": [
      {"era":"time period or culture","text":"one short sentence on what they knew/used it for"}
    ]
  },
  "modernUse": "1 concise paragraph on current research and applications",
  "compounds": [{"name":"compound","role":"one short phrase","strength":0-100}],
  "bodyEffects": [{"system":"body system","effect":"one short phrase"}],
  "preparation": {
    "tea": "method and dose or null",
    "tincture": "method and dose or null",
    "capsule": "dose or null",
    "topical": "method or null",
    "smoke": "method or null",
    "traditional": "any traditional preparation method"
  },
  "rareFact": "one genuinely surprising fact, one sentence",
  "interactions": ["short list of known drug/herb interactions"],
  "forumSeed": [
    {"user":"Name","initials":"XX","rating":5,"comment":"short realistic user experience comment"},
    {"user":"Name","initials":"XX","rating":4,"comment":"short realistic user experience comment"}
  ]
}

Limits: timeline max 2 entries. compounds max 4 entries. bodyEffects max 4 entries. interactions max 3 entries. forumSeed exactly 2 entries.`;

// If a row has been stuck in 'generating' longer than this, assume the
// previous background job died and allow a fresh one to be kicked off.
const STALE_GENERATING_MS = 120000; // 2 minutes

// Builds the model prompt for a herb, optionally with the "user rejected X,
// suggest a better alternative" framing used by Herb Match's alternatives.
function buildUserMessage(name, excludedHerb, issues) {
  if (excludedHerb && issues && issues.length > 0) {
    return `The user rejected: ${excludedHerb}. They're looking for an herb that helps with: ${issues.join(', ')}. Find a different, complementary herb that addresses these issues better than ${excludedHerb}. Provide the full deep profile for: ${name}`;
  }
  return `Provide the full deep profile for: ${name}`;
}

// Claude occasionally wraps JSON in a code fence, or adds a short sentence
// before/after it despite being told to return JSON only. Rather than only
// stripping fences anchored at the very start/end of the string (which
// misses any leading/trailing prose), pull out the outermost {...} block
// and parse that instead.
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

// Ask the model for a herb profile. NOTE: this model rejects assistant-
// message prefill ("the conversation must end with a user message"), so a
// plain question/answer call is the only option. If parsing fails, retry
// once with an extra plain reminder appended to the user message.
async function requestProfile(anthropic, userMessage, attempt = 1) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1400,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: attempt === 1 ? userMessage : userMessage + '\n\nReturn ONLY the JSON object, with no other text before or after it.' }
    ]
  });

  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || !textBlock.text) {
    return { error: 'No text content in model response', stopReason: message.stop_reason };
  }

  try {
    return extractJson(textBlock.text);
  } catch (parseErr) {
    if (attempt === 1) {
      return requestProfile(anthropic, userMessage, 2);
    }
    return {
      error: 'Model response was not valid JSON',
      stopReason: message.stop_reason,
      raw: textBlock.text.trim().slice(0, 500)
    };
  }
}

// ── BACKGROUND FUNCTION ────────────────────────────────────────────
// Netlify runs any function whose filename ends in "-background" as a
// background job: it returns 202 immediately and may run for up to 15
// minutes. That's plenty for a full profile generation, so this is where
// the actual (potentially slow) model call happens. herb-profile.js
// triggers this, and the client polls herb-profile.js until the result
// this writes to Supabase is ready.
exports.handler = async (event) => {
  let name = '';
  try {
    const { herbName, excludedHerb, issues } = JSON.parse(event.body || '{}');
    if (!herbName || !herbName.trim()) return; // nothing to do
    name = herbName.trim().toLowerCase();

    // DIAGNOSTIC heartbeat — proves this background function actually
    // executed (written before the slow model call). Read by diag-bg.js.
    // Safe to remove once the background path is confirmed working.
    if (supabase) {
      try {
        await supabase.from('herbs').upsert({
          name: '__bg_heartbeat__',
          status: 'complete',
          data: { name: '__bg_heartbeat__', ranAt: new Date().toISOString(), forHerb: name }
        });
      } catch (e) { console.error('heartbeat write failed:', e.message); }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('herb-profile-background: missing ANTHROPIC_API_KEY');
      if (supabase) await supabase.from('herbs').upsert({ name, status: 'error', data: { error: 'Server is missing ANTHROPIC_API_KEY' } });
      return;
    }

    const anthropic = new Anthropic({ apiKey });
    const herb = await requestProfile(anthropic, buildUserMessage(name, excludedHerb, issues));

    if (herb.error) {
      console.error('herb-profile-background: generation failed for', name, herb.error);
      if (supabase) await supabase.from('herbs').upsert({ name, status: 'error', data: { error: herb.error } });
      return;
    }

    if (supabase) {
      await supabase.from('herbs').upsert({ name, data: herb, status: 'complete' });
    }
  } catch (error) {
    console.error('herb-profile-background: unexpected error for', name, error.message);
    try {
      if (supabase && name) await supabase.from('herbs').upsert({ name, status: 'error', data: { error: error.message } });
    } catch (e) {}
  }
};
