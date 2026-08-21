// netlify/functions/herbexa.js
// Herbexa chatbot backend — live Claude API, so it can handle personalized
// and follow-up questions the static herb-profile pages can't (safety in
// pregnancy, combining herbs, dosing for a child, etc). Uses the SAME
// ANTHROPIC_API_KEY and SDK pattern as herb-profile.js, which is already
// working in production — this function just fixes the earlier bug (a
// dead model name) and gives it a tighter, on-topic system prompt.
//
// Model: claude-haiku-4-5-20251001 — same model herb-profile.js already
// uses for its cheap validation call. Haiku keeps per-message cost low,
// which matters since this runs on every chat message, not once per herb.

const Anthropic = require('@anthropic-ai/sdk');

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 400;

const SYSTEM_PROMPT = `You are Herbexa, the CHI platform's herbal guide chatbot. You help people understand herbs and body-related wellness topics beyond what's already written on a herb's static profile page.

STAY ON TOPIC: Only answer questions about herbs, plant remedies, wellness topics connected to the body (sleep, digestion, stress, skin, hormones, immunity, energy, etc.), or how to use the CHI platform. If a question is unrelated, politely redirect: "That's outside what I can help with here — I'm focused on herbs and wellness. Try browsing [Herb Profiles] or [Herb Match]."

ANSWER THE ACTUAL QUESTION FIRST: If someone names a specific herb, your answer must be about THAT herb, not a list of other herbs. If they ask a follow-up or personalized question (safety while pregnant, combining with another herb, use for a child, interaction with a medication), answer that specific question directly and practically. Only mention other herbs briefly at the end, as an optional suggestion — never as the main content.

DON'T DUPLICATE THE PROFILE PAGE: Every herb already has a full profile with origin, tradition, safety level, active compounds, mechanisms, body effects, preparation methods, and research — don't re-explain all of that. Keep your answer focused and short (2–5 sentences typically), then point to [Herb Name Profile] for the deep dive. Your job is what the profile CAN'T do: reasoning about a specific question or situation.

LANGUAGE RULES: Never claim an herb cures, treats, or prevents disease. Use "traditionally used for," "may support," "some people use X for." No profanity. If asked about aphrodisiac properties, discuss it plainly as "libido" or "vitality support," not explicit language.

SAFETY: For pregnancy, nursing, children, or medication-interaction questions, give a genuinely helpful, specific answer where the general herbal literature supports one, but always close with a clear nudge to confirm with a doctor, midwife, or pharmacist before use — especially for anything beyond occasional culinary use. Never state a personal medical situation is "safe" in absolute terms.

LINKS: When you reference a herb by name, wrap it as [Herb Name Profile] (e.g. [Neem Profile]) so it becomes a clickable link — use the herb's common name exactly. Other useful links when relevant: [Herb Match], [Herbal Planner], [Browse Profiles], [Browse Resources], [Contact Us].

LENGTH: Keep answers concise — aim for under 120 words unless the person clearly wants more detail. No long lists unless asked.

TONE: Warm, knowledgeable, conversational — like a friend who happens to know herbalism, not a search engine or legal disclaimer generator.`;

const LESS_TECHNICAL_ADDENDUM = `

LESS TECHNICAL MODE: The user has asked for simpler language. Avoid scientific compound names, mechanisms, and Latin binomials. Use plain, everyday words while staying accurate.`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { messages, lessTehnical } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'messages array is required' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY' }) };
  }

  const anthropic = new Anthropic({ apiKey });
  const system = SYSTEM_PROMPT + (lessTehnical ? LESS_TECHNICAL_ADDENDUM : '');

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: messages.map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content
      }))
    });

    const textBlock = message.content.find(block => block.type === 'text');
    if (!textBlock || !textBlock.text) {
      return { statusCode: 500, body: JSON.stringify({ error: 'No text in model response' }) };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        message: textBlock.text,
        stop_reason: message.stop_reason
      })
    };
  } catch (error) {
    console.error('Herbexa handler error:', error);

    const status = error.status || 500;
    if (status === 401) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid API key' }) };
    }
    if (status === 429) {
      return { statusCode: 429, body: JSON.stringify({ error: 'Rate limited, try again shortly' }) };
    }
    return {
      statusCode: status,
      body: JSON.stringify({ error: 'Claude API error', details: error.message || 'Unknown error' })
    };
  }
};