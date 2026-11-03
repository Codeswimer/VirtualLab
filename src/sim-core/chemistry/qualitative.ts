/**
 * Qualitative analysis (CHM-04, CHM-05, CHM-06).
 *
 * ADR-006: rules live as data, not `if` statements, so curriculum reviewers can
 * audit and extend them. Every observation is a string a student could write,
 * plus machine-checkable keywords.
 */

export type QualitativeFamilyId = 'cations' | 'anions' | 'gases' | 'food';

export interface Reagent {
  id: string;
  label: string;
  formula?: string;
  /** How the reagent is applied. */
  mode: 'add' | 'heat' | 'flame' | 'paper' | 'splint';
  hint?: string;
}

export interface SpeciesTest {
  reagentId: string;
  /** The observation a student would record. */
  observation: string;
  /** Key phrases that must appear for the observation to earn credit. */
  keywords: string[];
  /** Swatch used by the test-tube animation. */
  colour?: string;
  precipitate?: boolean;
  gas?: boolean;
  inference: string;
}

export interface Species {
  id: string;
  label: string;
  name: string;
  tests: SpeciesTest[];
}

export interface QualitativeFamily {
  id: QualitativeFamilyId;
  title: string;
  subtitle: string;
  reagents: Reagent[];
  species: Species[];
  /** Species that can be the unknown in an attempt. */
  unknownPool: string[];
  identificationPrompt: string;
}

const sodiumHydroxide: Reagent = {
  id: 'naoh',
  label: 'NaOH solution',
  formula: 'NaOH(aq)',
  mode: 'add',
  hint: 'Add a little, then in excess.',
};
const ammonia: Reagent = {
  id: 'nh3',
  label: 'Ammonia solution',
  formula: 'NH₃(aq)',
  mode: 'add',
  hint: 'Add a little, then in excess.',
};

