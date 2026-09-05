/**
 * C.H.I. Herb Search API - IMPROVED with Fuzzy Matching
 * Netlify Serverless Function
 *
 * Endpoint: /.netlify/functions/herb-search
 * Query Parameters:
 *   q (string, required) - Search query (min 2 chars)
 *   limit (int, optional) - Max results (default 20, max 100)
 *   tradition (string, optional) - Filter by tradition
 *   fuzzy (boolean, optional) - Enable fuzzy matching (default true)
 *   confidence (int, optional) - Min match score 0-100 (default 30)
 *
 * Returns: {success, query, results[], total_found, suggestions[], confidence}
 */

// Copy FuzzyHerbMatcher class here or import it
// For Netlify, include the full class inline:

class FuzzyHerbMatcher {
  constructor(herbs = []) {
    this.herbs = herbs;
    this.herbIndex = herbs.map((herb, idx) => ({
      idx,
      herb,
      nameLower: herb.name.toLowerCase(),
      latinLower: (herb.latin_name || '').toLowerCase(),
      keywords: (herb.keywords || []).map(k => k.toLowerCase()),
      parts: this.tokenize(herb.name + ' ' + (herb.latin_name || '') + ' ' + (herb.keywords || []).join(' '))
    }));
  }

  findMatches(query, maxResults = 20, minScore = 30) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const queryNorm = query.toLowerCase().trim();
    const queryTokens = this.tokenize(queryNorm);
    const results = [];

    for (const entry of this.herbIndex) {
      let score = 0;
      let matchType = null;

      if (entry.nameLower === queryNorm) {
        score = 100;
        matchType = 'exact_name';
      } else if (entry.latinLower === queryNorm) {
        score = 100;
        matchType = 'exact_latin';
      } else if (entry.nameLower.includes(queryNorm)) {
        score = 90;
        matchType = 'partial_name';
      } else if (entry.latinLower.includes(queryNorm)) {
        score = 85;
        matchType = 'partial_latin';
      } else if (entry.keywords.some(k => k === queryNorm)) {
        score = 80;
        matchType = 'keyword_exact';
      } else if (entry.keywords.some(k => k.includes(queryNorm))) {
        score = 70;
        matchType = 'keyword_partial';
      } else {
        const nameSimilarity = this.levenshteinSimilarity(queryNorm, entry.nameLower);
        const latinSimilarity = this.levenshteinSimilarity(queryNorm, entry.latinLower);
        const maxSimilarity = Math.max(nameSimilarity, latinSimilarity);

        if (maxSimilarity >= 0.60) {
          score = 50 + (maxSimilarity * 25);
          matchType = nameSimilarity > latinSimilarity ? 'fuzzy_name' : 'fuzzy_latin';
        }
      }

      if (score === 0) {
        const tokenScore = this.tokenSimilarity(queryTokens, entry.parts);
        if (tokenScore > 0.5) {
          score = 40 + (tokenScore * 20);
          matchType = 'token_match';
        }
      }

      if (score >= minScore) {
        results.push({
          herb: entry.herb,
          score: Math.round(score),
          reason: this.getMatchReason(matchType),
          matchType
        });
      }
    }

    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.herb.name.localeCompare(b.herb.name);
    });

    return results.slice(0, maxResults);
  }

  levenshteinSimilarity(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1.0;
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  tokenize(text) {
    return text.toLowerCase()
      .split(/[\s\-\(\),\.\/]+/)
      .filter(token => token.length > 1);
  }

  tokenSimilarity(queryTokens, herbTokens) {
    if (queryTokens.length === 0 || herbTokens.length === 0) return 0;
    let matches = 0;
    for (const queryToken of queryTokens) {
      for (const herbToken of herbTokens) {
        if (herbToken === queryToken) {
          matches++;
          break;
        }
      }
    }
    return matches / Math.max(queryTokens.length, herbTokens.length);
  }

  getMatchReason(matchType) {
    const reasons = {
      'exact_name': 'Exact name match',
      'exact_latin': 'Exact scientific name match',
      'partial_name': 'Found in herb name',
      'partial_latin': 'Found in scientific name',
      'keyword_exact': 'Matches herb keyword exactly',
      'keyword_partial': 'Found in herb keywords',
      'fuzzy_name': 'Similar to herb name (possible typo)',
      'fuzzy_latin': 'Similar to scientific name (possible typo)',
      'token_match': 'Matches herb tags'
    };
    return reasons[matchType] || 'Possible match';
  }
}

