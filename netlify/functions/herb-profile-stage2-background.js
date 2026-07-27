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
Provide rich, detailed profile for the requested herb. Return ONLY valid JSON:
{
  "spiritualHistory": {
    "overview": "1 rich paragraph (3-4 sentences) on spiritual/shamanic/religious/cultural significance",
    "timeline": [
      {"era":"time period or culture","text":"one short sentence on use/knowledge"}
    ]
  },
  "modernUse": "1 paragraph on current research and modern applications",
  "compounds": [
    {"name":"compound name","mechanism":"detailed mechanism of action (1-2 sentences)","evidence":"scientific evidence or traditional use note"}
  ],
  "herbalActions": [
    {"name":"action name","description":"detailed how this action works in 1-2 sentences","compounds":["compound1","compound2"]}
  ],
  "rareFact": "one genuinely surprising fact, one sentence",
  "forumSeed": [
    {"user":"Name","initials":"XX","rating":5,"comment":"realistic user experience"},
    {"user":"Name","initials":"XX","rating":4,"comment":"realistic user experience"}
  ]
}

Limits: timeline max 2, compounds max 4, herbalActions max 7, forumSeed exactly 2.
For compounds: add mechanism and evidence to match the compound names from Stage 1.
For herbalActions: expand descriptions and list key compounds that drive each action.`;

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
    return `The user rejected: ${excludedHerb}. They're looking for an herb that helps with: ${issues.join(', ')}. Find a different, complementary herb that addresses these issues better than ${excludedHerb}. Provide deep, rich details for: ${name}`;
  }
  return `Provide deep, rich details for: ${name}`;
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
// Filename ends in "-background" so Netlify runs this as an actual
// background function: it returns 202 immediately and gets up to 15
// minutes of execution time, instead of the ~10-26s a regular function
// gets. herb-profile.js's fire-and-forget dispatch used to call
// herb-profile-stage2.js (a regular function), which silently died mid-
// generation for anything slower than that limit — leaving Modern Use,
// spiritual history, and compound mechanisms permanently missing for
// that herb no matter how many times it was searched again. This file
// replaces that dispatch target; herb-profile-stage2.js is no longer
// called and can be removed once this is confirmed working.
// Generates Stage 2 (rich depth) in the background and saves to Supabase.
// The client already has Stage 1 (essentials) and will poll for Stage 2 once ready.
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
      // Merge compounds: combine Stage 1 basic info with Stage 2 detailed mechanisms
      let mergedCompounds = stage1.compounds || [];
      if (stage2.compounds && stage2.compounds.length) {
        mergedCompounds = mergedCompounds.map(c1 => {
          const c2 = stage2.compounds.find(x => x.name === c1.name);
          return c2 ? { ...c1, ...c2 } : c1;
        });
      }

      // Merge herbal actions: combine Stage 1 basic with Stage 2 detailed descriptions
      let mergedActions = stage1.herbalActions || [];
      if (stage2.herbalActions && stage2.herbalActions.length) {
        mergedActions = mergedActions.map(a1 => {
          const a2 = stage2.herbalActions.find(x => x.name === a1.name);
          return a2 ? { ...a1, ...a2 } : a1;
        });
      }

      const merged = {
        ...stage1,
        ...stage2,
        compounds: mergedCompounds,
        herbalActions: mergedActions,
        stage2Status: 'complete'
      };

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
