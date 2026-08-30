/**
 * HERBADEX Anatomy Education Data
 * Complete organ and system information
 *
 * Usage: Include this file before anatomy-modal.js
 * <script src="anatomy-data.js"></script>
 * <script src="anatomy-modal.js"></script>
 */

const ANATOMY_DATA = {
  systems: {
    digestive: {
      id: 'digestive',
      name: 'Digestive System',
      description: 'Breaks down food, absorbs nutrients, eliminates waste',
      organs: ['liver', 'stomach', 'pancreas', 'small_intestine', 'large_intestine', 'gallbladder']
    },
    respiratory: {
      id: 'respiratory',
      name: 'Respiratory System',
      description: 'Exchanges oxygen for carbon dioxide',
      organs: ['lungs', 'trachea', 'diaphragm']
    },
    circulatory: {
      id: 'circulatory',
      name: 'Circulatory System',
      description: 'Transports oxygen, nutrients, and hormones',
      organs: ['heart', 'blood_vessel']
    },
    nervous: {
      id: 'nervous',
      name: 'Nervous System',
      description: 'Processes information, regulates functions',
      organs: ['brain']
    },
    urinary: {
      id: 'urinary',
      name: 'Urinary System',
      description: 'Filters waste and regulates water balance',
      organs: ['kidneys', 'kidney_detail', 'bladder']
    }
  },

  organs: {
    // DIGESTIVE SYSTEM
    liver: {
      id: 'liver',
      system: 'digestive',
      name: 'Liver',
      latinName: 'Hepar',
      description: 'Your liver is the detoxification powerhouse. It processes every nutrient and toxin that enters your bloodstream, performs 500+ functions, and produces bile to digest fats.',
      functions: [
        'Phase 1/2/3 detoxification pathways',
        'Bile production (800-1000 mL daily)',
        'Nutrient metabolism',
        'Protein synthesis',
        'Blood filtering and storage'
      ],
      needs: [
        'B vitamins (B5, B12, folate)',
        'Glutathione (antioxidant)',
        'Sulfur-rich foods (garlic, onions, cruciferous)',
        'Adequate sleep (detox peaks midnight-4 AM)',
        'Minimize alcohol and processed foods'
      ],
      processes: [
        {
          title: 'Three-Phase Detoxification',
          description: 'Phase 1: Enzymes (cytochrome P450) break toxins into smaller pieces. Phase 2: Glutathione and other molecules bind to toxins (conjugation), making them water-soluble. Phase 3: Carrier proteins escort toxins to bile or urine for elimination.'
        },
        {
          title: 'Bile Production & Fat Digestion',
          description: 'Your liver makes 800-1000 mL bile daily. Bile salts emulsify fats (break them into tiny droplets), making them absorbable. Bile also carries cholesterol and fat-soluble waste out via the small intestine.'
        },
        {
          title: 'How Much Bile Does Your Body Need?',
          description: 'Bile is recycled 6-8 times daily (enterohepatic circulation). Only about 200 mL of new bile is needed daily to replace losses, but the constant recycling means you need an efficient liver and gallbladder.'
        }
      ],
      relatedHerbs: ['Milk Thistle', 'Dandelion Root', 'Turmeric', 'Ginger', 'Burdock']
    },

    stomach: {
      id: 'stomach',
      system: 'digestive',
      name: 'Stomach',
      latinName: 'Ventriculus',
      description: 'Your stomach is the initial breakdown chamber for food. It produces hydrochloric acid (HCl) and pepsin (a protein-digesting enzyme) to break down what you eat into smaller pieces called chyme.',
      functions: [
        'Acid production for protein digestion',
        'Mechanical churning of food',
        'Releasing chyme into small intestine',
        'Producing intrinsic factor (B12 absorption)'
      ],
      needs: [
        'Adequate stomach acid (not too high, not too low)',
        'Digestive enzymes',
        'Warm environment (not ice-cold foods)',
        'Reduced stress and proper chewing'
      ],
      processes: [
        {
          title: 'Protein Digestion in the Stomach',
          description: 'When you eat protein (meat, beans, etc.), your stomach releases pepsinogen (inactive). Stomach acid activates it into pepsin, which breaks protein chains. This process takes 30 min to 4 hours depending on what you ate.'
        },
        {
          title: 'Acid Production & pH Balance',
          description: 'Stomach parietal cells produce HCl, dropping pH to 1.5-3.5. Too much acid = heartburn/erosion. Too little = poor digestion, B12 issues. Ginger stimulates BALANCED acid production.'
        }
      ],
      relatedHerbs: ['Ginger', 'Peppermint', 'Fennel', 'Cardamom', 'Turmeric']
    },

    pancreas: {
      id: 'pancreas',
      system: 'digestive',
      name: 'Pancreas',
      latinName: 'Pancreas',
      description: 'A dual-function gland: it produces digestive enzymes for the small intestine AND hormones (insulin, glucagon) for blood sugar regulation.',
      functions: [
        'Producing digestive enzymes (amylase, lipase, protease)',
        'Regulating blood sugar with insulin/glucagon',
        'Balancing pH in small intestine'
      ],
      needs: [
        'Balanced blood sugar (low sugar diet)',
        'Chromium and zinc',
        'Reduced inflammation',
        'Adequate sleep'
      ],
      processes: [
        {
          title: 'Enzyme Production',
          description: 'The pancreas produces lipase (fat digestion), protease (protein), and amylase (carb digestion). These are released into the small intestine when food arrives from the stomach.'
        }
      ],
      relatedHerbs: ['Ginger', 'Turmeric', 'Gymnema', 'Fenugreek', 'Cinnamon']
    },

    small_intestine: {
      id: 'small_intestine',
      system: 'digestive',
      name: 'Small Intestine',
      latinName: 'Intestinum Tenue',
      description: 'The small intestine is where most nutrient absorption happens. Over 20 feet long, it has millions of villi (finger-like projections) that maximize surface area for nutrient uptake.',
      functions: [
        'Primary site of nutrient absorption',
        'Receiving chyme from stomach',
        'Mixing with bile and pancreatic enzymes',
        'Moving food along via peristalsis'
      ],
      needs: [
        'Healthy gut bacteria (microbiome)',
        'Intact intestinal lining',
        'Proper stomach acid (signals pancreas)',
        'Adequate bile and digestive enzymes'
      ],
      processes: [
        {
          title: 'Nutrient Absorption via Villi',
          description: 'The small intestine has 3-4 million villi. Each villus is covered with microvilli, creating an absorption surface of 250-300 sq meters (larger than a tennis court!). Different nutrients absorb in different parts.'
        }
      ],
      relatedHerbs: ['Ginger', 'Slippery Elm', 'Marshmallow', 'Licorice', 'Fennel']
    },

    large_intestine: {
      id: 'large_intestine',
      system: 'digestive',
      name: 'Large Intestine (Colon)',
      latinName: 'Intestinum Crassum',
      description: 'The final stage of digestion. It absorbs remaining water and electrolytes, and is home to your microbiome (trillions of bacteria that influence your health).',
      functions: [
        'Water absorption',
        'Electrolyte balance',
        'Gut bacteria habitat',
        'Vitamin K production (by bacteria)',
        'Stool formation'
      ],
      needs: [
        'Healthy microbiome (diverse bacteria)',
        'Prebiotics (fiber, resistant starch)',
        'Hydration',
        'Regular movement/exercise'
      ],
      processes: [
        {
          title: 'Microbiome & Health Connection',
          description: 'Your colon bacteria produce short-chain fatty acids (butyrate), make B vitamins, and influence your immune system. A diverse, balanced microbiome is linked to better digestion, mood, and immunity.'
        }
      ],
      relatedHerbs: ['Ginger', 'Peppermint', 'Psyllium', 'Aloe Vera', 'Fennel']
    },

    gallbladder: {
      id: 'gallbladder',
      system: 'digestive',
      name: 'Gallbladder',
      latinName: 'Vesica Fellea',
      description: 'Stores and concentrates bile produced by the liver, releasing it to digest fats in the small intestine.',
      functions: [
        'Storing bile',
        'Concentrating bile',
        'Releasing bile on demand',
        'Regulating fat digestion'
      ],
      needs: [
        'Regular meal timing',
        'Healthy fats',
        'Adequate hydration',
        'Reduced inflammation'
      ],
      processes: [
        {
          title: 'Bile Concentration & Release',
          description: 'The gallbladder concentrates bile by reabsorbing water, making it 5-20 times stronger. When fat-rich food enters the small intestine, the gallbladder contracts and releases concentrated bile.'
        }
      ],
      relatedHerbs: ['Ginger', 'Turmeric', 'Milk Thistle', 'Dandelion']
    },

    // RESPIRATORY SYSTEM
    lungs: {
      id: 'lungs',
      system: 'respiratory',
      name: 'Lungs',
      latinName: 'Pulmones',
      description: 'Your lungs exchange oxygen from air for carbon dioxide in your blood. They\'re lined with millions of tiny air sacs called alveoli.',
      functions: [
        'Gas exchange (O2 for CO2)',
        'Breathing regulation',
        'Immune defense',
        'Blood pH regulation'
      ],
      needs: [
        'Clean air',
        'Regular deep breathing',
        'Antioxidant nutrients',
        'Hydration'
      ],
      processes: [
        {
          title: 'Gas Exchange in Alveoli',
          description: 'Oxygen diffuses from air into blood capillaries; CO2 diffuses from blood into air. This happens across 300+ million alveoli, creating a surface area the size of a tennis court.'
        }
      ],
      relatedHerbs: ['Ginger', 'Thyme', 'Elecampane', 'Licorice', 'Coltsfoot']
    },

    trachea: {
      id: 'trachea',
      system: 'respiratory',
      name: 'Trachea (Windpipe)',
      latinName: 'Trachea',
      description: 'The tube that carries air from your throat to your lungs. It\'s lined with mucus and tiny hairs (cilia) that filter air.',
      functions: [
        'Conducting air to lungs',
        'Filtering air',
        'Protecting airways',
        'Facilitating cough reflex'
      ],
      needs: [
        'Mucus production',
        'Healthy cilia',
        'Clear airways',
        'Hydration'
      ],
      processes: [
        {
          title: 'Ciliary Defense',
          description: 'Cilia (hairlike projections) beat 10-20 times per second, pushing mucus and trapped particles up and out. This mucociliary clearance is your lungs\' first defense line.'
        }
      ],
      relatedHerbs: ['Ginger', 'Peppermint', 'Eucalyptus', 'Thyme']
    },

    diaphragm: {
      id: 'diaphragm',
      system: 'respiratory',
      name: 'Diaphragm',
      latinName: 'Diaphragma',
      description: 'The muscular dome below your lungs. It contracts to create negative pressure, pulling air into your lungs.',
      functions: [
        'Primary breathing muscle',
        'Creating breathing rhythm',
        'Supporting core stability',
        'Regulating intra-abdominal pressure'
      ],
      needs: [
        'Muscle tone and flexibility',
        'Deep breathing practice',
        'Relaxation and tension release',
        'Proper posture'
      ],
      processes: [
        {
          title: 'Inspiration & Expiration',
          description: 'Diaphragm contracts → moves down → increases chest volume → negative pressure pulls air in. Diaphragm relaxes → moves up → decreases chest volume → air exits.'
        }
      ],
      relatedHerbs: ['Ginger', 'Valerian', 'Passionflower', 'Chamomile']
    },

    // CIRCULATORY SYSTEM
    heart: {
      id: 'heart',
      system: 'circulatory',
      name: 'Heart',
      latinName: 'Cor',
      description: 'A muscular pump that beats 100,000 times daily, circulating blood throughout your body.',
      functions: [
        'Pumping oxygenated blood',
        'Circulating nutrients',
        'Regulating blood pressure',
        'Maintaining circulation rhythm'
      ],
      needs: [
        'Healthy blood pressure',
        'Adequate oxygen',
        'Electrolytes (potassium, magnesium)',
        'Regular movement and exercise'
      ],
      processes: [
        {
          title: 'Cardiac Cycle',
          description: 'Atria fill with blood → contract → push blood into ventricles → ventricles contract → push blood to lungs and body. This cycle repeats 60-100 times per minute.'
        }
      ],
      relatedHerbs: ['Ginger', 'Hawthorn', 'Garlic', 'Turmeric', 'Cayenne']
    },

    blood_vessel: {
      id: 'blood_vessel',
      system: 'circulatory',
      name: 'Blood Vessels',
      latinName: 'Vasa Sanguinea',
      description: 'Arteries, veins, and capillaries that carry blood throughout your body.',
      functions: [
        'Transporting oxygen and nutrients',
        'Removing waste products',
        'Regulating blood pressure',
        'Distributing body heat'
      ],
      needs: [
        'Healthy endothelium (vessel lining)',
        'Good blood flow and circulation',
        'Reduced inflammation',
        'Healthy blood viscosity'
      ],
      processes: [
        {
          title: 'Arterial & Venous Circulation',
          description: 'Arteries (thick-walled) carry oxygenated blood away from heart at high pressure. Veins (thin-walled) return deoxygenated blood at low pressure. Capillaries (tiny) enable nutrient and waste exchange.'
        }
      ],
      relatedHerbs: ['Ginger', 'Turmeric', 'Garlic', 'Cayenne', 'Ginkgo']
    },

    // NERVOUS SYSTEM
    brain: {
      id: 'brain',
      system: 'nervous',
      name: 'Brain',
      latinName: 'Cerebrum',
      description: 'The command center of your body. It processes information, regulates all body functions, and creates consciousness.',
      functions: [
        'Processing sensory information',
        'Regulating hormones',
        'Managing emotions and cognition',
        'Controlling movement and sensation'
      ],
      needs: [
        'Adequate glucose and oxygen',
        'Omega-3 fatty acids',
        'B vitamins and antioxidants',
        'Healthy blood circulation'
      ],
      processes: [
        {
          title: 'Neurotransmission',
          description: 'Brain cells (neurons) communicate via neurotransmitters (chemical messengers). These influence mood, cognition, movement, and all brain functions.'
        }
      ],
      relatedHerbs: ['Ginger', 'Ginkgo', 'Rosemary', 'Turmeric', 'Gotu Kola']
    },

    // URINARY SYSTEM
    kidneys: {
      id: 'kidneys',
      system: 'urinary',
      name: 'Kidneys',
      latinName: 'Renes',
      description: 'Two bean-shaped organs that filter waste from your blood and produce urine. They also regulate electrolytes and blood pressure.',
      functions: [
        'Filtering waste from blood',
        'Regulating electrolytes (sodium, potassium)',
        'Controlling blood pressure',
        'Producing hormones (EPO, vitamin D activation)'
      ],
      needs: [
        'Adequate hydration (2-3L water daily)',
        'Healthy blood pressure',
        'Reduced sodium intake',
        'Antioxidant nutrients'
      ],
      processes: [
        {
          title: 'Glomerular Filtration',
          description: 'Blood enters kidney nephrons under pressure. Water, waste, and small molecules are filtered into collecting ducts. Large molecules (proteins, cells) remain in blood.'
        }
      ],
      relatedHerbs: ['Ginger', 'Nettle', 'Parsley', 'Juniper', 'Uva Ursi']
    },

    kidney_detail: {
      id: 'kidney_detail',
      system: 'urinary',
      name: 'Kidney (Detail View)',
      latinName: 'Nephron',
      description: 'Close-up view of kidney structure showing the filtration units (nephrons) where blood is filtered.',
      functions: [
        'Detailed filtration of blood',
        'Reabsorption of valuable nutrients',
        'Concentration of urine',
        'Hormone production'
      ],
      needs: [
        'Proper filtration pressure',
        'Healthy capillaries',
        'Adequate blood flow',
        'Balanced pH'
      ],
      processes: [
        {
          title: 'Tubular Reabsorption',
          description: 'As filtered fluid moves through kidney tubules, valuable nutrients (glucose, amino acids) and some water are reabsorbed back into blood. Wastes remain in urine.'
        }
      ],
      relatedHerbs: ['Ginger', 'Nettle', 'Parsley', 'Turmeric']
    },

    bladder: {
      id: 'bladder',
      system: 'urinary',
      name: 'Bladder',
      latinName: 'Vesica Urinaria',
      description: 'A muscular sac that stores urine until it\'s ready to be eliminated.',
      functions: [
        'Storing urine',
        'Muscle contraction for elimination',
        'Sensing fullness',
        'Regulating urinary frequency'
      ],
      needs: [
        'Healthy smooth muscle tone',
        'Adequate hydration',
        'Reduced irritants (caffeine, alcohol)',
        'Regular urination'
      ],
      processes: [
        {
          title: 'Urinary Storage & Elimination',
          description: 'Bladder expands to store urine (can hold 400-600 mL). When full, sensory nerves signal the brain. Sphincter muscles relax, bladder contracts, urine is eliminated.'
        }
      ],
      relatedHerbs: ['Ginger', 'Cranberry', 'Uva Ursi', 'D-Mannose', 'Nettle']
    }
  },

  // Herb-to-organ support mapping
  herbSupport: {
    'ginger': {
      primaryOrgans: ['liver', 'stomach', 'pancreas', 'small_intestine', 'large_intestine', 'heart', 'blood_vessel', 'brain'],
      secondaryOrgans: ['lungs', 'trachea', 'kidneys', 'bladder'],
      description: 'Warming, stimulating digestive tonic that improves circulation and reduces inflammation across multiple systems.'
    },
    'turmeric': {
      primaryOrgans: ['liver', 'pancreas', 'gallbladder', 'blood_vessel', 'brain'],
      secondaryOrgans: ['stomach', 'small_intestine', 'lungs', 'heart'],
      description: 'Powerful anti-inflammatory with strong detoxification support, especially for liver and circulation.'
    },
    'milk thistle': {
      primaryOrgans: ['liver', 'gallbladder'],
      secondaryOrgans: ['stomach', 'small_intestine', 'kidneys'],
      description: 'Silymarin-rich herb specifically supports hepatic detoxification and regeneration.'
    },
    'peppermint': {
      primaryOrgans: ['stomach', 'small_intestine', 'large_intestine'],
      secondaryOrgans: ['liver', 'pancreas', 'brain'],
      description: 'Cooling digestive carminative that eases tension and improves motility.'
    },
    'thyme': {
      primaryOrgans: ['lungs', 'trachea'],
      secondaryOrgans: ['brain', 'immune'],
      description: 'Antimicrobial respiratory support with expectorant properties.'
    },
    'hawthorn': {
      primaryOrgans: ['heart', 'blood_vessel'],
      secondaryOrgans: ['brain'],
      description: 'Circulatory tonic that strengthens heart function and supports healthy blood pressure.'
    },
    'ashwagandha': {
      primaryOrgans: ['brain', 'heart', 'kidneys'],
      secondaryOrgans: ['blood_vessel', 'lungs'],
      description: 'Adaptogenic herb that supports stress resilience, cognitive function, and overall nervous system health.'
    },
    'chamomile': {
      primaryOrgans: ['stomach', 'small_intestine', 'brain'],
      secondaryOrgans: ['liver', 'heart'],
      description: 'Calming digestive and nervine herb that promotes relaxation and gentle digestive support.'
    },
    'echinacea': {
      primaryOrgans: ['lungs', 'trachea'],
      secondaryOrgans: ['blood_vessel', 'brain'],
      description: 'Immune-supporting herb that strengthens respiratory and circulatory defenses.'
    },
    'ginseng': {
      primaryOrgans: ['brain', 'heart', 'kidneys', 'blood_vessel'],
      secondaryOrgans: ['lungs', 'stomach', 'liver'],
      description: 'Potent adaptogenic tonic that supports energy, endurance, and overall vitality.'
    },
    'lavender': {
      primaryOrgans: ['brain', 'heart'],
      secondaryOrgans: ['lungs', 'stomach'],
      description: 'Aromatic calming herb that supports relaxation, sleep quality, and emotional balance.'
    },
    'elderberry': {
      primaryOrgans: ['lungs', 'trachea'],
      secondaryOrgans: ['blood_vessel', 'heart', 'brain'],
      description: 'Antiviral-rich berry that supports immune response and respiratory health.'
    },
    'garlic': {
      primaryOrgans: ['heart', 'blood_vessel', 'liver'],
      secondaryOrgans: ['lungs', 'stomach', 'kidneys'],
      description: 'Pungent cardiovascular and immune tonic with antimicrobial and anti-inflammatory properties.'
    },
    'ginkgo': {
      primaryOrgans: ['brain', 'blood_vessel'],
      secondaryOrgans: ['heart', 'lungs', 'kidneys'],
      description: 'Circulation-enhancing herb that supports cognitive clarity and peripheral blood flow.'
    },
    'nettle': {
      primaryOrgans: ['kidneys', 'liver', 'lungs'],
      secondaryOrgans: ['blood_vessel', 'stomach', 'heart'],
      description: 'Mineral-rich nutritive herb that supports kidney function and overall nourishment.'
    },
    'rosemary': {
      primaryOrgans: ['brain', 'heart', 'liver'],
      secondaryOrgans: ['lungs', 'blood_vessel', 'stomach'],
      description: 'Aromatic circulatory and cognitive tonic with antioxidant and digestive benefits.'
    }
  }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ANATOMY_DATA;
}
