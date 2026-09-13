# Template: Type-Based Content Validation System
**Extracted from:** C.H.I. / Herbadex (Sept 2026)
**Use case:** Any project where you have a curated database of "things," generate rich content about each one on-demand via an LLM, need to reject invalid/off-topic requests, and want that validation to be cheap, fast, and easy to expand.

---

## The Problem This Solves

You've got:
- A catalog of items (herbs, products, recipes, exercises, whatever)
- An API endpoint that generates a rich profile/page for an item on request, using an LLM
- A need to reject requests that don't belong (junk input, off-topic items, spam)

**The naive first approach** — ask the LLM itself "is this a valid X?" before generating — works but is:
- Slow (an extra LLM round-trip per request)
- Inconsistent (the LLM's judgment call can vary run to run)
- Expensive at scale

**This pattern replaces that with a deterministic, instant lookup**, backed by a `type` field you control.

---

## The Architecture

```
Request comes in for "ItemName"
        │
        ▼
1. Check cache (Supabase/DB) — if already generated, serve instantly
        │ (miss)
        ▼
2. Look up "ItemName" in your catalog JSON
        │
        ▼
3. TYPE-BASED VALIDATION (this template's core piece):
   a. Does the catalog entry have a `type`? Is that type in BLOCKED_TYPES? → reject
   b. Is the name itself in a hardcoded NON_ALLOWED_EXACT list
      (catches junk that isn't even in the catalog)? → reject
   c. Otherwise → allowed (including "unknown" type — logged, not blocked)
        │
        ▼
4. Generate content via LLM
        │
        ▼
5. Cache the result, return it
```

---

## Part 1 — The Catalog Schema

Every item in your database gets a `type` field. Keep the type list as a flat array of strings — no nested taxonomy, no enums baked into a schema migration. This is what makes it cheap to expand later.

```json
{
  "metadata": {
    "total_items": 612,
    "categories": {
      "category_a": 528,
      "category_b": 30,
      "category_c": 25
    }
  },
  "items": [
    { "name": "Example Item", "type": "category_a", "...": "...other fields..." }
  ]
}
```

**Categorization script pattern** (Python, run once to backfill `type` on an existing catalog):

```python
import json
from collections import defaultdict

def categorize(item):
    name = item.get('name', '').lower()
    combined_text = f"{name} {item.get('summary','')} {item.get('tags','')}".lower()

    # Check exact-name blocklist FIRST (highest confidence, avoids false positives)
    if name in BLOCKED_EXACT_NAMES:
        return 'blocked_category'

    # Then keyword/substring rules, ordered most-specific to least-specific
    for keyword in SPECIFIC_CATEGORY_KEYWORDS:
        if keyword in combined_text:
            return 'specific_category'

    # Fallback default — pick whatever is the "safe majority" case for your domain
    return 'default_category'

# IMPORTANT: use exact-name matching for anything that could be a substring
# of a legitimate item's name. Substring matching bit us hard — see
# "Lessons Learned" below (e.g. "turkey" matching inside "Turkey Rhubarb").
```

---

## Part 2 — The Validation Function (drop into your generation endpoint)

```javascript
// ── TYPE-BASED VALIDATION ──
// Validate by item type field, looked up from your catalog. Allowed types
// are content categories you want to generate for. Blocked types are things
// that look superficially similar but should be rejected.

const ALLOWED_TYPES = [
  'category_a',
  'category_b',
  'category_c'
  // Add new categories here as the database grows — no other code changes needed.
];

const BLOCKED_TYPES = [
  'blocked_category_a',
  'blocked_category_b'
];

// Direct blocklist — catches obvious invalid items even when they aren't in
// the catalog at all, so an "unknown" type can't slip through. Use EXACT
// word match only, never substring, to avoid false positives on compound
// names (see Lessons Learned).
const NON_ALLOWED_EXACT = [
  'known-bad-item-1',
  'known-bad-item-2'
  // Extend this list as new false negatives turn up in testing/production
];

const catalogEntry = catalog.find(i => i.name.toLowerCase() === requestedName.toLowerCase());
const itemType = catalogEntry ? (catalogEntry.type || 'unknown') : 'unknown';
const isBlockedByType = BLOCKED_TYPES.includes(itemType);
const isBlockedByName = NON_ALLOWED_EXACT.includes(requestedName.toLowerCase());

if (isBlockedByType || isBlockedByName) {
  // Optional: clean up any stale cache entry for this rejected item
  return {
    statusCode: 400,
    body: JSON.stringify({
      error: 'not_valid',
      message: `"${requestedName}" is categorized as a ${(isBlockedByType ? itemType : 'excluded item').replace(/_/g, ' ')} — this tool only generates content for [your allowed categories]. If this looks wrong, try a different name.`
    })
  };
}

if (itemType === 'unknown') {
  console.warn(`[WARNING] ${requestedName} has unknown type — allowing generation. Consider categorizing it.`);
}
// END TYPE-BASED VALIDATION
```

**Key design decision:** unknown types are *allowed by default*, not blocked. This keeps the system permissive toward legitimate new items you haven't categorized yet — the `NON_ALLOWED_EXACT` list is what catches known-bad requests instead of a strict deny-by-default. Flip this default only if your catalog is meant to be a closed, complete set (i.e. nothing outside it should ever generate).

---

## Part 3 — Caching Layer

Pattern used: check cache → miss → generate → write to cache → serve. On any cache read, "heal" the row if newer fields are missing (backward-compatible schema evolution) and re-save.

```javascript
// 1. Check cache first
const cached = await db.from('items').select('data, status').eq('name', name).maybeSingle();
if (cached?.data?.status === 'complete') {
  return cached.data; // instant, no LLM call
}

// 2. Generate (only reached on cache miss, after validation passes)
const generated = await callLLM(...);

// 3. Cache it
await db.from('items').upsert({ name, status: 'complete', data: generated }, { onConflict: 'name' });
```

---

## Lessons Learned (apply these next time, save yourself the debugging)

1. **Substring matching in categorization is a false-positive trap.** `"turkey" in "turkey rhubarb"` matches even though Turkey Rhubarb is a legitimate herb, not poultry. Always prefer exact-name equality for anything going into a BLOCKED list; reserve substring/keyword matching for ALLOWED categorization where a false positive just means "slightly wrong bucket" rather than "wrongly rejected."

2. **A curated catalog can't block what isn't in it.** If your validation only checks catalog-listed items, anything NOT in the catalog defaults to "unknown" and — if you allow unknowns — sails through. A direct exact-match blocklist (`NON_ALLOWED_EXACT`) checked independently of catalog membership closes this gap for the most common bad-input cases.

3. **"Write succeeded" isn't proof the write happened**, especially over a remote file bridge or flaky I/O layer. When syncing generated files to another environment (a device bridge, an FTP push, whatever), verify by reading the file back and checking actual content — not just trusting a success response or an unchanged-but-plausible byte count. This bit us multiple times: a tool reported success while silently leaving stale content in place.

4. **Extensibility means "add a string to an array," not "write new code."** The whole point of the `type` field + `ALLOWED_TYPES`/`BLOCKED_TYPES` arrays is that growing the system from 600 items to 10,000, or from 8 categories to 30, never requires touching the validation logic itself — only data (the catalog) and a one-line array addition.

5. **Keep the reject message specific.** Telling the user *why* something was rejected (its category) rather than a generic "invalid item" error makes debugging false positives trivial — you see instantly whether it's a categorization bug or a genuinely correct rejection.

---

## Checklist for Reusing This in a New Project

- [ ] Define your domain's catalog schema with a flat `type: string` field per item
- [ ] Write/run a one-time categorization script to backfill `type` on existing data
- [ ] Define `ALLOWED_TYPES` and `BLOCKED_TYPES` for your domain
- [ ] Build `NON_ALLOWED_EXACT` from real bad-input examples you've seen (start empty, add as issues surface)
- [ ] Decide: unknown type = allow (permissive) or block (strict)? Depends whether your catalog is meant to be exhaustive.
- [ ] Wire validation into your generation endpoint, before the LLM call
- [ ] Add cache read/write around the LLM call
- [ ] Test with: a known-good item, a known-bad item that IS in the catalog, a known-bad item NOT in the catalog, and an edge-case name that could false-positive on your keyword rules
