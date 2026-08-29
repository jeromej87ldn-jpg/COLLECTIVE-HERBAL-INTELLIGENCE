// TEMPORARY DIAGNOSTIC — checks whether the Supabase caching layer that
// herb-profile.js depends on is actually working in production.
//
// Visit this function's URL directly in a browser (GET request) to see a
// plain JSON report. Safe to leave deployed temporarily: it does not
// expose any secret values, only presence/absence and pass/fail results.
// Delete this file once the caching issue is diagnosed and fixed.

const { createClient } = require('@supabase/supabase-js');

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

exports.handler = async () => {
  const report = {
    timestamp: new Date().toISOString(),
    env: {
      SUPABASE_URL_present: !!process.env.SUPABASE_URL,
      SUPABASE_URL_looks_valid: !!(process.env.SUPABASE_URL && process.env.SUPABASE_URL.startsWith('http')),
      SUPABASE_KEY_present: !!process.env.SUPABASE_KEY,
      SUPABASE_KEY_length: process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.length : 0,
      ANTHROPIC_API_KEY_present: !!process.env.ANTHROPIC_API_KEY
    },
    tests: {}
  };

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    report.verdict = 'FAIL: SUPABASE_URL and/or SUPABASE_KEY are not set in this deploy context. herb-profile.js silently skips all caching when these are missing (supabase stays null), which means every single herb search regenerates from scratch via the AI every time — exactly matching what you are seeing.';
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report, null, 2) };
  }

  let supabase;
  try {
    supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
  } catch (e) {
    report.tests.client_creation = { ok: false, error: e.message };
    report.verdict = 'FAIL: could not create Supabase client — check SUPABASE_URL format.';
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report, null, 2) };
  }
  report.tests.client_creation = { ok: true };

  // Test 1: can we READ from the herbs table at all?
  try {
    const { data, error, count } = await supabase
      .from('herbs')
      .select('name, status', { count: 'exact' })
      .limit(5);
    if (error) {
      report.tests.read = { ok: false, error: error.message, code: error.code, hint: error.hint || null };
    } else {
      report.tests.read = { ok: true, total_row_count: count, sample: data };
    }
  } catch (e) {
    report.tests.read = { ok: false, error: e.message };
  }

  // Test 2: can we look up dandelion specifically, and what does its row actually look like?
  try {
    const { data, error } = await supabase
      .from('herbs')
      .select('name, status, data')
      .eq('name', 'dandelion')
      .maybeSingle();
    if (error) {
      report.tests.dandelion_lookup = { ok: false, error: error.message };
    } else if (!data) {
      report.tests.dandelion_lookup = { ok: true, found: false, note: 'No row named "dandelion" exists in the herbs table at all — every search will always regenerate.' };
    } else {
      const compoundsLen = Array.isArray(data.data && data.data.compounds) ? data.data.compounds.length : null;
      report.tests.dandelion_lookup = {
        ok: true,
        found: true,
        status: data.status,
        compounds_count: compoundsLen,
        has_modernUse: !!(data.data && data.data.modernUse),
        has_preparation: !!(data.data && data.data.preparation),
        interactions_is_array: Array.isArray(data.data && data.data.interactions)
      };
    }
  } catch (e) {
    report.tests.dandelion_lookup = { ok: false, error: e.message };
  }

  // Test 3: can we WRITE to the herbs table? (writes a harmless diagnostic row, then deletes it)
  try {
    const testName = '__diagnostic_test_row__';
    const { error: writeErr } = await supabase
      .from('herbs')
      .upsert({ name: testName, status: 'complete', data: { name: 'diagnostic', latin: 'test', category: 'test', summary: 'test', safetyLevel: 'test' } });
    if (writeErr) {
      report.tests.write = { ok: false, error: writeErr.message, code: writeErr.code, hint: writeErr.hint || null };
    } else {
      const { error: deleteErr } = await supabase.from('herbs').delete().eq('name', testName);
      report.tests.write = { ok: true, cleanup_ok: !deleteErr };
    }
  } catch (e) {
    report.tests.write = { ok: false, error: e.message };
  }

  // Verdict
  if (report.tests.read && !report.tests.read.ok) {
    report.verdict = `FAIL: Cannot READ from the herbs table (${report.tests.read.error}). This means every search always falls through to full AI regeneration — nothing is ever served from cache. Likely causes: wrong table name, Row Level Security policy blocking the key you're using, or wrong SUPABASE_KEY (using anon key without a read policy, when it needs the service_role key or a permissive RLS policy).`;
  } else if (report.tests.write && !report.tests.write.ok) {
    report.verdict = `PARTIAL: Reads work but WRITES fail (${report.tests.write.error}). Profiles generate correctly but are never saved, so every search regenerates from scratch every time. Likely a Row Level Security policy blocking inserts/updates for the key currently configured.`;
  } else if (report.tests.read && report.tests.read.ok && report.tests.read.total_row_count === 0) {
    report.verdict = 'Read/write both work, but the herbs table is completely empty — nothing has ever been successfully cached. If searches have been run before, something is deleting rows or writes were failing until now.';
  } else {
    report.verdict = 'Read and write both succeeded. Supabase caching appears to be working at the infrastructure level — if searches are still always slow, the issue is more likely in herb-profile.js\'s completeness check logic itself, not the database connection.';
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report, null, 2) };
};
