# HERBADEX Anatomy Education Feature — Integration Guide

**Status:** Production-Ready  
**Last Updated:** 2026-08-30  
**Components:** 16 organ images + 3 JS modules + 1 CSS file

---

## 📦 Files You Have

```
anatomy-data.js          → All organ information, system definitions, herb mappings
anatomy-modal.js         → Interactive modal controller, organ gallery logic
anatomy-styles.css       → Complete styling (mobile-responsive)
organs/                  → 16 extracted organ PNG images
  ├── liver.png
  ├── stomach.png
  ├── pancreas.png
  ├── small_intestine.png
  ├── large_intestine.png
  ├── gallbladder.png
  ├── lungs.png
  ├── trachea.png
  ├── diaphragm.png
  ├── heart.png
  ├── blood_vessel.png
  ├── brain.png
  ├── kidneys.png
  ├── kidney_detail.png
  ├── bladder.png
  └── blood_vessel.png
```

---

## 🚀 Quick Start (5 minutes)

### Step 1: Copy Files to Your Project

```bash
# Copy to your HERBADEX project root
cp anatomy-data.js your-project/js/
cp anatomy-modal.js your-project/js/
cp anatomy-styles.css your-project/css/
cp -r organs/ your-project/organs/
```

### Step 2: Add to Your HTML (e.g., `supreme.html`)

```html
<!-- In the <head> section -->
<link rel="stylesheet" href="css/anatomy-styles.css">

<!-- At the end of <body>, before closing </body> -->
<div id="anatomyModalContainer"></div>

<script src="js/anatomy-data.js"></script>
<script src="js/anatomy-modal.js"></script>
```

### Step 3: Add Button to Herb Profile

In your herb profile view (wherever you display herb details), add this button:

```html
<button class="anatomy-btn-primary" onclick="openAnatomyModal('ginger')">
  📖 See which organs this supports
</button>
```

Replace `'ginger'` with the actual herb name as a string.

### Step 4: Test

1. Open a herb profile in your browser
2. Click "See which organs this supports"
3. Modal should open showing digestive system organs
4. Click any organ card to see details

✅ Done! You now have an interactive anatomy education system.

---

## 🔧 Integration Details

### Adding the Button to Herb Profiles

In `supreme.html` (or wherever herb profiles are displayed), find where you display herb info and add:

```html
<div class="herb-actions">
  <button class="anatomy-btn-primary" onclick="openAnatomyModal('${herb.commonName}')">
    📖 See which organs this supports
  </button>
</div>
```

If using dynamically loaded herb data, pass the herb name as a parameter:

```javascript
// In your herb rendering code
const herbName = herb.commonName || 'ginger'; // fallback to ginger
button.onclick = () => openAnatomyModal(herbName);
```

### Customizing Organ Images Path

If your organ images are in a different location, update the path when initializing:

```javascript
// In anatomy-modal.js, modify this line:
const modal = new AnatomyModal({
  organImagesPath: '/your-path/organs/' // Adjust as needed
});
```

### Adding New Herbs to the Herb-Support Mapping

To add support mapping for new herbs, edit `anatomy-data.js`:

```javascript
ANATOMY_DATA.herbSupport['your-herb-name'] = {
  primaryOrgans: ['liver', 'stomach', 'pancreas'], // organs most supported
  secondaryOrgans: ['heart', 'kidneys'], // organs with indirect support
  description: 'Brief description of how this herb works...'
};
```

### Customizing Organ Information

All organ data is in `anatomy-data.js`. To edit an organ:

```javascript
ANATOMY_DATA.organs['liver'] = {
  id: 'liver',
  system: 'digestive',
  name: 'Liver',
  description: 'Your custom description...',
  functions: [...],
  needs: [...],
  processes: [...],
  relatedHerbs: [...]
};
```

---

## 🎨 Customizing Colors

Edit the CSS variables in `anatomy-styles.css`:

```css
:root {
  --anatomy-gold: #c89530;           /* Primary color */
  --anatomy-gold-dark: #b8842a;      /* Hover color */
  --anatomy-text: #2c2c2c;           /* Text color */
  --anatomy-text-light: #666;        /* Light text */
  --anatomy-bg-light: #f9f9f9;       /* Light background */
  --anatomy-border: #eee;            /* Border color */
}
```

---

## 📱 Responsive Behavior

The modal automatically adapts:
- **Desktop (>900px):** Side-by-side layout (organs left, details right)
- **Tablet (600-900px):** Stacked layout (organs on top)
- **Mobile (<600px):** Full-screen optimized with smaller fonts

No additional configuration needed—CSS handles it all.

---

## 🔌 API Reference

### Opening the Modal

```javascript
// Open with default herb (ginger)
openAnatomyModal();

// Open with specific herb
openAnatomyModal('turmeric');
openAnatomyModal('milk thistle');
```

### Closing the Modal

