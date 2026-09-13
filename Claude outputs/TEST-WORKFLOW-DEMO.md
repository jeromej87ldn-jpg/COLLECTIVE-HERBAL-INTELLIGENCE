# 🧪 Test: Complete Workflow Demo

## How It Works - Step by Step

---

## **TONIGHT: Generation**

```
10 PM UTC → Overnight Job Starts
           ↓
Read 689 herbs from herbadex_master_catalog.json
           ↓
For each herb:
  • Build prompt with herb name + tradition
  • Call Claude Sonnet API
  • Validate response has all required sections
  • Retry up to 3 times if validation fails
  • Write result to CSV
           ↓
Output to: /mnt/user-data/outputs/herb-profiles-generated.csv
Log to: /mnt/user-data/outputs/generation-log.txt
```

---

## **TOMORROW: Import**

### Your Command
```bash
bash /tmp/run-import.sh
```

### What Happens Inside

#### **STEP 1: Parse CSV**
```
Input: herb-profiles-generated.csv
       ├─ Row 1: Ginger, Zingiber officinale, TCM, [full profile text]
       ├─ Row 2: Turmeric, Curcuma longa, Ayurveda, [full profile text]
       ├─ Row 3: ...
       └─ Row 689: Last herb

Parse Result: 689 records loaded into memory
```

#### **STEP 2: Validate Each Profile**
```
For each herb:
  ✓ Check for COMPOUNDS section    → Must exist
  ✓ Check for ACTIONS section      → Must exist
  ✓ Check for SAFETY LEVEL         → Must exist
  ✓ Check for TRADITIONAL USE      → Must exist
  ✓ Check for SCIENTIFIC BASIS     → Must exist

If all 5 sections present → VALID
If any missing → SKIP (log error)

Result: ~620-650 valid profiles ready for import
```

#### **STEP 3: Transform to Database Format**

**Input CSV Row:**
```
id,name,latin_name,tradition,status,profile,generation_attempts
1,"Ginger","Zingiber officinale","TCM","complete","**COMPOUNDS**...[full profile]...",1
```

**Transformed to Database Record:**
```json
{
  "name": "Ginger",
  "latin_name": "Zingiber officinale",
  "tradition": "TCM",
  "status": "complete",
  "data": {
    "profile": "**COMPOUNDS**... [full profile text] ...",
    "generated_at": "2026-09-13T08:30:00Z",
    "generation_attempts": 1,
    "source": "claude-sonnet-batch-generation"
  }
}
```

#### **STEP 4: Insert into Supabase**

**The Operation:**
```javascript
supabase
  .from('herbs')
  .upsert(record, { onConflict: 'name' })
```

**What "upsert with onConflict" means:**
```
IF herb with name "Ginger" already exists
  → UPDATE: overwrite with new profile data
ELSE
  → INSERT: create new herb record

Result: No duplicates, existing herbs updated with better profiles
```

**For Each Profile:**
```
✓ Ginger - inserted/updated
✓ Turmeric - inserted/updated
✓ Ashwagandha - inserted/updated
... (repeat for all 689)

Status column: changed from "insufficient_data" → "complete"
```

#### **STEP 5: Log Results**

```
✓ Ginger: imported
✓ Turmeric: imported
✓ Ashwagandha: imported
...
✗ Some-Herb-Name: failed (validation error)
...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total: 689 records
Successful: 620+
Failed: 5-20
Success Rate: 90%+
```

---

## **Real Example: Ginger Profile**

### Generated Profile (from Claude):
```
**COMPOUNDS** 
- Gingerol (Pungent Alkaloid): Primary anti-inflammatory
- Shogaol (Volatile Oil): Thermogenic agent
- Zingibain (Protease): Aids digestion

**ACTIONS** 
- Carminative: Supports digestion
- Thermogenic: Increases circulation
- Anti-inflammatory: Reduces inflammation

**SAFETY LEVEL** 
Generally Safe - Caution with high doses during pregnancy

**TRADITIONAL USE** 
Used for thousands of years in TCM and Ayurveda for warming digestion
and supporting circulation.

**SCIENTIFIC BASIS** 
Modern research confirms anti-inflammatory compounds. Studies show
effectiveness for nausea and digestive support.

**SYSTEMS AFFECTED** 
Digestive, Circulatory, Immune

**PREPARATIONS** 
Fresh tea, Dried powder, Tincture

**INTERACTIONS** 
May potentiate anticoagulants
```

