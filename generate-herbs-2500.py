#!/usr/bin/env python3
"""
C.H.I Herb Database Generator — 2,500 Complete Profiles
Generates herb data via Claude API and outputs CSV for vetting

Usage: python generate-herbs-2500.py
Output: herbs-complete-2500.csv (can resume if interrupted)
"""

import csv
import json
import re
import time
import os
import urllib.request
import urllib.parse
from anthropic import Anthropic

# Initialize API client
client = Anthropic()

# Output file
OUTPUT_FILE = "herbs-complete-2500.csv"
RESUME_FILE = "herb-generation-progress.json"

# CSV headers — must match the structure
CSV_HEADERS = [
    "herbId", "commonName", "latinName", "family", "traditionalNames",
    "nativeLocation", "cultivatedLocation", "partsUsed", "botanicalDescription", "types", "history",
    "benefits", "dosageFormats", "preparation", "timing", "cautions",
    "compoundIds", "compoundClasses", "traditionIds", "sustainabilityStatus",
    "legalStatus", "primaryAbility",
    "pharmacologyTitle", "pharmacologyContent",
    "clinicalTitle1", "clinicalContent1",
    "clinicalTitle2", "clinicalContent2",
    "clinicalTitle3", "clinicalContent3",
    "safetyTitle1", "safetyContent1",
    "safetyTitle2", "safetyContent2",
    "safetyTitle3", "safetyContent3",
    "safetyTitle4", "safetyContent4",
    "safetyTitle5", "safetyContent5",
    "traditionTitle1", "traditionContent1",
    "traditionTitle2", "traditionContent2",
    "traditionTitle3", "traditionContent3",
    "traditionTitle4", "traditionContent4",
    "sourcingTitle1", "sourcingContent1",
    "sourcingTitle2", "sourcingContent2",
    "sourcingTitle3", "sourcingContent3",
    "evidenceTitle", "evidenceContent",
    "relatedHerbsCompoundClass", "relatedHerbsType", "relatedHerbsTradition",
    "substituteHerbs", "endangermentStatus", "ethicalSourcingNotes",
    "drugHerbInteractions",
    # NEW — added for schema v2 (botanical description + sourced images)
    "imageUrl1", "imageCredit1", "imageUrl2", "imageCredit2", "imageSourceNote"
]

HERB_CATEGORIES = [
    # Traditional medicines
    ("Ayurvedic", 200),
    ("Traditional Chinese Medicine", 150),
    ("Western Herbalism", 200),
    ("African Traditional Medicine", 150),
    ("Caribbean Folk Medicine", 100),
    ("South American", 150),
    ("Southeast Asian", 150),
    ("Central Asian & Siberian", 100),
    ("North African & Maghreb", 100),
    ("European Folk", 150),
    ("Pacific Island", 75),
    ("Middle Eastern & Unani", 100),
    ("Himalayan & Tibetan", 100),
    ("Japanese & Korean", 75),
    ("Native American", 75),
    ("Mexican Traditional", 75),
]

