const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

// ── DAILY CATALOG FILL ──────────────────────────────────────────────
// Scheduled function (see netlify.toml: [functions."herb-catalog-fill"]
// schedule = "@daily"). Netlify's own cron trigger invokes this — nothing
// external needs to call it, and it doesn't depend on a live user search
// or on any AI session being open. Each run: picks a small batch of herbs
// from the CATALOG below that aren't in Supabase yet, generates a full
// profile for each (same shape as herb-profile.js + herb-profile-stage2-
// background.js produce, so it renders identically on the live site),
// and writes them straight in as status:'complete'.
//
// Scheduled functions get a 30-second execution budget (better than the
// free tier's normal 10s, still short of background functions' 15min) —
// so BATCH_SIZE stays small and safe rather than ambitious.

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
}

const BATCH_SIZE = 3;

// Starter catalog — roughly 20 well-documented, safe herbs per tradition.
// Not exhaustive by design (per Jerome: doesn't need to happen all at
// once). Deliberately excludes controlled/toxic entries (e.g. kratom,
// ayahuasca, raw aconite) consistent with the project's existing safety
// principle of not putting dangerous or thinly-documented herbs into a
// generator tool.
const CATALOG = [
  ["Ashwagandha","Ayurvedic"],["Turmeric","Ayurvedic"],["Tulsi (Holy Basil)","Ayurvedic"],["Neem","Ayurvedic"],["Shatavari","Ayurvedic"],
  ["Guduchi","Ayurvedic"],["Amla","Ayurvedic"],["Licorice Root","Ayurvedic"],["Guggul","Ayurvedic"],["Manjistha","Ayurvedic"],
  ["Gotu Kola","Ayurvedic"],["Bibhitaki","Ayurvedic"],["Haritaki","Ayurvedic"],["Arjuna","Ayurvedic"],["Bacopa (Brahmi)","Ayurvedic"],
  ["Vetiver","Ayurvedic"],["Sandalwood","Ayurvedic"],["Fenugreek","Ayurvedic"],["Cardamom","Ayurvedic"],["Punarnava","Ayurvedic"],

  ["Ginseng (Panax)","Traditional Chinese Medicine"],["Astragalus","Traditional Chinese Medicine"],["Reishi Mushroom","Traditional Chinese Medicine"],
  ["Goji Berry","Traditional Chinese Medicine"],["Dong Quai","Traditional Chinese Medicine"],["Schisandra","Traditional Chinese Medicine"],
  ["Rehmannia","Traditional Chinese Medicine"],["Codonopsis","Traditional Chinese Medicine"],["Poria","Traditional Chinese Medicine"],
  ["Atractylodes","Traditional Chinese Medicine"],["Cordyceps","Traditional Chinese Medicine"],["Fo-Ti (He Shou Wu)","Traditional Chinese Medicine"],
  ["Jujube Date","Traditional Chinese Medicine"],["Chrysanthemum Flower","Traditional Chinese Medicine"],["Honeysuckle Flower","Traditional Chinese Medicine"],
  ["Bupleurum","Traditional Chinese Medicine"],["White Peony Root","Traditional Chinese Medicine"],["Rhubarb Root (Da Huang)","Traditional Chinese Medicine"],
  ["Coptis","Traditional Chinese Medicine"],["Forsythia","Traditional Chinese Medicine"],

  ["Echinacea","Western Herbalism"],["St John's Wort","Western Herbalism"],["Valerian Root","Western Herbalism"],["German Chamomile","Western Herbalism"],
  ["Peppermint","Western Herbalism"],["Milk Thistle","Western Herbalism"],["Elderberry","Western Herbalism"],["Hawthorn","Western Herbalism"],
  ["Lavender","Western Herbalism"],["Stinging Nettle","Western Herbalism"],["Dandelion","Western Herbalism"],["Feverfew","Western Herbalism"],
  ["Skullcap","Western Herbalism"],["Passionflower","Western Herbalism"],["Yarrow","Western Herbalism"],["Calendula","Western Herbalism"],
  ["Ginkgo Biloba","Western Herbalism"],["Saw Palmetto","Western Herbalism"],["Goldenseal","Western Herbalism"],["Red Clover","Western Herbalism"],

  ["African Wormwood","African Traditional Medicine"],["Devil's Claw","African Traditional Medicine"],["Sutherlandia (Cancer Bush)","African Traditional Medicine"],
  ["Buchu","African Traditional Medicine"],["Rooibos","African Traditional Medicine"],["African Ginger (Siphonochilus)","African Traditional Medicine"],
  ["Baobab","African Traditional Medicine"],["Moringa","African Traditional Medicine"],["Hibiscus (Sorrel)","African Traditional Medicine"],
  ["Kola Nut","African Traditional Medicine"],["Bitter Kola","African Traditional Medicine"],["African Potato (Hypoxis)","African Traditional Medicine"],
  ["Pygeum","African Traditional Medicine"],["Aloe Ferox","African Traditional Medicine"],["Wild Garlic (Tulbaghia)","African Traditional Medicine"],
  ["African Cherry Bark","African Traditional Medicine"],["Kigelia (Sausage Tree)","African Traditional Medicine"],["Camwood","African Traditional Medicine"],
  ["Bush Tea (Athrixia)","African Traditional Medicine"],["Marula","African Traditional Medicine"],

  ["Soursop Leaf","Caribbean Folk Medicine"],["Cerasee","Caribbean Folk Medicine"],["Guinea Hen Weed","Caribbean Folk Medicine"],
  ["Fever Grass (Lemongrass)","Caribbean Folk Medicine"],["Sea Moss (Irish Moss)","Caribbean Folk Medicine"],["Noni","Caribbean Folk Medicine"],
  ["Bay Rum Leaf","Caribbean Folk Medicine"],["Shado Beni (Culantro)","Caribbean Folk Medicine"],["Chaney Root","Caribbean Folk Medicine"],
  ["Man Better Man","Caribbean Folk Medicine"],["Wonder of the World Leaf","Caribbean Folk Medicine"],["Vervine","Caribbean Folk Medicine"],
  ["John Charles","Caribbean Folk Medicine"],["Senna","Caribbean Folk Medicine"],["Sarsaparilla","Caribbean Folk Medicine"],
  ["Ginger","Caribbean Folk Medicine"],["Turmeric","Caribbean Folk Medicine"],["Moringa","Caribbean Folk Medicine"],
  ["Aloe Vera","Caribbean Folk Medicine"],["Jackass Bitters","Caribbean Folk Medicine"],

  ["Cat's Claw (Uña de Gato)","South American"],["Pau d'Arco","South American"],["Maca","South American"],["Yerba Mate","South American"],
  ["Guayusa","South American"],["Chanca Piedra","South American"],["Passionflower (Maracuja)","South American"],["Muira Puama","South American"],
  ["Suma (Brazilian Ginseng)","South American"],["Boldo","South American"],["Guarana","South American"],["Damiana","South American"],
  ["Espinheira Santa","South American"],["Dragon's Blood (Sangre de Grado)","South American"],["Jatoba","South American"],
  ["Copaiba","South American"],["Carqueja","South American"],["Chuchuhuasi","South American"],["Cinchona Bark (Quina)","South American"],
  ["Annatto","South American"],

  ["Galangal","Southeast Asian"],["Lemongrass","Southeast Asian"],["Kaffir Lime Leaf","Southeast Asian"],["Pandan Leaf","Southeast Asian"],
  ["Betel Leaf","Southeast Asian"],["Tongkat Ali","Southeast Asian"],["Java Tea (Cat's Whiskers)","Southeast Asian"],["Andrographis","Southeast Asian"],
  ["Butterfly Pea Flower","Southeast Asian"],["Torch Ginger","Southeast Asian"],["Mangosteen Rind","Southeast Asian"],["Roselle","Southeast Asian"],
  ["Turmeric","Southeast Asian"],["Noni","Southeast Asian"],["Moringa","Southeast Asian"],["Holy Basil","Southeast Asian"],
  ["Centella Asiatica","Southeast Asian"],["Ginger","Southeast Asian"],["Neem","Southeast Asian"],["Soursop","Southeast Asian"],

  ["Siberian Ginseng (Eleuthero)","Central Asian & Siberian"],["Rhodiola Rosea","Central Asian & Siberian"],["Sea Buckthorn","Central Asian & Siberian"],
  ["Chaga Mushroom","Central Asian & Siberian"],["Wormwood","Central Asian & Siberian"],["Bergenia (Badan)","Central Asian & Siberian"],
  ["Barberry","Central Asian & Siberian"],["Juniper Berry","Central Asian & Siberian"],["Siberian Larch Bark","Central Asian & Siberian"],
  ["Saffron","Central Asian & Siberian"],["Black Cumin","Central Asian & Siberian"],["Wild Thyme","Central Asian & Siberian"],
  ["Meadowsweet","Central Asian & Siberian"],["Bearberry (Uva Ursi)","Central Asian & Siberian"],["Elecampane","Central Asian & Siberian"],
  ["Licorice Root","Central Asian & Siberian"],["Astragalus","Central Asian & Siberian"],["Schisandra","Central Asian & Siberian"],
  ["St John's Wort","Central Asian & Siberian"],["Birch Leaf","Central Asian & Siberian"],

  ["Black Seed (Nigella Sativa)","North African & Maghreb"],["Argan","North African & Maghreb"],["Prickly Pear","North African & Maghreb"],
  ["Henna","North African & Maghreb"],["Rosemary","North African & Maghreb"],["Nana Mint","North African & Maghreb"],
  ["Saffron","North African & Maghreb"],["Carob","North African & Maghreb"],["Fennel","North African & Maghreb"],
  ["Anise","North African & Maghreb"],["Cumin","North African & Maghreb"],["Coriander Seed","North African & Maghreb"],
  ["Orange Blossom","North African & Maghreb"],["Damask Rose","North African & Maghreb"],["Myrtle","North African & Maghreb"],
  ["Thyme","North African & Maghreb"],["Moroccan Sage","North African & Maghreb"],["Za'atar (Origanum syriacum)","North African & Maghreb"],
  ["Fenugreek","North African & Maghreb"],["Date Palm","North African & Maghreb"],

  ["Elderflower","European Folk"],["Plantain (Plantago)","European Folk"],["Comfrey","European Folk"],["Mullein","European Folk"],
  ["Horsetail","European Folk"],["Burdock","European Folk"],["Lady's Mantle","European Folk"],["Chickweed","European Folk"],
  ["Vervain","European Folk"],["Wild Rose Hips","European Folk"],["Birch Leaf","European Folk"],["Oak Bark","European Folk"],
  ["Wild Marjoram","European Folk"],["Self-Heal","European Folk"],["Sweet Woodruff","European Folk"],["Angelica","European Folk"],
  ["Wormwood","European Folk"],["Feverfew","European Folk"],["Yarrow","European Folk"],["Stinging Nettle","European Folk"],

  ["Kava","Pacific Island"],["Noni","Pacific Island"],["Mamaki","Pacific Island"],["Kukui","Pacific Island"],["Ti Leaf","Pacific Island"],
  ["Coconut","Pacific Island"],["Breadfruit Leaf","Pacific Island"],["Guava Leaf","Pacific Island"],["Papaya Leaf","Pacific Island"],
  ["Pandanus","Pacific Island"],["Sea Grape","Pacific Island"],["Beach Naupaka","Pacific Island"],["Turmeric","Pacific Island"],
  ["Hibiscus","Pacific Island"],["Taro Leaf","Pacific Island"],["Awapuhi (Shampoo Ginger)","Pacific Island"],
  ["Kawakawa","Pacific Island"],["Manuka","Pacific Island"],["Kumarahou","Pacific Island"],["Koromiko","Pacific Island"],

  ["Frankincense","Middle Eastern & Unani"],["Myrrh","Middle Eastern & Unani"],["Sumac","Middle Eastern & Unani"],["Chicory","Middle Eastern & Unani"],
  ["Mallow (Khubbazi)","Middle Eastern & Unani"],["Pomegranate","Middle Eastern & Unani"],["Marshmallow Root","Middle Eastern & Unani"],
  ["Black Seed","Middle Eastern & Unani"],["Saffron","Middle Eastern & Unani"],["Fenugreek","Middle Eastern & Unani"],
  ["Licorice Root","Middle Eastern & Unani"],["Rosewater (Damask Rose)","Middle Eastern & Unani"],["Cumin","Middle Eastern & Unani"],
  ["Fennel","Middle Eastern & Unani"],["Anise","Middle Eastern & Unani"],["Carob","Middle Eastern & Unani"],
  ["Date Palm","Middle Eastern & Unani"],["Thyme","Middle Eastern & Unani"],["Senna","Middle Eastern & Unani"],["Za'atar","Middle Eastern & Unani"],

  ["Rhodiola Rosea","Himalayan & Tibetan"],["Himalayan Rhubarb","Himalayan & Tibetan"],["Spikenard (Musk Root)","Himalayan & Tibetan"],
  ["Costus Root (Kuth)","Himalayan & Tibetan"],["Gentian","Himalayan & Tibetan"],["Snow Lotus","Himalayan & Tibetan"],
  ["Himalayan Nettle","Himalayan & Tibetan"],["Bergenia","Himalayan & Tibetan"],["Kutki (Picrorhiza)","Himalayan & Tibetan"],
  ["Shilajit","Himalayan & Tibetan"],["Sea Buckthorn","Himalayan & Tibetan"],["Saffron","Himalayan & Tibetan"],
  ["Cordyceps","Himalayan & Tibetan"],["Juniper Berry","Himalayan & Tibetan"],["Ashwagandha","Himalayan & Tibetan"],
  ["Licorice Root","Himalayan & Tibetan"],["Musk Rose","Himalayan & Tibetan"],["Himalayan Wild Ginger","Himalayan & Tibetan"],
  ["Elecampane","Himalayan & Tibetan"],["Yarrow","Himalayan & Tibetan"],

  ["Korean Ginseng","Japanese & Korean"],["Shiitake Mushroom","Japanese & Korean"],["Perilla Leaf (Shiso)","Japanese & Korean"],
  ["Mugwort (Yomogi)","Japanese & Korean"],["Green Tea","Japanese & Korean"],["Kudzu Root (Kakkon)","Japanese & Korean"],
  ["Wasabi","Japanese & Korean"],["Burdock Root (Gobo)","Japanese & Korean"],["Job's Tears (Adlay)","Japanese & Korean"],
  ["Korean Angelica (Angelica gigas)","Japanese & Korean"],["Reishi Mushroom","Japanese & Korean"],["Astragalus","Japanese & Korean"],
  ["Licorice Root","Japanese & Korean"],["Schisandra","Japanese & Korean"],["Jujube Date","Japanese & Korean"],
  ["White Peony Root","Japanese & Korean"],["Atractylodes","Japanese & Korean"],["Poria","Japanese & Korean"],
  ["Codonopsis","Japanese & Korean"],["Sesame Seed","Japanese & Korean"],

  ["White Sage","Native American"],["Sweetgrass","Native American"],["Cedar","Native American"],["Black Cohosh","Native American"],
  ["Osha Root","Native American"],["Yerba Santa","Native American"],["Wild Cherry Bark","Native American"],["Slippery Elm","Native American"],
  ["Willow Bark","Native American"],["Boneset","Native American"],["Cottonwood Bud","Native American"],["Yucca Root","Native American"],
  ["Chokecherry","Native American"],["Pipsissewa","Native American"],["Blue Cohosh","Native American"],["Echinacea","Native American"],
  ["Goldenseal","Native American"],["Bearberry","Native American"],["Mullein","Native American"],["Yarrow","Native American"],

  ["Epazote","Mexican Traditional"],["Cuachalalate","Mexican Traditional"],["Gordolobo (Mexican Mullein)","Mexican Traditional"],
  ["Tejocote","Mexican Traditional"],["Nopal (Prickly Pear)","Mexican Traditional"],["Hibiscus (Jamaica)","Mexican Traditional"],
  ["Chaparral","Mexican Traditional"],["Rue (Ruda)","Mexican Traditional"],["Copal","Mexican Traditional"],
  ["Estafiate (Mexican Wormwood)","Mexican Traditional"],["Manzanilla (Chamomile)","Mexican Traditional"],["Guava Leaf","Mexican Traditional"],
  ["Tepezcohuite","Mexican Traditional"],["Arnica Mexicana","Mexican Traditional"],["Yerba Buena (Mexican Mint)","Mexican Traditional"],
  ["Damiana","Mexican Traditional"],["Yerba Santa","Mexican Traditional"],["Chile Pepper","Mexican Traditional"],
  ["Sarsaparilla","Mexican Traditional"],["Papaya Leaf","Mexican Traditional"]
];

