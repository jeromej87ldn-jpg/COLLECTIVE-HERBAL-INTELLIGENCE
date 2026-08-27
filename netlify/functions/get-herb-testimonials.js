// Public read of APPROVED herb testimonials only, plus a real aggregate
// rating computed from them -- replaces the old TOP20 hardcoded stars/votes
// and forumSeed fake reviews with actual submitted data. Mirrors
// community-photos.js's pattern. Fails soft (empty result, not an error) so
// a broken fetch never breaks a herb profile page around it.
const { createClient } = require('@supabase/supabase-js');

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
}

const EMPTY = { testimonials: [], count: 0, average: null };

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!supabase) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(EMPTY) };
  }

  try {
    const herb = ((event.queryStringParameters && event.queryStringParameters.herb) || '').trim().toLowerCase();
    if (!herb) {
      return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(EMPTY) };
    }

    const { data, error } = await supabase
      .from('herb_testimonials')
      .select('id, display_name, rating, comment, created_at')
      .eq('herb_name', herb)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const testimonials = data || [];
    const count = testimonials.length;
    const average = count ? Math.round((testimonials.reduce((s, t) => s + t.rating, 0) / count) * 10) / 10 : null;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testimonials, count, average })
    };
  } catch (e) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(EMPTY) };
  }
};
