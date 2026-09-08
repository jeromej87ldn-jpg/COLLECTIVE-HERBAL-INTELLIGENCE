const removedSample = [
  // Legitimate medicinals
  { name: "Japanese Knotweed", type: "legit" },
  { name: "Condurango", type: "legit" },
  { name: "Muira puama", type: "legit" },
  { name: "Devil's Club", type: "legit" },
  
  // Food items
  { name: "Cocoa", type: "food" },
  { name: "Raw Honey", type: "food" },
  { name: "Poppy Seeds", type: "food" },
  
  // Duplicates
  { name: "Turmeric Root", type: "duplicate" },
  { name: "Valerian Root", type: "duplicate" },
  { name: "Ashwagandha Root", type: "duplicate" },
  
  // Obscure
  { name: "Cipó", type: "obscure" },
  { name: "Genipap", type: "obscure" }
];

console.log("🧪 TESTING IF PROFILES CAN BE GENERATED\n");
console.log("Herb Name | Type | Profile Likelihood\n");

removedSample.forEach(herb => {
  let verdict = "";
  
  if (herb.type === "legit") {
    verdict = "✅ YES - Known medicinal herb";
  } else if (herb.type === "food") {
    verdict = "❌ NO - Food item, not medicinal";
  } else if (herb.type === "duplicate") {
    verdict = "⚠️ MAYBE - Variant of existing herb";
  } else if (herb.type === "obscure") {
    verdict = "❓ UNKNOWN - May be too obscure";
  }
  
  console.log(`${herb.name.padEnd(25)} | ${herb.type.padEnd(10)} | ${verdict}`);
});

console.log("\n📊 VERDICT:\n");
console.log("✅ YES (ADD BACK): Japanese Knotweed, Condurango, Muira puama, Devil's Club");
console.log("❌ NO (KEEP REMOVED): Cocoa, Honey, Seeds (food items)");
console.log("⚠️ MAYBE: Root variants - could go either way");
console.log("❓ UNKNOWN: Obscure herbs - need testing");
