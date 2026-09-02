const fs = require('fs');

// Read herb-profile.js
let code = fs.readFileSync('netlify/functions/herb-profile.js', 'utf8');

// Find the exports.handler line
const handlerStart = code.indexOf('exports.handler = async (event) => {');
const nextBrace = code.indexOf('\n', handlerStart) + 1;

// Inject status-check code right after handler opens
const statusCheckCode = `
  // Load herb catalog to check status
  const getCatalogStatus = (herbName) => {
    try {
      const catalogPath = \`\${__dirname}/../../herbadex_master_catalog.json\`;
      if (fs.existsSync(catalogPath)) {
        const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
        const herb = catalog.herbs.find(h => h.name.toLowerCase() === herbName.toLowerCase());
        return herb ? { status: herb.status || 'unknown', herb } : null;
      }
    } catch (e) {
      console.error('Catalog load failed:', e.message);
    }
    return null;
  };
`;

const updatedCode = code.slice(0, nextBrace) + statusCheckCode + code.slice(nextBrace);

// Also add code to check status right after name is extracted
const nameExtractionPoint = updatedCode.indexOf('const name = herbName.trim().toLowerCase();');
const nameLineEnd = updatedCode.indexOf('\n', nameExtractionPoint) + 1;

const statusLogCode = `
    // Check catalog status
    const catalogInfo = getCatalogStatus(herbName);
    if (catalogInfo) {
      console.log(\`[CATALOG STATUS] \${herbName}: \${catalogInfo.status}\`);
    }
`;

const fullyUpdatedCode = updatedCode.slice(0, nameLineEnd) + statusLogCode + updatedCode.slice(nameLineEnd);

// Write back
fs.writeFileSync('netlify/functions/herb-profile.js', fullyUpdatedCode);
console.log('✅ Added status-check logic to herb-profile.js');
console.log('📝 Changes:');
console.log('   - Load herbadex_master_catalog.json');
console.log('   - Check herb status before generation');
console.log('   - Log status to console');
