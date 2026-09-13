# Herbadex — New Base Level
**Date:** September 13, 2026
**Status:** ✅ CONFIRMED WORKING — this is now the floor everything else builds on

---

## What's live and working right now

### 1. Herb profile validation (type-based)
- All 612 herbs in `herbadex_master_catalog.json` carry a `type` field (medicinal_herb, spice, adaptogen, tonic_root, flower_herb, fruit, medicinal_mushroom)
- `herb-profile.js` blocks generation for catalog items typed `staple_food`, `meat`, `grain`, `vegetable_staple`
- A direct `NON_HERBAL_EXACT` name blocklist catches obvious non-herbal searches (chicken, rice, beef, etc.) even when they aren't in the catalog at all
- Exact-name matching used for blocking (not substring) to avoid false positives like "Turkey Rhubarb" — a real learning captured in the reusable template below
- Supabase caching untouched and confirmed working: generate once, serve from cache after

### 2. Real user accounts (Supabase Auth)
- `join.html` creates real accounts — email + password, via Supabase Auth
- A `profiles` row is auto-created on signup (DB trigger) with **100 seeds** by default
- Email confirmation flow fixed: `emailRedirectTo` set explicitly in the signup call, Supabase Site URL / Redirect URLs configured to `https://collectiveherbal.netlify.app`
- Confirmed working end-to-end: signup → confirmation email → click link → lands back on `join.html` → auto-redirects to `profile.html` with a real session
- Paid plans (monthly/annual) and seed top-ups are **visibly disabled ("Coming soon")** — no Stripe integration exists yet, so nothing fakes premium access or charges anyone

### 3. Database foundation for community features (deployed to Supabase, live)
- `profiles` — seed_balance, rank_level, is_premium, herbs_founded, username
- `seed_transactions` — append-only ledger, every earn/spend logged with a reason
- `herb_submissions` — for the Unclassified Herbal feature (not yet wired to any UI)
- `herb_corroborations` — one per user per submission; inserting one automatically (via DB trigger, can't be gamed client-side):
  - bumps the submission's corroboration count
  - pays the corroborator 10 seeds
  - at 3 corroborations: promotes the herb to `verified` and credits the submitter's `herbs_founded` count
- Security check run post-build: found and fixed public RPC exposure on the two new trigger functions

---

## Explicitly NOT done yet (don't assume these work)

- `profile.html`, `garden.html`, `community.html` still show **hardcoded/mock data** — none of them read the real `profiles` table
- No sign-in page wired up (existing "Sign in" link not yet connected to Supabase Auth)
- Unclassified Herbal submission UI doesn't exist — the database is ready, nothing calls it yet
- No achievement/badge UI (founder badge, leaderboard) — only the underlying `herbs_founded` counter exists
- Stripe not integrated — free tier only is real; paid tiers are UI-only placeholders
- Seed *expiry* (32-day) is stored as a timestamp but no actual expiry logic runs yet

---

## Real lesson learned this session (matters for all future syncing)

The device-to-Windows-machine file bridge repeatedly reported successful writes that **silently did not update the file on disk** — confirmed by immediately staging the file back and checking actual content, not just trusting byte size or the "written" response. This happened 4+ times today, always recovered by retrying with `force:true` and verifying content after every single write, not just file size (which was sometimes identical even when content differed, and different even when a retry hadn't actually changed anything meaningful — size alone is not proof).

**Going forward: every file sync to your machine gets read back and content-checked before being reported as done.**

---

## Reusable pattern extracted

The type-based validation architecture (catalog `type` field + ALLOWED/BLOCKED arrays + direct exact-name blocklist) was generalized into a standalone template for future projects — delivered separately as `TEMPLATE_Type-Based-Content-Validation-System.md`.

---

## Immediate next steps (in order, once you're ready)

1. Wire `profile.html` to read the real `profiles` table (real seed balance, real rank) instead of mock data
2. Build a real sign-in flow
3. Build the Unclassified Herbal submission UI (the DB already supports the full corroborate → verify → founder-credit loop)
4. Achievement/badge display (founder badge, leaderboard) surfaced from `herbs_founded`
