/**
 * Cache Warmer - Pre-generates herb profiles to warm the server cache
 * Reduces first-load wait time from 28-32s to instant for popular herbs
 *
 * Usage: node warm-cache.js
 *
 * This script:
 * 1. Reads herbs from netlify/functions/herbs-database.json
 * 2. Requests each herb profile to trigger generation
 * 3. Shows progress and timing
 * 4. Profiles are cached server-side after first request
 */

   const PROFILE_URL = 'https://collectiveherbal.netlify.app/';const path = require('path');
const http = require('http');
const https = require('https');

// Configuration
const HERBS_DB_PATH = './netlify/functions/herbs-database.json';
const PROFILE_URL = 'https://your-netlify-site.netlify.app/.netlify/functions/herb-profile';
// OR for local testing: 'http://localhost:8888/.netlify/functions/herb-profile'

const BATCH_SIZE = 5;  // Request 5 herbs in parallel
const DELAY_BETWEEN_BATCHES = 1000; // 1 second between batches to avoid overwhelming server

// Load herbs from database
function loadHerbs() {
  try {
    const data = fs.readFileSync(HERBS_DB_PATH, 'utf8');
    const db = JSON.parse(data);
    return Object.keys(db).map(key => ({
      id: key,
      name: db[key].name
    }));
  } catch (error) {
    console.error(`❌ Error loading herbs database: ${error.message}`);
    process.exit(1);
  }
}

// Request a single herb profile
function requestHerbProfile(herbName) {
  return new Promise((resolve, reject) => {
    const url = `${PROFILE_URL}?herb=${encodeURIComponent(herbName)}`;
    const protocol = url.startsWith('https') ? https : http;

    const startTime = Date.now();
    protocol.get(url, { timeout: 35000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - startTime;
        if (res.statusCode === 200 || res.statusCode === 202) {
          resolve({ herb: herbName, status: 'success', duration, httpStatus: res.statusCode });
        } else {
          resolve({ herb: herbName, status: 'failed', duration, httpStatus: res.statusCode, error: data.substring(0, 100) });
        }
      });
    }).on('error', (error) => {
      const duration = Date.now() - startTime;
      resolve({ herb: herbName, status: 'error', duration, error: error.message });
    }).on('timeout', () => {
      resolve({ herb: herbName, status: 'timeout', duration: 35000 });
    });
  });
}

// Process herbs in batches
async function warmCache(herbs) {
  console.log(`\n🔥 Starting cache warm-up for ${herbs.length} herbs...\n`);

  const results = {
    success: 0,
    failed: 0,
    timeout: 0,
    error: 0
  };

  const times = [];

  for (let i = 0; i < herbs.length; i += BATCH_SIZE) {
    const batch = herbs.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(herbs.length / BATCH_SIZE);

    console.log(`📦 Batch ${batchNum}/${totalBatches} (${i + 1}-${Math.min(i + BATCH_SIZE, herbs.length)}/${herbs.length})`);

    const batchPromises = batch.map(herb => requestHerbProfile(herb.name));
    const batchResults = await Promise.all(batchPromises);

    batchResults.forEach(result => {
      const statusIcon =
        result.status === 'success' ? '✅' :
        result.status === 'failed' ? '⚠️' :
        result.status === 'timeout' ? '⏱️' : '❌';

      const statusText =
        result.status === 'success' ? `${result.httpStatus} - ${result.duration}ms` :
        result.status === 'timeout' ? 'Timeout (35s)' :
        result.error || result.httpStatus;

      console.log(`  ${statusIcon} ${result.herb.padEnd(25)} ${statusText}`);

      results[result.status]++;
      if (result.status === 'success') {
        times.push(result.duration);
      }
    });

    if (i + BATCH_SIZE < herbs.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }

  // Summary
  console.log(`\n📊 Cache Warm-up Complete!\n`);
  console.log(`   ✅ Success:  ${results.success}`);
  console.log(`   ⚠️  Failed:   ${results.failed}`);
  console.log(`   ⏱️  Timeout:  ${results.timeout}`);
  console.log(`   ❌ Error:    ${results.error}`);

  if (times.length > 0) {
    const avgTime = Math.round(times.reduce((a, b) => a + b) / times.length);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    console.log(`\n⏱️  Generation Times:`);
    console.log(`   Average: ${avgTime}ms`);
    console.log(`   Min:     ${minTime}ms`);
    console.log(`   Max:     ${maxTime}ms`);
  }

  console.log(`\n💾 Profiles are now cached. First-time searches will be instant!\n`);
}

// Main
async function main() {
  console.log('🌿 Herb Profile Cache Warmer');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const herbs = loadHerbs();
  console.log(`📖 Loaded ${herbs.length} herbs from database\n`);

  await warmCache(herbs);
}

main().catch(console.error);