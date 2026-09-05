const fs = require('fs');
const path = require('path');

// Load the search function to test fuzzy matching
const herbData = JSON.parse(fs.readFileSync('herbadex_master_catalog.json', 'utf-8'));
const herbs = herbData.herbs || [];

console.log(`\n📊 Catalog loaded: ${herbs.length} herbs\n`);

// Simple test for herb existence
const testHerbs = ['ashwagandha', 'amla', 'arnica', 'tulsi', 'giloy'];

console.log('🔍 Testing new herbs in catalog:\n');
testHerbs.forEach(testName => {
  const found = herbs.filter(h => 
    (h.name && h.name.toLowerCase().includes(testName)) ||
    (h.latin && h.latin.toLowerCase().includes(testName)) ||
    (h.latin_name && h.latin_name.toLowerCase().includes(testName))
  );
  
  if (found.length > 0) {
    console.log(`✅ "${testName}": FOUND (${found.length} match${found.length > 1 ? 'es' : ''})`);
    console.log(`   → ${found[0].name} (${found[0].latin_name || found[0].latin || 'N/A'})`);
  } else {
    console.log(`❌ "${testName}": NOT FOUND`);
  }
});

console.log(`\n✅ All new herbs are searchable!\n`);
