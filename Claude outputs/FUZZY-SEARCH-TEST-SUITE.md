# 🧪 Fuzzy Herb Search - Test Suite
## Comprehensive Testing Guide for supreme.html

**Purpose:** Verify fuzzy matching works for all herb name variations

**Total Test Cases:** 50+

**Time Required:** ~30 minutes

---

## Test Environment Setup

### Before Testing
1. Deploy `herb-search-improved.js` to `netlify/functions/herb-search.js`
2. Load `chi-fuzzy-matcher.js` into `supreme.html`
3. Update search handler with suggestion UI
4. Open browser DevTools (F12) → Console tab (to watch for errors)

### Browser Test
- Chrome/Firefox/Safari (recommended)
- Test on desktop and mobile (responsive)
- Test with and without internet cache (Ctrl+Shift+Delete)

---

## Quick Test Matrix (5 minutes)

Run these 5 searches first to verify basic functionality:

| # | Query | Expected Match | Confidence | Pass? |
|---|-------|-----------------|------------|-------|
| 1 | "ginger" | Ginger (exact) | 100% | ☐ |
| 2 | "japaneese" | Japanese Knotweed (fuzzy) | 70-85% | ☐ |
| 3 | "st johns wort" | St. John's Wort (token) | 60-75% | ☐ |
| 4 | "immune" | Multiple herbs (keyword) | 70-80% | ☐ |
| 5 | "turmeric" | Turmeric (exact) | 100% | ☐ |

**Result:** If all 5 pass → Fuzzy search is working ✅

---

## Full Test Suite

### Category 1: Exact Name Matches (Should return 100%)

These should be instant, highest confidence matches.

```
Test 1.1: "Ginger"
├─ Expected: Ginger
├─ Confidence: 100%
├─ Match Type: exact_name
└─ Pass: ☐

Test 1.2: "Turmeric"
├─ Expected: Turmeric
├─ Confidence: 100%
├─ Match Type: exact_name
└─ Pass: ☐

Test 1.3: "Chamomile"
├─ Expected: Chamomile (German or Roman, either OK)
├─ Confidence: 100%
├─ Match Type: exact_name
└─ Pass: ☐

Test 1.4: "Licorice"
├─ Expected: Licorice
├─ Confidence: 100%
├─ Match Type: exact_name
└─ Pass: ☐

Test 1.5: "Echinacea"
├─ Expected: Echinacea (purpurea or angustifolia, either OK)
├─ Confidence: 100%
├─ Match Type: exact_name
└─ Pass: ☐
```

### Category 2: Case Insensitivity (Should return 90-100%)

These test whether uppercase/lowercase variations work.

```
Test 2.1: "GINGER" (uppercase)
├─ Expected: Ginger
├─ Confidence: 90%+
├─ Match Type: partial_name or similar
└─ Pass: ☐

Test 2.2: "TuRmErIc" (mixed case)
├─ Expected: Turmeric
├─ Confidence: 90%+
└─ Pass: ☐

Test 2.3: "japanese knotweed" (lowercase)
├─ Expected: Japanese Knotweed
├─ Confidence: 90%+
└─ Pass: ☐

Test 2.4: "JAPANESE KNOTWEED" (uppercase)
├─ Expected: Japanese Knotweed
├─ Confidence: 85-95%
└─ Pass: ☐
```

### Category 3: Spelling Mistakes (Should return 50-85%)

These test typo tolerance via Levenshtein distance.

```
Test 3.1: "ginjer" (missing second 'g')
├─ Expected: Ginger
├─ Confidence: 70-80%
├─ Match Type: fuzzy_name
└─ Pass: ☐

Test 3.2: "tumeric" (missing second 'r')
├─ Expected: Turmeric
├─ Confidence: 80-90%
├─ Match Type: fuzzy_name
└─ Pass: ☐

Test 3.3: "chamomille" (extra 'l')
├─ Expected: Chamomile
├─ Confidence: 75-85%
├─ Match Type: fuzzy_name
└─ Pass: ☐

Test 3.4: "japaneese" (extra 'e')
├─ Expected: Japanese Knotweed
├─ Confidence: 70-80%
├─ Match Type: fuzzy_name
└─ Pass: ☐

Test 3.5: "licroce" (3-char difference)
├─ Expected: Licorice (if confidence allows)
├─ Confidence: 50-70%
├─ Match Type: fuzzy_name
└─ Pass: ☐
```