export const CATIONS: QualitativeFamily = {
  id: 'cations',
  title: 'Identification of cations',
  subtitle: 'Use NaOH and NH₃ solutions, then a flame test where useful.',
  reagents: [sodiumHydroxide, ammonia, { id: 'flame', label: 'Flame test', mode: 'flame' }],
  unknownPool: ['cu2', 'fe2', 'fe3', 'zn2', 'al3', 'pb2', 'ca2', 'nh4'],
  identificationPrompt: 'Which cation is present in the unknown solution?',
  species: [
    {
      id: 'cu2',
      label: 'Cu²⁺',
      name: 'Copper(II) ion',
      tests: [
        {
          reagentId: 'naoh',
          observation: 'Pale blue precipitate, insoluble in excess NaOH',
          keywords: ['blue', 'precipitate', 'insoluble'],
          colour: 'rgba(96,165,250,0.75)',
          precipitate: true,
          inference: 'Cu²⁺ likely present',
        },
        {
          reagentId: 'nh3',
          observation: 'Pale blue precipitate, soluble in excess giving a deep blue solution',
          keywords: ['blue', 'soluble', 'excess'],
          colour: 'rgba(37,99,235,0.85)',
          precipitate: true,
          inference: 'Cu²⁺ confirmed',
        },
      ],
    },
    {
      id: 'fe2',
      label: 'Fe²⁺',
      name: 'Iron(II) ion',
      tests: [
        {
          reagentId: 'naoh',
          observation: 'Dirty green precipitate, insoluble in excess NaOH',
          keywords: ['green', 'precipitate', 'insoluble'],
          colour: 'rgba(74,124,89,0.85)',
          precipitate: true,
          inference: 'Fe²⁺ likely present',
        },
        {
          reagentId: 'nh3',
          observation: 'Dirty green precipitate, insoluble in excess ammonia',
          keywords: ['green', 'precipitate', 'insoluble'],
          colour: 'rgba(74,124,89,0.85)',
          precipitate: true,
          inference: 'Fe²⁺ confirmed',
        },
      ],
    },
    {
      id: 'fe3',
      label: 'Fe³⁺',
      name: 'Iron(III) ion',
      tests: [
        {
          reagentId: 'naoh',
          observation: 'Reddish-brown precipitate, insoluble in excess NaOH',
          keywords: ['reddish-brown', 'brown', 'precipitate'],
          colour: 'rgba(154,52,18,0.9)',
          precipitate: true,
          inference: 'Fe³⁺ likely present',
        },
        {
          reagentId: 'nh3',
          observation: 'Reddish-brown precipitate, insoluble in excess ammonia',
          keywords: ['reddish-brown', 'brown', 'precipitate'],
          colour: 'rgba(154,52,18,0.9)',
          precipitate: true,
          inference: 'Fe³⁺ confirmed',
        },
      ],
    },
    {
      id: 'zn2',
      label: 'Zn²⁺',
      name: 'Zinc ion',
      tests: [
        {
          reagentId: 'naoh',
          observation: 'White precipitate, soluble in excess NaOH',
          keywords: ['white', 'precipitate', 'soluble'],
          colour: 'rgba(248,250,252,0.95)',
          precipitate: true,
          inference: 'Zn²⁺ or Al³⁺ or Pb²⁺',
        },
        {
          reagentId: 'nh3',
          observation: 'White precipitate, soluble in excess ammonia',
          keywords: ['white', 'precipitate', 'soluble'],
          colour: 'rgba(248,250,252,0.95)',
          precipitate: true,
          inference: 'Zn²⁺ confirmed',
        },
      ],
    },
    {
      id: 'al3',
      label: 'Al³⁺',
      name: 'Aluminium ion',
      tests: [
        {
          reagentId: 'naoh',
          observation: 'White gelatinous precipitate, soluble in excess NaOH',
          keywords: ['white', 'gelatinous', 'soluble'],
          colour: 'rgba(248,250,252,0.95)',
          precipitate: true,
          inference: 'Al³⁺ or Zn²⁺ or Pb²⁺',
        },
        {
          reagentId: 'nh3',
          observation: 'White gelatinous precipitate, insoluble in excess ammonia',
          keywords: ['white', 'gelatinous', 'insoluble'],
          colour: 'rgba(248,250,252,0.95)',
          precipitate: true,
          inference: 'Al³⁺ confirmed',
        },
      ],
    },
    {
      id: 'pb2',
      label: 'Pb²⁺',
      name: 'Lead(II) ion',
      tests: [
        {
          reagentId: 'naoh',
          observation: 'White precipitate, soluble in excess NaOH',
          keywords: ['white', 'precipitate', 'soluble'],
          colour: 'rgba(248,250,252,0.95)',
          precipitate: true,
          inference: 'Pb²⁺, Zn²⁺ or Al³⁺',
        },
        {
          reagentId: 'nh3',
          observation: 'White precipitate, insoluble in excess ammonia',
          keywords: ['white', 'precipitate', 'insoluble'],
          colour: 'rgba(248,250,252,0.95)',
          precipitate: true,
          inference: 'Pb²⁺ possible; confirm with KI',
        },
        {
          reagentId: 'flame',
          observation: 'No characteristic flame colour (or faint blue)',
          keywords: ['blue', 'no colour'],
          inference: 'Not conclusive',
        },
      ],
    },
    {
      id: 'ca2',
      label: 'Ca²⁺',
      name: 'Calcium ion',
      tests: [
        {
          reagentId: 'naoh',
          observation: 'White precipitate, insoluble in excess NaOH',
          keywords: ['white', 'precipitate', 'insoluble'],
          colour: 'rgba(248,250,252,0.95)',
          precipitate: true,
          inference: 'Ca²⁺ likely present',
        },
        {
          reagentId: 'flame',
          observation: 'Brick-red flame',
          keywords: ['brick-red', 'red'],
          colour: 'rgba(220,80,60,0.9)',
          inference: 'Ca²⁺ confirmed',
        },
      ],
    },
    {
      id: 'nh4',
      label: 'NH₄⁺',
      name: 'Ammonium ion',
      tests: [
        {
          reagentId: 'naoh',
          observation: 'No precipitate; pungent gas evolved on warming, turns red litmus blue',
          keywords: ['pungent', 'gas', 'litmus', 'blue'],
          gas: true,
          inference: 'NH₄⁺ present',
        },
        {
          reagentId: 'flame',
          observation: 'No characteristic flame colour',
          keywords: ['no colour', 'no characteristic'],
          inference: 'Not conclusive',
        },
      ],
    },
  ],
};

