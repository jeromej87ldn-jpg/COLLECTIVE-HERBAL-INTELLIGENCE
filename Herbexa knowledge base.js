// Herbexa Knowledge Base
// Curated herb responses - no API calls needed

const HERBEXA_KB = {
  // Sleep & Rest
  "sleep|insomnia|rest|tired": {
    response: "For sleep support, several herbs may help. **Passionflower** and **Valerian** are traditionally used to promote relaxation. **Chamomile** is gentler and beloved for bedtime tea. **Lavender** combines calming aromatics with mild sedative properties. Start with one herb to see what works for your body. [Passionflower Profile] [Valerian Profile] [Chamomile Profile]",
    links: ["Passionflower", "Valerian", "Chamomile"],
    suggestions: ["Would you like to add one of these to your Stack?", "Track your sleep patterns in your Herbal Planner"]
  },

  // Focus & Mental Clarity
  "focus|concentration|mental|clarity|brain": {
    response: "For mental clarity, **Ginkgo Biloba** is well-researched for cognitive support. **Rosemary** has both aromatic and traditional benefits for focus. **Gotu Kola** is used in traditional medicine as a brain tonic. **Lion's Mane** (a mushroom) is gaining research attention for cognitive function. These work best consistently over time. [Ginkgo Profile] [Rosemary Profile] [Gotu Kola Profile]",
    links: ["Ginkgo Biloba", "Rosemary", "Gotu Kola", "Lion's Mane"],
    suggestions: ["Would you like to create a focus blend in your Planner?"]
  },

  // Digestion & Gut Health
  "digestion|stomach|bloating|gas|gut|intestinal": {
    response: "For digestive support, **Ginger** is time-tested for nausea and motility. **Peppermint** soothes the digestive tract and may ease bloating. **Fennel** addresses gas and cramping. **Slippery Elm** supports digestive lining. **Licorice** aids overall digestive comfort (avoid if on blood pressure meds). Sip these as tea 20 minutes before meals. [Ginger Profile] [Peppermint Profile] [Fennel Profile]",
    links: ["Ginger", "Peppermint", "Fennel", "Slippery Elm", "Licorice"],
    suggestions: ["Have you tried these as a tea before meals?"]
  },

  // Immunity & Seasonal Wellness
  "immune|immunity|cold|flu|virus|season": {
    response: "For immune support, **Elderberry** is popular during cold season. **Echinacea** may support immune response when taken early. **Astragalus** is traditionally used as a preventive tonic. **Reishi** (mushroom) supports overall resilience. **Vitamin C-rich herbs** like Rose Hips complement these. Start in fall to build resilience before winter. [Elderberry Profile] [Echinacea Profile] [Astragalus Profile]",
    links: ["Elderberry", "Echinacea", "Astragalus", "Reishi", "Rose Hips"],
    suggestions: ["Consider a seasonal immunity stack in your Planner"]
  },

  // Stress & Anxiety
  "stress|anxiety|calm|nervous|worried": {
    response: "For calming support, **Ashwagandha** is an adaptogen that may reduce stress perception. **Rhodiola** supports resilience during challenging times. **Lemon Balm** is gentle and pleasant. **Skullcap** and **Passionflower** support nervous system ease. **Lavender** works both internally (tea) and aromatically. Choose one to start—adaptogens work best over time. [Ashwagandha Profile] [Rhodiola Profile] [Lemon Balm Profile]",
    links: ["Ashwagandha", "Rhodiola", "Lemon Balm", "Skullcap", "Passionflower", "Lavender"],
    suggestions: ["Track your stress levels alongside herb use in your Planner"]
  },

  // Energy & Vitality
  "energy|tired|fatigue|stamina|vigor": {
    response: "For sustained energy, **Ginseng** (Asian or American) supports endurance and resilience. **Rhodiola** combats fatigue without overstimulation. **Maca** traditionally supports vitality and stamina. **Cordyceps** (mushroom) is used by athletes for energy. **Siberian Ginseng** is gentler than Asian varieties. These work best as consistent tonics, not quick fixes. [Ginseng Profile] [Rhodiola Profile] [Maca Profile]",
    links: ["Ginseng", "Rhodiola", "Maca", "Cordyceps", "Siberian Ginseng"],
    suggestions: ["Would you like to create an energy stack?"]
  },

  // Inflammation & Pain
  "inflammation|pain|sore|ache|joint": {
    response: "For inflammation support, **Turmeric** (curcumin) is well-researched. **Ginger** complements turmeric's action. **Boswellia** (frankincense) supports joint comfort. **Willow Bark** has traditional pain-easing properties. **Nettle** provides minerals that support joint health. Always take turmeric with black pepper (piperine) for better absorption. [Turmeric Profile] [Ginger Profile] [Boswellia Profile]",
    links: ["Turmeric", "Ginger", "Boswellia", "Willow Bark", "Nettle"],
    suggestions: ["Combine turmeric + black pepper for maximum benefit"]
  },

  // Skin Health
  "skin|complexion|acne|eczema|rash|dermatitis": {
    response: "For skin wellness, **Burdock Root** supports skin health from within. **Red Clover** is traditionally used for skin clarity. **Calendula** (topical) soothes irritated skin. **Nettle** provides minerals for skin vitality. **Turmeric** supports skin inflammation. Work from inside (tea/tincture) and outside (salve) for best results. Consistency over weeks matters more than immediate results. [Burdock Profile] [Red Clover Profile] [Calendula Profile]",
    links: ["Burdock Root", "Red Clover", "Calendula", "Nettle", "Turmeric"],
    suggestions: ["Create a skin-wellness routine—track it in your Planner"]
  },

  // Libido & Vitality
  "libido|intimate|vitality|aphrodisiac|desire": {
    response: "For intimate wellness, **Maca** is traditionally used to support vitality and arousal. **Tribulus** may support desire and satisfaction. **Damiana** has aphrodisiac history. **Ginseng** supports sexual function and energy. **Cacao** combines enjoyment with blood-flow benefits. These work best alongside stress reduction and good circulation—use your Herb Match to explore stress herbs too. [Maca Profile] [Tribulus Profile] [Damiana Profile] [Ginseng Profile]",
    links: ["Maca", "Tribulus", "Damiana", "Ginseng", "Cacao"],
    suggestions: ["Combine intimate wellness herbs with stress-reduction herbs for best results"]
  },

  // Hormonal Balance
  "hormone|hormonal|cycle|period|menstrual": {
    response: "For hormonal wellness, **Vitex (Chasteberry)** supports hormonal balance. **Red Clover** contains phytoestrogens and supports cycle wellness. **Dong Quai** is traditionally used for menstrual comfort. **Black Cohosh** supports hormone transitions. **Raspberry Leaf** nourishes the reproductive system. These are best as consistent tonics over 2-3 months. Consider working with an herbalist for personalized blends. [Vitex Profile] [Red Clover Profile] [Dong Quai Profile]",
    links: ["Vitex", "Red Clover", "Dong Quai", "Black Cohosh", "Raspberry Leaf"],
    suggestions: ["Track your cycle alongside herb use in your Planner"]
  },

  // Preparation Methods
  "tea|tincture|capsule|extract|preparation|how to use": {
    response: "Herbs can be used many ways:\n\n**Tea (Infusion):** Steep dried herb in hot water 5-10 minutes. Best for leaves and flowers. Gentle and enjoyable.\n\n**Decoction:** Simmer roots/bark 15-30 minutes. Releases more compounds from dense plant material.\n\n**Tincture:** Alcohol extract. Potent and shelf-stable. Use 1 dropperful in water.\n\n**Capsules:** Convenient for travel. Less flavorful.\n\n**Fresh:** Best but seasonal. Stronger than dried.\n\nStart with tea—it's gentlest and teaches your body. Each herb responds best to one method. Check individual [Herb Profiles] for specifics.",
    links: [],
    suggestions: ["Which preparation method appeals to you most?"]
  },

  // Herb Combinations
  "combination|blend|together|synergy": {
    response: "Many herbs work synergistically:\n\n**Sleep Blend:** Passionflower + Valerian + Lavender\n**Focus Blend:** Ginkgo + Rosemary + Gotu Kola\n**Inflammation Blend:** Turmeric + Ginger + Black Pepper\n**Stress Blend:** Ashwagandha + Rhodiola + Lemon Balm\n**Immunity Blend:** Elderberry + Echinacea + Astragalus\n\nCombinations are more powerful than single herbs. Your Herbal Planner lets you build and track custom blends. Start with 2-3 herbs, not 5+. [Browse Profiles] to explore which herbs call to you.",
    links: [],
    suggestions: ["Use your Herbal Planner to create a personalized blend"]
  },

  // Safety & Interactions
  "pregnant|nursing|medication|drug|interaction|safety|contraindication": {
    response: "⚠️ **Safety First:**\n\n**Pregnancy/Nursing:** Many herbs aren't studied in pregnancy. Consult your midwife or OB before using. Avoid: Vitex, Dong Quai, Pennyroyal, Rue, Motherwort (unless directed by provider).\n\n**Medications:** Some herbs interact with prescriptions. **Critical:** Turmeric thins blood (avoid with warfarin). St. John's Wort reduces birth control effectiveness. Ginseng may affect blood sugar meds.\n\n**Rule of Thumb:** Tell your doctor AND your herbalist what you're taking.\n\nC.H.I is educational, not medical advice. When in doubt, consult your healthcare provider. Check individual [Herb Profiles] for contraindications.",
    links: [],
    suggestions: ["Always disclose herb use to your doctor"]
  },

  // Getting Started
  "start|beginner|new|first time|where to begin": {
    response: "Welcome to herbalism! Here's how to start:\n\n**1. Define Your Goal:** What wellness area calls to you? Sleep, focus, stress, energy?\n\n**2. Try Herb Match:** Answer 5 questions about your concerns. We'll suggest herbs tailored to you. [Try Herb Match]\n\n**3. Explore One Herb:** Start with ONE herb as tea. Spend 2-4 weeks with it. Notice how your body responds.\n\n**4. Read Profiles:** Each herb has a full profile here—safety info, preparation, research, sourcing.\n\n**5. Track Your Journey:** Use your Herbal Planner to log which herbs you try and how they make you feel.\n\nHerbalism is about listening to your body. Start slow, notice patterns, adjust. [Browse Profiles] to explore.",
    links: [],
    suggestions: ["Try Herb Match to get personalized recommendations"]
  },

  // Sourcing & Quality
  "quality|source|where to buy|organic|supplier": {
    response: "Quality matters in herbalism. Here's what to look for:\n\n**Organic Certification:** Ensures no pesticide residues.\n\n**Reputable Suppliers:** Buy from established herbal companies. Check reviews and certifications.\n\n**Wildcrafted:** Some herbs are sustainably harvested wild. Ask suppliers if plants are endangered.\n\n**Freshness:** Dried herbs should smell vibrant, not musty. Buy from suppliers with high turnover.\n\n**Know the Botanical Name:** 'Ginseng' can mean 3 different plants. Confirm species with your supplier.\n\nYour Herbal Planner can track which suppliers you trust. We'll have resources for ethical sourcing coming soon. [Browse Resources] for current recommendations.",
    links: [],
    suggestions: ["Invest in quality herbs—they're more potent and safer"]
  },

  // Business & Resources
  "business|resources|herbal business|start selling|become herbalist": {
    response: "Interested in herbalism as a profession or side business? Great!\n\nC.H.I has a **Resources section** dedicated to this:\n- How to source wholesale herbs\n- Creating herbal blends for others\n- Regulatory requirements (FDA, labeling)\n- Building an herbal practice\n- Connecting with suppliers\n- Educational pathways (certifications, apprenticeships)\n\nWe also feature herbalists and small suppliers who use our platform. [Browse Resources] to explore business paths, or [Contact Us] if you're interested in being featured.\n\nRemember: Different regions have different regulations. Always research your area's guidelines.",
    links: [],
    suggestions: ["Check our Resources page for herbal business guidance"]
  },

  // Default response for questions we don't have specific answers for
  "default": {
    response: "Great question! I'm still learning about all of herbalism's depths. Here's what I suggest:\n\n1. **Browse our [Herb Profiles]** — explore herbs by name, wellness area, or preparation method.\n2. **Try Herb Match** — answer a few questions and we'll suggest relevant herbs.\n3. **Search our Glossary** — learn about plant compounds, herbalism terms, and concepts.\n4. **Read our Resources** — guides on getting started, safety, sourcing, and building an herbal practice.\n\nIf you're looking for a specific herb or wellness concern, try searching those keywords in Herb Match or our profiles. What aspect of herbalism interests you most?",
    links: [],
    suggestions: ["Explore Herb Match or browse all Herb Profiles"]
  }
};

