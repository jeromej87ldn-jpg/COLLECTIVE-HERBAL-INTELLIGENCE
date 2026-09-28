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
const { createClient } = require('@supabase/supabase-js');

// ── Access rules (v2, Sept 2026) ─────────────────────────────────────────
// Signed-in users only. Every rule lives in the database functions
// herbexa_status() and herbexa_consume(), which run AS THE USER (their own
// token), so nobody can spend someone else's balance or skip the limit:
//   Premium: 25 questions/day (UK day), then bought extra questions.
//   Free:    20 seeds per question (free seeds first, then bought seeds).
// A question is only charged AFTER Claude has answered successfully.

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

function userClient(token) {
  return createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY, {
    global: { headers: { Authorization: 'Bearer ' + token } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const reply = (statusCode, obj) => ({ statusCode, headers: JSON_HEADERS, body: JSON.stringify(obj) });

// Cost control: only the recent conversation is sent to Claude.
const MAX_HISTORY = 10;
const MAX_CHARS = 1500;

// Would herbexa_consume() refuse right now? (Checked before calling Claude
// so we never pay for an answer we can't charge for.)
function blockedReason(st) {
  if (!st || !st.signed_in || st.profile === false) return 'not_signed_in';
  if (st.premium) {
    return (st.used_today >= st.daily_limit && st.extra_questions <= 0) ? 'daily_limit' : null;
  }
  return st.seeds < st.seed_cost ? 'no_seeds' : null;
}


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
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return reply(400, { error: 'Invalid JSON body' }); }

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return reply(401, { reason: 'not_signed_in' });
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return reply(500, { error: 'Server is missing Supabase settings' });
  }

  const sb = userClient(token);
  const { data: status, error: stErr } = await sb.rpc('herbexa_status');
  if (stErr) {
    console.error('herbexa_status error:', stErr.message);
    // An expired/invalid token comes back as an auth error.
    return reply(401, { reason: 'not_signed_in' });
  }

  // Status-only request (the widget asks this when it opens).
  if (body.action === 'status') return reply(200, { status });

  const block = blockedReason(status);
  if (block) return reply(402, { reason: block, status });

  const { messages, lessTehnical } = body;
  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return reply(400, { error: 'messages array is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return reply(500, { error: 'Server is missing ANTHROPIC_API_KEY' });

  const history = messages.slice(-MAX_HISTORY).map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: String(m.content || '').slice(0, MAX_CHARS)
  }));
  // Claude requires the conversation to start with a user turn.
  while (history.length && history[0].role !== 'user') history.shift();
  if (!history.length) return reply(400, { error: 'No user message' });

  const anthropic = new Anthropic({ apiKey });
  const system = SYSTEM_PROMPT + (lessTehnical ? LESS_TECHNICAL_ADDENDUM : '');

  let text;
  try {
    const message = await anthropic.messages.create({ model: MODEL, max_tokens: MAX_TOKENS, system, messages: history });
    const textBlock = message.content.find(block => block.type === 'text');
    text = textBlock && textBlock.text;
  } catch (error) {
    console.error('Herbexa Claude error:', error);
    // Not charged: nothing was answered.
    return reply(502, { reason: 'unavailable' });
  }
  if (!text) return reply(502, { reason: 'unavailable' });

  // Charge only now that there's an answer to give.
  const { data: spent, error: spendErr } = await sb.rpc('herbexa_consume');
  if (spendErr) {
    console.error('herbexa_consume error:', spendErr.message);
    return reply(500, { reason: 'unavailable' });
  }
  if (!spent || !spent.ok) {
    // Balance ran out between the check and now (e.g. two tabs at once).
    return reply(402, { reason: (spent && spent.reason) || 'no_seeds', status });
  }

  return reply(200, { message: text, usage: spent });
};
