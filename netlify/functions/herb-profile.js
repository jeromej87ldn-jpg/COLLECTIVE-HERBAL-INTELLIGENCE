const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const SYSTEM_PROMPT = `You are the Herbadex — CHI's deep herb knowledge engine.
You provide the FULLEST possible profile of any herb requested.
The SPIRITUAL and ENERGETIC history is THE MAIN FEATURE — prioritise it.
Go deep into ancient use, shamanic and religious traditions, folklore, mythology.
Also cover: full modern research, active compounds, preparation methods, body system effects.

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
    "overview": "3-4 paragraph deep exploration of the herb's spiritual, shamanic, religious and cultural significance across all traditions that used it",
    "timeline": [
      {"era":"time period or culture","text":"what they knew/used it for"}
    ]
  },
  "modernUse": "2-3 paragraphs on current research and applications",
  "compounds": [{"name":"compound","role":"what it does","strength":0-100}],
  "bodyEffects": [{"system":"body system","effect":"what it does there"}],
  "preparation": {
    "tea": "method and dose or null",
    "tincture": "method and dose or null",
    "capsule": "dose or null",
    "topical": "method or null",
    "smoke": "method or null",
    "traditional": "any traditional preparation method"
  },
  "rareFact": "one genuinely surprising fact",
  "interactions": ["list of known drug/herb interactions"],
  "forumSeed": [
    {"user":"Name","initials":"XX","rating":5,"comment":"realistic user experience comment"},
    {"user":"Name","initials":"XX","rating":4,"comment":"realistic user experience comment"},
    {"user":"Name","initials":"XX","rating":5,"comment":"realistic comment including something funny or surprising"}
  ]
}`;

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
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Provide the full deep profile for: ${herbName.trim()}` }]
    });

    const raw = message.content[0].text.trim()
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '');
    const herb = JSON.parse(raw);

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
