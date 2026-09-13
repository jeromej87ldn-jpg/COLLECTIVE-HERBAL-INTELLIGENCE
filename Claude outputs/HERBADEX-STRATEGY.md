# HERBADEX Profile Generation Strategy
**Date:** 2026-09-12  
**Status:** Overnight batch generation scheduled ✅

---

## 📊 Current State

### Overnight Generation Task (Tonight 10 PM UTC)
- **Target:** 676 herbs in master catalogue
- **Method:** Claude Sonnet API with quality validation
- **Output:** CSV + detailed log to `/mnt/user-data/outputs/`
- **Quality Gates:** Compounds, Actions, Safety Level, Traditional Use, Scientific Basis
- **Priority:** Medicinal herbs first (Ayurveda → TCM → Western Herbalism → others)

### Materia-Medica-Main Repository Analysis
- **Total profiles:** 170 herbs in HTML format
- **Status:** All 170 are **incomplete templates** (0% complete)
- **Average gaps per profile:** 8-11 missing sections
- **Last updated:** November 2025

---

## 🎯 Key Finding: 148 Overlaps + 22 Gaps

### Overlaps (148 herbs in BOTH catalogues)
These are already in your 676-herb master catalogue. The overnight generation will create NEW profiles for them, potentially improving on materia-medica's incomplete templates.

**Examples:**
- Ginger (TCM) → Currently has gaps in materia-medica
- Ginkgo (TCM) → Currently incomplete
- St. John's Wort (Western Herbalism) → Currently incomplete
- Turmeric (Ayurveda) → Currently incomplete

### Missing from Catalogue (22 medicinal herbs)

**These should be ADDED to herbadex_master_catalog.json:**

1. Butchers Broom
2. Calamus
3. Cat's Claw
4. Devil's Claw
5. Euphorbia
6. Fennel
7. Fenugreek
8. Flax
9. Garlic
10. Goat's Rue
11. Golden Oyster
12. Indian Sarsaparilla
13. Juniper Berries
14. Lady's Mantle
15. Lion's Mane
16. Pau D'Arco
17. Pine Bark
18. Pleurisy Root
19. Senna
20. Shepherd's Purse
21. St. John's Wort *(already in catalogue as different name)*
22. Vitex

---

## 📋 Post-Generation Workflow

### Phase 1: Review Results (Tomorrow Morning)
1. ✅ Check `/mnt/user-data/outputs/herb-profiles-generated.csv`
2. ✅ Review `/mnt/user-data/outputs/generation-log.txt` for success rate
3. ✅ Identify any failed generations (will be marked in CSV with ERROR status)
4. ✅ Sample 10-15 profiles to verify quality

### Phase 2: Add Missing 22 Herbs (Optional Enhancement)
**These high-medicinal-value herbs should be added to the catalogue:**
- Extract their data from materia-medica.html templates
- Add to `herbadex_master_catalog.json` with appropriate traditions
- Schedule a secondary generation run for these 22 herbs

**Estimated data to add:**
```json
{
  "id": [next-available],
  "name": "Herb Name",
  "latin_name": "Latin binomial",
  "tradition": "TCM|Ayurveda|Western Herbalism|etc",
  "summary": "Brief description"
}
```

### Phase 3: Database Import
1. Parse successful CSV profiles
2. Map to Supabase upsert structure
3. Import with conflict resolution (name-based)
4. Update herb.status from "insufficient_data" → "complete"

---

## 📈 Comparison Summary

| Metric | Value |
|--------|-------|
| Materia-Medica herbs | 170 |
| Master Catalogue herbs | 676 |
| Overlapping herbs | 148 (87% of MM) |
| Herbs missing from catalogue | 22 (13% of MM) |
| Tonight's generation target | 676 |
| Expected new profiles | 676 |

---

## ✨ Value of Tonight's Generation vs. Materia-Medica

### Tonight's Profiles Will Be:
- ✅ **Complete** - No placeholders, all sections filled
- ✅ **Structured** - CSV format ready for database import
- ✅ **Validated** - Quality gates on every profile
- ✅ **Consistent** - Same format across all 676 herbs
- ✅ **Science-backed** - Both traditional use AND modern research
- ✅ **Safe** - Explicit safety levels and cautions

### Materia-Medica Reference Use:
- Cross-check generated profiles for accuracy
- Identify any herbs we missed
- Fill the 22-herb gap
- Reference for traditional use accuracy (high-quality content)

---

## 🎬 Action Items

### Before Overnight Run Completes:
- [ ] Confirm generation task is running at 10 PM UTC
- [ ] Monitor email for completion notification

### First Thing Tomorrow:
- [ ] Review herb-profiles-generated.csv
- [ ] Check generation-log.txt for success rate
- [ ] Sample 10-15 profiles for quality verification

### Follow-Up (Optional):
- [ ] Add the 22 missing herbs to catalogue
- [ ] Run secondary generation for those 22
- [ ] Import all profiles to Supabase
- [ ] Update status field in master catalogue

---

## 📦 Files Generated Tonight

```
/mnt/user-data/outputs/
├── herb-profiles-generated.csv          # Main deliverable (676 herbs)
├── generation-log.txt                   # Detailed event log with timestamps
├── herb-comparison-report.json          # This analysis (overlaps + missing)
└── HERBADEX-STRATEGY.md                 # This document
```

---

## 💡 Notes

- **Materia-Medica repo**: 170 incomplete HTML templates (all have 8-11 missing fields)
- **BIODB repo**: Irrelevant (old project, no structured herb data)
- **Strategy**: Tonight's batch generation creates NEW, complete profiles that supersede materia-medica's incomplete ones
- **Missing 22 herbs**: Valuable additions for next phase (all are medicinal)

**Status:** Ready. Task scheduled. Awaiting overnight results. 🌙
