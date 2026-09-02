const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_KEY environment variables required');
  console.error('   Set these in Netlify or your .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl.replace(/\/rest\/v1\/?$/, ''), supabaseKey);

async function extractTier1Data() {
  console.log('🔄 Connecting to Supabase...');
  
  try {
    // Get all cached herb profiles
    const { data: herbs, error } = await supabase
      .from('herbs')
      .select('name, data')
      .eq('status', 'complete')
      .limit(200);

    if (error) {
      console.error('❌ Supabase query failed:', error.message);
      process.exit(1);
    }

    if (!herbs || herbs.length === 0) {
      console.error('❌ No complete herb profiles found in Supabase');
      process.exit(1);
    }

    console.log(`✅ Found ${herbs.length} cached profiles in Supabase\n`);

    // Extract tier-1 fields from each profile
    const tierOneFields = ['modern_uses', 'herbal_actions', 'cultural_history', 'preparation'];
    const extracted = {};

    herbs.forEach(row => {
      const profile = row.data;
      if (!profile) return;

      const herbName = row.name.toLowerCase();
      extracted[herbName] = {};

      tierOneFields.forEach(field => {
        if (profile[field]) {
          extracted[herbName][field] = profile[field];
        }
      });
    });

    // Load current catalog and merge data
    const catalog = JSON.parse(fs.readFileSync('herbadex_master_catalog.json', 'utf8'));
    
    let merged = 0;
    catalog.herbs = catalog.herbs.map(herb => {
      const herbKey = herb.name.toLowerCase();
      if (extracted[herbKey]) {
        Object.keys(extracted[herbKey]).forEach(field => {
          herb[field] = extracted[herbKey][field];
        });
        merged++;
      }
      return herb;
    });

    console.log(`📝 Merged tier-1 data for ${merged} herbs`);
    
    // Re-audit with updated data
    let sufficient = 0;
    catalog.herbs = catalog.herbs.map(herb => {
      const has6 = tierOneFields.every(f => herb[f] && (
        typeof herb[f] === 'string' ? herb[f].trim().length > 0 : 
        Array.isArray(herb[f]) ? herb[f].length > 0 :
        typeof herb[f] === 'object' ? Object.keys(herb[f]).length > 0 : false
      ));
      if (has6) sufficient++;
      return {
        ...herb,
        status: has6 ? 'verified' : 'insufficient_data'
      };
    });

    console.log(`✅ Now ${sufficient} herbs have complete tier-1 data\n`);

    // Save updated catalog
    fs.writeFileSync('herbadex_master_catalog.json', JSON.stringify(catalog, null, 2));
    console.log('✅ Saved updated catalog with tier-1 fields');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

extractTier1Data();
