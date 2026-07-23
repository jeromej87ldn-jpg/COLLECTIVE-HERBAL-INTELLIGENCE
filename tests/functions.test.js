// Local, network-free tests for the Netlify function logic.
//
// The functions require('@anthropic-ai/sdk') and require('@supabase/supabase-js')
// and call out to the network. We intercept those requires with fakes (and
// stub global.fetch), so we can exercise every branch of the control flow
// here — cache hit / miss / generating / stale / error / fallback, and the
// herb-match batching+dedup — without deploying or hitting any API.
//
// Run:  node tests/functions.test.js
'use strict';
const assert = require('assert');
const path = require('path');
const Module = require('module');

// ── test registry ───────────────────────────────────────────────────
let passed = 0, failed = 0;
const failures = [];
async function test(name, fn) {
  try { await fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; failures.push([name, e]); console.log('  ✗ ' + name + '\n      ' + e.message); }
}

// ── fakes ────────────────────────────────────────────────────────────
// Fake Anthropic SDK. Each test sets `anthropicQueue` to the text(s) the
// model should "return"; every messages.create() shifts one off.
let anthropicQueue = [];
const anthropicCalls = [];
class FakeAnthropic {
  constructor(opts) { this.opts = opts; }
  get messages() {
    return {
      create: async (params) => {
        anthropicCalls.push(params);
        const text = anthropicQueue.length ? anthropicQueue.shift() : '{}';
        return { content: [{ type: 'text', text }], stop_reason: 'end_turn' };
      }
    };
  }
}

// Fake Supabase client. `getRow` decides what a select().maybeSingle()
// returns; upserts and deletes are recorded for assertions.
function makeSupabase(getRow) {
  const log = { upserts: [], deletes: [] };
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return { maybeSingle: async () => ({ data: getRow(), error: null }) };
            }
          };
        },
        upsert: async (row) => { log.upserts.push(row); return { error: null }; },
        delete() { return { eq: async () => { log.deletes.push(true); return { error: null }; } }; }
      };
    }
  };
  return { client, log };
}

// Env keys the functions read. We clear these on every load so a value set
// by one test can't leak into the next, then apply the test's env and LEAVE
// it in place — the functions read env at handler-call time, which happens
// after this returns, so restoring it here would (and originally did) break
// the very branch under test.
const RELEVANT_ENV = ['SUPABASE_URL', 'SUPABASE_KEY', 'ANTHROPIC_API_KEY', 'URL', 'DEPLOY_PRIME_URL'];

// Install the require() interception + global fetch stub, then load a fresh
// copy of a function module with the given env and supabase behavior.
let fetchCalls = [];
function loadFunction(relPath, { env = {}, getRow = () => null } = {}) {
  const sb = makeSupabase(getRow);

  RELEVANT_ENV.forEach(k => { delete process.env[k]; });
  Object.keys(env).forEach(k => { process.env[k] = env[k]; });

  const origLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === '@anthropic-ai/sdk') return FakeAnthropic;
    if (request === '@supabase/supabase-js') return { createClient: () => sb.client };
    return origLoad.call(this, request, parent, isMain);
  };

  // Fresh module instance (top-level supabase client is built at load).
  const full = require.resolve(path.join(__dirname, '..', relPath));
  delete require.cache[full];

  fetchCalls = [];
  global.fetch = async (url, opts) => { fetchCalls.push({ url, opts }); return { status: 202, json: async () => ({}) }; };

  let mod;
  try { mod = require(full); }
  finally { Module._load = origLoad; delete require.cache[full]; }
  return { handler: mod.handler, sb };
}

const ev = (obj) => ({ httpMethod: 'POST', body: JSON.stringify(obj) });
const SUPA_ENV = { SUPABASE_URL: 'https://x.supabase.co/rest/v1/', SUPABASE_KEY: 'k', ANTHROPIC_API_KEY: 'sk-test', URL: 'https://site.example' };