export const ANIONS: QualitativeFamily = {
  id: 'anions',
  title: 'Identification of anions',
  subtitle: 'Use dilute acid, barium chloride and silver nitrate as appropriate.',
  reagents: [
    { id: 'diluteHcl', label: 'Dilute HCl', formula: 'HCl(aq)', mode: 'add' },
    { id: 'bacl2', label: 'Barium chloride', formula: 'BaCl₂(aq)', mode: 'add' },
    { id: 'agno3', label: 'Silver nitrate', formula: 'AgNO₃(aq)', mode: 'add' },
    { id: 'heat', label: 'Heat gently', mode: 'heat' },
  ],
  unknownPool: ['co3', 'so4', 'cl', 'i', 'no3', 'so3'],
  identificationPrompt: 'Which anion is present in the unknown salt?',
  species: [
    {
      id: 'co3',
      label: 'CO₃²⁻',
      name: 'Carbonate ion',
      tests: [
        {
          reagentId: 'diluteHcl',
          observation: 'Effervescence; gas turns limewater milky',
          keywords: ['effervescence', 'limewater', 'milky', 'colourless gas'],
          gas: true,
          inference: 'CO₃²⁻ or HCO₃⁻',
        },
        {
          reagentId: 'bacl2',
          observation: 'White precipitate, soluble in dilute HCl with effervescence',
          keywords: ['white', 'precipitate', 'soluble', 'effervescence'],
          colour: 'rgba(248,250,252,0.95)',
          precipitate: true,
          inference: 'CO₃²⁻ confirmed',
        },
      ],
    },
    {
      id: 'so4',
      label: 'SO₄²⁻',
      name: 'Sulphate ion',
      tests: [
        {
          reagentId: 'bacl2',
          observation: 'White precipitate, insoluble in dilute HCl',
          keywords: ['white', 'precipitate', 'insoluble'],
          colour: 'rgba(248,250,252,0.95)',
          precipitate: true,
          inference: 'SO₄²⁻ present',
        },
        {
          reagentId: 'diluteHcl',
          observation: 'No visible reaction',
          keywords: ['no visible', 'no reaction'],
          inference: 'Not a carbonate or sulphite',
        },
      ],
    },
    {
      id: 'cl',
      label: 'Cl⁻',
      name: 'Chloride ion',
      tests: [
        {
          reagentId: 'agno3',
          observation: 'White precipitate, soluble in excess ammonia',
          keywords: ['white', 'precipitate', 'soluble', 'ammonia'],
          colour: 'rgba(248,250,252,0.95)',
          precipitate: true,
          inference: 'Cl⁻ present',
        },
        {
          reagentId: 'bacl2',
          observation: 'No visible reaction',
          keywords: ['no visible', 'no reaction'],
          inference: 'Sulphate absent',
        },
      ],
    },
    {
      id: 'i',
      label: 'I⁻',
      name: 'Iodide ion',
      tests: [
        {
          reagentId: 'agno3',
          observation: 'Yellow precipitate, insoluble in excess ammonia',
          keywords: ['yellow', 'precipitate', 'insoluble'],
          colour: 'rgba(250,204,21,0.85)',
          precipitate: true,
          inference: 'I⁻ present',
        },
      ],
    },
    {
      id: 'no3',
      label: 'NO₃⁻',
      name: 'Nitrate ion',
      tests: [
        {
          reagentId: 'heat',
          observation: 'Brown fumes evolved; brown ring test is positive',
          keywords: ['brown', 'fumes', 'ring'],
          gas: true,
          inference: 'NO₃⁻ present',
        },
        {
          reagentId: 'bacl2',
          observation: 'No visible reaction',
          keywords: ['no visible', 'no reaction'],
          inference: 'Sulphate absent',
        },
      ],
    },
    {
      id: 'so3',
      label: 'SO₃²⁻',
      name: 'Sulphite ion',
      tests: [
        {
          reagentId: 'diluteHcl',
          observation: 'Colourless gas with a choking smell; decolourises acidified KMnO₄',
          keywords: ['choking', 'colourless', 'decolourises', 'kmno4'],
          gas: true,
          inference: 'SO₃²⁻ present',
        },
        {
          reagentId: 'bacl2',
          observation: 'White precipitate, soluble in dilute HCl with a choking gas',
          keywords: ['white', 'precipitate', 'soluble', 'choking'],
          colour: 'rgba(248,250,252,0.95)',
          precipitate: true,
          inference: 'SO₃²⁻ confirmed',
        },
      ],
    },
  ],
};

