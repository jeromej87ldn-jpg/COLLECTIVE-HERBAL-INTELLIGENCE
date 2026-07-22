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

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Broad concern: ${issue.trim()}` }]
    });

    const textBlock = message.content.find(block => block.type === 'text');
    if (!textBlock || !textBlock.text) {
      return { statusCode: 502, body: JSON.stringify({ error: 'No text content in model response' }) };
    }

    const raw = textBlock.text.trim()
      .replace(/^```json\s*/, '')
      .replace(/\s*```$/, '');

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Model response was not valid JSON', raw: raw.slice(0, 300) })
      };
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