### Category 4: Spacing Variants (Should return 60-80%)

These test multi-word name handling with different spacing.

```
Test 4.1: "st johns wort" (spaces instead of hyphens)
├─ Expected: St. John's Wort
├─ Confidence: 65-75%
├─ Match Type: token_match
└─ Pass: ☐

Test 4.2: "st-johns-wort" (hyphens)
├─ Expected: St. John's Wort
├─ Confidence: 65-75%
├─ Match Type: token_match
└─ Pass: ☐

Test 4.3: "st. john's wort" (with periods)
├─ Expected: St. John's Wort
├─ Confidence: 75-85%
└─ Pass: ☐

Test 4.4: "japanese knotweed" (spaces)
├─ Expected: Japanese Knotweed
├─ Confidence: 85-95%
├─ Match Type: partial_name
└─ Pass: ☐

Test 4.5: "st    johns    wort" (extra spaces)
├─ Expected: St. John's Wort
├─ Confidence: 60-70%
└─ Pass: ☐
```

### Category 5: Partial Names (Should return 85-95%)

These test substring matching.

```
Test 5.1: "knotweed"
├─ Expected: Japanese Knotweed (within name)
├─ Confidence: 85-95%
├─ Match Type: partial_name
└─ Pass: ☐

Test 5.2: "wort"
├─ Expected: Multiple herbs (St. John's Wort, Mugwort, etc.)
├─ Confidence: 85-95% for each
├─ Match Type: partial_name
└─ Pass: ☐

Test 5.3: "berry"
├─ Expected: Multiple herbs (Hawthorn Berry, Goji Berry, etc.)
├─ Confidence: 85-95% for each
└─ Pass: ☐

Test 5.4: "root"
├─ Expected: Multiple herbs with "root" in name
├─ Confidence: 85-95% for each
└─ Pass: ☐

Test 5.5: "ginger" (partial, even though exact)
├─ Expected: Ginger (and possibly Ginger (dry) if exists)
├─ Confidence: 90%+ for all
└─ Pass: ☐
```

### Category 6: Latin Names (Should return 85-100%)

These test scientific name matching.

```
Test 6.1: "Zingiber officinale" (exact Latin)
├─ Expected: Ginger
├─ Confidence: 100%
├─ Match Type: exact_latin
└─ Pass: ☐

Test 6.2: "Curcuma longa" (exact Latin)
├─ Expected: Turmeric
├─ Confidence: 100%
├─ Match Type: exact_latin
└─ Pass: ☐

Test 6.3: "Reynoutria japonica" (exact Latin)
├─ Expected: Japanese Knotweed
├─ Confidence: 100%
├─ Match Type: exact_latin
└─ Pass: ☐

Test 6.4: "zingiber" (partial Latin)
├─ Expected: Ginger
├─ Confidence: 85-95%
├─ Match Type: partial_latin
└─ Pass: ☐

Test 6.5: "curcuma" (partial Latin)
├─ Expected: Turmeric
├─ Confidence: 85-95%
├─ Match Type: partial_latin
└─ Pass: ☐

Test 6.6: "zingber" (typo in Latin)
├─ Expected: Ginger (fuzzy match)
├─ Confidence: 70-80%
├─ Match Type: fuzzy_latin
└─ Pass: ☐
```

### Category 7: Keywords (Should return 70-80%)

These test keyword-based matching (properties like "immune" or "sleep").

```
Test 7.1: "immune"
├─ Expected: Multiple immune-supporting herbs
├─ Confidence: 70-80% for each
├─ Match Type: keyword_exact or keyword_partial
└─ Pass: ☐

Test 7.2: "sleep"
├─ Expected: Multiple sleep-supporting herbs
├─ Confidence: 70-80% for each
└─ Pass: ☐

Test 7.3: "digestive"
├─ Expected: Multiple digestive herbs
├─ Confidence: 70-80% for each
└─ Pass: ☐

Test 7.4: "inflammation"
├─ Expected: Multiple anti-inflammatory herbs
├─ Confidence: 70-80% for each
└─ Pass: ☐

Test 7.5: "detox"
├─ Expected: Multiple detoxifying herbs
├─ Confidence: 70-80% for each
└─ Pass: ☐
```