### Validation:
- ✅ COMPOUNDS present? YES
- ✅ ACTIONS present? YES  
- ✅ SAFETY LEVEL present? YES
- ✅ TRADITIONAL USE present? YES
- ✅ SCIENTIFIC BASIS present? YES
- **Result:** VALID → Import to database

### Database Record Created:
```json
{
  "name": "Ginger",
  "latin_name": "Zingiber officinale",
  "tradition": "TCM",
  "status": "complete",
  "data": {
    "profile": "[full profile text above]",
    "generated_at": "2026-09-13T08:45:30Z",
    "generation_attempts": 1,
    "source": "claude-sonnet-batch-generation"
  }
}
```

### In Supabase:
```sql
INSERT INTO herbs (name, latin_name, tradition, status, data)
VALUES (
  'Ginger',
  'Zingiber officinale',
  'TCM',
  'complete',
  '{"profile": "...", "generated_at": "...", ...}'
)
ON CONFLICT (name) DO UPDATE SET
  status = 'complete',
  data = {...}
```

### On Your Website:
Herb card for "Ginger" now displays the complete profile with:
- Compounds
- Actions
- Safety information
- Traditional use
- Scientific basis
- Recommended preparations
- Drug interactions

---

## **Timeline Summary**

| Time | Action | Files |
|------|--------|-------|
| **Tonight 10 PM** | Generation starts | - |
| **Tonight (2-4 hrs)** | 689 profiles generated | herb-profiles-generated.csv |
| **Tomorrow AM** | You review results | generation-log.txt |
| **Tomorrow AM** | Run import script | (you run the command) |
| **Tomorrow AM** | Import to Supabase | import-log.txt |
| **Tomorrow AM** | Live on site | All 689 herbs searchable |

---

## **Verification Checklist**

After import completes:

- [ ] Import log shows 85%+ success rate
- [ ] CSV had 689 rows, ~620+ imported successfully
- [ ] Any failures are logged for manual review
- [ ] Open site and search for "Ginger" → Full profile displays
- [ ] Click herb card → All sections visible (Compounds, Actions, Safety, etc.)
- [ ] New herbs added (Fennel, Fenugreek, etc.) appear in search

---

## **What Could Go Wrong & How to Fix**

### Generation Fails (tonight)
- Check: `/mnt/user-data/outputs/generation-log.txt`
- Look for: herbs marked "failed" in CSV
- Fix: Retry manually or wait for next scheduled run

### Import Fails (tomorrow)
- Check: `/mnt/user-data/outputs/import-log.txt`
- Look for: specific herbs with errors
- Fix: Run import script again (upsert handles retries)

### Supabase Credential Error
- Error: "Could not authenticate"
- Fix: Verify API key is correct (copy-paste fresh from Supabase)
- Fix: Ensure using correct key (service_role for inserts)

### Some Profiles Missing Sections
- Script automatically skips invalid profiles
- Logs which ones failed
- Import continues for valid ones

---

## **Success Indicators**

✅ **Generation tonight works when:**
- generation-log.txt shows 80%+ success rate
- CSV has 689 rows
- No permissions errors

✅ **Import tomorrow works when:**
- run-import.sh prompts for credentials
- Script runs without errors
- import-log.txt shows 85%+ success
- Supabase shows new records

✅ **Site works when:**
- Search for herb name → Result appears
- Click result → Full profile displays
- All 8 sections visible (COMPOUNDS, ACTIONS, SAFETY, etc.)

---

## **Ready?**

Tonight: Let the overnight job run 🌙
Tomorrow: One command to import ⚡
Then: 689 herbs live on your site 🚀