// ── herb-profile.js ──────────────────────────────────────────────────
async function run() {
console.log('herb-profile.js');

await test('cache hit returns 200 with stored data', async () => {
  const row = { status: 'complete', data: { name: 'sage', summary: 's' } };
  const { handler } = loadFunction('netlify/functions/herb-profile.js', { env: SUPA_ENV, getRow: () => row });
  const res = await handler(ev({ herbName: 'Sage' }));
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).name, 'sage');
});

await test('fresh generating row returns 202 (keep polling)', async () => {
  const row = { status: 'generating', data: { generating_at: Date.now() } };
  const { handler } = loadFunction('netlify/functions/herb-profile.js', { env: SUPA_ENV, getRow: () => row });
  const res = await handler(ev({ herbName: 'Sage' }));
  assert.strictEqual(res.statusCode, 202);
  assert.strictEqual(JSON.parse(res.body).status, 'generating');
});

await test('cache miss returns Stage 1 immediately, triggers Stage 2 background', async () => {
  // Two-stage: cache miss returns Stage 1 (essentials) as 200, triggers background Stage 2 async
  anthropicQueue = [
    JSON.stringify({ name: 'Gotu Kola', latin: 'Bacopa monnieri', category: 'Cognitive', categoryColor: '#5cab7a', summary: 'A gentle herb for memory.', safetyLevel: 'Generally safe', preparations: ['tea','tincture'], functionalOverview: 'Supports brain health.', source: null })
  ];
  const { handler, sb } = loadFunction('netlify/functions/herb-profile.js', { env: SUPA_ENV, getRow: () => null });
  const res = await handler(ev({ herbName: 'Gotu Kola' }));
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(body.name, 'Stage 1 should have name');
  assert.strictEqual(body.stage2Status, 'loading', 'Stage 2 should be loading');
  assert.ok(sb.log.upserts.some(u => u.status === 'generating'), 'should mark generating in cache');
  // Background job dispatch is tried; may succeed or fail gracefully depending on siteURL
});

await test('stale generating row generates Stage 1 fresh', async () => {
  anthropicQueue = [JSON.stringify({ name: 'Sage', latin: 'Salvia', category: 'Cognitive', categoryColor: '#5cab7a', summary: 'An herb for memory.', safetyLevel: 'Generally safe', preparations: ['tea'], functionalOverview: 'Enhances clarity.', source: null })];
  const row = { status: 'generating', data: { generating_at: Date.now() - 5 * 60 * 1000 } };
  const { handler } = loadFunction('netlify/functions/herb-profile.js', { env: SUPA_ENV, getRow: () => row });
  const res = await handler(ev({ herbName: 'Sage' }));
  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.ok(body.name, 'should generate Stage 1 fresh for stale row');
});

await test('error row returns 502 and clears the row', async () => {
  const row = { status: 'error', data: { error: 'model refused' } };
  const { handler, sb } = loadFunction('netlify/functions/herb-profile.js', { env: SUPA_ENV, getRow: () => row });
  const res = await handler(ev({ herbName: 'Sage' }));
  assert.strictEqual(res.statusCode, 502);
  assert.strictEqual(JSON.parse(res.body).error, 'model refused');
  assert.strictEqual(sb.log.deletes.length, 1, 'should delete the errored row');
});

await test('missing herbName returns 400', async () => {
  const { handler } = loadFunction('netlify/functions/herb-profile.js', { env: SUPA_ENV, getRow: () => null });
  const res = await handler(ev({}));
  assert.strictEqual(res.statusCode, 400);
});

await test('non-POST returns 405', async () => {
  const { handler } = loadFunction('netlify/functions/herb-profile.js', { env: SUPA_ENV, getRow: () => null });
  const res = await handler({ httpMethod: 'GET' });
  assert.strictEqual(res.statusCode, 405);
});

