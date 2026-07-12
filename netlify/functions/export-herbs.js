const { createClient } = require('@supabase/supabase-js');

function supabaseProjectUrl() {
  return (process.env.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '');
}

exports.handler = async () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Supabase is not configured' }) };
  }

  try {
    const supabase = createClient(supabaseProjectUrl(), process.env.SUPABASE_KEY);
    const { data, error } = await supabase
      .from('herbs')
      .select('*')
      .eq('status', 'complete')
      .order('name');

    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    const headers = [
      'name', 'latin', 'category', 'origin', 'tradition',
      'safetyLevel', 'summary', 'rareFact', 'status', 'created_at'
    ];

    const escapeCsv = (val) => {
      const s = val === null || val === undefined ? '' : String(val);
      if (/["\n,]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };

    const rows = (data || []).map(row => {
      const d = row.data || {};
      return [
        row.name || d.name || '',
        d.latin || '',
        d.category || '',
        d.origin || '',
        d.tradition || '',
        d.safetyLevel || '',
        d.summary || '',
        d.rareFact || '',
        row.status || '',
        row.created_at || row.inserted_at || row.updated_at || ''
      ];
    });

    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(row.map(escapeCsv).join(','));
    }
    const csv = lines.join('\n');

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="chi-herbs.csv"'
      },
      body: csv
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
