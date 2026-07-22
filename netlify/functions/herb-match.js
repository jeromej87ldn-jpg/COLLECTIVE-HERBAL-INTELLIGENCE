const Anthropic = require('@anthropic-ai/sdk');

// Given a person's selected concerns (and optional specifics), return a
// genuinely varied spread of candidate herbs — not just the same handful
// of famous names every time — while respecting an "avoid" list of herbs
// the person already owns or has seen recently.
const SYSTEM_PROMPT = `You are the Herbadex matching engine.

A person has described what they'd like herbal support with. Recommend a
genuinely varied spread of herbs. Do not default to the same small set of
famous herbs every time (e.g. reaching for ashwagandha for every stress
query, or valerian for every sleep query) unless one is truly the strongest
fit — actively look past the obvious choices. Draw broadly across global
herbal traditions (Western, Ayurvedic, Traditional Chinese, folk and
indigenous herbalism) and include at least one or two lesser-known options
alongside any classic choices, so the person discovers something new each
time.

If an "avoid" list is provided, those are herbs the person already knows
well or has been shown recently. Only include one of them if nothing else
is a comparably strong fit, and never include more than one in a single
response.

Return ONLY valid JSON:
{
  "herbs": [
    {
      "name": "common name",
      "latin": "latin binomial",
      "matchReason": "one short, warm, plain-language sentence on why this fits their specific situation",
      "matchStrength": "strong | good | worth exploring"
    }
  ]
}
Return exactly the requested count of herbs. Every herb in the list must be distinct.`;

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

// Ask the model for herbs. NOTE: this model rejects assistant-message
// prefill ("the conversation must end with a user message"), so we can't
// force JSON-only output that way — a plain question/answer call is the
// only option here. If parsing fails, we retry once with an extra plain
// reminder appended to the user message.
async function requestHerbs(anthropic, userMsg, attempt = 1) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1600,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: attempt === 1 ? userMsg : userMsg + '\n\nReturn ONLY the JSON object, with no other text before or after it.' }
    ]
  });

  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || !textBlock.text) {
    return { error: 'No text content in model response' };
  }

  try {
    return extractJson(textBlock.text);
  } catch (parseErr) {
    if (attempt === 1) {
      return requestHerbs(anthropic, userMsg, 2);
    }
    return { error: 'Model response was not valid JSON', raw: textBlock.text.trim().slice(0, 500) };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { issues, specifics, avoid, count } = JSON.parse(event.body || '{}');
    if (!issues || !Array.isArray(issues) || !issues.length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'issues is required' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY' }) };
    }
    const anthropic = new Anthropic({ apiKey });

    const n = Math.max(1, Math.min(10, Number(count) || 8));
    const avoidList = Array.isArray(avoid) ? avoid.filter(Boolean) : [];

    const userMsg = [
      `Concerns: ${issues.join(', ')}`,
      (specifics && specifics.length) ? `Specifics the person picked: ${specifics.join(', ')}` : null,
      avoidList.length ? `Avoid defaulting to (already familiar or shown recently): ${avoidList.join(', ')}` : null,
      `Return exactly ${n} herb(s).`
    ].filter(Boolean).join('\n');

    const parsed = await requestHerbs(anthropic, userMsg);
    if (parsed.error) {
      return { statusCode: 502, body: JSON.stringify(parsed) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ herbs: parsed.herbs || [] })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
