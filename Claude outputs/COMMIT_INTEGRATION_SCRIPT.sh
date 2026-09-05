#!/bin/bash

# CHI Herb Database Expansion Commit Integration Script
# Run this in your CHI project root directory

echo "🌿 CHI Herb Database Expansion Commit"
echo "======================================"
echo ""

# Check if we're in a git repo
if [ ! -d .git ]; then
    echo "❌ Error: Not in a git repository. Run this from your CHI project root."
    exit 1
fi

# Create data directory if it doesn't exist
mkdir -p data/herbs

echo "✓ Step 1: Copying new herb databases..."
cp CHI_NEW_AYURVEDA_HERBS.json data/herbs/
cp CHI_NEW_AYURVEDA_HERBS.csv data/herbs/
cp CHI_NEW_MATERIA_MEDICA_HERBS.json data/herbs/
cp CHI_NEW_MATERIA_MEDICA_HERBS.csv data/herbs/
cp AMIDHA_AYURVEDA_LICENSE docs/LICENSES/

echo "✓ Step 2: Checking git status..."
git status --short

echo ""
echo "✓ Step 3: Staging new herb files..."
git add data/herbs/CHI_NEW_AYURVEDA_HERBS.*
git add data/herbs/CHI_NEW_MATERIA_MEDICA_HERBS.*
git add docs/LICENSES/AMIDHA_AYURVEDA_LICENSE

echo ""
echo "✓ Step 4: Verifying staged files..."
git diff --cached --name-only

echo ""
echo "📝 Ready to commit with message:"
echo "---"
echo "feat: Add 507 medicinal herbs from GitHub databases"
echo ""
echo "- Add 355 Ayurvedic herbs from Amidha Ayurveda (MIT Licensed)"
echo "  Source: https://github.com/sciencewithsaucee-sudo/herb-database"
echo "  Features: Sanskrit synonyms, Ayurvedic properties, family classifications"
echo ""
echo "- Add 152 Western herbalism plants from Materia Medica"
echo "  Source: https://github.com/laureanne-sea/materia-medica"
echo "  Features: Medicinal properties, body systems, family classifications"
echo ""
echo "- All herbs start as 'insufficient_data' status"
echo "- Ready for on-demand profile generation via Claude API"
echo "- Profiles will be cached after first generation"
echo "- Total herb database expansion: +507 herbs"
echo "---"
echo ""
echo "To complete the commit, run:"
echo "  git commit -m 'feat: Add 507 medicinal herbs from GitHub databases'"
echo ""
echo "✅ Ready to proceed!"

