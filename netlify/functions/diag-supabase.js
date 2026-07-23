// ── TEMPORARY DIAGNOSTIC — safe to delete after Phase 0 ──────────────
// Tests, from inside the real Netlify runtime, exactly what the herb
// profile caching depends on: can the configured Supabase key READ and
// WRITE the `herbs` table? Also reports whether the env the background
// flow needs is present. Visit in a browser; it returns JSON. It writes
// and then deletes a throwaway sentinel row, so it leaves no residue.
// No secrets are included in the output.
const { createClient } = require('@supabase/supabase-js');

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

function decodeJwtRole(key) {
  try {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString('utf8'));
    return payload.role || 'unknown';
  } catch (e) {
    return 'undecodable';
  }
}

exports.handler = async () => {
  const out = {
    env: {
      SUPABASE_URL_present: !!process.env.SUPABASE_URL,
      SUPABASE_URL_hadRestSuffix: /\/rest\/v1\/?$/.test(process.env.SUPABASE_URL || ''),
      SUPABASE_KEY_present: !!process.env.SUPABASE_KEY,
      SUPABASE_KEY_role: process.env.SUPABASE_KEY ? decodeJwtRole(process.env.SUPABASE_KEY) : null,
      ANTHROPIC_API_KEY_present: !!process.env.ANTHROPIC_API_KEY,
      URL_present: !!process.env.URL,        // needed to invoke the background fn
      URL_value: process.env.URL || null
    },
    read: { ok: false, error: null, rowCount: null },
    write: { ok: false, error: null },
    readback: { ok: false, found: false, error: null },
    cleanup: { ok: false, error: null }
  };

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    out.fatal = 'Supabase env vars missing';
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out, null, 2) };
  }

  const supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
  const sentinel = '__diag__' + Date.now();

  // 1. READ
  try {
    const { data, error } = await supabase.from('herbs').select('name').limit(3);
    if (error) out.read.error = error.message;
    else { out.read.ok = true; out.read.rowCount = data.length; }
  } catch (e) { out.read.error = e.message; }

  // 2. WRITE (upsert a throwaway row — this is the operation the whole
  //    async caching flow relies on)
  try {
    const { error } = await supabase.from('herbs').upsert({
      name: sentinel,
      status: 'complete',
      data: { name: sentinel, diagnostic: true }
    });
    if (error) out.write.error = error.message;
    else out.write.ok = true;
  } catch (e) { out.write.error = e.message; }

  // 3. READ BACK (confirm the write actually persisted, not just "no error")
  if (out.write.ok) {
    try {
      const { data, error } = await supabase.from('herbs').select('name,status').eq('name', sentinel).maybeSingle();
      if (error) out.readback.error = error.message;
      else { out.readback.ok = true; out.readback.found = !!data; }
    } catch (e) { out.readback.error = e.message; }
  }

  // 4. CLEAN UP the sentinel row
  try {
    const { error } = await supabase.from('herbs').delete().eq('name', sentinel);
    if (error) out.cleanup.error = error.message;
    else out.cleanup.ok = true;
  } catch (e) { out.cleanup.error = e.message; }

  // Plain-english verdict
  out.verdict =
    out.write.ok && out.readback.found
      ? 'WRITES WORK — the background caching architecture is viable.'
      : (out.read.ok
          ? 'READS work but WRITES do not (likely RLS blocks the anon key). The async flow will not cache — pick option B or C.'
          : 'Neither reads nor writes work with this key (RLS or key/table issue).');

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(out, null, 2)
  };
};
