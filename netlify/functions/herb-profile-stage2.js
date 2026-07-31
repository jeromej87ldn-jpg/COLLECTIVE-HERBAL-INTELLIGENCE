const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

// ── STAGE 2 — rich depth, ordinary synchronous call (NOT background) ──
// The client calls this directly, right after Stage 1 renders, and awaits
// it like any normal request. No fire-and-forget dispatch, no Supabase
// 'generating' status, no polling. If this call is slow enough to hit
// Netlify's sync timeout, the client gets a normal failed fetch it can
// catch — Stage 1's content just stays on screen instead. That's the
// whole point of splitting these two calls: a Stage 2 failure now costs
// the rich detail, not the entire profile.
function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
}

const STAGE2_PROMPT = `You are the Herbadex — CHI's deep herb knowledge engine.
Provide rich, detailed profile content for the requested herb. Return ONLY valid JSON:
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
Limits: timeline max 2, compounds max 4, herbalActions max 4, forumSeed exactly 2.
For compounds: match the compound names given in Stage 1 and add mechanism + evidence.
For herbalActions: match the action names given in Stage 1, expand the description, and list key compounds that drive each action.`;

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

function buildUserMessage(name, stage1, excludedHerb, issues) {
  const knownCompounds = (stage1.compounds || []).map(c => c.name).join(', ');
  const knownActions = (stage1.herbalActions || []).map(a => a.name).join(', ');
  const context = `Stage 1 already identified these compounds: [${knownCompounds}] and these herbal actions: [${knownActions}].`;
  if (excludedHerb && issues && issues.length > 0) {
    return `The user rejected: ${excludedHerb}. They're looking for an herb that helps with: ${issues.join(', ')}. Provide deep, rich details for: ${name}, a complementary alternative to ${excludedHerb}. ${context}`;
  }
  return `Provide deep, rich details for: ${name}. ${context}`;
}

async function requestStage2(anthropic, userMessage, attempt = 1) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1600,
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
    if (attempt === 1) return requestStage2(anthropic, userMessage, 2);
    return { error: 'Model response was not valid JSON', stopReason: message.stop_reason };
  }
}

// functionalOverview should already be set by Stage 1 (direct or derived
// from summary) — this is only a defensive backstop in case it somehow
// still isn't, now that modernUse is available as a second fallback source.
function deriveFunctionalOverview(h) {
  if (h.functionalOverview && h.functionalOverview.trim()) return;
  if (h.modernUse && h.modernUse.trim()) {
    const sentences = h.modernUse.trim().split(/(?<=[.!?])\s+/).filter(Boolean);
    h.functionalOverview = sentences.slice(0, 2).join(' ');
  } else if (h.summary && h.summary.trim()) {
    h.functionalOverview = h.summary.trim();
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let name = '';
  try {
    const { herbName, excludedHerb, issues, stage1 } = JSON.parse(event.body || '{}');
    if (!herbName || !herbName.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'herbName is required' }) };
    }
    if (!stage1 || !stage1.name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'stage1 profile is required' }) };
    }
    name = herbName.trim().toLowerCase();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY' }) };
    }

    const anthropic = new Anthropic({ apiKey });
    const userMsg = buildUserMessage(name, stage1, excludedHerb, issues);
    const stage2 = await requestStage2(anthropic, userMsg);

    if (stage2.error) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Stage 2 generation failed: ' + stage2.error }) };
    }

    // Merge Stage 1 + Stage 2: combine Stage 1's basic compound/action
    // entries with Stage 2's detailed mechanisms/descriptions, matched by
    // name. Anything Stage 2 didn't return a match for keeps its Stage 1
    // version rather than disappearing.
    let mergedCompounds = stage1.compounds || [];
    if (stage2.compounds && stage2.compounds.length) {
      mergedCompounds = mergedCompounds.map(c1 => {
        const c2 = stage2.compounds.find(x => x.name === c1.name);
        return c2 ? { ...c1, ...c2 } : c1;
      });
    }

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
      herbalActions: mergedActions
    };
    delete merged.stage2Pending;
    deriveFunctionalOverview(merged);
    merged.generatedAt = new Date().toISOString();

    if (supabase) {
      try {
        await supabase.from('herbs').upsert({ name, status: 'complete', data: merged });
      } catch (e) {
        console.error('Supabase write failed:', e.message);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged)
    };
  } catch (error) {
    console.error('herb-profile-stage2: unexpected error for', name, error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
