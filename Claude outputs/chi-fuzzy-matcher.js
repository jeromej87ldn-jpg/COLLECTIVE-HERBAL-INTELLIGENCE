/**
 * C.H.I. Fuzzy Herb Matcher
 * Provides forgiving search for complex herb names with typo tolerance
 *
 * Usage:
 *   const matcher = new FuzzyHerbMatcher(herbList);
 *   const results = matcher.findMatches("japaneese knotweed");
 *   // Returns: [{herb, score, reason}, {herb, score, reason}, ...]
 */

class FuzzyHerbMatcher {
  constructor(herbs = []) {
    this.herbs = herbs;
    // Build search index for performance
    this.herbIndex = herbs.map((herb, idx) => ({
      idx,
      herb,
      nameLower: herb.name.toLowerCase(),
      latinLower: (herb.latin_name || '').toLowerCase(),
      keywords: (herb.keywords || []).map(k => k.toLowerCase()),
      parts: this.tokenize(herb.name + ' ' + (herb.latin_name || '') + ' ' + (herb.keywords || []).join(' '))
    }));
  }

  /**
   * Find matching herbs for a query string
   * Returns array of {herb, score, reason, matchType}
   * scored from 100 (perfect match) down to 0 (no match)
   */
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

      // LAYER 1: Exact name match (100 points)
      if (entry.nameLower === queryNorm) {
        score = 100;
        matchType = 'exact_name';
      }
      // LAYER 2: Exact latin match (100 points)
      else if (entry.latinLower === queryNorm) {
        score = 100;
        matchType = 'exact_latin';
      }
      // LAYER 3: Partial name match (90 points)
      else if (entry.nameLower.includes(queryNorm)) {
        score = 90;
        matchType = 'partial_name';
      }
      // LAYER 4: Partial latin match (85 points)
      else if (entry.latinLower.includes(queryNorm)) {
        score = 85;
        matchType = 'partial_latin';
      }
      // LAYER 5: Keyword exact match (80 points)
      else if (entry.keywords.some(k => k === queryNorm)) {
        score = 80;
        matchType = 'keyword_exact';
      }
      // LAYER 6: Keyword partial match (70 points)
      else if (entry.keywords.some(k => k.includes(queryNorm))) {
        score = 70;
        matchType = 'keyword_partial';
      }
      // LAYER 7: Fuzzy match on name (50-75 points)
      else {
        const nameSimilarity = this.levenshteinSimilarity(queryNorm, entry.nameLower);
        const latinSimilarity = this.levenshteinSimilarity(queryNorm, entry.latinLower);
        const maxSimilarity = Math.max(nameSimilarity, latinSimilarity);

        if (maxSimilarity >= 0.60) { // 60% similarity threshold
          score = 50 + (maxSimilarity * 25); // 50-75 points
          matchType = nameSimilarity > latinSimilarity ? 'fuzzy_name' : 'fuzzy_latin';
        }
      }

      // LAYER 8: Token-based matching (40-60 points)
      if (score === 0) {
        const tokenScore = this.tokenSimilarity(queryTokens, entry.parts);
        if (tokenScore > 0.5) {
          score = 40 + (tokenScore * 20); // 40-60 points
          matchType = 'token_match';
        }
      }

      // Add result if score meets minimum
      if (score >= minScore) {
        results.push({
          herb: entry.herb,
          score: Math.round(score),
          reason: this.getMatchReason(matchType),
          matchType
        });
      }
    }

    // Sort by score descending, then by herb name for ties
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.herb.name.localeCompare(b.herb.name);
    });

    return results.slice(0, maxResults);
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Returns similarity ratio (0-1, where 1 = perfect match)
   */
  levenshteinSimilarity(str1, str2) {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1.0;

    const distance = this.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLen);
  }

  /**
   * Calculate Levenshtein distance (edit distance)
   * Used for typo/misspelling detection
   */
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
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Tokenize string into words (for token-based matching)
   */
  tokenize(text) {
    return text.toLowerCase()
      .split(/[\s\-\(\),\.\/]+/)
      .filter(token => token.length > 1);
  }

  /**
   * Calculate similarity between token sets
   * Used for multi-word matching (e.g., "st johns wort")
   */
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

  /**
   * Get human-readable reason for match
   */
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

  /**
   * Check if two herbs are likely the same (for deduplication)
   * Returns true if similarity > 95%
   */
  areLikelyDuplicates(herb1, herb2) {
    const nameSim = this.levenshteinSimilarity(
      herb1.name.toLowerCase(),
      herb2.name.toLowerCase()
    );
    return nameSim > 0.95;
  }
}

// Export for use in Node/Netlify functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FuzzyHerbMatcher;
}
