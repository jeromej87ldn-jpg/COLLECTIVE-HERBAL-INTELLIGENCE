const fs = require('fs');

// Load catalogs
const existing = JSON.parse(fs.readFileSync('herbadex_master_catalog.json', 'utf-8'));
const existingHerbs = existing.herbs || [];

const ayurveda = JSON.parse(fs.readFileSync('data/herbs/CHI_NEW_AYURVEDA_HERBS.json', 'utf-8'));
const materia = JSON.parse(fs.readFileSync('data/herbs/CHI_NEW_MATERIA_MEDICA_HERBS.json', 'utf-8'));

function getNormalizedKey(herb) {
  const name = (herb.name || '').toLowerCase().trim();
  const latin = (herb.latin || herb.latin_name || '').toLowerCase().trim();
  return `${name}|||${latin}`;
}

// Remove old herb entries (except original 201)
const originals = existingHerbs.filter(h => !h.source || h.source === 'original');
const mergedMap = new Map();

originals.forEach(herb => {
  mergedMap.set(getNormalizedKey(herb), herb);
});

// Add Ayurveda (with properties)
let ayurCount = 0;
ayurveda.forEach(herb => {
  const key = getNormalizedKey(herb);
  if (!mergedMap.has(key)) {
    mergedMap.set(key, herb);
    ayurCount++;
  }
});

// Add Materia Medica (with properties)
let materiaCount = 0;
materia.forEach(herb => {
  const key = getNormalizedKey(herb);
  if (!mergedMap.has(key)) {
    mergedMap.set(key, herb);
    materiaCount++;
  }
});

const finalHerbs = Array.from(mergedMap.values());

const updated = {
  metadata: {
    total_herbs: finalHerbs.length,
    version: "2.1.0",
    date_consolidated: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    features: "Fuzzy matching (0.45 threshold), Property search, System search, Keyword search",
    notes: `Enhanced with searchable properties. Ayurveda: ${ayurCount}, Materia Medica: ${materiaCount}`
  },
  herbs: finalHerbs
};

fs.writeFileSync('herbadex_master_catalog.json', JSON.stringify(updated, null, 2));

console.log(`✅ Catalog updated with properties:`);
console.log(`   Total herbs: ${finalHerbs.length}`);
console.log(`   Ayurveda (enriched): ${ayurCount}`);
console.log(`   Materia Medica: ${materiaCount}`);
console.log(`   Original herbs: ${originals.length}`);
console.log(`\n✅ All herbs now searchable by name, properties, and systems`);
