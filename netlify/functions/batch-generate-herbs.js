const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const { findMissing, deriveFunctionalOverview, validateCompounds } = require('./profile-validation');

// Batch generation function for Netlify scheduled events
// Runs on a schedule to proactively generate herb profiles from the pending list

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

const SYSTEM_PROMPT = `You are the Herbadex -- CHI's herb knowledge engine.

IMPORTANT DISCLAIMER: Profiles are generated for educational reference only and are NOT medical advice. Users should consult healthcare professionals before using any herbs, especially if pregnant, nursing, or on medications.

Generate a complete, informative herb profile based on well-established herbal knowledge. Include traditional uses, modern applications, preparation methods, safety considerations, and phytochemistry where applicable.

COMPOUND ACCURACY CRITICAL: Only use real, well-established herbal compounds. Never invent compound names. Use ONLY compounds from known herbal references (e.g. curcumin from turmeric, gingerol from ginger, allicin from garlic, inulin from burdock, silymarin from milk thistle). Each compound must be verifiable in herbal/botanical literature.

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "name": "common name",
  "latin": "latin binomial, or null if not confident",
  "category": "primary action category (never null)",
  "categoryColor": "#hex",
  "origin": "native region, or null",
  "tradition": "primary healing tradition(s) (never null)",
  "preparations": ["tea","tincture","capsule"],
  "safetyLevel": "Generally safe | Use with caution | Consult professional (never null)",
  "summary": "2 sentence overview, warm and plain",
  "functionalOverview": "2-3 sentence in-depth summary of what it does and how people use it",
  "sources": [],
  "spiritualHistory": { "overview": "3-4 sentence paragraph on cultural/spiritual significance, or null", "timeline": [{"era":"period or culture","text":"one sentence"}] },
  "modernUse": "1-2 paragraph(s) on current applications and research",
  "compounds": [{"name":"REAL compound name ONLY (e.g. curcumin, gingerol, silymarin, inulin)","class":"Flavonoid | Alkaloid | Terpenoid | Saponin | Glycoside | Tannin | Polysaccharide | Phenolic acid","role":"what it does","mechanism":"1-2 sentences on HOW it works","evidence":"supporting information"}],
  "herbalActions": [{"name":"action name","system":"body system","description":"1-2 sentences","compounds":["REAL compound name"]}],
  "bodyEffects": [{"system":"body system","effect":"short phrase"}],
  "preparation": {"tea":"method or null","tincture":"method or null","capsule":"method or null","topical":"method or null","traditional":"method or null"},
  "rareFact": "one surprising fact, or null",
  "interactions": ["known interaction"],
  "disclaimer": "Educational reference only. Not medical advice. Consult healthcare provider before use.",
  "keyCharacteristics": "2-3 sentence description of defining traits, appearance, or botanical features (REQUIRED, never empty)",
  "growingInformation": "Growing conditions, climate, soil requirements, hardiness, or cultivation notes (REQUIRED, never empty)",
  "herbalCombinations": "Common herbal pairings or synergistic combinations, or null if rarely combined",
  "harvestingStorage": "Harvesting season/methods and proper storage conditions (REQUIRED, never empty)"
}

Limits: compounds max 4, herbalActions max 4, bodyEffects max 4, interactions max 3, timeline max 3.
Do not invent testimonials or user reviews -- that data comes only from real users.
Keep sources empty unless you can cite a well-known published reference by name.
MANDATORY FIELDS (never null or empty): category, tradition, safetyLevel, keyCharacteristics, growingInformation, harvestingStorage.
Return ONLY the JSON object.`;

const MAX_ATTEMPTS = 2;
const BATCH_SIZE = 20; // Process 20 herbs per day (most common first)

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
  const startTime = Date.now();
  const supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' })
    };
  }

  const anthropic = new Anthropic({ apiKey });
  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
    herbs: []
  };

  try {
    // Fetch pending herbs (not yet generated)
    const { data: pendingHerbs, error: queryErr } = await supabase
      .from('herbs')
      .select('name, status')
      .eq('status', 'pending')
      .limit(BATCH_SIZE);

    if (queryErr) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Failed to query pending herbs: ${queryErr.message}` })
      };
    }

    if (!pendingHerbs || pendingHerbs.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'No pending herbs to generate',
          results
        })
      };
    }

    // Generate profiles for each pending herb
    for (const herbRow of pendingHerbs) {
      try {
        const name = herbRow.name.toLowerCase();
        console.log(`[batch] Generating profile for: ${name}`);

        const herb = await requestProfile(anthropic, name);

        if (herb.error) {
          results.failed++;
          results.errors.push({ herb: name, error: herb.error });
          console.log(`[batch] Generation failed for ${name}: ${herb.error}`);
          continue;
        }

        // Post-generation fixes
        deriveFunctionalOverview(herb);
        validateCompounds(herb);

        if (!herb.disclaimer) {
          herb.disclaimer = 'Educational reference only. Not medical advice. Consult healthcare provider before use.';
        }

        herb.images = [];
        herb.generatedAt = new Date().toISOString();

        // Save to Supabase
        const { error: saveErr } = await supabase
          .from('herbs')
          .upsert({ name, status: 'complete', data: herb });

        if (saveErr) {
          results.failed++;
          results.errors.push({ herb: name, error: `Save failed: ${saveErr.message}` });
          console.log(`[batch] Save failed for ${name}: ${saveErr.message}`);
        } else {
          results.success++;
          results.herbs.push(name);
          console.log(`[batch] Successfully generated and saved: ${name}`);
        }
      } catch (err) {
        results.failed++;
        results.errors.push({ herb: herbRow.name, error: err.message });
        console.error(`[batch] Exception generating ${herbRow.name}:`, err);
      }
    }

    const elapsedMs = Date.now() - startTime;
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `Batch generation complete`,
        results,
        elapsedMs,
        totalProcessed: pendingHerbs.length
      })
    };
  } catch (error) {
    console.error('[batch] Fatal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};