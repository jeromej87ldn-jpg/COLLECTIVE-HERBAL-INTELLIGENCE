const fs = require('fs');
const path = require('path');

// Load existing catalog
const existingPath = 'herbadex_master_catalog.json';
const existing = JSON.parse(fs.readFileSync(existingPath, 'utf-8'));
const existingHerbs = existing.herbs || [];

// Load new herbs
const ayurvedaPath = 'data/herbs/CHI_NEW_AYURVEDA_HERBS.json';
const materiaPath = 'data/herbs/CHI_NEW_MATERIA_MEDICA_HERBS.json';

const ayurveda = JSON.parse(fs.readFileSync(ayurvedaPath, 'utf-8'));
const materia = JSON.parse(fs.readFileSync(materiaPath, 'utf-8'));

// Normalize for deduplication
function getNormalizedKey(herb) {
  const name = (herb.name || herb.commonName || '').toLowerCase().trim();
  const latin = (herb.latin || herb.botanicalName || herb.latin_name || '').toLowerCase().trim();
  return `${name}|||${latin}`;
}

// Create dedup map from existing herbs
const existingMap = new Map();
existingHerbs.forEach(herb => {
  existingMap.set(getNormalizedKey(herb), herb);
});

let added = 0;
let skipped = 0;

// Add Ayurveda herbs
ayurveda.forEach(herb => {
  const key = getNormalizedKey(herb);
  if (!existingMap.has(key)) {
    existingHerbs.push(herb);
    existingMap.set(key, herb);
    added++;
  } else {
    skipped++;
  }
});

// Add Materia Medica herbs
materia.forEach(herb => {
  const key = getNormalizedKey(herb);
  if (!existingMap.has(key)) {
    existingHerbs.push(herb);
    existingMap.set(key, herb);
    added++;
  } else {
    skipped++;
  }
});

// Update the catalog
const updated = {
  metadata: {
    total_herbs: existingHerbs.length,
    version: "2.0.0",
    date_consolidated: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    notes: `Merged with 507 new herbs: 355 Ayurveda + 152 Materia Medica. Added: ${added}, Skipped (duplicates): ${skipped}`
  },
  herbs: existingHerbs
};

// Write updated catalog
fs.writeFileSync(existingPath, JSON.stringify(updated, null, 2));

console.log(`✅ Merge complete!`);
console.log(`   Total herbs now: ${existingHerbs.length}`);
console.log(`   Added: ${added}`);
console.log(`   Duplicates skipped: ${skipped}`);