export const GASES: QualitativeFamily = {
  id: 'gases',
  title: 'Identification of gases',
  subtitle: 'Collect the gas and test it with the reagents below.',
  reagents: [
    { id: 'limewater', label: 'Limewater', mode: 'add' },
    { id: 'splint', label: 'Lighted / glowing splint', mode: 'splint' },
    { id: 'litmus', label: 'Moist litmus paper', mode: 'paper' },
    { id: 'kmno4', label: 'Acidified KMnO₄', mode: 'add' },
    { id: 'hclGlassRod', label: 'Glass rod + conc. HCl', mode: 'add' },
  ],
  unknownPool: ['co2', 'o2', 'h2', 'nh3', 'cl2', 'so2', 'hcl'],
  identificationPrompt: 'Which gas is given off?',
  species: [
    {
      id: 'co2',
      label: 'CO₂',
      name: 'Carbon dioxide',
      tests: [
        {
          reagentId: 'limewater',
          observation: 'Turns limewater milky; precipitate dissolves in excess gas',
          keywords: ['limewater', 'milky', 'white precipitate'],
          inference: 'CO₂ present',
        },
        {
          reagentId: 'splint',
          observation: 'Extinguishes a lighted splint',
          keywords: ['extinguishes', 'splint'],
          inference: 'Not oxygen or hydrogen',
        },
        {
          reagentId: 'litmus',
          observation: 'Turns moist blue litmus paper red',
          keywords: ['blue', 'red', 'acidic'],
          inference: 'Acidic gas',
        },
      ],
    },
    {
      id: 'o2',
      label: 'O₂',
      name: 'Oxygen',
      tests: [
        {
          reagentId: 'splint',
          observation: 'Relights a glowing splint',
          keywords: ['relights', 'glowing'],
          inference: 'O₂ present',
        },
        {
          reagentId: 'litmus',
          observation: 'No change to litmus paper',
          keywords: ['no change', 'neutral'],
          inference: 'Neutral gas',
        },
      ],
    },
    {
      id: 'h2',
      label: 'H₂',
      name: 'Hydrogen',
      tests: [
        {
          reagentId: 'splint',
          observation: 'Burns with a pop when a lighted splint is applied',
          keywords: ['pop', 'burns'],
          inference: 'H₂ present',
        },
        {
          reagentId: 'litmus',
          observation: 'No change to litmus paper',
          keywords: ['no change', 'neutral'],
          inference: 'Neutral gas',
        },
      ],
    },
    {
      id: 'nh3',
      label: 'NH₃',
      name: 'Ammonia',
      tests: [
        {
          reagentId: 'litmus',
          observation: 'Pungent gas; turns moist red litmus blue',
          keywords: ['pungent', 'red', 'blue'],
          inference: 'NH₃ present',
        },
        {
          reagentId: 'hclGlassRod',
          observation: 'Dense white fumes with a glass rod dipped in conc. HCl',
          keywords: ['white fumes', 'hcl'],
          inference: 'NH₃ confirmed',
        },
      ],
    },
    {
      id: 'cl2',
      label: 'Cl₂',
      name: 'Chlorine',
      tests: [
        {
          reagentId: 'litmus',
          observation: 'Greenish-yellow gas; bleaches moist litmus paper',
          keywords: ['greenish', 'bleaches', 'litmus'],
          inference: 'Cl₂ present',
        },
      ],
    },
    {
      id: 'so2',
      label: 'SO₂',
      name: 'Sulphur(IV) oxide',
      tests: [
        {
          reagentId: 'kmno4',
          observation: 'Decolourises acidified potassium manganate(VII)',
          keywords: ['decolourises', 'kmno4'],
          inference: 'SO₂ present',
        },
        {
          reagentId: 'litmus',
          observation: 'Turns moist blue litmus red; choking smell',
          keywords: ['red', 'choking', 'acidic'],
          inference: 'Acidic gas',
        },
      ],
    },
    {
      id: 'hcl',
      label: 'HCl',
      name: 'Hydrogen chloride',
      tests: [
        {
          reagentId: 'litmus',
          observation: 'Dense white fumes in moist air; turns blue litmus red',
          keywords: ['white fumes', 'red', 'acidic'],
          inference: 'HCl gas',
        },
        {
          reagentId: 'limewater',
          observation: 'No change to limewater',
          keywords: ['no change'],
          inference: 'Not CO₂',
        },
      ],
    },
  ],
};

