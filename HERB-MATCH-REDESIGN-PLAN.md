# HERB MATCH REDESIGN — Complete Implementation Plan

**Date:** July 2026  
**Version:** 2.0 (From Symptom Matcher → Discovery Engine + Database Builder)

---

## VISION

Transform Herb Match from a simple symptom-matcher into a **discovery engine that educates users AND builds the Herbadex database collaboratively**.

Users don't just get herb recommendations — they research alternatives, learn about new herbs, and contribute new profiles to the system.

---

## ARCHITECTURE

### User Flow (Main Journey)

```
1. DISCOVERY PHASE
   ├─ User selects up to 3 "common issues" (pyramid structure)
   │  └─ Searches ACTIONS array for herbs matching ALL 3 issues
   │
2. RESULTS PHASE
   ├─ Display matched herbs (cards, no profiles shown yet)
   ├─ User actions:
   │  ├─ Like herb? → Add to stack
   │  └─ Reject herb? → "Offer me alternatives"
   │
3. ALTERNATIVE PHASE (Smart Rejection)
   ├─ User chooses alternative
   ├─ System calls herb-profile.js API to generate NEW herb profile
   ├─ Profile created + cached in Supabase
   ├─ **DATABASE GROWS** (crowd-sourced research)
   │
4. PROFILE VIEWING (Same as Herbadex/PI)
   ├─ Click herb card → show full profile
   ├─ Navigation:
   │  ├─ Edge tab: "Back to Herb Match Results" (left)
   │  └─ Edge tab: "Plant Intelligence" (right)
   └─ Add/remove from herb stack
```

---

## UI COMPONENTS

### 1. PYRAMID/TREE OF ISSUES

**Structure:** Hierarchical categories (like a decision tree)

```
Common Issues You're Tackling
├─ Sleep & Rest
│  ├─ Insomnia
│  ├─ Restlessness
│  └─ Occasional wakefulness
├─ Mood & Mind
│  ├─ Stress & Overwhelm
│  ├─ Occasional anxiety
│  └─ Low mood
├─ Energy & Stamina
│  ├─ Low energy
│  ├─ Fatigue
│  └─ Brain fog
├─ Digestion & Gut
│  ├─ Occasional bloating
│  ├─ Slow digestion
│  └─ Cramping
└─ [More categories...]
```

**User can select UP TO 3** (multi-select checkboxes)

### 2. RESULTS DISPLAY

**When user submits (after selecting 3 issues):**
- Show herbs matching ALL 3 issues
- Display as cards (like Herbadex rankings grid)
- No profile shown initially
- Actions on each card:
  - "Add to stack" button
  - "View profile" link (expands inline or navigates)
  - "Reject this" button (triggers alternatives flow)

### 3. REJECTION/ALTERNATIVES FLOW

**When user clicks "Reject this":**
1. Show dropdown/modal: "Why are you rejecting this herb?"
   - "Already tried it"
   - "Cost/availability"
   - "Personal preference"
   - "Want something different"
2. Show loading: "Finding alternatives..."
3. Call herb-profile.js API with:
   - Original 3 issues
   - Excluded herb name
   - Get back: NEW herb recommendation
4. Display new herb card with:
   - "This is a better match for your needs"
   - "Learn about [Herb Name]"
   - Add to stack / Reject / View profile

### 4. NAVIGATION (Cross-tool)

**Edge tabs (same pattern as PI/Herbadex):**
- Left edge tab: "Back to Herb Match" (shows when viewing profile from Herb Match)
- Right edge tab: "Plant Intelligence" (from any profile)

---

## DATABASE BUILDING STREAM

**How Herb Match feeds the database:**

1. User rejects suggested herbs → API generates alternatives
2. New herb profile created via herb-profile.js (AI-generated)
3. Profile cached in Supabase (`.from('herbs').upsert()`)
4. Next user searching similar issues sees NEW herb in database
5. **Over time:** Database grows organically through user rejections

**Metrics to track:**
- Herbs discovered via alternatives flow
- Most common rejection reasons
- Alternative herbs that get added to stacks (signals value)

---

## TECHNICAL IMPLEMENTATION

### Backend Changes Needed

**1. Update herb-profile.js** (Netlify function)
- Already lazy-loads via API
- Needs to accept "excluded_herb" parameter
- Returns alternative herb when rejection triggered

