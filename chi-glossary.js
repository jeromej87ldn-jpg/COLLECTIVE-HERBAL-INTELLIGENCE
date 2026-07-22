// ── CHI SHARED GLOSSARY (portable) ───────────────────────────────
// Auto-tags known terms in page text and shows a definition tooltip on
// hover. Extracted from phytochemistry.html so multiple pages share one
// copy of the definitions.
(function(){
  if(window.__chiGlossaryLoaded) return;          // guard against double-include
  window.__chiGlossaryLoaded = true;

  // Injected styles — literal colors so the tooltip looks identical on any
  // page regardless of that page's own CSS variables.
  (function(){
    var css = `
.chi-term{border-bottom:1px dashed rgba(200,149,42,.45);cursor:help;transition:border-color .15s;}
.chi-term:hover{border-bottom-color:rgba(200,149,42,.9);}
.chi-tooltip{position:fixed;z-index:2000;background:#1a3a2a;border:1px solid rgba(200,149,42,.35);border-radius:8px;padding:.85rem 1.1rem;max-width:320px;min-width:200px;box-shadow:0 8px 28px rgba(0,0,0,.55);pointer-events:none;opacity:0;transform:translateY(4px);transition:opacity .18s,transform .18s;}
.chi-tooltip.show{opacity:1;transform:translateY(0);}
.chi-tooltip-term{font-family:'Cormorant Garamond',serif;font-size:15px;font-weight:500;color:#e8b84b;margin-bottom:.3rem;}
.chi-tooltip-def{font-size:12.5px;color:rgba(245,240,232,.82);line-height:1.62;}
.chi-tooltip-herbs{margin-top:.55rem;padding-top:.5rem;border-top:1px solid rgba(255,255,255,.08);}
.chi-tooltip-herbs-label{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:rgba(245,240,232,.3);margin-bottom:.35rem;}
.chi-tooltip-herb-pills{display:flex;flex-wrap:wrap;gap:.3rem;}
.chi-tooltip-herb-pill{font-size:11px;padding:2px 7px;border-radius:4px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(245,240,232,.6);}
.chi-tooltip-herb-pill.in-stack{background:rgba(200,149,42,.18);border-color:rgba(200,149,42,.4);color:#e8b84b;font-weight:500;}
.chi-tooltip-footer{font-size:10.5px;color:rgba(245,240,232,.28);margin-top:.45rem;display:flex;align-items:center;gap:5px;}
`;
    var style = document.createElement('style');
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
  })();

  const DEFS = {
    'adaptogen': {l:'Adaptogen',d:'A herb that helps the body resist physical and mental stress without causing harm. Works by modulating the HPA axis — your central stress system. Examples: ashwagandha, rhodiola, shilajit.'},
  'adaptogenic': {l:'Adaptogenic',d:'Having the properties of an adaptogen — helping the body resist stress and return to balance without overstimulating any one system.'},
  'nervine': {l:'Nervine',d:'A herb that supports and nourishes the nervous system. Nervine tonics (oat straw) rebuild; nervine relaxants (passionflower, lemon balm) calm; nervine stimulants (rosemary) activate.'},
  'nootropic': {l:'Nootropic',d:"A substance that enhances cognitive function — memory, focus, creativity — without significant side effects. Lion's mane and lemon balm are herbal nootropics."},
  'carminative': {l:'Carminative',d:'A herb that relieves intestinal gas and gut spasm, typically through volatile oils that relax smooth muscle in the gut wall. Examples: fennel, peppermint, clove, ginger.'},
  'demulcent': {l:'Demulcent',d:'A herb that soothes irritated or inflamed mucous membranes by forming a protective coating. Marshmallow root and slippery elm are classic demulcents.'},
  'expectorant': {l:'Expectorant',d:"A herb that helps clear mucus from the lungs and airways. Stimulating expectorants (thyme) increase secretion; relaxing expectorants (mullein, marshmallow) thin mucus so it's easier to clear."},
  'diuretic': {l:'Diuretic',d:'Increases urine production. Most herbal diuretics (dandelion, nettle) are aquaretics — they increase water output without depleting potassium, unlike pharmaceutical loop diuretics.'},
  'aquaretic': {l:'Aquaretic',d:'A type of diuretic that increases water excretion without significant electrolyte loss. Safer for long-term use than pharmaceutical diuretics. Dandelion leaf is a well-known aquaretic.'},
  'hepatoprotective': {l:'Hepatoprotective',d:'Protects liver cells from damage. Silymarin in milk thistle is the most clinically validated hepatoprotective compound — used in emergency medicine for toxic liver injury.'},
  'cholagogue': {l:'Cholagogue',d:'A herb that stimulates the gallbladder to release stored bile — aiding fat digestion and liver detoxification. Dandelion root is a well-known cholagogue.'},
  'choleretic': {l:'Choleretic',d:'Stimulates the liver to produce more bile. Distinct from a cholagogue (which releases stored bile). Dandelion root and milk thistle do both.'},
  'vulnerary': {l:'Vulnerary',d:'A herb that promotes wound healing and tissue repair, typically by stimulating collagen synthesis. Calendula is the most evidenced vulnerary herb.'},
  'emmenagogue': {l:'Emmenagogue',d:'Stimulates or regulates menstrual flow by acting on uterine smooth muscle. Mugwort is the most documented Western example. Contraindicated in pregnancy.'},
  'diaphoretic': {l:'Diaphoretic',d:'Promotes sweating, traditionally used to break fevers. Hot diaphoretics (ginger, elderflower) increase circulation; cool diaphoretics (hibiscus, peppermint) lower temperature.'},
  'styptic': {l:'Styptic',d:'Stops external bleeding when applied topically. Tannin-rich herbs (yarrow, raspberry leaf) precipitate proteins on wound surfaces and contract blood vessels.'},
  'antispasmodic': {l:'Antispasmodic',d:'Relaxes muscle spasm — either in the digestive tract or skeletal muscle. Works mainly by blocking calcium channels in smooth muscle.'},
  'anxiolytic': {l:'Anxiolytic',d:'Reduces anxiety without necessarily causing sedation. Ashwagandha, passionflower and lemon balm have anxiolytic action at lower doses before becoming sedative at higher doses.'},
  'hypnotic': {l:'Hypnotic',d:'Promotes sleep — stronger in effect than a simple relaxant. Valerian, hops and high-dose passionflower are hypnotics.'},
  'sedative': {l:'Sedative',d:'Calms the nervous system and reduces excitability. Milder than a hypnotic. Passionflower and lemon balm are sedatives at standard doses.'},
  'immunomodulator': {l:'Immunomodulator',d:'Normalises immune function — can stimulate an underactive immune system or calm an overactive one. Different from a simple immune stimulant. Nigella and medicinal mushrooms are immunomodulators.'},
  'antiviral': {l:'Antiviral',d:'Inhibits viral replication or entry. Oleuropein in olive leaf prevents viral entry by binding to viral envelope proteins before they can attach to host cells.'},
  'antimicrobial': {l:'Antimicrobial',d:'Active against bacteria, fungi or viruses. Thymoquinone in nigella is broadly antimicrobial — it disrupts microbial cell membrane integrity.'},
  'lymphagogue': {l:'Lymphagogue',d:'Stimulates lymphatic circulation and clears lymphatic congestion. Calendula and cleavers are lymphagogues — supporting immune cell movement and tissue drainage.'},
  'trophorestorative': {l:'Trophorestorative',d:"Restores and rebuilds the function of a specific organ or system over time through regular use. Milk thistle is trophorestorative for the liver; lion's mane for the nervous system."},
  'alterative': {l:'Alterative',d:'Gradually improves metabolism and nutrition, traditionally said to "alter" the body towards better health. Cleavers, nettle and burdock are classic alteratives.'},
  'bitter tonic': {l:'Bitter tonic',d:'A herb that stimulates digestion through bitter taste receptors (TAS2R) on the tongue. Must be tasted to work — capsules bypass the mechanism. Dandelion, mugwort and gentian are bitter tonics.'},
  // Singular and plural keys point at one shared definition so the tagger
  // matches either form without maintaining two copies that can drift.
  'flavonoid': {l:'Flavonoid',d:'The largest class of plant polyphenols — over 6,000 known. Includes quercetin, apigenin, luteolin and kaempferol. Broadly anti-inflammatory, antioxidant and cardioprotective; found in almost every herb.'},
  'alkaloid': {l:'Alkaloid',d:'Nitrogen-containing plant compounds — often bitter and pharmacologically potent. Include berberine (barberry), caffeine (green tea) and morphine; the basis of many plant-derived pharmaceuticals. Work on specific receptors with clear dose-dependence.'},
  'tannin': {l:'Tannin',d:'Polyphenols that bind and precipitate proteins, creating an astringent sensation that contracts tissue. Protect wound surfaces, reduce inflammation and have antimicrobial properties. High in raspberry leaf, oak bark, green tea and witch hazel.'},
  'saponin': {l:'Saponin',d:'Soap-like plant compounds that foam in water. Improve cell membrane permeability (enhancing absorption of other compounds), support immune function and lower cholesterol. Found in ashwagandha, liquorice and many herbs.'},
  'terpenoid': {l:'Terpenoid',d:'The largest class of plant compounds — built from five-carbon isoprene units. Includes essential oil components (monoterpenes), withanolides (diterpenes), silymarin (triterpenoid) and carotenoids.'},
  'terpenoids': {l:'Terpenoids',d:"The most diverse class of plant compounds. Responsible for most herbal scents (monoterpenes) and many therapeutic actions. Includes everything from lemon balm's citral to ashwagandha's withanolides."},
  'polysaccharide': {l:'Polysaccharide',d:"Long-chain sugars found in medicinal mushrooms and herbs. Beta-glucans in lion's mane activate immune surveillance; arabinogalactans in marshmallow coat and protect gut mucosa."},
  'polysaccharides': {l:'Polysaccharides',d:'Complex carbohydrate chains with significant immune-modulating and protective effects. Beta-glucans (mushrooms), arabinogalactans (marshmallow) and inulin (dandelion) are key examples.'},
  'phenolic acid': {l:'Phenolic acid',d:'Simple polyphenols including rosmarinic acid (lemon balm), chlorogenic acid (dandelion) and caffeic acid (nettle). Anti-inflammatory, antioxidant and often involved in enzyme inhibition.'},
  'phenolic acids': {l:'Phenolic acids',d:'Simple polyphenolic compounds with antioxidant and anti-inflammatory properties. Rosmarinic acid in lemon balm inhibits both AChE and GABA-T — making it uniquely cognitive and calming.'},
  'iridoid': {l:'Iridoid',d:'A type of terpenoid found in olives, valerian and plantain — often bitter and anti-inflammatory. Oleuropein (olive leaf) is an iridoid glycoside.'},
  'iridoids': {l:'Iridoids',d:'Bitter terpenoid compounds found in olive leaf (oleuropein), valerian and plantain. Among the most studied natural anti-inflammatory and antimicrobial compound classes.'},
  'withanolide': {l:'Withanolide',d:'Steroidal lactone compounds unique to ashwagandha (Withania somnifera). Structurally similar to human steroid hormones — modulate glucocorticoid receptors, reduce cortisol, and support testosterone.'},
  'withanolides': {l:'Withanolides',d:'The primary bioactive compounds in ashwagandha. Reduce cortisol by up to 27% in double-blind trials by modulating the HPA axis. Also support testosterone and thyroid function.'},
  'glycoside': {l:'Glycoside',d:'A compound consisting of a sugar molecule attached to an active compound (aglycone). The sugar improves solubility and stability; digestive enzymes split it, releasing the active aglycone.'},
  'glycosides': {l:'Glycosides',d:"Compounds where a sugar is bonded to an active molecule. The sugar acts as a delivery vehicle — gut bacteria or digestive enzymes release the active aglycone where it's needed."},
  'bioavailability': {l:'Bioavailability',d:'The proportion of a compound that actually reaches systemic circulation after ingestion. Fat-soluble compounds need dietary fat to absorb. Piperine in black pepper increases curcumin bioavailability by 2,000%.'},
  'hpa axis': {l:'HPA Axis',d:"Hypothalamic-Pituitary-Adrenal axis — your body's central stress response system. Chronic activation keeps cortisol elevated, impairing sleep, immunity and cognition. Adaptogens specifically modulate this system."},
  'nf-κb': {l:'NF-κB',d:'A key molecular switch controlling inflammation genes. When activated it triggers cytokine production. Ashwagandha withanolides, olive leaf oleuropein and nigella thymoquinone all inhibit NF-κB.'},
  'nrf2': {l:'Nrf2',d:"A master regulator of cellular antioxidant defence. When activated by sulforaphane, quercetin or thymoquinone, it switches on genes producing SOD, catalase and glutathione — your body's own antioxidant enzymes."},
  'gaba': {l:'GABA',d:"Gamma-aminobutyric acid — your brain's primary inhibitory neurotransmitter. Low GABA = anxiety and poor sleep. Passionflower's apigenin binds GABA-A receptors; lemon balm's rosmarinic acid slows GABA breakdown."},
  'cox-2': {l:'COX-2',d:'Cyclooxygenase-2 — the enzyme that produces inflammatory prostaglandins. NSAIDs like ibuprofen block it. Many herbs (quercetin, oleuropein, thymoquinone) also inhibit COX-2 without the gut side effects.'},
  'cox': {l:'COX (COX-1/COX-2)',d:'Cyclooxygenase enzymes that produce prostaglandins — chemical messengers of pain and inflammation. Many anti-inflammatory herbs inhibit COX. COX-2-specific inhibitors cause less gut damage than COX-1 inhibitors.'},
  'apoptosis': {l:'Apoptosis',d:"Programmed cell death — the body's controlled process for removing damaged cells. Some plant compounds are studied because they trigger apoptosis in cancer cells while leaving healthy cells unaffected."},
  'ngf': {l:'NGF (Nerve Growth Factor)',d:"A protein that supports the survival and growth of nerve cells. Hericenones and erinacines from lion's mane mushroom are the only known dietary compounds that directly stimulate NGF synthesis in the brain."},
  'bdnf': {l:'BDNF',d:"Brain-Derived Neurotrophic Factor — a protein that supports brain cell growth, learning and memory. Lion's mane erinacines stimulate BDNF production in the hippocampus."},
  'ampk': {l:'AMPK',d:'A master metabolic switch in every cell. When activated it increases glucose uptake, burns fat and reduces inflammation. Berberine and chlorogenic acid activate AMPK via the same pathway as metformin.'},
  'silymarin': {l:'Silymarin',d:'The active complex in milk thistle — a mixture of flavonolignans. One of the most clinically validated hepatoprotective compounds; used in emergency medicine for death cap mushroom poisoning.'},
  'oleuropein': {l:'Oleuropein',d:'The primary bioactive compound in olive leaf. Has antimicrobial, antiviral, antihypertensive and antioxidant actions. Prevents viral entry by binding to viral capsid proteins before they reach host cells.'},
  'thymoquinone': {l:'Thymoquinone',d:'Primary bioactive in nigella (black seed). Simultaneously inhibits COX-1/2, 5-LOX and NF-κB — a rare triple anti-inflammatory mechanism. Also disrupts microbial membranes and modulates Th1/Th2 immune balance.'},
  'rosmarinic acid': {l:'Rosmarinic acid',d:'A phenolic acid in lemon balm, rosemary and sage. Inhibits acetylcholinesterase (improving focus) and GABA transaminase (promoting calm) simultaneously — making it uniquely both cognitive and anxiolytic.'},
  'beta-glucan': {l:'Beta-glucan',d:"A type of polysaccharide found in medicinal mushrooms. Binds to Dectin-1 receptors on immune cells, activating the body's innate immune response — the same alert system normally triggered by fungal pathogens."},
  'beta-glucans': {l:'Beta-glucans',d:"Polysaccharides in medicinal mushrooms (lion's mane, reishi, turkey tail) that activate macrophage and NK cell immune surveillance via Dectin-1 receptor binding."},
  'mitophagy': {l:'Mitophagy',d:'A cellular cleaning process where damaged mitochondria are broken down and recycled. Urolithin A — produced from ellagic acid in raspberry leaf — activates mitophagy and is one of the most studied anti-aging compounds.'},
  'senolytic': {l:'Senolytic',d:'Clears senescent cells — old, damaged cells that have stopped dividing but release inflammatory signals that accelerate aging. Fisetin (strawberry) is one of the most studied natural senolytics.'},
  'phytoestrogen': {l:'Phytoestrogen',d:'A plant compound that weakly mimics oestrogen. Isoflavones (red clover) and lignans (flaxseed) are phytoestrogens. Effects can be oestrogenic or anti-oestrogenic depending on hormonal context.'},
  'nervous system': {l:'Nervous System',d:'Controls all body functions through electrical signals. Includes brain, spinal cord and peripheral nerves. Nervines calm it; adaptogens regulate its stress response; nootropics improve its efficiency.'},
  'immune system': {l:'Immune System',d:"The body's defence network. Overactivation causes allergies and autoimmunity; underactivation causes frequent illness. Immunomodulators like nigella normalise rather than simply stimulate it."},
  'digestive system': {l:'Digestive System',d:'Breaks down food across 9 metres of gut. Bitter herbs stimulate it via TAS2R receptors; demulcents soothe it; prebiotics feed its microbiome; bitters must be tasted to work.'},
  'cardiovascular': {l:'Cardiovascular System',d:'Heart and blood vessels. Herbs support it via blood pressure regulation (olive leaf ACE inhibition), vessel wall integrity (proanthocyanidins) and anti-inflammatory action (quercetin).'},
  'endocrine': {l:'Endocrine System',d:'Hormone-producing glands — adrenals, thyroid, pancreas, gonads. Controls metabolism, stress and reproduction. Adaptogens specifically target the HPA axis (stress hormones) within this system.'},
  'respiratory': {l:'Respiratory System',d:'Lungs and airways. Expectorants clear mucus; antispasmodics relax bronchial spasm; demulcents soothe irritated mucosa; antimicrobials address infection.'},
  'hepatic': {l:'Hepatic / Liver',d:'The liver has 500+ functions — detoxification, bile production, hormone processing. Hepatoprotective herbs protect liver cells; choleretics stimulate bile; cholagogues release stored bile.'},
  'lymphatic': {l:'Lymphatic System',d:'Vessels and nodes draining fluid from tissues and hosting immune cells. Lymphagogue herbs (calendula, cleavers) stimulate lymph flow and clear congestion.'},
  'antioxidant': {l:'Antioxidant',d:'Neutralises free radicals — reactive molecules that damage cells and accelerate ageing. Quercetin, vitamin C and rosmarinic acid are potent antioxidants. Your body also makes its own via Nrf2 activation.'},
  'bioactive': {l:'Bioactive',d:'A compound that has a measurable biological effect in the body — it works. Not all compounds in an herb are bioactive; many are just bulk. Quercetin and oleuropein are bioactive; cellulose is not.'},
  'polyphenol': {l:'Polyphenol',d:'A plant compound with multiple phenolic rings — potent antioxidants and anti-inflammatories. Includes flavonoids, tannins and phenolic acids. Responsible for most herbal benefits.'},
  'anti-inflammatory': {l:'Anti-inflammatory',d:'Reduces inflammation by inhibiting cytokines or inflammatory enzymes (COX, 5-LOX, NF-κB). Quercetin, thymoquinone and oleuropein are multi-pathway anti-inflammatories.'},
  'adaptogen': {l:'Adaptogen',d:'An herb that helps the body adapt to stress and restore balance. Works specifically on the HPA axis (cortisol). Ashwagandha and reishi are classic adaptogens — non-toxic, non-habit-forming.'},
  'mechanism': {l:'Mechanism of Action',d:"How a compound produces its effect. Rather than 'lowers inflammation,' it might be 'inhibits NF-κB pathway' or 'blocks COX-2 enzyme.' Understanding mechanism explains why a herb works and when it might fail."},
  'receptor': {l:'Receptor',d:'A protein on a cell that catches and responds to chemical messengers. GABA receptors bind calming neurotransmitters; benzodiazepine site on GABA-A is where anxiety drugs (and passionflower) bind.'},
  'enzyme': {l:'Enzyme',d:'A protein that speeds up chemical reactions. Cholinesterase breaks down acetylcholine; COX-2 produces prostaglandins (pain); AChE breakdown slows cognition. Many herbs work by inhibiting enzymes.'},
  'synergistic': {l:'Synergistic',d:'When two compounds work better together than separately. Piperine enhances curcumin absorption 2,000x. Herbal synergy is often why whole-plant extracts work better than isolated compounds.'},
  'constituent': {l:'Constituent',d:'A component or ingredient in an herb. Milk thistle has 200+ constituents, but silymarin is the key therapeutic one. Not all constituents are active — bulk includes fibre and minerals.'},
  'tincture': {l:'Tincture',d:'An alcohol (usually 1:5 ratio) or glycerin extract of an herb. Preserves volatile oils and alkaloids better than water. Faster-acting than dried herb infusions; more concentrated.'},
  'decoction': {l:'Decoction',d:'A water extraction made by simmering roots, bark or seeds for 15-30 minutes. Extracts harder plant material and minerals. Use for woody herbs (hawthorn, liquorice root). Not for delicate leaves.'},
  'infusion': {l:'Infusion',d:'A water extraction made by steeping dried leaves in hot water for 5-10 minutes — like tea. Gentler than decoction. Best for leaves and flowers. Does not preserve volatile oils well.'},
  'bioavailability': {l:'Bioavailability (improved)',d:'How much of an ingested compound actually reaches your bloodstream. Fat-soluble vitamins need dietary fat; piperine (black pepper) increases curcumin absorption 2,000-fold. Preparation method matters enormously.'},
  'rct': {l:'RCT (Randomized Controlled Trial)',d:'A double-blind study comparing an herb to placebo on randomly assigned groups. The gold standard for evidence. Many herbs have RCT data — ashwagandha, passionflower and olive leaf are well-studied.'},
  'in vitro': {l:'In Vitro',d:'Latin "in glass" — research done in test tubes or petri dishes, not in living organisms. Shows mechanism but does not prove it works in real bodies. Many herbs kill cancer cells in vitro but not in humans.'},
  'in vivo': {l:'In Vivo',d:'Latin "in living" — research done in living animals or humans. Shows whether something actually works in a real body, not just theoretically. More trustworthy than in vitro, but harder to do.'},
  'inhibitor': {l:'Inhibitor',d:'A compound that blocks or slows an enzyme or process. COX-2 inhibitors reduce inflammation; AChE inhibitors improve memory by slowing neurotransmitter breakdown.'},
  'acute': {l:'Acute (vs Chronic)',d:'Short-term, intense condition. Acute diarrhoea vs chronic IBS. Some herbs work acutely (ginger for nausea); others require weeks of use to restore (nettle for nutrition).'},
  'potentiation': {l:'Potentiation',d:'When one compound enhances the effect of another beyond what either does alone. Piperine potentiates curcumin absorption. Synergy and potentiation make herbal combinations powerful.'},
  'metabolism': {l:'Metabolism',d:'Chemical processes that break down, store and use food for energy and tissue repair. Herbs affect metabolism through AMPK activation (fat burning), mitochondrial function (energy), or CYP enzyme modulation (detox).'},
  'half-life': {l:'Half-life',d:'Time for half a dose of a compound to leave your body. Caffeine: 5 hours; curcumin: 6 hours; berberine: 4-6 hours. Matters for dosing frequency and whether it builds up or washes out.'},
  'synergy': {l:'Synergy',d:'Herbal synergy means combinations work better than single herbs. This is why traditional formulas with 5+ herbs often outperform isolated single compounds. Whole-plant medicine is more than the sum of its parts.'}
  };

  // Plural aliases — the word-boundary tagger matches whole words, so the
  // plural forms need their own keys, but they point at the singular's
  // single canonical definition rather than duplicating the text.
  ['flavonoid','alkaloid','tannin','saponin'].forEach(base=>{ DEFS[base+'s'] = DEFS[base]; });

  // Create tooltip element
  const tip = document.createElement('div');
  tip.className = 'chi-tooltip';
  tip.innerHTML = '<div class="chi-tooltip-term"></div><div class="chi-tooltip-def"></div><div class="chi-tooltip-herbs" style="display:none"><div class="chi-tooltip-herbs-label">Herb sources</div><div class="chi-tooltip-herb-pills"></div></div><div class="chi-tooltip-footer">📚 CHI Glossary</div>';
  document.body.appendChild(tip);

  let hideTimer;

  function showTip(el, e){
    const term = el.dataset.term || el.textContent.trim();
    const def = DEFS[term.toLowerCase()];
    const herbs = el.dataset.herbs ? el.dataset.herbs.split('|').filter(Boolean) : [];

    // Need either a definition or herb list to show anything
    if(!def && !herbs.length) return;

    tip.querySelector('.chi-tooltip-term').textContent = def ? def.l : term;
    tip.querySelector('.chi-tooltip-def').textContent = def ? def.d : '';

    // Herb pills
    const herbSection = tip.querySelector('.chi-tooltip-herbs');
    const pillsWrap = tip.querySelector('.chi-tooltip-herb-pills');
    if(herbs.length){
      const stack = JSON.parse(localStorage.getItem('chi_phyto_stack')||'[]').map(h=>h.toLowerCase());
      pillsWrap.innerHTML = herbs.sort().map(h=>{
        const inStack = stack.some(s=>s.includes(h.toLowerCase())||h.toLowerCase().includes(s));
        return `<span class="chi-tooltip-herb-pill${inStack?' in-stack':''}">${h}${inStack?' ✓':''}</span>`;
      }).join('');
      herbSection.style.display='block';
    } else {
      herbSection.style.display='none';
    }

    clearTimeout(hideTimer);
    positionTip(e);
    tip.classList.add('show');
  }

  function positionTip(e){
    const pad = 14, tw = 300, th = 160;
    let x = e.clientX + pad;
    let y = e.clientY + pad;
    if(x + tw > window.innerWidth) x = e.clientX - tw - pad;
    if(y + th > window.innerHeight) y = e.clientY - th - pad;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }

  document.addEventListener('mouseover', function(e){
    const el = e.target.closest('.chi-term,[data-herbs]');
    if(!el) return;
    showTip(el, e);
  });

  document.addEventListener('mousemove', function(e){
    if(tip.classList.contains('show') && e.target.closest('.chi-term,[data-herbs]'))
      positionTip(e);
  });

  document.addEventListener('mouseout', function(e){
    if(!e.target.closest('.chi-term,[data-herbs]')) return;
    hideTimer = setTimeout(()=>tip.classList.remove('show'), 250);
  });

  // Auto-tag known terms in the page after render
  // Uses a MutationObserver so it catches dynamically rendered content too
  const tagged = new WeakSet();
  const termKeys = Object.keys(DEFS).sort((a,b)=>b.length-a.length); // longest first

  function tagNode(node){
    if(node.nodeType !== Node.TEXT_NODE) return;
    if(!node.textContent.trim()) return;
    const parent = node.parentElement;
    if(!parent) return;
    // Skip: already tagged, inside script/style/input, inside a chi-term
    if(parent.closest('.chi-term,.chi-tooltip,script,style,input,textarea,a,button')) return;
    if(tagged.has(node)) return;
    tagged.add(node);

    let text = node.textContent;
    let changed = false;
    let html = text;

    termKeys.forEach(term=>{
      if(!html.toLowerCase().includes(term)) return;
      const re = new RegExp('(?<![\w-])(' + term.replace(/[-[\]{}()*+?.,\\^$|#\s]/g,'\\$&') + ')(?![\w-])', 'gi');
      if(re.test(html)){
        html = html.replace(re, `<span class="chi-term" data-term="${term}">$1</span>`);
        changed = true;
      }
    });

    if(changed){
      const span = document.createElement('span');
      span.innerHTML = html;
      parent.replaceChild(span, node);
    }
  }

  function tagTree(root){
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    const nodes = [];
    let n;
    while((n = walker.nextNode())) nodes.push(n);
    nodes.forEach(tagNode);
  }

  // Tag existing content once the DOM is ready. If this script loads after
  // the document has already parsed (e.g. included at the end of <body>),
  // DOMContentLoaded won't fire again, so tag immediately in that case.
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=>tagTree(document.body));
  } else {
    tagTree(document.body);
  }

  // Watch for dynamic content (React renders, JS-injected HTML)
  const observer = new MutationObserver(muts=>{
    muts.forEach(m=>{
      m.addedNodes.forEach(n=>{
        if(n.nodeType === Node.ELEMENT_NODE) tagTree(n);
        else if(n.nodeType === Node.TEXT_NODE) tagNode(n);
      });
    });
  });
  observer.observe(document.body, {childList:true, subtree:true});
})();
