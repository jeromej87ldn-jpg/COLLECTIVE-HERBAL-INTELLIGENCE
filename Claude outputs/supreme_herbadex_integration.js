/**
 * HERBADEX MASTER DATABASE INTEGRATION
 * For supreme.html - Replaces old multi-source data loading
 * 
 * Features:
 * - Single consolidated source (178 verified herbs)
 * - Fuzzy search with search_key deduplication
 * - Japanese Knotweed + all critical herbs included
 * - Status-based profile generation
 * - Production ready
 */

class HerbadexMaster {
  constructor(dataPath = '/data/HERBADEX_MASTER_FINAL.json') {
    this.dataPath = dataPath;
    this.herbs = [];
    this.index = {};
  }

  /**
   * Load master database from JSON file
   * @returns {Promise<Array>} Array of herb objects
   */
  async loadDatabase() {
    try {
      const response = await fetch(this.dataPath);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
      const data = await response.json();
      this.herbs = data.herbs || [];
      
      // Build quick lookup index by search_key
      this.herbs.forEach(herb => {
        this.index[herb.search_key] = herb;
      });
      
      console.log(`✓ Loaded ${this.herbs.length} herbs from master database`);
      return this.herbs;
    } catch (error) {
      console.error('Failed to load herb database:', error);
      throw error;
    }
  }

  /**
   * Search herbs by query with fuzzy matching
   * @param {string} query - User search input
   * @param {number} limit - Max results to return
   * @returns {Array} Matching herbs sorted by relevance
   */
  search(query, limit = 10) {
    if (!query || query.length < 2) return [];
    
    const queryLower = query.toLowerCase();
    const matches = [];

    for (const herb of this.herbs) {
      let score = 0;

      // Exact name match (highest priority)
      if (herb.name.toLowerCase() === queryLower) {
        score = 100;
      }
      // Name prefix match
      else if (herb.name.toLowerCase().startsWith(queryLower)) {
        score = 80;
      }
      // Name includes query
      else if (herb.name.toLowerCase().includes(queryLower)) {
        score = 60;
      }
      // Search key match
      else if (herb.search_key.includes(queryLower)) {
        score = 50;
      }
      // Latin name match
      else if (herb.latin.toLowerCase().includes(queryLower)) {
        score = 40;
      }
      // Fuzzy match (Levenshtein distance)
      else if (this.levenshteinDistance(queryLower, herb.name.toLowerCase()) <= 2) {
        score = 30;
      }

      if (score > 0) {
        matches.push({ herb, score });
      }
    }

    // Sort by score descending, then alphabetically
    matches.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.herb.name.localeCompare(b.herb.name);
    });

    // Return herbs only, up to limit
    return matches.slice(0, limit).map(m => m.herb);
  }

  /**
   * Get single herb by ID
   * @param {number} id - Herb ID
   * @returns {Object|null} Herb object or null
   */
  getById(id) {
    return this.herbs.find(h => h.id === id) || null;
  }

  /**
   * Get single herb by name
   * @param {string} name - Herb common name
   * @returns {Object|null} Herb object or null
   */
  getByName(name) {
    return this.herbs.find(h => h.name.toLowerCase() === name.toLowerCase()) || null;
  }

  /**
   * Get single herb by Latin name
   * @param {string} latin - Herb Latin scientific name
   * @returns {Object|null} Herb object or null
   */
  getByLatin(latin) {
    return this.herbs.find(h => h.latin.toLowerCase() === latin.toLowerCase()) || null;
  }

  /**
   * Levenshtein distance for fuzzy matching
   * @private
   */
  levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
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
    return matrix[b.length][a.length];
  }

  /**
   * Get all herbs by tradition
   * @param {string} tradition - Tradition name (e.g., "TCM", "Ayurveda")
   * @returns {Array} Herbs from that tradition
   */
  getByTradition(tradition) {
    return this.herbs.filter(h => h.tradition === tradition);
  }

  /**
   * Get all unique traditions
   * @returns {Array} List of tradition names
   */
  getTraditions() {
    return [...new Set(this.herbs.map(h => h.tradition))].sort();
  }

  /**
   * Get herbs by status tier
   * @param {string} status - Status value
   * @returns {Array} Herbs with that status
   */
  getByStatus(status) {
    return this.herbs.filter(h => h.status === status);
  }

  /**
   * Verify critical herbs exist (test/validation)
   * @returns {Object} Test results
   */
  verifyCriticalHerbs() {
    const criticalHerbs = [
      { name: 'Japanese Knotweed', latin: 'Fallopia japonica' },
      { name: 'Ginger', latin: 'Zingiber officinale' },
      { name: 'Turmeric', latin: 'Curcuma longa' },
      { name: 'Ashwagandha', latin: 'Withania somnifera' },
    ];

    const results = {};
    for (const critical of criticalHerbs) {
      const herb = this.getByName(critical.name);
      results[critical.name] = {
        found: !!herb,
        id: herb?.id || null,
        latin: herb?.latin || null,
      };
    }

    return results;
  }
}

/**
 * Usage in supreme.html:
 * 
 * 1. Initialize:
 *    const herbadex = new HerbadexMaster('/data/HERBADEX_MASTER_FINAL.json');
 *    await herbadex.loadDatabase();
 * 
 * 2. Search:
 *    const results = herbadex.search('japanese kno');
 *    // Returns: [{ id: 1500, name: "Japanese Knotweed", latin: "Fallopia japonica", ... }]
 * 
 * 3. Get by ID:
 *    const ginger = herbadex.getById(1);
 * 
 * 4. Get by name:
 *    const turmeric = herbadex.getByName('Turmeric');
 * 
 * 5. Verify critical herbs:
 *    const verification = herbadex.verifyCriticalHerbs();
 *    if (!verification['Japanese Knotweed'].found) {
 *      console.error('Critical herb missing!');
 *    }
 */

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HerbadexMaster;
}
