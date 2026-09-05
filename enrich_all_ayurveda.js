const fs = require('fs');

// Comprehensive Ayurvedic properties mapping
const properties = {
  'tulsi': 'Stimulant, Immune-boosting, Anti-inflammatory, Stress-relief, Respiratory support',
  'amla': 'Cooling, Rejuvenating, Vitamin C source, Immune support, Digestive',
  'ashwagandha': 'Adaptogenic, Sleep-promoting, Nervine tonic, Stress relief, Rejuvenating',
  'giloy': 'Immune support, Anti-fever, Digestive, Detoxifying, Anti-inflammatory',
  'brahmi': 'Memory enhancement, Nervine, Cooling, Nootropic, Stress relief',
  'neem': 'Blood purifying, Antimicrobial, Skin support, Detoxifying, Immune',
  'triphala': 'Digestive balance, Laxative, Rejuvenating, Detoxifying, Colon support',
  'haritaki': 'Laxative, Rejuvenating, Digestive, Astringent, Colon support',
  'bibhitaki': 'Respiratory support, Digestive, Phlegm-reducing, Astringent',
  'amalaki': 'Cooling, Rejuvenating, Vitamin C rich, Immune support',
  'ginger': 'Warming, Digestive, Anti-inflammatory, Circulation, Antiemetic',
  'turmeric': 'Anti-inflammatory, Liver support, Circulation, Antioxidant, Wound healing',
  'bhringraj': 'Hair health, Cooling, Liver support, Nervine, Rejuvenating',
  'bhumyamalaki': 'Liver support, Cooling, Detoxifying, Digestive, Anti-inflammatory',
  'punarnava': 'Diuretic, Detoxifying, Respiratory support, Anti-inflammatory, Circulation',
  'vidanga': 'Digestive, Anti-parasitic, Warming, Carminative, Metabolism support',
  'shilajit': 'Rejuvenating, Energy-boosting, Mineral-rich, Adaptogenic, Vitality'
};

const path = 'data/herbs/CHI_NEW_AYURVEDA_HERBS.json';
const herbs = JSON.parse(fs.readFileSync(path, 'utf-8'));

let mapped = 0;
let defaulted = 0;

herbs.forEach(herb => {
  const key = herb.name.toLowerCase();
  
  if (properties[key]) {
    herb.properties = properties[key];
    mapped++;
  } else {
    // Use family or default Ayurvedic properties
    herb.properties = `Ayurvedic remedy, Traditional medicine, Medicinal herb (${herb.family || 'Botanical'})`;
    defaulted++;
  }
  
  // Ensure systems field exists
  if (!herb.systems) {
    herb.systems = 'nervous,immune,digestive,respiratory,general';
  }
});

fs.writeFileSync(path, JSON.stringify(herbs, null, 2));

console.log(`✅ Enriched Ayurveda herbs:`);
console.log(`   Specifically mapped: ${mapped}`);
console.log(`   Default properties: ${defaulted}`);
console.log(`   Total enriched: ${herbs.length}`);
console.log(`\n✅ All Ayurveda herbs now searchable by properties & systems`);