GENERATION_PROMPT = """You are generating herb database entries for C.H.I (Collective Herbal Intelligence). 
Generate a COMPLETE herb entry with ALL fields populated. Return ONLY valid JSON, no markdown or extra text.

Herb to generate: {herb_info}

Return this exact JSON structure (all fields required, use empty strings "" only if truly unknown):
{{
  "herbId": "lowercase-slug-id",
  "commonName": "Common Name",
  "latinName": "Latin binomial",
  "family": "Plant family",
  "traditionalNames": "Language: Name | Language: Name",
  "nativeLocation": "Where it grows naturally",
  "cultivatedLocation": "Where it's cultivated",
  "partsUsed": "Root | Leaf | Bark",
  "botanicalDescription": "Physical description for identification: growth habit, height, leaf/flower/fruit appearance, habitat. 2-3 sentences.",
  "types": "Type1 | Type2 | Type3",
  "history": "Historical use paragraph (2-3 sentences)",
  "benefits": "Traditional uses and research (2-3 sentences, MHRA-compliant)",
  "dosageFormats": "Powder: X-Y g daily | Extract: X-Y mg daily | Tincture: X ml daily",
  "preparation": "How to prepare (1-2 sentences)",
  "timing": "When to take it and cycling advice",
  "cautions": "Contraindications and warnings",
  "compoundIds": "compound-id-1 | compound-id-2 | compound-id-3",
  "compoundClasses": "Alkaloids | Terpenoids | Flavonoids",
  "traditionIds": "ayurveda | tcm | western-folk",
  "sustainabilityStatus": "Not threatened | At risk | Endangered",
  "legalStatus": "Legal status in UK/EU/US",
  "primaryAbility": "One-line primary use",
  "pharmacologyTitle": "Mechanism of action & pharmacology",
  "pharmacologyContent": "Research on mechanisms (2-3 sentences)",
  "clinicalTitle1": "Clinical applications & indications",
  "clinicalContent1": "Clinical uses (2-3 sentences)",
  "clinicalTitle2": "Condition-specific protocols & combinations",
  "clinicalContent2": "How it's combined with other herbs",
  "clinicalTitle3": "Preparation methods & dosing",
  "clinicalContent3": "Detailed preparation and dosing",
  "safetyTitle1": "Contraindications — absolute & relative",
  "safetyContent1": "Contraindications",
  "safetyTitle2": "Drug–herb interactions",
  "safetyContent2": "Known interactions",
  "safetyTitle3": "Safety profile & toxicity",
  "safetyContent3": "Safety at traditional doses",
  "safetyTitle4": "Paediatric considerations",
  "safetyContent4": "Use in children",
  "safetyTitle5": "Pregnancy & lactation safety",
  "safetyContent5": "Safety in pregnancy/lactation",
  "traditionTitle1": "Ayurvedic properties & applications",
  "traditionContent1": "If used in Ayurveda: properties and dosha balance",
  "traditionTitle2": "TCM properties & applications",
  "traditionContent2": "If used in TCM: properties and pattern clearing",
  "traditionTitle3": "Western herbal energetics",
  "traditionContent3": "Western energetic view",
  "traditionTitle4": "Other tradition classifications",
  "traditionContent4": "Other cultural uses",
  "sourcingTitle1": "Botanical identity & adulterants",
  "sourcingContent1": "True plant ID and common adulterations",
  "sourcingTitle2": "Quality markers & standardisation",
  "sourcingContent2": "How to identify quality",
  "sourcingTitle3": "Sustainable sourcing & legal status",
  "sourcingContent3": "Sourcing ethics and legality",
  "evidenceTitle": "Research & clinical evidence",
  "evidenceContent": "Summary of research (MHRA-compliant phrasing)",
  "relatedHerbsCompoundClass": "herb1-name | herb2-name | herb3-name",
  "relatedHerbsType": "herb1-name | herb2-name | herb3-name",
  "relatedHerbsTradition": "herb1-name | herb2-name | herb3-name",
  "substituteHerbs": "If unavailable, try: herb1 | herb2",
  "endangermentStatus": "Conservation status",
  "ethicalSourcingNotes": "Ethical sourcing considerations",
  "drugHerbInteractions": "Known interactions with medications"
}}

CRITICAL:
- Return ONLY valid JSON (no markdown, no text before/after)
- ALL fields must be present
- No null values; use "" for unknown
- Make data realistic and traditional-medicine-grounded
- Vary compounds and properties between herbs
- Include cross-references to plausible related herbs

HONESTY ON THIN EVIDENCE — applies especially to safetyContent1-5, pharmacologyContent,
clinicalContent1-3, traditionContent1-4, sourcingContent1-3, and evidenceContent:
- Never fill these with generic boilerplate ("consult a doctor", "may interact with medications")
  when you don't have herb-specific grounding for it.
- If the evidence for this specific herb is genuinely thin, say so plainly and specifically —
  e.g. "No documented paediatric dosing data exists for this herb; use is not recommended for
  children under traditional-use guidance alone" rather than a vague, generic caution.
- The 5 safety fields (safetyContent1-5) must NEVER be reduced to a single generic line, even
  when evidence is thin — give the best available traditional/pharmacological reasoning AND
  name the uncertainty explicitly. They are never left blank.
- Do not invent citations, named studies, or statistics you cannot ground in real, known research.
"""

