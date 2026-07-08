const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

exports.handler = async (event) => {
  try {
    const { herbName } = JSON.parse(event.body);
    const name = herbName.toLowerCase().trim();

    // Check Supabase first
    const { data: existing } = await supabase
      .from('herbs')
      .select('*')
      .eq('name', name)
      .single();

    if (existing && existing.status === 'complete') {
      return { 
        statusCode: 200, 
        body: JSON.stringify(existing.data) 
      };
    }

    // Generate herb data with Claude
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: `Generate detailed herbal information for ${name} in JSON format with: properties, uses, dosage, contraindications, interactions.`
        }
      ]
    });

    const herbData = JSON.parse(message.content[0].text);

    // Save to Supabase
    await supabase.from('herbs').upsert({
      name,
      data: herbData,
      status: 'complete'
    });

    return { 
      statusCode: 200, 
      body: JSON.stringify(herbData) 
    };
  } catch (error) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: error.message }) 
    };
  }
};