```javascript
// Programmatically close
closeAnatomyModal();

// Or user clicks X button / presses ESC
```

### Accessing the Modal Instance

```javascript
// Direct access to modal instance
window.anatomyModal.open('herb-name');
window.anatomyModal.close();
window.anatomyModal.selectOrgan('liver');
```

---

## 🐛 Troubleshooting

### Modal doesn't appear
- Check that `anatomy-modal.js` is loaded after `anatomy-data.js`
- Verify `#anatomyModalContainer` exists in your HTML
- Open browser console for errors

### Organ images don't load
- Verify organ PNG files exist in your `organs/` folder
- Check that `organImagesPath` matches your file location
- Browser console will show 404 errors for missing images

### Button doesn't work
- Ensure `anatomy-modal.js` is loaded
- Check that you're passing a valid herb name
- Verify `openAnatomyModal()` function exists globally

### Styling looks wrong
- Ensure `anatomy-styles.css` is properly linked
- Check for CSS conflicts with existing styles
- CSS variables can be overridden in your own CSS

---

## 🎯 Future Enhancements

The architecture is built for easy expansion:

1. **More Organs** — Add to `ANATOMY_DATA.organs` in `anatomy-data.js`
2. **More Systems** — Add to `ANATOMY_DATA.systems`
3. **Herb Discovery** — Wire the "Discover these herbs" button to search
4. **Organ Integration with Herb Profiles** — Auto-tag organs in herb detail view
5. **Gamification** — Award achievements for exploring organs
6. **Mobile App** — React Native can use the same data module

---

## 📊 Data Structure

### Organ Object

```javascript
{
  id: 'liver',                           // Unique identifier
  system: 'digestive',                   // System category
  name: 'Liver',                         // Display name
  latinName: 'Hepar',                    // Scientific name
  description: 'Your liver is...',       // Detailed description
  functions: [                           // What it does
    'Phase 1/2/3 detoxification',
    'Bile production',
    ...
  ],
  needs: [                               // What it needs
    'B vitamins',
    'Glutathione',
    ...
  ],
  processes: [                           // Deep-dive topics
    {
      title: 'Detoxification',
      description: 'Phase 1 enzymes...'
    },
    ...
  ],
  relatedHerbs: [                        // Supportive herbs
    'Milk Thistle',
    'Dandelion Root',
    ...
  ]
}
```

### Herb Support Object

```javascript
{
  primaryOrgans: ['liver', 'stomach'],    // Direct support
  secondaryOrgans: ['heart', 'blood_vessel'], // Indirect support
  description: 'Warming digestive...'    // How it works
}
```

---

## 🚢 Deployment

1. **Test locally** — Verify all links and images work
2. **Optimize images** — Run organs through ImageOptim or similar
3. **Minify JS** — Optional but recommended for production
4. **Set cache headers** — Cache organ images for 1 year
5. **Monitor performance** — Check modal load times

### Netlify Deployment

If using Netlify (like HERBADEX):

```toml
# In netlify.toml
[build]
  publish = "."

[[redirects]]
  from = "/organs/*"
  to = "/organs/:splat"
  status = 200
```

---

## 📈 Usage Analytics

Track user engagement by adding analytics:

```javascript
// In anatomy-modal.js, add tracking
selectOrgan(organId) {
  // ... existing code ...
  
  // Track which organs users explore
  if (typeof gtag !== 'undefined') {
    gtag('event', 'anatomy_organ_viewed', {
      herb: this.options.currentHerb,
      organ: organId
    });
  }
}
```

---

## 📝 Notes

- **Herb names are case-insensitive** — `'Ginger'`, `'ginger'`, `'GINGER'` all work
- **Organ IDs use underscores** — `small_intestine`, `blood_vessel`, etc.
- **No server required** — Everything runs in the browser
- **Fully self-contained** — No external dependencies

---

## 🎓 How Users Interact

1. **Browse herb profiles** → Click "See organs" button
2. **Modal opens** → Shows digestive system by default
3. **Click system tabs** → Switch between digestive, respiratory, etc.
4. **Click organ cards** → See detailed info on the right
5. **Read deep-dives** → Click processes to expand explanations
6. **Discover herbs** → Button links to other herbs supporting that organ
7. **Add to stack** → Button adds herb to their saved collection

---

## 💡 Design Philosophy

- **Visual-first** — Organ images are the hero
- **Progressive disclosure** — Basic info visible, deep dives on demand
- **Curious-friendly** — Every section invites questions
- **Mobile-native** — Responsive from the start
- **Performant** — No external dependencies, minimal JS

---

## ❓ Questions?

Refer to the inline comments in:
- `anatomy-modal.js` — How modal and interactions work
- `anatomy-data.js` — What data is available
- `anatomy-styles.css` — How to customize appearance

For feedback or suggestions, update the data files and test locally.

---

**Ready to launch? You now have everything needed!** 🚀
