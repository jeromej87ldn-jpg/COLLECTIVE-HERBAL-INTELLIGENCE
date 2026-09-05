const fs = require('fs');

// Traditional Ayurvedic herb properties reference
const ayurvedaProperties = {
  'tulsi': 'Stimulant, Diaphoretic, Carminative, Immune-boosting, Stress-relieving, Anti-inflammatory',
  'amla': 'Cooling, Astringent, Rejuvenating, High-Vitamin C, Immunomodulating, Digestive',
  'ashwagandha': 'Adaptogenic, Rejuvenating, Nervine, Anti-stress, Sleep-promoting, Anti-inflammatory',
  'giloy': 'Immune-boosting, Febrifuge, Digestive, Detoxifying, Anti-inflammatory, Bitter',
  'brahmi': 'Nervine, Cooling, Memory-enhancing, Calming, Nootropic, Stress-relieving',
  'neem': 'Blood-purifying, Antimicrobial, Skin-healing, Bitter, Detoxifying, Anti-parasitic',
  'triphala': 'Laxative, Digestive, Rejuvenating, Colon-cleansing, Balancing, Detoxifying',
  'ginger': 'Stimulant, Warming, Digestive, Anti-inflammatory, Circulation-enhancing, Antiemetic',
  'turmeric': 'Anti-inflammatory, Liver-supporting, Circulation-enhancing, Antioxidant, Antimicrobial, Wound-healing',
  'haritaki': 'Laxative, Rejuvenating, Digestive, Astringent, Detoxifying, Colon-supporting'
};

// Load and enrich
const path = 'data/herbs/CHI_NEW_AYURVEDA_HERBS.json';
const herbs = JSON.parse(fs.readFileSync(path, 'utf-8'));

let enriched = 0;
herbs.forEach(herb => {
  const key = herb.name.toLowerCase();
  if (ayurvedaProperties[key]) {
    herb.properties = ayurvedaProperties[key];
    enriched++;
  } else {
    // Default properties for herbs without specific mapping
    herb.properties = 'Ayurvedic, Medicinal, Herbal remedy';
  }
  // Add systems field for Ayurvedic herbs
  herb.systems = herb.systems || 'nervous,immune,digestive';
});

fs.writeFileSync(path, JSON.stringify(herbs, null, 2));

console.log(`✅ Enriched ${enriched} Ayurveda herbs with properties`);
console.log(`✅ All herbs now have properties searchable`);
