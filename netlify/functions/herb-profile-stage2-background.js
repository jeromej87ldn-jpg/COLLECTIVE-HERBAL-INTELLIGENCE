const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
}

const STAGE2_PROMPT = `You are the Herbadex — CHI's deep herb knowledge engine.
Provide the rich, deep profile for the requested herb. Return ONLY valid JSON:
{
  "origin": "native region or origin",
  "tradition": "primary healing tradition(s) (e.g. Ayurvedic, TCM, Western)",
  "spiritualHistory": {
    "overview": "1 rich paragraph (3-4 sentences) on spiritual/shamanic/religious/cultural significance",
    "timeline": [
      {"era":"time period or culture","text":"one short sentence on use/knowledge"}
    ]
  },
  "modernUse": "1 paragraph on current research and modern applications",
  "compounds": [
    {"name":"compound","role":"one short phrase","strength":0-100}
  ],
  "bodyEffects": [
    {"system":"body system","effect":"one short phrase"}
  ],
  "preparation": {
    "tea": "method and dose or null",
    "tincture": "method and dose or null",
    "capsule": "dose or null",
    "topical": "method or null",
    "smoke": "method or null",
    "traditional": "traditional preparation method if any"
  },
  "rareFact": "one genuinely surprising fact, one sentence",
  "interactions": ["known drug or herb interactions - max 3"],
  "forumSeed": [
    {"user":"Name","initials":"XX","rating":5,"comment":"realistic user experience"},
    {"user":"Name","initials":"XX","rating":4,"comment":"realistic user experience"}
  ]
}

Limits: timeline max 2, compounds max 4, bodyEffects max 4, interactions max 3, forumSeed exactly 2.`;

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

async function requestStage2(anthropic, userMessage, attempt = 1) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1400,
    system: STAGE2_PROMPT,
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
      return requestStage2(anthropic, userMessage, 2);
    }
    return { error: 'Model response was not valid JSON', stopReason: message.stop_reason };
  }
}

// ── BACKGROUND FUNCTION ────────────────────────────────────────────
// Generates Stage 2 (rich depth) in the background and saves to Supabase.
// The client already has Stage 1 (essentials) and will poll or refetch
// to get Stage 2 once it's ready.
exports.handler = async (event) => {
  let name = '';
  try {
    const { herbName, excludedHerb, issues, stage1 } = JSON.parse(event.body || '{}');
    if (!herbName || !herbName.trim()) return;
    name = herbName.trim().toLowerCase();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('herb-profile-stage2: missing ANTHROPIC_API_KEY');
      return;
    }

    const anthropic = new Anthropic({ apiKey });
    const userMsg = buildUserMessage(name, excludedHerb, issues);
    const stage2 = await requestStage2(anthropic, userMsg);

    if (stage2.error) {
      console.error('herb-profile-stage2: generation failed for', name, stage2.error);
      return;
    }

    // Merge Stage 1 + Stage 2 and save as 'complete'
    if (supabase) {
      const merged = { ...stage1, ...stage2, stage2Status: 'complete' };
      await supabase.from('herbs').upsert({
        name,
        data: merged,
        status: 'complete'
      });
    }
  } catch (error) {
    console.error('herb-profile-stage2: unexpected error for', name, error.message);
  }
};