function extractJson(text) {
  const stripped = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  try { return JSON.parse(stripped); }
  catch (e) {
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) return JSON.parse(stripped.slice(start, end + 1));
    throw e;
  }
}

const SYSTEM_PROMPT = `You are the Herbadex — CHI's herb knowledge engine.
Provide a complete, rich herb profile. Return ONLY valid JSON, no markdown fences, no explanation:
{
  "name": "common name", "latin": "latin binomial", "category": "primary action category",
  "categoryColor": "#hex", "origin": "native region", "tradition": "primary healing tradition(s)",
  "preparations": ["tea","tincture","capsule"], "safetyLevel": "Generally safe | Use with caution | Consult professional",
  "summary": "2 sentence overview, warm and plain",
  "functionalOverview": "2-3 sentence in-depth summary of what it does and how people use it",
  "source": "a real, verifiable citation or null if not genuinely confident one exists — never invent one",
  "spiritualHistory": { "overview": "3-4 sentence paragraph on cultural/spiritual significance", "timeline": [{"era":"period or culture","text":"one sentence"}] },
  "modernUse": "1-2 paragraph(s) on current research and modern applications",
  "compounds": [{"name":"compound","class":"Flavonoid | Alkaloid | Terpenoid | Saponin | Glycoside | Tannin | Polysaccharide | Phenolic acid","role":"short phrase","strength":0-100,"mechanism":"1-2 sentences","evidence":"evidence or traditional note"}],
  "herbalActions": [{"name":"action name","system":"body system","description":"1-2 sentences","compounds":["compound name"]}],
  "bodyEffects": [{"system":"body system","effect":"short phrase"}],
  "preparation": {"tea":"or null","tincture":"or null","capsule":"or null","topical":"or null","smoke":"or null","traditional":"or null"},
  "rareFact": "one surprising fact, one sentence",
  "interactions": ["known interaction"],
  "forumSeed": [{"user":"Name","initials":"XX","rating":5,"comment":"realistic experience"},{"user":"Name","initials":"XX","rating":4,"comment":"realistic experience"}]
}
Limits: compounds max 4, herbalActions max 4, bodyEffects max 4, interactions max 3, timeline max 3, forumSeed exactly 2.`;