// Main handler
exports.handler = async (event) => {
  try {
    // Parse query parameters
    const query = (event.queryStringParameters?.q || '').trim();
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || '20'), 100);
    const tradition = event.queryStringParameters?.tradition || null;
    const useFuzzy = event.queryStringParameters?.fuzzy !== 'false';
    const confidence = Math.max(0, Math.min(100, parseInt(event.queryStringParameters?.confidence || '30')));

    // Validate query
    if (query.length < 2) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Query must be at least 2 characters',
          query: query,
          results: [],
          suggestions: []
        })
      };
    }

    // Load herb index from static file
    // In Netlify context, this would be:
    // const fs = require('fs');
    // const indexPath = require('path').join(__dirname, '..', 'herbadex_index_searchable.json');
    // const herbIndex = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

    // For this example, assume herbs are loaded
    const herbs = await loadHerbIndex();

    // Filter by tradition if specified
    let filteredHerbs = herbs;
    if (tradition) {
      filteredHerbs = herbs.filter(h => h.tradition === tradition);
    }

    // Initialize fuzzy matcher
    const matcher = new FuzzyHerbMatcher(filteredHerbs);

    // Find matches using fuzzy matching
    const allMatches = useFuzzy
      ? matcher.findMatches(query, limit * 2, Math.max(30, confidence))
      : filterTraditional(query, filteredHerbs, limit * 2);

    // Separate results into tiers
    const exactMatches = allMatches.filter(m => m.score >= 85);
    const closeMatches = allMatches.filter(m => m.score >= 60 && m.score < 85);
    const possibleMatches = allMatches.filter(m => m.score >= 40 && m.score < 60);

    // Build results: prioritize exact matches
    const results = [
      ...exactMatches,
      ...closeMatches,
      ...possibleMatches
    ].slice(0, limit);

    // Extract suggestions (for UI)
    const suggestions = results
      .slice(0, 5)
      .map(m => ({
        id: m.herb.id,
        name: m.herb.name,
        latin_name: m.herb.latin_name,
        tradition: m.herb.tradition,
        confidence: m.score,
        reason: m.reason
      }));

    // Calculate overall confidence (avg of top results)
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
          latin_name: r.herb.latin_name,
          tradition: r.herb.tradition,
          summary: r.herb.summary,
          keywords: r.herb.keywords,
          status: r.herb.status,
          status_badge: r.herb.status_badge,
          relevance_score: r.score,
          match_reason: r.reason
        })),
        total_found: results.length,
        suggestions: suggestions,
        confidence: overallConfidence,
        metadata: {
          query_type: query.split(/\s+/).length > 1 ? 'multi_word' : 'single_word',
          fuzzy_enabled: useFuzzy,
          tradition_filter: tradition || 'all',
          results_count: results.length
        }
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

/**
 * Load herb index from static file
 * Replace with actual file loading based on your Netlify setup
 */
async function loadHerbIndex() {
  // This would load from herbadex_index_searchable.json
  // For Netlify functions:
  // const fs = require('fs');
  // const path = require('path');
  // const data = fs.readFileSync(path.join(__dirname, '..', 'herbadex_index_searchable.json'), 'utf-8');
  // return JSON.parse(data);

  // Placeholder
  return [];
}

/**
 * Traditional matching (exact/partial) without fuzzy
 */
function filterTraditional(query, herbs, limit) {
  const queryLower = query.toLowerCase();

  const results = herbs
    .map(herb => {
      let score = 0;
      let matchType = null;

      if (herb.name.toLowerCase() === queryLower) {
        score = 100;
        matchType = 'exact_name';
      } else if (herb.name.toLowerCase().includes(queryLower)) {
        score = 90;
        matchType = 'partial_name';
      } else if ((herb.latin_name || '').toLowerCase().includes(queryLower)) {
        score = 85;
        matchType = 'partial_latin';
      } else if ((herb.keywords || []).some(k => k.toLowerCase().includes(queryLower))) {
        score = 70;
        matchType = 'keyword_partial';
      }

      return score > 0
        ? { herb, score, matchType, reason: matchType }
        : null;
    })
    .filter(r => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return results;
}
