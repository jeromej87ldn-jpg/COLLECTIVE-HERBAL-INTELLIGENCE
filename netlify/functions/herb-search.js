/**
 * C.H.I. Herb Search API - ENHANCED
 * Fuzzy Matching + Property/Keyword Search
 */

// HERBADEX SEARCH v4
const CATALOG_DATA = require('../../herbadex_master_catalog.json');
const CATALOG_HERBS = Array.isArray(CATALOG_DATA) ? CATALOG_DATA : (CATALOG_DATA.herbs || []);

class FuzzyHerbMatcher {
  constructor(herbs = []) {
    this.herbs = herbs;
    this.herbIndex = herbs.map((herb, idx) => {
      // Extract properties/keywords from multiple sources
      const properties = [];
      if (herb.properties) {
        properties.push(...(typeof herb.properties === 'string' 
          ? herb.properties.split(',').map(p => p.trim().toLowerCase())
          : Array.isArray(herb.properties) 
            ? herb.properties.map(p => (typeof p === 'string' ? p.toLowerCase() : String(p).toLowerCase()))
            : []));
      }
      if (herb.systems) {
        properties.push(...(typeof herb.systems === 'string'
          ? herb.systems.split(',').map(s => s.trim().toLowerCase())
          : Array.isArray(herb.systems)
            ? herb.systems.map(s => (typeof s === 'string' ? s.toLowerCase() : String(s).toLowerCase()))
            : []));
      }
      if (herb.keywords) {
        properties.push(...(Array.isArray(herb.keywords)
          ? herb.keywords.map(k => (typeof k === 'string' ? k.toLowerCase() : String(k).toLowerCase()))
          : typeof herb.keywords === 'string'
            ? herb.keywords.split(',').map(k => k.trim().toLowerCase())
            : []));
      }

      return {
        idx,
        herb,
        nameLower: (herb.name || '').toLowerCase(),
        latinLower: (herb.latin || herb.latin_name || '').toLowerCase(),
        englishLower: (herb.english_name || '').toLowerCase(),
        properties: [...new Set(properties)], // dedupe
        parts: this.tokenize((herb.name || '') + ' ' + (herb.latin || herb.latin_name || '') + ' ' + (herb.english_name || ''))
      };
    });
  }

  tokenize(text) {
    return text.toLowerCase().split(/[^\w]+/).filter(t => t.length > 2);
  }

