// Moderation endpoint — list / approve / reject pending community photo
// submissions. Gated by a passcode checked server-side against the
// GARDEN_ADMIN_PASSCODE environment variable (set this in Netlify's env
// vars the same way ANTHROPIC_API_KEY is already set — never hardcode it
// here). The passcode never appears in any HTML/JS file; garden-review.html
// only sends whatever the admin types in, and this function is the only
// place that knows the real value.
const { createClient } = require('@supabase/supabase-js');

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!supabase) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing Supabase configuration' }) };
  }

  try {
    const { passcode, action, photoId } = JSON.parse(event.body || '{}');
    const expected = process.env.GARDEN_ADMIN_PASSCODE;

    if (!expected) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing GARDEN_ADMIN_PASSCODE' }) };
    }
    if (!passcode || passcode !== expected) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Incorrect passcode' }) };
    }

    if (action === 'list') {
      const { data, error } = await supabase
        .from('community_photos')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photos: data || [] }) };
    }

    if (action === 'approve' || action === 'reject') {
      if (!photoId) return { statusCode: 400, body: JSON.stringify({ error: 'photoId is required' }) };
      const { error } = await supabase
        .from('community_photos')
        .update({ status: action === 'approve' ? 'approved' : 'rejected' })
        .eq('id', photoId);
      if (error) throw error;
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
