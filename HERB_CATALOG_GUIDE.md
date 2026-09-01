# Herbadex Catalog System - Quick Start Guide

**Date:** September 1, 2026  
**Status:** ✅ Ready to use

---

## What's New

You now have a simple, clean herb catalog system for on-demand profile generation:

### Files Added
- **herbadex_master_catalog.json** - Database of 113 herbs with metadata (id, name, latin_name, tradition, summary)
- **herb-catalog.html** - Browse and search interface

---

## How to Use

### 1. Access the Catalog
Open `herb-catalog.html` in your browser to see:
- All 113 herbs displayed in a clean grid
- Search box to find herbs by name, Latin name, or properties
- Filter buttons for different herbal traditions:
  - TCM (Traditional Chinese Medicine)
  - Ayurveda
  - Western Herbalism
  - European Folk
  - African Traditional
  - Caribbean
  - South American
  - Southeast Asian
  - And more...

### 2. Select an Herb
- Click "Select" on any herb card to choose it
- The card will highlight in blue when selected
- Only one herb can be selected at a time

### 3. Generate Profile
- Once selected, click "Generate Profile" button
- This opens the full herb profile page with detailed information
- The existing `herb-profile.js` system handles full profile generation on demand

---

## System Architecture

```
User selects herb in herb-catalog.html
         ↓
Navigate to herb-profile.html?id={herbId}
         ↓
herb-profile.js loads
         ↓
Generates full profile via Claude API
         ↓
Display rich profile to user
```

---

## Herb Database Structure

Each herb in the catalog includes:

```json
{
  "id": 1,
  "name": "Ginger",
  "latin_name": "Zingiber officinale",
  "tradition": "TCM",
  "summary": "Warming digestive herb with anti-inflammatory and circulation-supporting properties"
}
```

- **id**: Unique identifier (1-10, 601-605, 681-683, 741-743, 821-823, 901-903, 1001-1005, 1051-1055, 1176-1178, 1226-1227, 1251-1253, 1301-1305, 1476-1478, 1501-1560)
- **name**: Common English name
- **latin_name**: Scientific Latin name
- **tradition**: Herbal tradition/origin
- **summary**: Brief description for recommendations

---

## Key Features

✅ **Search Functionality**
- Real-time search as you type
- Search by herb name, Latin name, or summary content
- Case-insensitive matching

✅ **Filter by Tradition**
- Toggle tradition filters
- Mix and match multiple traditions
- Or view all herbs at once

✅ **Responsive Design**
- Works on desktop and mobile
- Touch-friendly buttons
- Clean, modern interface

✅ **On-Demand Generation**
- No profiles generated until requested
- Keeps API costs minimal
- Full profile generated only for selected herb

---

## Navigation

To add the catalog to your main navigation:

1. Open `index.html` or your main navigation file
2. Add a link to `herb-catalog.html`:
   ```html
   <a href="herb-catalog.html">Herb Catalog</a>
   ```

---

## What's Different from Before

**Before (Phase 2):**
- Attempted serverless discovery system with Netlify functions
- Pre-built searchable index
- Complex deployment with build scripts

**Now (Simplified):**
- Simple HTML/JSON catalog
- Local search in the browser (no API calls needed)
- On-demand profile generation via existing system
- Easy to understand and maintain

---

## File Manifest

```
herbadex_master_catalog.json    - 113 herb database
herb-catalog.html               - Browse/select interface
HERB_CATALOG_GUIDE.md           - This file
```

---

## Next Steps

1. **Test the catalog** - Open herb-catalog.html and browse herbs
2. **Select a herb** - Try selecting a few to see the interface
3. **Generate a profile** - Click "Generate Profile" to see full details
4. **Add to navigation** - Link from your main site

---

## Troubleshooting

**"Error loading herb catalog"**
- Ensure herbadex_master_catalog.json is in the same directory as herb-catalog.html
- Check browser console for specific error messages

**Profile not generating**
- Verify herb-profile.js is working properly
- Check that herb IDs match between catalog and profile system

**Search not working**
- Try refreshing the page
- Check browser console for JavaScript errors

---

**Ready to use!** The catalog is live and all files are committed to git.
