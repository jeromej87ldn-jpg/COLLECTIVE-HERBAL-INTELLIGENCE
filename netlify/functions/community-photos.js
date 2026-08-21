// Public read of APPROVED community photos only. Used by:
//  - garden.html: no ?herb param, returns every approved photo across all herbs
//  - supreme.html: ?herb=<name>, returns approved photos for one herb's
//    "Community photos" section
// Deliberately fails soft (empty list, not an error) on any problem — a
// broken community-photos fetch should never break the garden gallery or a
// herb profile page around it.
const { createClient } = require('@supabase/supabase-js');

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!supabase) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photos: [] }) };
  }

  try {
    const herb = ((event.queryStringParameters && event.queryStringParameters.herb) || '').trim().toLowerCase();
    let query = supabase
      .from('community_photos')
      .select('id, herb_name, image_url, credit, part, note, created_at')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });
    if (herb) query = query.eq('herb_name', herb);

    const { data, error } = await query;
    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos: data || [] })
    };
  } catch (e) {
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ photos: [] }) };
  }
};
