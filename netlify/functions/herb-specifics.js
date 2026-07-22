const Anthropic = require('@anthropic-ai/sdk');

// Given one broad wellness concern (e.g. "Stress"), return a handful of
// more specific, plain-language variations so the person can narrow in on
// what actually fits their situation before we go looking for herbs.
const SYSTEM_PROMPT = `You help refine a herbal wellness search.
Given one broad wellness concern, return 4-6 short, specific, plain-language
variations of that concern so a person can pick whichever one best matches
their own situation. Think of these as gentle follow-up questions phrased as
options, not clinical sub-diagnoses. Keep each one under 8 words, warm and
conversational in tone, never medical-sounding.

Return ONLY valid JSON:
{"specifics": ["...", "...", "...", "..."]}`;

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

// Ask the model for specifics. If the response isn't parseable JSON, retry
// once with an assistant-turn prefill of '{' — this strongly biases Claude
// to continue directly as JSON with no surrounding commentary.
async function requestSpecifics(anthropic, issue, attempt = 1) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: attempt === 1
      ? [{ role: 'user', content: `Broad concern: ${issue}` }]
      : [
          { role: 'user', content: `Broad concern: ${issue}` },
          { role: 'assistant', content: '{' },
        ]
  });

  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || !textBlock.text) {
    return { error: 'No text content in model response' };
  }

  const rawText = attempt === 1 ? textBlock.text : '{' + textBlock.text;

  try {
    return extractJson(rawText);
  } catch (parseErr) {
    if (attempt === 1) {
      return requestSpecifics(anthropic, issue, 2);
    }
    return { error: 'Model response was not valid JSON', raw: rawText.trim().slice(0, 300) };
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { issue } = JSON.parse(event.body || '{}');
    if (!issue || !issue.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'issue is required' }) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY' }) };
    }
    const anthropic = new Anthropic({ apiKey });

    const parsed = await requestSpecifics(anthropic, issue.trim());
    if (parsed.error) {
      return { statusCode: 502, body: JSON.stringify(parsed) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ specifics: parsed.specifics || [] })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
