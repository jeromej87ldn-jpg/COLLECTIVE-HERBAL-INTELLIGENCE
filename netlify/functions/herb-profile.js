const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
}

// ── STAGE 1: Fast essentials + basic compounds/actions (Haiku, sync) ──────────
// Returns immediately: name, latin, category, summary, safety, preparations,
// functional overview, origin, tradition, basic compounds/actions, body effects
const STAGE1_PROMPT = `You are the Herbadex — CHI's herb knowledge engine.
Provide the essential profile for the requested herb. Return ONLY valid JSON:
{
  "name": "common name",
  "latin": "latin binomial",
  "category": "primary action category",
  "categoryColor": "#hex (e.g. #e8a840)",
  "summary": "2 sentence overview, warm and plain",
  "safetyLevel": "Generally safe | Use with caution | Consult professional",
  "preparations": ["tea","tincture","capsule","etc - list up to 4"],
  "functionalOverview": "2 sentence summary: what it does, how people use it",
  "source": "verifiable citation (e.g. 'Commission E Monograph') or null",
  "origin": "native region or origin",
  "tradition": "primary healing tradition(s) (e.g. Ayurvedic, TCM, Western)",
  "compounds": [
    {"name":"compound name","class":"compound class (e.g. Flavonoid, Alkaloid)","role":"primary action phrase","strength":0-100}
  ],
  "herbalActions": [
    {"name":"action name","system":"body system","description":"brief description"}
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
  "interactions": ["known drug or herb interactions - max 3"]
}

Limits: compounds max 4, herbalActions max 4, bodyEffects max 4, interactions max 3.`;

// ── STAGE 2: Rich depth (Sonnet, background) ──────────────────────────────────
// Returns later: spiritual history, detailed compound mechanisms/evidence,
// full herbal actions, modern use, rare fact, forum seed
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

const STALE_GENERATING_MS = 120000; // 2 minutes

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

// Stage 1: Haiku, fast, essentials + basic compounds/actions
async function requestStage1(anthropic, userMessage, attempt = 1) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 900,
    system: STAGE1_PROMPT,
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
      return requestStage1(anthropic, userMessage, 2);
    }
    return { error: 'Model response was not valid JSON', stopReason: message.stop_reason, raw: textBlock.text.trim().slice(0, 300) };
  }
}

// Stage 2: Sonnet, slower, detailed mechanisms/evidence/spiritual history
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
    return { error: 'Model response was not valid JSON', stopReason: message.stop_reason, raw: textBlock.text.trim().slice(0, 500) };
  }
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

    // ── 1. CACHE CHECK: if both stages are cached, return full data ──
    if (supabase) {
      try {
        const { data: row } = await supabase
          .from('herbs')
          .select('data, status')
          .eq('name', name)
          .maybeSingle();

        if (row && row.status === 'complete' && row.data && row.data.name) {
          return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'X-Cache': 'hit' },
            body: JSON.stringify(row.data)
          };
        }

        if (row && row.status === 'generating') {
          const startedAt = (row.data && row.data.generating_at) || 0;
          if (Date.now() - startedAt < STALE_GENERATING_MS) {
            return {
              statusCode: 202,
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'generating' })
            };
          }
        }

        if (row && row.status === 'error') {
          const message = (row.data && row.data.error) || 'Profile generation failed';
          try { await supabase.from('herbs').delete().eq('name', name); } catch (e) {}
          return { statusCode: 502, body: JSON.stringify({ error: message }) };
        }
      } catch (cacheErr) {
        console.error('Supabase read failed:', cacheErr.message);
      }
    }

    // ── 2. STAGE 1: Generate essentials (Haiku, sync) ──────────────────
    const apiKey = serverKey || previewApiKey;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY' }) };
    }
    const anthropic = new Anthropic({ apiKey });

    const userMsg = buildUserMessage(name, excludedHerb, issues);
    const stage1 = await requestStage1(anthropic, userMsg);

    if (stage1.error) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Stage 1 generation failed: ' + stage1.error }) };
    }

    // Prepare response with Stage 1 data and Stage 2 flag
    const response = {
      ...stage1,
      stage2Status: 'loading'
    };

    // ── 3. STAGE 2: Dispatch background Sonnet generation ───────────────
    const siteURL = process.env.URL || process.env.DEPLOY_PRIME_URL;
    if (supabase && serverKey && siteURL) {
      try {
        // Mark as 'generating' in database
        await supabase.from('herbs').upsert({
          name,
          status: 'generating',
          data: { ...response, generating_at: Date.now() }
        });

        // Fire off background Stage 2 generation
        fetch(`${siteURL}/.netlify/functions/herb-profile-stage2`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ herbName: name, excludedHerb, issues, stage1 })
        }).catch(e => console.error('Stage 2 background dispatch failed:', e.message));
      } catch (e) {
        console.error('Stage 2 background setup failed:', e.message);
      }
    }

    // Return Stage 1 immediately; client will poll for Stage 2
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
