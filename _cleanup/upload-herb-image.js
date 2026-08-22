const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { herbName, imageData } = JSON.parse(event.body || '{}');
    
    if (!herbName || !imageData) {
      return { statusCode: 400, body: JSON.stringify({ error: 'herbName and imageData required' }) };
    }

    const name = herbName.toLowerCase().trim();

    // Update the herb record with the image
    const { error } = await supabase
      .from('herbs')
      .update({
        data: supabase.raw(`jsonb_set(data, '{images,0}', '{"url":"${imageData}","credit":"Uploaded by community"}'::jsonb)`)
      })
      .eq('name', name);

    if (error) {
      // If herb doesn't exist, create it with the image
      await supabase.from('herbs').insert({
        name,
        data: {
          name: herbName,
          images: [{ url: imageData, credit: 'Uploaded by community' }]
        },
        status: 'complete'
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Image uploaded successfully' })
    };
  } catch (error) {
    console.error('Upload error:', error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};