def load_progress():
    """Load generation progress if resuming"""
    if os.path.exists(RESUME_FILE):
        with open(RESUME_FILE, 'r') as f:
            return json.load(f)
    return {"generated_count": 0, "current_herb": 1, "herbs_list": []}

def save_progress(progress):
    """Save progress to resume later"""
    with open(RESUME_FILE, 'w') as f:
        json.dump(progress, f, indent=2)

def generate_herb_list(progress):
    """Generate list of 2,500 herbs to create"""
    if progress["herbs_list"]:
        return progress["herbs_list"]
    
    herbs = []
    herb_id = 1
    
    for tradition, count in HERB_CATEGORIES:
        for i in range(count):
            herbs.append({
                "id": herb_id,
                "tradition": tradition,
                "index_in_tradition": i + 1
            })
            herb_id += 1
    
    return herbs

def generate_herb(herb_spec):
    """Call Claude API to generate one complete herb profile"""
    prompt = GENERATION_PROMPT.format(
        herb_info=f"#{herb_spec['id']}: {herb_spec['tradition']} herb #{herb_spec['index_in_tradition']}"
    )
    
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=2000,
        messages=[
            {"role": "user", "content": prompt}
        ]
    )
    
    response_text = message.content[0].text.strip()
    
    # Parse JSON
    try:
        herb_data = json.loads(response_text)
        return herb_data
    except json.JSONDecodeError as e:
        print(f"JSON parse error for herb #{herb_spec['id']}: {e}")
        print(f"Response: {response_text[:200]}")
        return None

WIKIMEDIA_USER_AGENT = "CHI-Herbadex-Bot/1.0 (collectiveherbalintelligence project; contact via project owner)"
ACCEPTED_LICENSES = ("cc0", "cc-by", "cc-by-sa", "public domain", "pd")

def fetch_herb_images(latin_name, common_name, max_images=2):
    """
    Look up up to `max_images` public-domain/CC-licensed images for a herb from
    Wikimedia Commons (searches by Latin name first, falls back to common name).
    No AI-generated images — sourced only, per the schema v2 decision.

    Returns (images, source_note):
      images      -> list of up to max_images {"url": ..., "credit": ...} dicts
      source_note -> "" if images were found, otherwise an explanation

    NOTE: Plants of the World Online (POWO) doesn't expose a simple public
    image-search API, so it isn't wired in here automatically. When this
    function finds nothing, imageSourceNote flags exactly which herbs need
    a manual POWO check.
    """
    def _search(term):
        params = {
            "action": "query",
            "generator": "search",
            "gsrsearch": f"{term} filetype:bitmap",
            "gsrnamespace": "6",
            "gsrlimit": str(max_images * 3),
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "iiurlwidth": "800",
            "format": "json",
        }
        url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={"User-Agent": WIKIMEDIA_USER_AGENT})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))

    results = []
    for term in (latin_name, common_name):
        if not term:
            continue
        try:
            data = _search(term)
        except Exception:
            continue  # network hiccup or nothing found — try the next term / fall through

        pages = (data.get("query") or {}).get("pages") or {}
        for page in pages.values():
            infos = page.get("imageinfo") or []
            if not infos:
                continue
            info = infos[0]
            meta = info.get("extmetadata") or {}
            license_short = (meta.get("LicenseShortName", {}).get("value") or "").lower()
            if not any(lic in license_short for lic in ACCEPTED_LICENSES):
                continue  # skip anything not public-domain / CC
            artist = re.sub("<[^<]+?>", "", (meta.get("Artist", {}).get("value") or "Unknown")).strip()
            credit = f"{artist} — {meta.get('LicenseShortName', {}).get('value', 'Unknown license')} — Wikimedia Commons"
            results.append({"url": info.get("url", ""), "credit": credit})
            if len(results) >= max_images:
                break
        if results:
            break  # found via Latin name — no need to also try common name

    if results:
        return results, ""
    return [], "No public-domain image found on Wikimedia Commons — check POWO manually for this herb."

