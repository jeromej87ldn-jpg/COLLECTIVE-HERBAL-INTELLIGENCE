// ── TEMPORARY DIAGNOSTIC — safe to delete once background path confirmed ──
// Reports whether the background function actually executed (via the
// heartbeat row it writes on start) and the current state of a given herb
// row. Visit: /.netlify/functions/diag-bg?herb=sage
const { createClient } = require('@supabase/supabase-js');

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

exports.handler = async (event) => {
  const herb = ((event.queryStringParameters && event.queryStringParameters.herb) || 'sage').trim().toLowerCase();
  const out = { herbQueried: herb, heartbeat: null, herbRow: null, interpretation: null };

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    out.interpretation = 'Supabase env missing';
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out, null, 2) };
  }

  const supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);

  try {
    const { data: hb } = await supabase.from('herbs').select('data,status').eq('name', '__bg_heartbeat__').maybeSingle();
    out.heartbeat = hb ? { status: hb.status, ranAt: hb.data && hb.data.ranAt, forHerb: hb.data && hb.data.forHerb } : null;
  } catch (e) { out.heartbeat = { error: e.message }; }

  try {
    const { data: row } = await supabase.from('herbs').select('status,data').eq('name', herb).maybeSingle();
    if (!row) out.herbRow = 'no row';
    else out.herbRow = { status: row.status, hasProfile: !!(row.data && row.data.name && row.data.name !== herb ? true : (row.data && row.data.summary)), dataError: row.data && row.data.error, generating_at: row.data && row.data.generating_at };
  } catch (e) { out.herbRow = { error: e.message }; }

  // Plain-english read
  if (!out.heartbeat) {
    out.interpretation = 'Background function has NEVER run (no heartbeat). Netlify accepts the 202 but does not execute the job on this plan/config → need a non-background approach.';
  } else if (out.herbRow && out.herbRow.status === 'complete') {
    out.interpretation = 'Background ran AND the herb generated successfully. Working.';
  } else if (out.herbRow && out.herbRow.status === 'error') {
    out.interpretation = 'Background ran but generation FAILED: ' + (out.herbRow.dataError || 'unknown') + ' → fix that error.';
  } else {
    out.interpretation = 'Background STARTED (heartbeat present) but did not finish writing the herb (crashed/killed mid-generation).';
  }

  return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out, null, 2) };
};
