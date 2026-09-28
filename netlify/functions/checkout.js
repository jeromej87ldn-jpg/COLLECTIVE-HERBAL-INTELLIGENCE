// netlify/functions/checkout.js
// Single entry point for every "buy" button on Herbadex.
//
// TODAY: checks the product and the buyer, then answers "coming soon".
// No money is taken and nothing is credited.
//
// PAYMENTS LAUNCH DAY (see the request sheet):
//   1. Create the payment account (e.g. Stripe) and add its secret key to
//      Netlify env as STRIPE_SECRET_KEY.
//   2. Add SUPABASE_SERVICE_ROLE_KEY to Netlify env (needed only by the
//      payment-confirmation function, never sent to browsers).
//   3. Replace the "coming soon" block below with: create a checkout session
//      using the product's price_pence/currency from the products table,
//      with metadata { user_id, product_id }.
//   4. Add a payment-confirmation function (webhook) that verifies the
//      provider's signature, then calls the database function
//      grant_purchase(user_id, product_id, provider, payment_ref, amount_pence).
//      grant_purchase is safe to call twice for the same payment.
// Prices live in ONE place: the `products` table in Supabase.

const { createClient } = require('@supabase/supabase-js');

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

const reply = (statusCode, obj) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj)
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return reply(400, { error: 'Invalid JSON body' }); }

  const auth = event.headers.authorization || event.headers.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) return reply(401, { reason: 'not_signed_in' });

  const productId = String(body.product_id || '');
  if (!productId) return reply(400, { error: 'product_id is required' });

  const sb = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY, {
    global: { headers: { Authorization: 'Bearer ' + token } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: status, error: stErr } = await sb.rpc('herbexa_status');
  if (stErr || !status || !status.signed_in) return reply(401, { reason: 'not_signed_in' });

  const { data: product, error: prErr } = await sb
    .from('products')
    .select('id,name,kind,price_pence,currency,premium_only,active')
    .eq('id', productId)
    .maybeSingle();
  if (prErr || !product || !product.active) return reply(404, { reason: 'unknown_product' });
  if (product.premium_only && !status.premium) return reply(403, { reason: 'premium_only', product });

  // ── Payments not live yet ──
  return reply(200, { status: 'coming_soon', product });
};