// Scoring function: How well does a query match a category?
function scoreMatch(userQuery, categoryKeywords) {
  const queryWords = userQuery.toLowerCase().split(/\s+/);
  const keywords = categoryKeywords.toLowerCase().split("|");

  let matches = 0;
  keywords.forEach(keyword => {
    queryWords.forEach(word => {
      if (word.includes(keyword) || keyword.includes(word)) {
        matches++;
      }
    });
  });

  return matches;
}

// Get response based on user query
function getHerbexaResponse(userQuery, lessTehnical = false) {
  if (!userQuery || userQuery.trim().length === 0) {
    return "Ask me anything about herbs! What wellness area interests you? Sleep, focus, digestion, immunity, stress, energy, or something else?";
  }

  let bestScore = 0;
  let bestKey = "default";

  // Score all categories
  Object.keys(HERBEXA_KB).forEach(key => {
    if (key !== "default") {
      const score = scoreMatch(userQuery, key);
      if (score > bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }
  });

  // If no good match, use default
  if (bestScore === 0) {
    bestKey = "default";
  }

  const response = HERBEXA_KB[bestKey];
  let message = response.response;

  // Simplify if less technical mode
  if (lessTehnical) {
    message = message
      .replace(/curcumin|phytochemical|phytoestrogen|alkaloid/g, "compound")
      .replace(/bioavailable|absorption/g, "your body can use it")
      .replace(/NF-κB|COX-2|pathway/g, "")
      .replace(/\(.*?\)/g, ""); // Remove parenthetical explanations
  }

  // Add random suggestion
  if (response.suggestions && response.suggestions.length > 0) {
    const suggestion = response.suggestions[Math.floor(Math.random() * response.suggestions.length)];
    message += "\n\n" + suggestion;
  }

  return message;
}

// Export for use in widget
window.HERBEXA_ENGINE = {
  getResponse: getHerbexaResponse,
  kb: HERBEXA_KB
};