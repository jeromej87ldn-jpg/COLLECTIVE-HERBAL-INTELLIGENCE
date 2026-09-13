# 🚀 Herb Profile Import Workflow
**Status:** Ready to execute  
**Timeline:** Tonight (generation) → Tomorrow (import)

---

## 📅 What's Happening

### Tonight (10 PM UTC)
- ✅ **Overnight generation task** automatically starts
- ✅ Processes **689 herbs** (676 original + 13 newly added)
- ✅ Outputs to `/mnt/user-data/outputs/`:
  - `herb-profiles-generated.csv` — Main deliverable
  - `generation-log.txt` — Detailed execution log

### Tomorrow Morning
- You review results (5-10 min)
- You run the import (2-3 min)
- Profiles are live in Supabase

---

## ✅ What Was Done Tonight

### 1. Catalogue Updated
Added 13 missing medicinal herbs to `herbadex_master_catalog.json`:
- Butchers Broom, Calamus, Euphorbia, Fennel, Fenugreek, Flax, Garlic
- Golden Oyster, Indian Sarsaparilla, Juniper Berries, Pine Bark, Senna, Vitex

**New total: 689 herbs** (up from 676)

### 2. Import Pipeline Built
Created `/tmp/import-profiles.js` with:
- ✅ CSV parsing
- ✅ Profile validation (checks for all required sections)
- ✅ Supabase upsert with conflict resolution
- ✅ Batch processing (prevents rate limits)
- ✅ Detailed logging
- ✅ Error handling & recovery

### 3. Ready-to-Run Command
Created `/tmp/run-import.sh` — interactive script that:
- Checks if CSV exists
- Prompts for Supabase credentials securely
- Installs dependencies
- Runs import
- Logs results

---

## 🎯 Tomorrow's Steps (Simple)

### Step 1: Review Results (5 min)
```bash
# Check if generation succeeded
cat /mnt/user-data/outputs/generation-log.txt | tail -20

# Preview CSV
head -20 /mnt/user-data/outputs/herb-profiles-generated.csv

# Sample a profile (check a few rows)
```

### Step 2: Run Import (2 min)
```bash
bash /tmp/run-import.sh
```

Then:
1. Paste your Supabase URL
2. Paste your Supabase API key
3. Script runs automatically
4. Check results in `/mnt/user-data/outputs/import-log.txt`

**That's it!** Profiles are now in Supabase.

---

## 📊 What the Import Does

| Step | Action | Validation |
|------|--------|----------|
| 1 | Read CSV | Check file exists |
| 2 | Parse rows | Extract name, profile, tradition, etc |
| 3 | Validate | Ensure all required sections present |
| 4 | Prepare | Format for database |
| 5 | Upsert | Insert/update in Supabase with conflict resolution on `name` |
| 6 | Update status | Mark as "complete" |
| 7 | Log | Record success/failures |

**Conflict Resolution:** If a herb already exists (by name), it will be updated with the new profile.

---

## 🔑 Supabase Credentials Needed

You'll need:
- **SUPABASE_URL** — Find in Supabase Dashboard:
  - Go to Project Settings → API
  - Copy "Project URL"
  
- **SUPABASE_KEY** — Same location:
  - Use "service_role" key (for server-side operations)
  - OR "anon" key if that's what you use in your app

---

## 📋 Files Ready for Tomorrow

| File | Purpose |
|------|---------|
| `/mnt/user-data/outputs/herb-profiles-generated.csv` | **Generated profiles** (689 herbs) |
| `/mnt/user-data/outputs/generation-log.txt` | Generation execution log |
| `/mnt/user-data/outputs/import-log.txt` | Import execution log (created after you run) |
| `/tmp/import-profiles.js` | Import script (ready to run) |
| `/tmp/run-import.sh` | Interactive runner (ready to run) |
| `/mnt/user-data/outputs/added-herbs.json` | Log of 13 newly added herbs |
| `/mnt/user-data/outputs/herb-comparison-report.json` | Materia-Medica analysis |
| `/mnt/user-data/outputs/HERBADEX-STRATEGY.md` | Full strategy document |

---

## 🔄 What Happens After Import

1. **Profiles in Database** — All 689 profiles in Supabase `herbs` table
2. **Status Updated** — Changed from "insufficient_data" → "complete"
3. **Live on Site** — Herb cards display full profiles
4. **Searchable** — Profiles available via API/search

---

## ⚠️ If Something Goes Wrong

### Generation Failed (check log)
```bash
cat /mnt/user-data/outputs/generation-log.txt
```
Look for herbs marked "failed" in the CSV.

### Import Failed (check log)
```bash
cat /mnt/user-data/outputs/import-log.txt
```
Common issues:
- Supabase URL/key incorrect
- Network connection issue
- Database permissions

### Partial Import
Script logs which herbs succeeded/failed. You can:
- Fix the issue
- Run import again (upsert will re-process)

---

## 📞 Quick Reference

**Tomorrow morning, your only command is:**
```bash
bash /tmp/run-import.sh
```

Everything else is automated. 🎉

---

## ✨ Success Looks Like

After import completes:
- ✅ Import log shows "Success rate: 85%+" 
- ✅ ~590+ herbs imported successfully
- ✅ Failed ones logged (can retry)
- ✅ Profiles live in Supabase
- ✅ Status field updated to "complete"

**You're done!** The overnight batch generation + import pipeline is complete.

---

## 🎯 Next Phase (Optional)

After confirming imports are live:
1. Test a few herb cards on the live site
2. Spot-check profile quality
3. Monitor for any issues
4. Consider the 9 remaining herbs that weren't added (if needed)

But that's tomorrow's problem. Tonight, just let the generation run. 🌙