def write_csv_header():
    """Initialize CSV file with headers"""
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        writer.writeheader()

def append_herb_to_csv(herb_data):
    """Append a single herb to CSV"""
    with open(OUTPUT_FILE, 'a', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
        # Only write fields that are in headers
        row = {k: herb_data.get(k, "") for k in CSV_HEADERS}
        writer.writerow(row)

def main():
    print("=" * 70)
    print("C.H.I HERB DATABASE GENERATOR — 2,500 Profiles")
    print("=" * 70)
    
    progress = load_progress()
    herbs_list = generate_herb_list(progress)
    
    if progress["generated_count"] == 0:
        print(f"\n📝 Starting generation of {len(herbs_list)} herbs...")
        write_csv_header()
    else:
        print(f"\n📝 Resuming from herb #{progress['current_herb']} ({progress['generated_count']} already generated)")
    
    total = len(herbs_list)
    start_idx = progress["generated_count"]
    
    for idx, herb_spec in enumerate(herbs_list[start_idx:], start=start_idx + 1):
        try:
            print(f"\n[{idx}/{total}] Generating: {herb_spec['tradition']} herb #{herb_spec['index_in_tradition']}...", end=" ", flush=True)
            
            herb_data = generate_herb(herb_spec)

            if herb_data:
                images, image_note = fetch_herb_images(
                    herb_data.get("latinName", ""), herb_data.get("commonName", "")
                )
                herb_data["imageUrl1"] = images[0]["url"] if len(images) > 0 else ""
                herb_data["imageCredit1"] = images[0]["credit"] if len(images) > 0 else ""
                herb_data["imageUrl2"] = images[1]["url"] if len(images) > 1 else ""
                herb_data["imageCredit2"] = images[1]["credit"] if len(images) > 1 else ""
                herb_data["imageSourceNote"] = image_note

                append_herb_to_csv(herb_data)
                print("✓" if not image_note else "✓ (no image — flagged for manual POWO check)")
                progress["generated_count"] = idx
                progress["current_herb"] = herb_spec['id']
            else:
                print("✗ (parse error, skipping)")

            # Save progress every 10 herbs
            if idx % 10 == 0:
                save_progress(progress)
                print(f"   💾 Progress saved ({idx}/{total})")

            # Rate limiting: 1 second between requests (adjust if needed)
            # Wikimedia's own API is called once more per herb inside the loop above —
            # this pause also keeps that request rate polite.
            time.sleep(1)
        
        except Exception as e:
            print(f"✗ (error: {e})")
            save_progress(progress)
            print(f"\n⚠️  Paused at herb #{idx}. Run again to resume.")
            return
    
    # Clean up progress file
    if os.path.exists(RESUME_FILE):
        os.remove(RESUME_FILE)
    
    print("\n" + "=" * 70)
    print(f"✅ Generation complete! {total} herbs in {OUTPUT_FILE}")
    print("=" * 70)
    print("\nNext steps:")
    print("1. Vet the CSV offline")
    print("2. Run: python csv-to-js.py herbs-complete-2500.csv > herbs-database.js")
    print("3. Move herbs-database.js to /mnt/project/")
    print("4. Update profile pages to use dynamic rendering")

if __name__ == "__main__":
    main()
