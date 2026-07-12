const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { herbName } = JSON.parse(event.body || '{}');
    if (!herbName || !herbName.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'herbName is required' }) };
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY' }) };
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Provide the full deep profile for: ${herbName.trim()}` }]
    });

    const textBlock = message.content.find(block => block.type === 'text');
    if (!textBlock || !textBlock.text) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'No text content in model response', stopReason: message.stop_reason })
      };
    }

    const raw = textBlock.text.trim()
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '');

    let herb;
    try {
      herb = JSON.parse(raw);
    } catch (parseErr) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Model response was not valid JSON', stopReason: message.stop_reason, raw: raw.slice(0, 500) })
      };
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