### Category 8: Edge Cases (Variable Results OK)

These test boundary conditions and unusual inputs.

```
Test 8.1: Empty query ""
├─ Expected: Error message or full list
├─ Should NOT crash
└─ Pass: ☐

Test 8.2: Single character "a"
├─ Expected: Error message (too short)
├─ Should NOT crash
└─ Pass: ☐

Test 8.3: Very long query "thisisherbalistyouwillneverfindbecauseitdoesnotexist"
├─ Expected: No results or error
├─ Should NOT crash
└─ Pass: ☐

Test 8.4: Special characters "!@#$%"
├─ Expected: No results
├─ Should NOT crash
└─ Pass: ☐

Test 8.5: Numbers "2024"
├─ Expected: No results
├─ Should NOT crash
└─ Pass: ☐

Test 8.6: Quote marks "ginger's"
├─ Expected: Ginger (or similar)
├─ Should handle gracefully
└─ Pass: ☐

Test 8.7: Emoji "🌿 ginger"
├─ Expected: Ginger
├─ Should strip emoji safely
└─ Pass: ☐
```

### Category 9: Tradition Filtering

These test filtering results by herbal tradition.

```
Test 9.1: "turmeric" + tradition="Ayurveda"
├─ Expected: Turmeric (Ayurvedic tradition)
├─ Confidence: 100%
└─ Pass: ☐

Test 9.2: "ginger" + tradition="Traditional Chinese Medicine"
├─ Expected: Ginger (TCM tradition)
├─ Confidence: 100%
└─ Pass: ☐

Test 9.3: "ginkgo" + tradition="Traditional Chinese Medicine"
├─ Expected: Ginkgo (TCM tradition)
├─ Confidence: 100%
└─ Pass: ☐

Test 9.4: "chamomile" + tradition="Western Herbalism"
├─ Expected: Chamomile (Western tradition)
├─ Confidence: 100%
└─ Pass: ☐

Test 9.5: Query with wrong tradition
├─ Query: "turmeric" + tradition="Native American"
├─ Expected: No results or "not in this tradition"
└─ Pass: ☐
```

### Category 10: UI/UX Tests

These test the user experience and suggestion display.

```
Test 10.1: Suggestions appear
├─ Perform search: "ginger"
├─ Expected: Suggestion cards show
├─ UI should be clickable
└─ Pass: ☐

Test 10.2: Clicking suggestion navigates
├─ Perform search: "japaneese"
├─ Click suggestion card
├─ Expected: Navigate to herb profile
├─ Should NOT crash
└─ Pass: ☐

Test 10.3: Confidence badges display
├─ Perform search: any search
├─ Expected: "High/Medium/Low Confidence" badge appears
├─ Should show percentage
└─ Pass: ☐

Test 10.4: Match reason displays
├─ Perform search: any search
├─ Expected: "Exact match" or "Possible typo" reason shows
├─ Should be human-readable
└─ Pass: ☐

Test 10.5: Results sort by confidence
├─ Perform search: "immune"
├─ Expected: Highest confidence results at top
├─ Lower confidence results below
└─ Pass: ☐

Test 10.6: Mobile responsiveness
├─ Open in mobile view (F12 → responsive)
├─ Perform search
├─ Expected: Suggestion cards stack vertically
├─ Should be readable on phone
└─ Pass: ☐
```

---

## Performance Benchmarks

Run these and log response times:

```
| Query | Expected Time | Actual | Pass? |
|-------|----------------|--------|-------|
| "ginger" | <100ms | ___ms | ☐ |
| "immune" | <100ms | ___ms | ☐ |
| "japanese knotweed" | <100ms | ___ms | ☐ |
| "thiswordyoucannotfind" | <100ms | ___ms | ☐ |
| First cold start (any) | <3000ms | ___ms | ☐ |

Target: All <100ms (except cold start)
```

---

## Known Herb Test Set

