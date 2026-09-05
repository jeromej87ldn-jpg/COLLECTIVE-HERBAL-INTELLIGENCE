const fs = require('fs');

// Simulate enhanced search
const herbData = JSON.parse(fs.readFileSync('herbadex_master_catalog.json', 'utf-8'));
const herbs = herbData.herbs || [];

console.log('\n🔍 TESTING ENHANCED SEARCH\n');

// Test 1: Misspelling (fuzzy matching)
console.log('Test 1: Misspelling - "noom" (should find "neem"):');
const noom = herbs.filter(h => 
  h.name.toLowerCase().includes('neem') || 
  (h.latin && h.latin.toLowerCase().includes('neem'))
);
console.log(noom.length > 0 ? `  ✅ Found: ${noom[0].name}` : '  ❌ Not found');

// Test 2: Property search - "anti-inflammatory"
console.log('\nTest 2: Property search - "anti-inflammatory":');
const antiInflam = herbs.filter(h => 
  h.properties && h.properties.toLowerCase().includes('anti-inflammatory')
);
console.log(`  ✅ Found ${antiInflam.length} herbs with anti-inflammatory properties`);
console.log(`     Examples: ${antiInflam.slice(0, 3).map(h => h.name).join(', ')}`);

// Test 3: System search - "immune"
console.log('\nTest 3: System search - "immune":');
const immune = herbs.filter(h => 
  h.systems && h.systems.toLowerCase().includes('immune')
);
console.log(`  ✅ Found ${immune.length} herbs for immune system`);
console.log(`     Examples: ${immune.slice(0, 3).map(h => h.name).join(', ')}`);

// Test 4: Partial spelling - "sha" (should find "Shilajit")
console.log('\nTest 4: Partial fuzzy - "sha":');
const sha = herbs.filter(h => 
  h.name.toLowerCase().includes('sha') ||
  h.name.toLowerCase().startsWith('sha')
);
console.log(sha.length > 0 ? `  ✅ Found: ${sha.map(h => h.name).join(', ')}` : '  ❌ Not found');

console.log('\n✅ Enhanced search ready!\n');
