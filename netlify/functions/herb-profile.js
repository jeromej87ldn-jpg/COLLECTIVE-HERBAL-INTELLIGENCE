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
  "functionalOverview": "3-5 sentence in-depth paragraph, plain and grounded (not mystical), on what the herb actually does, what it's commonly used for, and how it helps people",
  "source": "a real, verifiable citation for functionalOverview — a specific study, textbook, monograph or pharmacopoeia (e.g. 'Commission E Monograph' or a named clinical trial/journal). Use null if you are not genuinely confident a real citation exists — never invent one",
  "spiritualHistory": {
    "overview": "2 concise paragraphs on the herb's spiritual, shamanic, religious and cultural significance",
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

Limits: timeline max 3 entries. compounds max 4 entries. bodyEffects max 4 entries. interactions max 4 entries. forumSeed exactly 2 entries.`;

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

// Ask the model for a herb profile. If the response isn't parseable JSON,
// retry once with an assistant-turn prefill of '{' — this strongly biases
// Claude to continue directly as JSON with no surrounding commentary.
async function requestProfile(anthropic, userMessage, attempt = 1) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1800,
    system: SYSTEM_PROMPT,
    messages: attempt === 1
      ? [{ role: 'user', content: userMessage }]
      : [
          { role: 'user', content: userMessage },
          { role: 'assistant', content: '{' },
        ]
  });

  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || !textBlock.text) {
    return { error: 'No text content in model response', stopReason: message.stop_reason };
  }

  const rawText = attempt === 1 ? textBlock.text : '{' + textBlock.text;

  try {
    return extractJson(rawText);
  } catch (parseErr) {
    if (attempt === 1) {
      return requestProfile(anthropic, userMessage, 2);
    }
    return {
      error: 'Model response was not valid JSON',
      stopReason: message.stop_reason,
      raw: rawText.trim().slice(0, 500)
    };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // TEMP — PREVIEW TESTING ONLY. Remove `previewApiKey` handling below
    // (and the matching text box in phytochemistry.html) before launch.
    const { herbName, previewApiKey, excludedHerb, issues } = JSON.parse(event.body || '{}');
    if (!herbName || !herbName.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'herbName is required' }) };
    }
    const name = herbName.trim().toLowerCase();
    const apiKey = process.env.ANTHROPIC_API_KEY || previewApiKey;
    // END TEMP

    // Check Supabase cache first (best-effort — if this fails for any
    // reason we just fall through to generating fresh data).
    if (supabase) {
      try {
        const { data: existing } = await supabase
          .from('herbs')
          .select('data, status')
          .eq('name', name)
          .eq('status', 'complete')
          .maybeSingle();

        if (existing && existing.data) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'X-Cache': 'hit' },
            body: JSON.stringify(existing.data)
          };
        }
      } catch (cacheErr) {
        console.error('Supabase read failed, continuing without cache:', cacheErr.message);
      }
    }

    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY' }) };
    }
    const anthropic = new Anthropic({ apiKey });

    // Build user message with exclusion context for alternatives
    let userMessage = `Provide the full deep profile for: ${name}`;
    if (excludedHerb && issues && issues.length > 0) {
      userMessage = `The user rejected: ${excludedHerb}. They're looking for an herb that helps with: ${issues.join(', ')}. Find a different, complementary herb that addresses these issues better than ${excludedHerb}. Provide the full deep profile for: ${name}`;
    }

    const herb = await requestProfile(anthropic, userMessage);
    if (herb.error) {
      return { statusCode: 502, body: JSON.stringify(herb) };
    }

    // Save to Supabase (best-effort — a caching failure shouldn't fail
    // the user's request, since they already have their herb data).
    if (supabase) {
      try {
        await supabase.from('herbs').upsert({
          name,
          data: herb,
          status: 'complete'
        });
      } catch (saveErr) {
        console.error('Supabase write failed:', saveErr.message);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'X-Cache': 'miss' },
      body: JSON.stringify(herb)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