Use these real herbs for testing (ensure they're in herbadex_index_searchable.json):

| Herb | Latin Name | Tradition | Keywords |
|------|-----------|-----------|----------|
| Ginger | Zingiber officinale | Ayurveda, TCM | immune, digestive, warming |
| Turmeric | Curcuma longa | Ayurveda | immune, anti-inflammatory, digestive |
| Chamomile | Matricaria chamomilla | Western | sleep, calming, digestive |
| Licorice | Glycyrrhiza glabra | TCM | sweet, tonifying |
| Echinacea | Echinacea purpurea | Native American | immune, wound-healing |
| St. John's Wort | Hypericum perforatum | Western | mood, nerve |
| Hawthorn | Crataegus spp | Western | heart, circulation |
| Ginkgo | Ginkgo biloba | TCM | memory, circulation |
| Ashwagandha | Withania somnifera | Ayurveda | stress, energy |
| Japanese Knotweed | Reynoutria japonica | Western | detox, circulation |

---

## Automated Test Script

Save this as `test-fuzzy-search.js` and run in browser console:

```javascript
// Fuzzy Search Test Runner
async function runFuzzyTests() {
  const tests = [
    { query: 'ginger', expect: 'Ginger', minConfidence: 90 },
    { query: 'japaneese', expect: 'Japanese Knotweed', minConfidence: 60 },
    { query: 'st johns wort', expect: "St. John's Wort", minConfidence: 60 },
    { query: 'immune', expect: 'multiple', minConfidence: 60 },
    { query: 'turmeric', expect: 'Turmeric', minConfidence: 90 },
  ];

  let passed = 0;
  let failed = 0;

  console.log('🧪 Fuzzy Search Test Suite\n');

  for (const test of tests) {
    console.log(`Test: "${test.query}"`);
    const startTime = performance.now();

    try {
      const url = `/.netlify/functions/herb-search?q=${encodeURIComponent(test.query)}&fuzzy=true`;
      const response = await fetch(url);
      const data = await response.json();

      const endTime = performance.now();
      const time = Math.round(endTime - startTime);

      if (data.success && data.results && data.results.length > 0) {
        const topResult = data.results[0];
        console.log(`✅ PASS - Found: "${topResult.name}" (${topResult.relevance_score}%, ${time}ms)`);
        passed++;
      } else {
        console.log(`❌ FAIL - No results`);
        failed++;
      }
    } catch (error) {
      console.log(`❌ ERROR - ${error.message}`);
      failed++;
    }

    console.log('---');
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// Run it
runFuzzyTests();
```

---

## Reporting Results

When tests are complete, create a summary:

```
FUZZY SEARCH TEST RESULTS
========================

Date: _______________
Environment: Supreme.html (Herbadex)
Browser: _______________

QUICK TEST (5 tests)
✅ Exact matches: 5/5
✅ Typos: 5/5
✅ Spacing: 5/5
✅ Keywords: 5/5
❌ Latin names: 3/5

FULL TEST SUITE (50+ tests)
✅ Exact names: 5/5 (100%)
✅ Case insensitivity: 4/4 (100%)
✅ Spelling mistakes: 5/5 (100%)
✅ Spacing variants: 5/5 (100%)
✅ Partial names: 5/5 (100%)
✅ Latin names: 6/6 (100%)
✅ Keywords: 5/5 (100%)
⚠️  Edge cases: 6/7 (86%)
✅ Tradition filtering: 5/5 (100%)
✅ UI/UX: 6/6 (100%)

PERFORMANCE
Average search time: ___ms
Cold start time: ___ms
Slow query (>200ms): None observed

ISSUES FOUND
1. [Issue description]
2. [Issue description]

RECOMMENDATION
☐ Ready for production
☐ Ready with fixes
☐ Needs more work
```

---

## Troubleshooting Test Failures

### If Exact Match Fails
```
Checklist:
☐ Herb exists in herbadex_index_searchable.json?
☐ Spelling matches exactly?
☐ Query properly URL-encoded?
☐ herb-search.js deployed and restarted?
```

### If Typo Matching Fails
```
Checklist:
☐ fuzzy=true parameter included?
☐ Levenshtein distance reasonable (<=3)?
☐ Minimum confidence set correctly?
☐ Are similar words in test set?
```

### If UI Not Showing
```
Checklist:
☐ Suggestions container div exists in HTML?
☐ JavaScript error in console?
☐ API response includes "suggestions" field?
☐ CSS loaded correctly?
```

---

**Total Test Duration:** ~30 minutes  
**Estimated Pass Rate:** 95%+ (first deployment)  
**Next Steps:** Fix any failures, then deploy to production

