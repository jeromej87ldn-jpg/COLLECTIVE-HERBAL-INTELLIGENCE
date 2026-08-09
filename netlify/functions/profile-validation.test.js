// Unit tests for profile-validation.js's findMissing(). Pure logic, zero
// dependencies — run with: node netlify/functions/profile-validation.test.js
// (no API keys, no network, no Supabase needed).

const { findMissing } = require('./profile-validation');

let passed = 0, failed = 0;

function assert(label, condition) {
  if (condition) { passed++; console.log('  PASS -', label); }
  else { failed++; console.log('  FAIL -', label); }
}

function baseCompleteHerb() {
  return {
    name: 'Ashwagandha', latin: 'Withania somnifera', category: 'Adaptogen',
    summary: 'A calming adaptogen used for stress.', safetyLevel: 'Generally safe',
    herbalActions: [{ name: 'Stress support', system: 'Nervous', description: 'x', compounds: [] }],
    compounds: [{ name: 'Withanolides', class: 'Terpenoid', role: 'x', strength: 50, mechanism: 'x', evidence: 'x' }],
    bodyEffects: [{ system: 'Nervous', effect: 'Calming' }],
    spiritualHistory: { overview: 'Long used in Ayurveda.', timeline: [] },
    modernUse: 'Studied for cortisol reduction.',
    preparation: { tea: null, tincture: 'x', capsule: 'x', topical: null, smoke: null, traditional: null },
    interactions: ['Sedatives']
  };
}

console.log('Testing findMissing()...\n');

// 1. A fully complete profile should have nothing missing.
assert('complete profile -> no missing fields', findMissing(baseCompleteHerb()).length === 0);

// 2. Missing name (a REQUIRED_TEXT field) should be caught.
{
  const h = baseCompleteHerb();
  delete h.name;
  assert('missing name -> caught', findMissing(h).includes('name'));
}

// 3. Empty herbalActions array (a REQUIRED_SECTIONS field) should be caught.
{
  const h = baseCompleteHerb();
  h.herbalActions = [];
  assert('empty herbalActions -> caught', findMissing(h).includes('herbalActions'));
}

// 4. THE FIX — interactions completely absent (model skipped it) should be caught.
{
  const h = baseCompleteHerb();
  delete h.interactions;
  const missing = findMissing(h);
  assert('missing interactions key -> caught', missing.some(m => m.startsWith('interactions')));
}

// 5. THE FIX — interactions present as an EMPTY array (herb genuinely has none)
//    should NOT be flagged as missing. This is the case that matters most:
//    an empty array is a legitimate answer and must not force a retry that
//    could push the model toward inventing a fake interaction.
{
  const h = baseCompleteHerb();
  h.interactions = [];
  const missing = findMissing(h);
  assert('empty interactions array -> NOT flagged (legitimate "none")', !missing.some(m => m.startsWith('interactions')));
}

// 6. interactions present as a non-array (malformed) should be caught.
{
  const h = baseCompleteHerb();
  h.interactions = 'Sedatives, blood thinners';
  const missing = findMissing(h);
  assert('non-array interactions -> caught', missing.some(m => m.startsWith('interactions')));
}

// 7. Missing preparation entirely should be caught.
{
  const h = baseCompleteHerb();
  delete h.preparation;
  assert('missing preparation -> caught', findMissing(h).includes('preparation'));
}

// 8. Missing spiritualHistory.overview should be caught.
{
  const h = baseCompleteHerb();
  h.spiritualHistory = { overview: '', timeline: [] };
  assert('empty spiritualHistory.overview -> caught', findMissing(h).includes('spiritualHistory'));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