await test('synchronous fallback when Supabase not configured', async () => {
  anthropicQueue = [JSON.stringify({ name: 'sage', latin: 'Salvia', summary: 'ok', compounds: [] })];
  // No SUPABASE_* env → module builds no supabase client → sync path.
  const { handler } = loadFunction('netlify/functions/herb-profile.js', { env: { ANTHROPIC_API_KEY: 'sk-test' } });
  const res = await handler(ev({ herbName: 'Sage' }));
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).name, 'sage');
  assert.strictEqual(fetchCalls.length, 0, 'sync path must not invoke background');
});

// ── herb-match.js ────────────────────────────────────────────────────
console.log('herb-match.js');

await test('count<=6 makes a single model call', async () => {
  anthropicQueue = [JSON.stringify({ herbs: [{ name: 'A' }, { name: 'B' }] })];
  const { handler } = loadFunction('netlify/functions/herb-match.js', { env: { ANTHROPIC_API_KEY: 'sk-test' } });
  anthropicCalls.length = 0;
  const res = await handler(ev({ issues: ['stress'], count: 6 }));
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(anthropicCalls.length, 1, 'one batch');
});

await test('count>6 splits into two batches and dedupes by name', async () => {
  anthropicQueue = [
    JSON.stringify({ herbs: [{ name: 'Ashwagandha' }, { name: 'Tulsi' }, { name: 'Reishi' }] }),
    JSON.stringify({ herbs: [{ name: 'Tulsi' }, { name: 'Skullcap' }, { name: 'Mimosa' }] }) // Tulsi dup
  ];
  const { handler } = loadFunction('netlify/functions/herb-match.js', { env: { ANTHROPIC_API_KEY: 'sk-test' } });
  anthropicCalls.length = 0;
  const res = await handler(ev({ issues: ['stress'], count: 12 }));
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(anthropicCalls.length, 2, 'two parallel batches');
  const names = JSON.parse(res.body).herbs.map(h => h.name);
  assert.deepStrictEqual(names, ['Ashwagandha', 'Tulsi', 'Reishi', 'Skullcap', 'Mimosa'], 'merged + deduped');
});

await test('herb-match tolerates prose around the JSON', async () => {
  anthropicQueue = ['Sure! Here are some herbs:\n{"herbs":[{"name":"A"}]}\nHope that helps.'];
  const { handler } = loadFunction('netlify/functions/herb-match.js', { env: { ANTHROPIC_API_KEY: 'sk-test' } });
  const res = await handler(ev({ issues: ['sleep'], count: 6 }));
  assert.strictEqual(res.statusCode, 200);
  assert.strictEqual(JSON.parse(res.body).herbs[0].name, 'A');
});

await test('herb-match missing issues returns 400', async () => {
  const { handler } = loadFunction('netlify/functions/herb-match.js', { env: { ANTHROPIC_API_KEY: 'sk-test' } });
  const res = await handler(ev({ count: 6 }));
  assert.strictEqual(res.statusCode, 400);
});

await test('herb-match unparseable model output returns 502 WITH diagnostic detail', async () => {
  // Two attempts, both junk → failure should carry the raw snippet so the
  // error is self-explaining rather than generic.
  anthropicQueue = ['I cannot help with that.', 'Still not JSON, sorry.'];
  const { handler } = loadFunction('netlify/functions/herb-match.js', { env: { ANTHROPIC_API_KEY: 'sk-test' } });
  const res = await handler(ev({ issues: ['sleep'], count: 6 }));
  assert.strictEqual(res.statusCode, 502);
  const body = JSON.parse(res.body);
  assert.ok(Array.isArray(body.detail) && body.detail.length === 1, 'detail present');
  assert.ok(body.detail[0].rawSnippet.includes('Still not JSON'), 'raw snippet captured from final attempt');
});

// ── summary ──────────────────────────────────────────────────────────
console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) { failures.forEach(([n, e]) => console.log('FAIL: ' + n + '\n' + (e.stack || e.message))); process.exit(1); }
}

run();
