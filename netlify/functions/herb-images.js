const https = require('https');
const { URLSearchParams } = require('url');

// Fetch herb images from Wikimedia Commons only (public domain / CC licensed)
// Images sourced from Wikimedia, never AI-generated — a wrong plant photo is a misidentification risk

const WIKIMEDIA_USER_AGENT = 'CHI-Herbadex-Bot/1.0 (collectiveherbalintelligence.com; contact via site owner)';
const ACCEPTED_LICENSES = ['cc0', 'ccby', 'ccbysa', 'publicdomain', 'pdself', 'pd'];

function normalizeLicense(s) {
  return (s || '').toLowerCase().replace(/[\s-]+/g, '');
}

function wikimediaSearch(term, maxImages) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `${term} filetype:bitmap`,
      gsrnamespace: '6',
      gsrlimit: String(maxImages * 3),
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '800',
      format: 'json'
    });
    const req = https.get(
      `https://commons.wikimedia.org/w/api.php?${params.toString()}`,
      { headers: { 'User-Agent': WIKIMEDIA_USER_AGENT }, timeout: 8000 },
      (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(body)); }
          catch (e) { reject(e); }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Wikimedia request timed out')));
  });
}

async function fetchHerbImages(latinName, commonName, maxImages = 2) {
  const results = [];
  for (const term of [latinName, commonName].filter(Boolean)) {
    let data;
    try {
      data = await wikimediaSearch(term, maxImages);
    } catch (e) {
      continue; // network hiccup or nothing found — try the next term
    }
    const pages = (data.query && data.query.pages) || {};
    for (const page of Object.values(pages)) {
      const info = (page.imageinfo && page.imageinfo[0]) || null;
      if (!info) continue;
      const meta = info.extmetadata || {};
      const licenseShort = (meta.LicenseShortName && meta.LicenseShortName.value) || '';
      if (!ACCEPTED_LICENSES.some(lic => normalizeLicense(licenseShort).includes(lic))) continue;
      const artist = ((meta.Artist && meta.Artist.value) || 'Unknown').replace(/<[^>]+>/g, '').trim();
      const credit = `${artist} — ${licenseShort || 'Unknown license'} — Wikimedia Commons`;
      results.push({ url: info.thumburl || info.url || '', credit });
      if (results.length >= maxImages) break;
    }
    if (results.length) break; // found via Latin name — no need to also try common name
  }
  return results;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { herbName, latinName } = JSON.parse(event.body || '{}');
    if (!herbName || !herbName.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'herbName is required' }) };
    }

    // Fetch up to 4 images (non-blocking, called separately after profile loads;
    // the frontend shows these as a small slideshow when there's more than one)
    const images = await fetchHerbImages(latinName || '', herbName.trim(), 4);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images })
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};