  levenshteinSimilarity(a, b) {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(s1, s2) {
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i;
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
      if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
  }

  tokenSimilarity(queryTokens, herbTokens) {
    if (!queryTokens.length || !herbTokens.length) return 0;
    const matches = queryTokens.filter(qt =>
      herbTokens.some(ht => {
        if (ht.includes(qt)) return true;
        if (qt.includes(ht) && ht.length / qt.length >= 0.6) return true;
        return false;
      })
    );
    return matches.length / Math.max(queryTokens.length, herbTokens.length);
  }

  findMatches(query, maxResults = 20, minScore = 30) {
    if (!query || query.trim().length < 2) return [];

    // Hard block — common non-herb words that fuzzy matching might
    // accidentally score against herb names. Exact word match only.
    const NON_HERBAL = new Set([
      'computer','phone','laptop','tablet','camera','television','radio',
      'ring','necklace','bracelet','watch','jewel','jewelry','diamond',
      'chicken','beef','pork','lamb','fish','egg','eggs','milk','cheese',
      'butter','bread','pasta','sugar','salt','flour','rice','wheat',
      'potato','tomato','lettuce','onion','carrot','cabbage','broccoli',
      'cat','dog','bird','horse','cow','pig','sheep','mouse','rat',
      'hello','goodbye','thanks','please','sorry','yes','no','okay',
      'money','bank','credit','debt','loan','cash','price','cost',
      'happy','sad','angry','tired','sick','dead','alive','free','busy',
      'cancer','virus','bacteria','disease','infection','fever','pain',
      'blood','bone','brain','heart','liver','kidney','lung','skin',
      'water','fire','earth','wind','rain','snow','sun','moon','star',
      'house','home','room','door','window','floor','wall','roof',
      'car','bus','train','plane','boat','truck','bike','road',
      'book','paper','pen','pencil','desk','chair','table','bed',
      'shirt','pants','shoes','hat','coat','dress','sock','bag',
      'game','sport','music','movie','film','song','dance','art',
      'school','work','job','office','meeting','class','test','exam'
    ]);

    if (NON_HERBAL.has(query.toLowerCase().trim())) return [];

    const queryNorm = query.toLowerCase().trim();
    const queryTokens = this.tokenize(queryNorm);
    const results = [];

    for (const entry of this.herbIndex) {
      let score = 0;
      let matchType = null;

      // EXACT MATCHES (highest priority)
      if (entry.nameLower === queryNorm) {
        score = 100;
        matchType = 'exact_name';
      } else if (entry.latinLower === queryNorm) {
        score = 100;
        matchType = 'exact_latin';
      } else if (entry.englishLower === queryNorm) {
        score = 100;
        matchType = 'exact_english';
      }
      // PARTIAL NAME MATCHES
      else if (entry.nameLower.includes(queryNorm)) {
        score = 90;
        matchType = 'partial_name';
      } else if (entry.latinLower.includes(queryNorm)) {
        score = 85;
        matchType = 'partial_latin';
      }
      // PROPERTY/KEYWORD MATCHES
      else if (entry.properties.some(p => p === queryNorm)) {
        score = 75;
        matchType = 'property_exact';
      } else if (entry.properties.some(p => p.includes(queryNorm))) {
        score = 65;
        matchType = 'property_partial';
      }
      // FUZZY MATCH - LOOSENED THRESHOLD
      else {
        const nameSimilarity = this.levenshteinSimilarity(queryNorm, entry.nameLower);
        const latinSimilarity = this.levenshteinSimilarity(queryNorm, entry.latinLower);
        const maxSimilarity = Math.max(nameSimilarity, latinSimilarity);

        // 0.55 blocks false positives (e.g. "computer") while keeping
        // real misspellings (e.g. "tumeric" scores 0.875, "mullien" 0.714)
        if (maxSimilarity >= 0.55) {
          score = 50 + (maxSimilarity * 30);
          matchType = nameSimilarity > latinSimilarity ? 'fuzzy_name' : 'fuzzy_latin';
        }
      }

      // TOKEN-BASED MATCHING
      if (score === 0) {
        const tokenScore = this.tokenSimilarity(queryTokens, entry.parts);
        if (tokenScore > 0.4) {
          score = 40 + (tokenScore * 20);
          matchType = 'token_match';
        }
      }

      if (score >= minScore) {
        results.push({
          herb: entry.herb,
          score: Math.round(score),
          reason: matchType
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}

const SEARCH_MATCHER = new FuzzyHerbMatcher(CATALOG_HERBS);

exports.handler = async (event) => {
  try {
    const query = (event.queryStringParameters?.q || '').trim();
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || '20'), 100);
    const confidence = Math.max(0, Math.min(100, parseInt(event.queryStringParameters?.confidence || '30')));

    if (query.length < 2) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Query must be at least 2 characters',
          results: [],
          suggestions: []
        })
      };
    }

    // Catalog is require()d at module level (see top of file) so Netlify
    // bundles it — the old fs.readFileSync call failed on Netlify (500 errors).
    const matcher = SEARCH_MATCHER;
    const allMatches = matcher.findMatches(query, limit * 2, Math.max(30, confidence));

    // Tier results by confidence
    const exactMatches = allMatches.filter(m => m.score >= 85);
    const closeMatches = allMatches.filter(m => m.score >= 60 && m.score < 85);
    const possibleMatches = allMatches.filter(m => m.score >= 40 && m.score < 60);

    const results = [
      ...exactMatches,
      ...closeMatches,
      ...possibleMatches
    ].slice(0, limit);

    const suggestions = results
      .slice(0, 5)
      .map(m => ({
        id: m.herb.id,
        name: m.herb.name,
        latin_name: m.herb.latin || m.herb.latin_name,
        confidence: m.score,
        reason: m.reason
      }));

    const overallConfidence = results.length > 0
      ? Math.round(results.slice(0, 3).reduce((sum, r) => sum + r.score, 0) / Math.min(3, results.length))
      : 0;

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        query: query,
        results: results.map(r => ({
          id: r.herb.id,
          name: r.herb.name,
          latin_name: r.herb.latin || r.herb.latin_name,
          tradition: r.herb.tradition,
          properties: r.herb.properties,
          systems: r.herb.systems,
          status: r.herb.status,
          relevance_score: r.score,
          match_reason: r.reason
        })),
        total_found: results.length,
        suggestions: suggestions,
        confidence: overallConfidence,
        search_type: 'fuzzy_and_property'
      }),
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      }
    };
  } catch (error) {
    console.error('Herb search error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
        query: event.queryStringParameters?.q || ''
      })
    };
  }
};
