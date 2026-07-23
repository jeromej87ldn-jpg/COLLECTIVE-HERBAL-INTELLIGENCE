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

// Ask the model for one batch of herbs.
// MODEL CHOICE: Haiku, deliberately — not Sonnet. Sonnet calls run long
// enough to blow the serverless function's execution limit, which showed up
// as a bodiless 502 (the function killed mid-run, before our try/catch could
// return anything). The one part of the app that already used Haiku — the
// follow-up-questions endpoint — is also the one that kept working. Herb
// matching is a light task, so Haiku is both fast enough to finish well
// inside the limit and perfectly capable here.
// NOTE: this model rejects assistant-message prefill, so a plain
// question/answer call is the only option. If parsing fails, retry once with
// an extra plain reminder appended to the user message.
async function requestBatch(anthropic, userMsg, attempt = 1) {
  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: attempt === 1 ? userMsg : userMsg + '\n\nReturn ONLY the JSON object, with no other text before or after it.' }
    ]
  });

  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || !textBlock.text) {
    return { herbs: [], diag: { reason: 'no text block', stopReason: message.stop_reason } };
  }

  try {
    const parsed = extractJson(textBlock.text);
    return { herbs: Array.isArray(parsed.herbs) ? parsed.herbs : [] };
  } catch (parseErr) {
    if (attempt === 1) {
      return requestBatch(anthropic, userMsg, 2);
    }
    // Final failure — carry back WHY so the 502 is self-explaining instead
    // of a generic "not valid JSON". stopReason 'max_tokens' means the JSON
    // was truncated; otherwise the raw snippet shows prose/refusal/etc.
    return {
      herbs: [],
      diag: {
        reason: 'json parse failed',
        stopReason: message.stop_reason,
        rawSnippet: textBlock.text.trim().slice(0, 300)
      }
    };
  }
}

function buildUserMsg(issues, specifics, avoidList, n, batchNote) {
  return [
    `Concerns: ${issues.join(', ')}`,
    (specifics && specifics.length) ? `Specifics the person picked: ${specifics.join(', ')}` : null,
    avoidList.length ? `Avoid defaulting to (already familiar or shown recently): ${avoidList.join(', ')}` : null,
    `Return exactly ${n} herb(s).`,
    batchNote || null
  ].filter(Boolean).join('\n');
}

// A single request for more than ~6 rich herb entries risks running long
// enough to hit Netlify's function timeout (confirmed in production as a
// 504 on the similarly-shaped herb-profile.js call). Rather than ask for a
// large count in one go, split anything above 6 into two smaller requests
// fired in parallel and merge the results — each individual call stays
// fast, and running them concurrently means the person isn't waiting
// twice as long for it.
async function requestHerbs(anthropic, issues, specifics, avoidList, n) {
  if (n <= 6) {
    const b = await requestBatch(anthropic, buildUserMsg(issues, specifics, avoidList, n));
    return { herbs: b.herbs, diags: b.diag ? [b.diag] : [] };
  }

  const half1 = Math.ceil(n / 2);
  const half2 = n - half1;
  const [batchA, batchB] = await Promise.all([
    requestBatch(anthropic, buildUserMsg(issues, specifics, avoidList, half1, '(This is batch 1 of 2 — someone else is independently generating another batch, so lean toward well-established, classic matches here.)')),
    requestBatch(anthropic, buildUserMsg(issues, specifics, avoidList, half2, '(This is batch 2 of 2 — someone else is independently generating another batch of well-known matches, so favor lesser-known or less mainstream options here.)'))
  ]);

  const merged = [];
  const seen = new Set();
  [...batchA.herbs, ...batchB.herbs].forEach(h => {
    if (!h || !h.name) return;
    const key = h.name.trim().toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(h);
  });
  const diags = [batchA.diag, batchB.diag].filter(Boolean);
  return { herbs: merged.slice(0, n), diags };
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

    const n = Math.max(1, Math.min(12, Number(count) || 12));
    const avoidList = Array.isArray(avoid) ? avoid.filter(Boolean) : [];

    const { herbs, diags } = await requestHerbs(anthropic, issues, specifics, avoidList, n);

    if (!herbs.length) {
      // Self-explaining failure: include what the model actually did so we
      // can tell truncation (stopReason 'max_tokens') from prose/refusal
      // (rawSnippet) without another blind round-trip.
      return {
        statusCode: 502,
        body: JSON.stringify({ error: 'Model response was not valid JSON', detail: diags })
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ herbs })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
