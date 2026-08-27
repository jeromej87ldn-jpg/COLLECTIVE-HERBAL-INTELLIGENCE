const https = require('https');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const { findMissing, deriveFunctionalOverview } = require('./profile-validation');

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
}

const SYSTEM_PROMPT = `You are the Herbadex -- CHI's herb knowledge engine.

IMPORTANT DISCLAIMER: Profiles are generated for educational reference only and are NOT medical advice. Users should consult healthcare professionals before using any herbs, especially if pregnant, nursing, or on medications.

Generate a complete, informative herb profile based on well-established herbal knowledge. Include traditional uses, modern applications, preparation methods, safety considerations, and phytochemistry where applicable.

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "name": "common name",
  "latin": "latin binomial, or null if not confident",
  "category": "primary action category, or null",
  "categoryColor": "#hex",
  "origin": "native region, or null",
  "tradition": "primary healing tradition(s), or null",
  "preparations": ["tea","tincture","capsule"],
  "safetyLevel": "Generally safe | Use with caution | Consult professional | null if not established",
  "summary": "2 sentence overview, warm and plain",
  "functionalOverview": "2-3 sentence in-depth summary of what it does and how people use it",
  "sources": [],
  "spiritualHistory": { "overview": "3-4 sentence paragraph on cultural/spiritual significance, or null", "timeline": [{"era":"period or culture","text":"one sentence"}] },
  "modernUse": "1-2 paragraph(s) on current applications and research",
  "compounds": [{"name":"compound name (e.g. baicalein)","class":"Flavonoid | Alkaloid | Terpenoid | Saponin | Glycoside | Tannin | Polysaccharide | Phenolic acid","role":"what it does","mechanism":"1-2 sentences on HOW it works","evidence":"supporting information"}],
  "herbalActions": [{"name":"action name","system":"body system","description":"1-2 sentences","compounds":["compound name"]}],
  "bodyEffects": [{"system":"body system","effect":"short phrase"}],
  "preparation": {"tea":"method or null","tincture":"method or null","capsule":"method or null","topical":"method or null","traditional":"method or null"},
  "rareFact": "one surprising fact, or null",
  "interactions": ["known interaction"],
  "disclaimer": "Educational reference only. Not medical advice. Consult healthcare provider before use."
}

Limits: compounds max 4, herbalActions max 4, bodyEffects max 4, interactions max 3, timeline max 3.
Do not invent testimonials or user reviews -- that data comes only from real users.
Keep sources empty unless you can cite a well-known published reference by name.
Return ONLY the JSON object.`;

const MAX_ATTEMPTS = 1;

function extractJson(text) {
  const stripped = text.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(stripped);
  } catch (e) {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(stripped.slice(start, end + 1));
    }
    throw e;
  }
}

async function requestProfile(anthropic, name, attempt = 1, priorMissing = null) {
  let userMessage = `Generate a complete herb profile for: ${name}`;

  if (attempt > 1) {
    userMessage += '\n\nReturn ONLY the JSON object, with no other text before or after it.';
  }
  if (priorMissing && priorMissing.length) {
    userMessage += `\n\nYour previous attempt had invalid structure for: ${priorMissing.join(', ')}. Fix the structure.`;
  }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }]
  });

  const textBlock = message.content.find(block => block.type === 'text');
  if (!textBlock || !textBlock.text) {
    return { error: 'No text content in model response', stopReason: message.stop_reason };
  }

  let herb;
  try {
    herb = extractJson(textBlock.text);
  } catch (parseErr) {
    if (attempt < MAX_ATTEMPTS) {
      return requestProfile(anthropic, name, attempt + 1, ['valid JSON structure']);
    }
    return { error: 'Model response was not valid JSON', stopReason: message.stop_reason, raw: textBlock.text.trim().slice(0, 300) };
  }

  const missing = findMissing(herb);
  if (missing.length && attempt < MAX_ATTEMPTS) {
    return requestProfile(anthropic, name, attempt + 1, missing);
  }
  herb._missingFields = missing;
  return herb;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { herbName, previewApiKey, excludedHerb, issues } = JSON.parse(event.body || '{}');
    if (!herbName || !herbName.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'herbName is required' }) };
    }
    const name = herbName.trim().toLowerCase();
    const serverKey = process.env.ANTHROPIC_API_KEY;
    const apiKey = serverKey || previewApiKey;
    if (!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server is missing ANTHROPIC_API_KEY' }) };
    }
    const anthropic = new Anthropic({ apiKey });

    let cachedRow = null;
    if (supabase) {
      try {
        const { data: row } = await supabase
          .from('herbs')
          .select('data, status')
          .eq('name', name)
          .maybeSingle();
        cachedRow = row;
      } catch (cacheErr) {
        console.error('Supabase read failed:', cacheErr.message);
      }
    }

    if (cachedRow && cachedRow.status === 'complete' && cachedRow.data && cachedRow.data.name) {
      const before = cachedRow.data.functionalOverview;
      deriveFunctionalOverview(cachedRow.data);
      let healed = cachedRow.data.functionalOverview !== before;

      if (healed) {
        supabase.from('herbs').upsert({ name, status: 'complete', data: cachedRow.data }).then(
          () => {}, e => console.error('healed-row save failed:', e.message)
        );
      }
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'X-Cache': healed ? 'repaired' : 'hit' },
        body: JSON.stringify(cachedRow.data)
      };
    }

    let isHerb = true;
    try {
      const check = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: `Is "${name}" primarily known and used as a medicinal herb, culinary herb/spice, or traditional herbal remedy plant (examples: ashwagandha, chamomile, turmeric, echinacea, ginger, rosemary)?
Answer "no" if it is mainly a staple food eaten as a vegetable, fruit, grain, meat, or everyday produce item rather than for herbal/medicinal use (examples: cabbage, potato, chicken, apple, rice, lettuce) — even if it has a minor folk remedy use.
Answer ONLY "yes" or "no", nothing else.`
        }]
      });
      const verdictBlock = check.content.find(b => b.type === 'text');
      const verdict = (verdictBlock && verdictBlock.text || '').trim().toLowerCase();
      if (verdict.startsWith('no')) isHerb = false;
    } catch (validationErr) {
      console.error('Herb validation check failed, proceeding anyway:', validationErr.message);
    }

    if (!isHerb) {
      if (supabase) {
        supabase.from('herbs').delete().eq('name', name).then(
          () => {}, e => console.error('bad-cache cleanup failed:', e.message)
        );
      }
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'not_an_herb',
          message: `"${herbName.trim()}" doesn't look like a recognized herb, spice, or traditional herbal remedy plant — it reads more like a staple food item. Herbadex only generates profiles for herbal/medicinal plants. If this looks wrong, try the plant's common herbal name.`
        })
      };
    }

    const herb = await requestProfile(anthropic, name);

    if (herb.error) {
      return { statusCode: 502, body: JSON.stringify({ error: 'Generation failed: ' + herb.error }) };
    }

    deriveFunctionalOverview(herb);

    if (!herb.disclaimer) {
      herb.disclaimer = 'Educational reference only. Not medical advice. Consult healthcare provider before use.';
    }

    herb.images = [];
    herb.generatedAt = new Date().toISOString();

    if (supabase) {
      try {
        await supabase.from('herbs').upsert({ name, status: 'complete', data: herb });
      } catch (e) {
        console.error('Supabase write failed:', e.message);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(herb)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