async function requestProfile(anthropic, name, attempt = 1) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 3000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: attempt === 1 ? `Provide the profile for: ${name}` : `Provide the profile for: ${name}\n\nReturn ONLY the JSON object, with no other text before or after it.` }]
  });
  const textBlock = message.content.find(b => b.type === 'text');
  if (!textBlock || !textBlock.text) throw new Error('No text content in model response');
  try {
    return extractJson(textBlock.text);
  } catch (e) {
    if (attempt === 1) return requestProfile(anthropic, name, 2);
    throw new Error('Model response was not valid JSON after retry');
  }
}

exports.handler = async (event) => {
  const summary = { added: [], skipped: [], failed: [], catalogRemaining: null };

  if (!supabase) {
    console.error('herb-catalog-fill: Supabase not configured');
    return { statusCode: 200, body: JSON.stringify({ error: 'Supabase not configured' }) };
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('herb-catalog-fill: missing ANTHROPIC_API_KEY');
    return { statusCode: 200, body: JSON.stringify({ error: 'Missing ANTHROPIC_API_KEY' }) };
  }

  try {
    // Which catalog herbs already exist (any status — don't regenerate
    // something mid-flight from a live user search either).
    const { data: existingRows } = await supabase.from('herbs').select('name');
    const existingNames = new Set((existingRows || []).map(r => r.name));

    const remaining = CATALOG.filter(([name]) => !existingNames.has(name.trim().toLowerCase()));
    summary.catalogRemaining = remaining.length;

    if (remaining.length === 0) {
      console.log('herb-catalog-fill: catalog fully generated, nothing to do');
      return { statusCode: 200, body: JSON.stringify(summary) };
    }

    const anthropic = new Anthropic({ apiKey });
    const batch = remaining.slice(0, BATCH_SIZE);

    for (const [name, tradition] of batch) {
      const key = name.trim().toLowerCase();
      try {
        const herb = await requestProfile(anthropic, name);
        herb.tradition = herb.tradition || tradition;
        herb.generatedAt = new Date().toISOString();
        herb.stage2Status = 'complete';
        await supabase.from('herbs').upsert({ name: key, status: 'complete', data: herb });
        summary.added.push(name);
      } catch (err) {
        console.error('herb-catalog-fill: failed for', name, err.message);
        summary.failed.push({ name, error: err.message });
      }
    }

    console.log('herb-catalog-fill run:', JSON.stringify(summary));
    return { statusCode: 200, body: JSON.stringify(summary) };
  } catch (error) {
    console.error('herb-catalog-fill: unexpected error', error.message);
    return { statusCode: 200, body: JSON.stringify({ error: error.message }) };
  }
};
