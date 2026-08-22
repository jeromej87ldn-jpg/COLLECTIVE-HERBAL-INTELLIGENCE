// Real user-photo upload, replacing the old (never-deployed, non-functional)
// upload-herb-image.js at the repo root. Stores the image file in Supabase
// Storage and records it in the community_photos table with status
// 'pending' — it does NOT touch the herbs table or the sourced/licensed
// image slideshow at all. Nothing here goes public until an admin approves
// it via community-photos-admin.js.
//
// Requires two things set up on the Supabase side that this code cannot
// create for itself (no dashboard/SQL access from here):
//   1. A public Storage bucket named "herb-photos"
//   2. A community_photos table (see community_photos.sql)
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
}

// Kept well under Netlify/Lambda's function payload ceiling — a base64
// data URL inflates the original file size by ~33%, so 4MB of actual image
// data is already a sizeable request body.
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  if (!supabase) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing Supabase configuration' }) };
  }

  try {
    const { herbName, imageData, part, note, contributorName } = JSON.parse(event.body || '{}');

    if (!herbName || !herbName.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'herbName is required' }) };
    }
    if (!imageData || typeof imageData !== 'string') {
      return { statusCode: 400, body: JSON.stringify({ error: 'imageData is required' }) };
    }

    const match = imageData.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
    if (!match) {
      return { statusCode: 400, body: JSON.stringify({ error: 'imageData must be a base64 image data URL' }) };
    }
    const mimeType = match[1];
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Unsupported image type — use JPEG, PNG, WebP, or GIF' }) };
    }

    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length > MAX_BYTES) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Image is too large (max 4MB)' }) };
    }

    const ext = mimeType.split('/')[1].replace('jpeg', 'jpg');
    const fileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
    const herbSlug = herbName.trim().toLowerCase().replace(/\s+/g, '-');
    const storagePath = `${herbSlug}/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from('herb-photos')
      .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

    if (uploadErr) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Image storage failed: ' + uploadErr.message }) };
    }

    const { data: publicUrlData } = supabase.storage.from('herb-photos').getPublicUrl(storagePath);
    const imageUrl = publicUrlData && publicUrlData.publicUrl;
    if (!imageUrl) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not resolve a public URL for the uploaded image' }) };
    }

    const { error: insertErr } = await supabase.from('community_photos').insert({
      herb_name: herbName.trim().toLowerCase(),
      image_url: imageUrl,
      credit: (contributorName && contributorName.trim()) || 'Anonymous',
      part: part || null,
      note: note || null,
      status: 'pending'
    });

    if (insertErr) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Could not save photo record: ' + insertErr.message }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Photo submitted for review' })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};