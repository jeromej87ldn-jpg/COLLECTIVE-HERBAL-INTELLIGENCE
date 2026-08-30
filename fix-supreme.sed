/^function loadHerbProfile/,/^}/c\
// Sample herb profiles for fallback when API is unavailable\
const FALLBACK_PROFILES = {\
  'ashwagandha': {name:'Ashwagandha',latin:'Withania somnifera',category:'Adaptogen',origin:'India, Pakistan',tradition:'Ayurvedic',safetyLevel:'Generally safe',functionalOverview:'Withania somnifera is a powerful adaptogenic herb traditionally used in Ayurvedic medicine to support stress response and vitality. Modern research validates its traditional applications, showing effects on cortisol regulation, anxiety reduction, and immune support.',preparation:{tea:'Steep 1-2g powder',tincture:'Standard herbal tincture',capsule:'Standardized extracts',topical:'Not typically used topically'},compounds:[{name:'Withanolides',class:'Alkaloid',role:'Adaptogenic activity',mechanism:'Stress hormone modulation',evidence:'Clinical studies show 2-3 month benefits'}],herbalActions:[{name:'Adaptogen',system:'Nervous',description:'Supports healthy stress response',compounds:['Withanolides']}],bodyEffects:[{system:'Nervous',effect:'Stress support'},{system:'Immune',effect:'Immune support'}],interactions:[],disclaimer:'Educational reference only. Not medical advice. Consult healthcare provider before use.'},\
  'turmeric': {name:'Turmeric',latin:'Curcuma longa',category:'Anti-inflammatory',origin:'South Asia',tradition:'Ayurvedic',safetyLevel:'Generally safe',functionalOverview:'Golden turmeric root has been revered across Indian and Southeast Asian healing traditions. Rich in curcumin and other polyphenols, modern science confirms its potent anti-inflammatory properties.',preparation:{tea:'Golden milk with black pepper',tincture:'Curcuma extract',capsule:'With piperine',topical:'In oils'},compounds:[{name:'Curcumin',class:'Phenolic acid',role:'Anti-inflammatory',mechanism:'Inhibits inflammatory pathways',evidence:'Extensive research'}],herbalActions:[{name:'Anti-inflammatory',system:'Circulatory',description:'Supports healthy inflammation response',compounds:['Curcumin']}],bodyEffects:[{system:'Digestive',effect:'Digestive support'},{system:'Circulatory',effect:'Circulation support'}],interactions:[],disclaimer:'Educational reference only.'},\
  'lion\'s mane': {name:'Lion\'s Mane',latin:'Hericium erinaceus',category:'Cognitive',origin:'North Asia',tradition:'Traditional Chinese',safetyLevel:'Generally safe',functionalOverview:'This distinctive mushroom supports brain health and cognitive function. Modern research reveals its unique compounds promote nerve growth factor (NGF) production.',preparation:{tea:'Mushroom decoction',tincture:'Extracted fruiting body',capsule:'Mycelium extract',topical:null},compounds:[{name:'Hericenones',class:'Terpenoid',role:'NGF stimulation',mechanism:'Promotes nerve growth',evidence:'Mushroom bioactives'}],herbalActions:[{name:'Cognitive support',system:'Nervous',description:'Supports brain health',compounds:['Hericenones']}],bodyEffects:[{system:'Nervous',effect:'Cognitive support'}],interactions:[],disclaimer:'Educational reference only.'}\
};\
\
function loadHerbProfile(herbName){\
  const profileSection = document.getElementById('herb-profile');\
  if(!profileSection) return;\
  const profileLoading = document.getElementById('profile-loading');\
  const profileContent = document.getElementById('profile-content');\
  profileSection.style.display = 'block';\
  if(profileLoading) profileLoading.style.display = 'block';\
  if(profileContent) profileContent.style.display = 'none';\
  const herbKey = herbName.toLowerCase().trim();\
  const url = '/.netlify/functions/herb-profile';\
  const payload = { herbName: herbKey };\
  fetch(url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)})\
  .then(res => {if(!res.ok) throw new Error(`HTTP ${res.status}`);return res.json();})\
  .then(profile => {renderProfile(profile);if(profileLoading) profileLoading.style.display = 'none';if(profileContent) profileContent.style.display = 'block';})\
  .catch(err => {console.error('API error:',err.message);const fallback = FALLBACK_PROFILES[herbKey];if(fallback){renderProfile(fallback);if(profileLoading) profileLoading.innerHTML = '<p style="text-align:center;color:var(--charcoal-mid);font-size:11px;padding:1rem;font-style:italic;">Sample profile</p>';if(profileContent) profileContent.style.display = 'block';}else{if(profileLoading) profileLoading.innerHTML = '<p style="text-align:center;color:var(--charcoal-mid);font-style:italic;padding:2rem;">Unable to load herb profile</p>';}});\
}
