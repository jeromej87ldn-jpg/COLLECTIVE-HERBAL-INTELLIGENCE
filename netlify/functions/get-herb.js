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
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Generate a comprehensive herbal profile for ${name} as ONLY valid JSON (no other text). Use this exact structure:

{
  "name": "${name}",
  "commonNames": ["list", "of", "alternative", "names"],
  "botanicalName": "scientific Latin name",
  "family": "plant family",
  "activeConstituents": ["baicalein", "wogonin", "other key compounds - be specific"],
  "appearance": "brief physical description of dried herb",
  "taste": "how it tastes (bitter, sweet, etc)",
  "temperament": "energetics (warming, cooling, moistening, etc)",
  "properties": "3-4 sentences on traditional use and modern research findings",
  "primaryUses": ["anxiety", "sleep", "inflammation", "etc - 3-5 main uses"],
  "secondaryUses": ["minor uses", "less common applications"],
  "dosage": {
    "infusion": "e.g. 1-2 tsp per cup, 2-3x daily",
    "tincture": "e.g. 20-40 drops in water, 2-3x daily",
    "powder": "e.g. 500mg-1g per dose"
  },
  "preparation": ["best as tea", "works in tincture", "can be encapsulated"],
  "taste_profile": "what to expect flavor-wise",
  "safety": "general safety - side effects if any",
  "contraindications": "who should avoid or be cautious",
  "interactions": ["potential interactions with medications or other herbs"],
  "pregnancy": "safe in pregnancy / avoid in pregnancy / use with caution",
  "breastfeeding": "safe while nursing / avoid while nursing",
  "children": "suitable for children / age recommendations if applicable",
  "cultivation": "grows where, how to identify in wild",
  "quality_indicators": "how to spot good quality dried herb",
  "storage": "how to store properly",
  "shelf_life": "how long it stays potent",
  "synergies": ["works well with", "other herbs that complement it"],
  "history": "brief historical/cultural use",
  "research_notes": "1-2 sentences on current scientific interest"
}

Return ONLY the JSON object, no markdown, no extra text.`
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