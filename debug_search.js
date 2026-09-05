const fs = require('fs');

const herbData = JSON.parse(fs.readFileSync('herbadex_master_catalog.json', 'utf-8'));
const herbs = herbData.herbs || [];

// Test 1: Is mullein in database?
console.log('Test 1: Is "Mullein" in database?');
const mullein = herbs.filter(h => h.name.toLowerCase().includes('mullein'));
console.log(mullein.length > 0 
  ? `  ✅ Found: ${mullein.map(h => h.name).join(', ')}` 
  : '  ❌ NOT FOUND');

// Test 2: Levenshtein similarity for "mullu" vs "mullein"
function levenshteinDistance(s1, s2) {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

function similarity(a, b) {
  const longer = a.length > b.length ? a : b;
  if (longer.length === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return (longer.length - dist) / longer.length;
}

const sim = similarity('mullu', 'mullein');
console.log(`\nTest 2: Fuzzy similarity "mullu" vs "mullein": ${(sim * 100).toFixed(1)}%`);
console.log(`  Current threshold: 0.45 (45%)`);
console.log(`  Match? ${sim >= 0.45 ? '✅ YES' : '❌ NO'}`);

if (sim < 0.45) {
  console.log(`  ⚠️  Need to lower threshold to ${(sim - 0.02).toFixed(2)}`);
}

// Test 3: Check cache directory
console.log('\nTest 3: Cache files present?');
const cacheDir = 'data/herb-profiles-cache';
if (fs.existsSync(cacheDir)) {
  const files = fs.readdirSync(cacheDir).length;
  console.log(`  ✅ Cache directory exists: ${files} profiles cached`);
} else {
  console.log('  ❌ Cache directory missing');
}