**2. Create herb-match.js** (Netlify function - optional)
- Takes: [3 issues selected]
- Returns: list of herbs matching all 3
- Could also handle rejection logic

### Frontend Changes (herb-match.html)

**1. Remove demo UI**
- Delete placeholder results section
- Remove temporary callAPI() stub

**2. Build pyramid/tree component**
- Recursive checkboxes for issue categories
- Max 3 selections enforced
- Show count of selected issues

**3. Build results display**
- Grid of herb cards (no profiles)
- Actions: Add to stack / View profile / Reject
- Loading states for API calls

**4. Build alternatives modal**
- Why rejection dropdown
- Loading state while fetching alternative
- Display new herb card

**5. Build profile viewer**
- Click "View profile" → inline or navigate to profile
- Show Herbadex-style profile
- Edge tab: "Back to Herb Match" (left)
- Edge tab: "Plant Intelligence" (right)
- Add/remove from stack buttons

**6. Update herb stack integration**
- When adding herb from Herb Match → add to stack
- Stack persists across pages (localStorage)

---

## DATA FLOW

### Issues → Herbs Matching

```javascript
// User selects 3 issues: ["insomnia", "stress", "low energy"]
// System finds herbs in ACTIONS array where:
//   herb.actions includes "insomnia" AND
//   herb.actions includes "stress" AND
//   herb.actions includes "low energy"
// Returns: list of matching herbs
```

### Rejection → Alternative

```javascript
// User rejects "Ashwagandha"
// Call herb-profile.js with:
// {
//   issues: ["insomnia", "stress", "low energy"],
//   excluded_herb: "Ashwagandha"
// }
// API returns: NEW herb profile (e.g., "Passionflower")
// Cache in Supabase for future use
```

---

## ISSUE CATEGORIES (Pyramid Structure)

**Suggested structure (can be customized):**

- Sleep & Rest (Insomnia, Restlessness, Light sleep)
- Mood & Mind (Stress, Anxiety, Low mood, Focus)
- Energy & Stamina (Low energy, Fatigue, Brain fog)
- Digestion & Gut (Bloating, Slow digestion, Cramping)
- Immune Support (Occasional illness, Immune boost)
- Inflammation & Pain (Joint stiffness, Occasional pain)
- Women's Health (Cycle support, Hormonal balance)
- Men's Health (Vitality, Energy)
- Skin & Radiance (Skin clarity, Glow)
- Longevity & Aging (Anti-aging, Vitality)

---

## FILES TO CREATE/MODIFY

### New/Modified Files:

1. **herb-match.html** (COMPLETE REDESIGN)
   - Remove demo results
   - Add pyramid/tree UI
   - Add results grid
   - Add alternatives modal
   - Add profile viewer
   - Add cross-nav edge tabs

2. **netlify/functions/herb-profile.js** (MINOR UPDATE)
   - Add `excluded_herb` parameter
   - Filter alternatives based on exclusion
   - Existing lazy-loading works as-is

3. **HERB-MATCH-WORKFLOW.md** (NEW)
   - Visual flowchart of user journeys
   - Interaction guide

### Unchanged:
- phytochemistry.html (PI)
- supreme.html (Herbadex)
- ACTIONS/COMPOUNDS arrays (already have issue data)

---

## TESTING CHECKLIST

- [ ] User selects 3 issues → results display correctly
- [ ] Selecting more than 3 issues is blocked
- [ ] "Add to stack" saves herb to localStorage
- [ ] "Reject this" shows alternatives flow
- [ ] API call to herb-profile.js returns valid profile
- [ ] New profile caches in Supabase
- [ ] "View profile" shows full herb profile
- [ ] Edge tabs navigate correctly (back to Herb Match, to PI)
- [ ] Cross-page navigation persists herb stack
- [ ] Herb stack updates reflect on all pages

---

## NEXT STEPS

1. **Build herb-match.html** (pyramid UI + results)
2. **Wire alternatives flow** (rejection modal + API call)
3. **Test cross-page navigation** (edge tabs + herb stack)
4. **Deploy to Netlify** (test live)
5. **Monitor** (track which herbs are being rejected/accepted)

---

## NOTES

- This design avoids "medical advice" by framing as discovery/education
- User research (rejections) directly improves database
- Users become educators through their exploration
- Every rejection loop potentially adds a new herb profile
- The system gets smarter as more users interact with it
