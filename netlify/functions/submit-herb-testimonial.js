// Real user testimonial submission -- replaces the old forumSeed AI-generated
// fake reviews and the non-functional addForumEntry()/rateHerb() that only
// updated the DOM locally and never persisted anything, or told the user
// their rating was "recorded" when nothing was saved. Every submission
// lands as status 'pending' and is never shown publicly until an admin
// approves it via herb-testimonials-admin.js -- same moderation pattern as
// community photos (community-photos-admin.js).
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
    const { herbName, rating, comment, displayName } = JSON.parse(event.body || '{}');

    if (!herbName || !herbName.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'herbName is required' }) };
    }
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return { statusCode: 400, body: JSON.stringify({ error: 'rating must be a whole number 1-5' }) };
    }
    const trimmedComment = (comment || '').trim().slice(0, 1000);
    const name = (displayName || '').trim().slice(0, 60) || 'Anonymous';

    const { error } = await supabase.from('herb_testimonials').insert({
      herb_name: herbName.trim().toLowerCase(),
      display_name: name,
      rating: ratingNum,
      comment: trimmedComment || null,
      status: 'pending'
    });
    if (error) throw error;

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ success: true }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
