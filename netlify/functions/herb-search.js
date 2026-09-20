/**
 * C.H.I. Herb Search API - ENHANCED
 * Fuzzy Matching + Property/Keyword Search
 */

const fs = require('fs');
const path = require('path');

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
    const matches = queryTokens.filter(qt => herbTokens.some(ht => ht.includes(qt) || qt.includes(ht)));
    return matches.length / Math.max(queryTokens.length, herbTokens.length);
  }

  findMatches(query, maxResults = 20, minScore = 30) {
    if (!query || query.trim().length < 2) return [];

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

        // LOOSENED: 0.60 → 0.45 (more forgiving of typos)
        if (maxSimilarity >= 0.45) {
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

    // Load herb index
    const indexPath = path.join(__dirname, '..', 'herbadex_master_catalog.json');
    const herbData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const herbs = Array.isArray(herbData) ? herbData : (herbData.herbs || Object.values(herbData));

    const matcher = new FuzzyHerbMatcher(herbs);
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