export const FOOD: QualitativeFamily = {
  id: 'food',
  title: 'Food tests and functional groups',
  subtitle: 'Test the sample with each reagent and record what you see.',
  reagents: [
    { id: 'benedicts', label: "Benedict's solution", mode: 'heat' },
    { id: 'iodine', label: 'Iodine solution', mode: 'add' },
    { id: 'biuret', label: 'Biuret reagent', mode: 'add' },
    { id: 'sudan', label: 'Sudan III', mode: 'add' },
    { id: 'bromine', label: 'Bromine water', mode: 'add' },
    { id: 'dcpip', label: 'DCPIP solution', mode: 'add' },
  ],
  unknownPool: ['glucose', 'starch', 'protein', 'fat', 'vitaminC', 'alkene'],
  identificationPrompt: 'Which food constituent or functional group is present?',
  species: [
    {
      id: 'glucose',
      label: 'Reducing sugar',
      name: 'Reducing sugar (e.g. glucose)',
      tests: [
        {
          reagentId: 'benedicts',
          observation: 'Brick-red precipitate on heating',
          keywords: ['brick-red', 'precipitate', 'heat'],
          colour: 'rgba(185,28,28,0.9)',
          precipitate: true,
          inference: 'Reducing sugar present',
        },
      ],
    },
    {
      id: 'starch',
      label: 'Starch',
      name: 'Starch',
      tests: [
        {
          reagentId: 'iodine',
          observation: 'Blue-black colouration',
          keywords: ['blue-black', 'colouration'],
          colour: 'rgba(30,41,59,0.95)',
          inference: 'Starch present',
        },
      ],
    },
    {
      id: 'protein',
      label: 'Protein',
      name: 'Protein',
      tests: [
        {
          reagentId: 'biuret',
          observation: 'Purple / violet colouration',
          keywords: ['purple', 'violet'],
          colour: 'rgba(126,34,206,0.85)',
          inference: 'Protein present',
        },
      ],
    },
    {
      id: 'fat',
      label: 'Fat / oil',
      name: 'Fat or oil',
      tests: [
        {
          reagentId: 'sudan',
          observation: 'Red-stained oil droplets / red layer',
          keywords: ['red', 'layer', 'droplets'],
          colour: 'rgba(220,38,38,0.75)',
          inference: 'Fat present',
        },
      ],
    },
    {
      id: 'vitaminC',
      label: 'Vitamin C',
      name: 'Vitamin C (ascorbic acid)',
      tests: [
        {
          reagentId: 'dcpip',
          observation: 'Blue DCPIP is decolourised',
          keywords: ['decolourised', 'blue', 'colourless'],
          inference: 'Vitamin C present',
        },
      ],
    },
    {
      id: 'alkene',
      label: 'Alkene',
      name: 'Alkene (C=C)',
      tests: [
        {
          reagentId: 'bromine',
          observation: 'Orange-brown bromine water is decolourised',
          keywords: ['decolourised', 'orange', 'bromine'],
          inference: 'Unsaturation (C=C) present',
        },
      ],
    },
  ],
};

export const QUALITATIVE_FAMILIES: Record<QualitativeFamilyId, QualitativeFamily> = {
  cations: CATIONS,
  anions: ANIONS,
  gases: GASES,
  food: FOOD,
};

export function family(id: QualitativeFamilyId): QualitativeFamily {
  return QUALITATIVE_FAMILIES[id];
}

export function speciesIn(id: QualitativeFamilyId, speciesId: string): Species | undefined {
  return family(id).species.find((s) => s.id === speciesId);
}

export function testObservation(
  familyId: QualitativeFamilyId,
  speciesId: string,
  reagentId: string,
): SpeciesTest | undefined {
  return speciesIn(familyId, speciesId)?.tests.find((t) => t.reagentId === reagentId);
}

/** Cheap correctness check for a written observation: all keywords present. */
export function observationMatches(written: string, expected: SpeciesTest): boolean {
  const text = written.toLowerCase();
  return expected.keywords.every((keyword) => text.includes(keyword.toLowerCase()));
}

/** How many expected keywords appear — used for partial credit / hints. */
export function observationScore(written: string, expected: SpeciesTest): number {
  const text = written.toLowerCase();
  const hits = expected.keywords.filter((keyword) => text.includes(keyword.toLowerCase())).length;
  return expected.keywords.length === 0 ? 0 : hits / expected.keywords.length;
}

/**
 * Lightweight schema validation for the rule tables (ADR-006). Called by unit
 * tests so a malformed table cannot ship.
 */
export function validateQualitativeData(): string[] {
  const problems: string[] = [];
  for (const fam of Object.values(QUALITATIVE_FAMILIES)) {
    const reagentIds = new Set(fam.reagents.map((r) => r.id));
    for (const species of fam.species) {
      for (const test of species.tests) {
        if (!reagentIds.has(test.reagentId)) {
          problems.push(`${fam.id}/${species.id}: unknown reagent ${test.reagentId}`);
        }
        if (test.keywords.length === 0) {
          problems.push(`${fam.id}/${species.id}/${test.reagentId}: no keywords`);
        }
      }
    }
    for (const unknown of fam.unknownPool) {
      if (!fam.species.some((s) => s.id === unknown)) {
        problems.push(`${fam.id}: unknown pool species ${unknown} missing`);
      }
    }
  }
  return problems;
}
