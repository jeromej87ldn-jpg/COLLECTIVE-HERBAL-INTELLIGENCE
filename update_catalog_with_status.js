const fs = require('fs');

// Read current catalog
const catalogPath = 'herbadex_master_catalog.json';
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

console.log(`\n📊 AUDITING ${catalog.herbs.length} herbs for tier-1 completeness...\n`);

const tierOneFields = ['latin_name', 'summary', 'modern_uses', 'herbal_actions', 'cultural_history', 'preparation'];

let verified = 0;
let pending = 0;
let insufficient = 0;

// Process each herb
catalog.herbs = catalog.herbs.map(herb => {
  // Count how many tier-1 fields exist
  const fieldsPresent = tierOneFields.filter(field => herb[field] && (
    typeof herb[field] === 'string' ? herb[field].trim().length > 0 : 
    Array.isArray(herb[field]) ? herb[field].length > 0 :
    typeof herb[field] === 'object' ? Object.keys(herb[field]).length > 0 : false
  )).length;

  // Determine status
  let status = 'insufficient_data';
  if (fieldsPresent >= 6) {
    status = 'verified';
    verified++;
  } else if (fieldsPresent >= 4) {
    status = 'pending_verification';
    pending++;
  } else {
    insufficient++;
  }

  return {
    ...herb,
    status: status,
    _tier1_fields_present: fieldsPresent
  };
});

console.log(`✅ VERIFIED (6/6 fields):           ${verified} herbs`);
console.log(`⏳ PENDING VERIFICATION (4-5 fields): ${pending} herbs`);
console.log(`❌ INSUFFICIENT DATA (<4 fields):   ${insufficient} herbs`);
console.log(`\n📝 HERBS BY STATUS:\n`);

const verified_herbs = catalog.herbs.filter(h => h.status === 'verified').map(h => `  ${h.id}: ${h.name}`);
const pending_herbs = catalog.herbs.filter(h => h.status === 'pending_verification').map(h => `  ${h.id}: ${h.name}`);
const insufficient_herbs = catalog.herbs.filter(h => h.status === 'insufficient_data').map(h => `  ${h.id}: ${h.name}`);

console.log(`✅ VERIFIED (${verified}):\n${verified_herbs.slice(0, 5).join('\n')}${verified > 5 ? `\n  ... and ${verified - 5} more` : ''}\n`);
console.log(`⏳ PENDING (${pending}):\n${pending_herbs.slice(0, 5).join('\n')}${pending > 5 ? `\n  ... and ${pending - 5} more` : ''}\n`);
console.log(`❌ INSUFFICIENT (${insufficient}):\n${insufficient_herbs.slice(0, 5).join('\n')}${insufficient > 5 ? `\n  ... and ${insufficient - 5} more` : ''}\n`);

// Remove internal tracking field before saving
catalog.herbs = catalog.herbs.map(h => {
  const { _tier1_fields_present, ...rest } = h;
  return rest;
});

// Save updated catalog
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

console.log(`✅ Updated ${catalogPath} with status field\n`);
console.log(`📊 SUMMARY: ${verified} verified + ${pending} pending + ${insufficient} insufficient = ${catalog.herbs.length} total`);
