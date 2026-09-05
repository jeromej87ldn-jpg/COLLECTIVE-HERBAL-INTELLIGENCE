/**
 * C.H.I. Herb Search API with Fuzzy Matching
 * Netlify Serverless Function
 * 
 * Endpoint: /.netlify/functions/herb-search
 * Query: ?q=query&limit=20&fuzzy=true
 * 
 * Returns fuzzy-matched herb suggestions with confidence scores
 */

const fs = require('fs');
const path = require('path');

// Fuzzy matcher class (embedded for single-file deployment)
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
    if (!query || query.trim().length < 2) return [];

    const queryNorm = query.toLowerCase().trim();
    const queryTokens = this.tokenize(queryNorm);
    const results = [];

    for (const entry of this.herbIndex) {
      let score = 0;
      let matchType = null;

      // Exact name match
      if (entry.nameLower === queryNorm) {
        score = 100;
        matchType = 'exact_name';
      } 
      // Exact latin match
      else if (entry.latinLower === queryNorm) {
        score = 100;
        matchType = 'exact_latin';
      }
      // Partial name match
      else if (entry.nameLower.includes(queryNorm)) {
        score = 90;
        matchType = 'partial_name';
      }
      // Partial latin match
      else if (entry.latinLower.includes(queryNorm)) {
        score = 85;
        matchType = 'partial_latin';
      }
      // Keyword exact match
      else if (entry.keywords.some(k => k === queryNorm)) {
        score = 80;
        matchType = 'keyword_exact';
      }
      // Keyword partial match
      else if (entry.keywords.some(k => k.includes(queryNorm))) {
        score = 70;
        matchType = 'keyword_partial';
      }
      // Fuzzy match on name or latin
      else {
        const nameSimilarity = this.levenshteinSimilarity(queryNorm, entry.nameLower);
        const latinSimilarity = this.levenshteinSimilarity(queryNorm, entry.latinLower);
        const maxSimilarity = Math.max(nameSimilarity, latinSimilarity);

        if (maxSimilarity >= 0.60) {
          score = 50 + (maxSimilarity * 25);
          matchType = nameSimilarity > latinSimilarity ? 'fuzzy_name' : 'fuzzy_latin';
        }
      }

      // Token-based matching for multi-word queries
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
    for (let i = 0; i <= str2.length; i++) matrix[i] = [i];
    for (let j = 0; j <= str1.length; j++) matrix[0][j] = j;
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
    // Parse parameters
    const query = (event.queryStringParameters?.q || '').trim();
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || '20'), 100);
    const useFuzzy = event.queryStringParameters?.fuzzy !== 'false';
    const confidence = Math.max(0, Math.min(100, parseInt(event.queryStringParameters?.confidence || '30')));

    // Validate query
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
    
    // Handle both array and object format
    const herbs = Array.isArray(herbData) ? herbData : Object.values(herbData);

    // Initialize matcher
    const matcher = new FuzzyHerbMatcher(herbs);

    // Find matches
    const allMatches = matcher.findMatches(query, limit * 2, Math.max(30, confidence));

    // Separate by confidence tier
    const exactMatches = allMatches.filter(m => m.score >= 85);
    const closeMatches = allMatches.filter(m => m.score >= 60 && m.score < 85);
    const possibleMatches = allMatches.filter(m => m.score >= 40 && m.score < 60);

    const results = [
      ...exactMatches,
      ...closeMatches,
      ...possibleMatches
    ].slice(0, limit);

    // Build suggestions (top 5)
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

    // Overall confidence
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
          relevance_score: r.score,
          match_reason: r.reason
        })),
        total_found: results.length,
        suggestions: suggestions,
        confidence: overallConfidence
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
