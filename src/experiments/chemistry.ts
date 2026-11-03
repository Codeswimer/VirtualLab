import { createRng } from '@sim/rng';
import {
  expectedTitreCm3,
  indicatorSpec,
  massConcentration,
  TITRATION_SYSTEMS,
  type TitrationSystem,
} from '@sim/chemistry/titration';
import { parseNumberAnswer } from '@sim/math';
import {
  scoreCalculations,
  scoreConclusion,
  scoreProcedure,
  scoreTitres,
  summarise,
} from '@sim/scoring/engine';
import {
  CATIONS,
  ANIONS,
  GASES,
  FOOD,
  family,
  type QualitativeFamilyId,
} from '@sim/chemistry/qualitative';
import type { ExperimentDefinition } from './types';
import { scoreQualitative } from './qualitative-scoring';

// ---------------------------------------------------------------------------
// Shared titration helpers
// ---------------------------------------------------------------------------

function titreValues(rows: Record<string, string>[]): (number | null)[] {
  return rows.map((row) => parseNumberAnswer(row.titre ?? ''));
}


// ---------------------------------------------------------------------------
// CHM-01 — Acid–base titration
// ---------------------------------------------------------------------------

export interface TitrationLabScenario {
  system: TitrationSystem;
  systemLabel: string;
  acidMolarity: number;
  analyteMolarity: number;
  analyteVolumeCm3: number;
  indicatorId: 'methylOrange' | 'phenolphthalein';
  trueTitreCm3: number;
  molarMass: number;
  analyteName: string;
}

export const titrationExperiment: ExperimentDefinition<TitrationLabScenario> = {
  score: (attempt, scenario) => {
    const system = TITRATION_SYSTEMS[scenario.system];
    const titres = titreValues(attempt.rows);
    const titreCriteria = scoreTitres(titres, scenario.trueTitreCm3);
    const calcCriteria = scoreCalculations(
      attempt.answers,
      titrationExperiment.calculations.map((spec) => ({
        id: spec.id,
        label: spec.label,
        unit: spec.unit,
        max: spec.max,
        tolerancePercent: spec.tolerancePercent,
        expected: spec.expected(scenario),
      })),
    );
    const procedureCriteria = scoreProcedure(attempt, [
      {
        id: 'indicator',
        label: 'Correct indicator selected',
        max: 2,
        flag: 'indicator-correct',
        feedbackPass: `${indicatorSpec(scenario.indicatorId).name} is the right indicator for ${system.label}.`,
        feedbackFail: `Use ${indicatorSpec(scenario.indicatorId).name} for this titration.`,
      },
      {
        id: 'dropwise',
        label: 'Added the last drops dropwise',
        max: 1,
        flag: 'dropwise',
        feedbackPass: 'The end-point was approached dropwise, so the titre is not overshot.',
        feedbackFail: 'Slow to a drop per second near the end-point and stop at the first permanent colour change.',
      },
      {
        id: 'rinse',
        label: 'Rinsed the burette with the acid',
        max: 1,
        flag: 'rinsed-burette',
        feedbackPass: 'Rinsing with the titrant prevents dilution of the acid.',
        feedbackFail: 'Rinse the burette with a little of the acid before filling it.',
      },
    ]);
    const conclusion = scoreConclusion(
      attempt.notes,
      ['concentration', 'molarity', 'mol', scenario.analyteName.toLowerCase()],
      2,
      `the concentration of ${scenario.analyteName} is ${scenario.analyteMolarity.toFixed(3)} mol/dm³`,
    );
    return summarise([...titreCriteria, ...calcCriteria, ...procedureCriteria, conclusion]);
  },
  meta: {
    code: 'CHM-01',
    slug: 'chm-01-acid-base-titration',
    title: 'Acid–base titration',
    subject: 'CHEMISTRY',
    priority: 'P0',
    examBodies: ['WAEC', 'NECO', 'JAMB'],
    summary:
      'Titrate a standard acid against an unknown base, choose the right indicator, obtain concordant titres and calculate the concentration.',
    durationMin: 22,
    apparatus: ['Burette', 'Pipette (25 cm³)', 'Conical flask', 'White tile', 'Indicator', 'Retort stand'],
    skills: ['Burette reading', 'End-point judgement', 'Concordant titres', 'Mole calculations'],
    objective: 'Determine the concentration of a base by titration and perform the full mole calculation.',
    curriculum: 'SS3 volumetric analysis: acid–base titration and concentration calculations.',
  },
  scene: 'titration',
  theory: [
    {
      heading: 'The titration reaction',
      body: 'The acid neutralises the base in a fixed mole ratio. The balanced equation gives the ratio used in the calculation.',
      formula: 'acid + base → salt + water',
    },
    {
      heading: 'Choosing the indicator',
      body: 'Phenolphthalein changes colour in the alkaline range; methyl orange changes in the acidic range. For Na₂CO₃ the visible end-point with methyl orange is at about pH 3.9, not pH 7.',
      formula: 'n(acid) = c × V/1000',
    },
    {
      heading: 'The calculation route',
      body: 'Average the concordant titres, find the moles of acid used, apply the mole ratio and divide by the pipetted volume of base.',
      formula: 'c_base = c_acid × V_acid / (ratio × V_base)',
    },
  ],
  procedure: [
    { title: 'Rinse and fill', detail: 'Rinse the burette with the acid, then fill it and remove air bubbles. Record the initial reading.' },
    { title: 'Pipette the base', detail: 'Pipette 25.0 cm³ of the base into a conical flask and add two drops of indicator.' },
    { title: 'Titrate', detail: 'Run the acid in with swirling. Slow to dropwise near the end-point and stop at the first permanent colour change.' },
    { title: 'Record and repeat', detail: 'Record the final burette reading and compute the titre. Repeat until you have at least three concordant titres.' },
    { title: 'Calculate', detail: 'Average the concordant titres and calculate the concentration of the base, then its mass concentration.' },
  ],
  table: {
    columns: [
      { id: 'initial', label: 'Initial reading', unit: 'cm³', decimals: 2, kind: 'number', burette: true },
      { id: 'final', label: 'Final reading', unit: 'cm³', decimals: 2, kind: 'number', burette: true },
      { id: 'titre', label: 'Titre', unit: 'cm³', decimals: 2, kind: 'number', burette: true },
    ],
    minRows: 2,
    addRows: true,
    keyColumn: 'titre',
    instructions: 'Record initial and final burette readings; the scene computes the titre when you press “Record titre”.',
  },
  calculations: [
    {
      id: 'meanTitre',
      label: 'Average of your concordant titres',
      unit: 'cm³',
      max: 2,
      tolerancePercent: 1.5,
      expected: (s) => s.trueTitreCm3,
      help: 'Use only the titres that agree within 0.20 cm³.',
      formula: 'mean = Σtitre / n',
    },
    {
      id: 'molesAcid',
      label: 'Moles of acid in the average titre',
      unit: 'mol',
      max: 2,
      tolerancePercent: 3,
      expected: (s) => (s.acidMolarity * s.trueTitreCm3) / 1000,
      help: 'n = cV/1000 with V in cm³.',
      formula: 'n(acid) = c_acid × V/1000',
    },
    {
      id: 'baseConc',
      label: 'Concentration of the base',
      unit: 'mol/dm³',
      max: 2,
      tolerancePercent: 3,
      expected: (s) => s.analyteMolarity,
      help: 'Use the mole ratio from the balanced equation and divide by 25.0 cm³ (0.025 dm³).',
      formula: 'c_base = n(acid) / (ratio × 0.025)',
    },
    {
      id: 'massConc',
      label: 'Mass concentration of the base',
      unit: 'g/dm³',
      max: 2,
      tolerancePercent: 3,
      expected: (s) => massConcentration(s.analyteMolarity, s.molarMass),
      help: 'Multiply the molarity by the molar mass of the base.',
      formula: 'mass conc = c × M',
    },
  ],
  coachTip: 'Swirl continuously and keep the tip of the burette inside the flask. Read the bottom of the meniscus.',
  generate: (seed) => {
    const rng = createRng(seed);
    const useCarbonate = rng.next() < 0.5;
    const system: TitrationSystem = useCarbonate ? 'hcl-na2co3' : 'hcl-naoh';
    const systemSpec = TITRATION_SYSTEMS[system];
    const acidMolarity = Math.round(rng.float(0.08, 0.12) * 1000) / 1000;
    const targetTitre = rng.float(16, 28);
    const analyteMolarity =
      Math.round(((acidMolarity * targetTitre) / (systemSpec.acidPerBase * 25)) * 1000) / 1000;
    const trueTitreCm3 = expectedTitreCm3(systemSpec, acidMolarity, analyteMolarity, 25);
    return {
      system,
      systemLabel: systemSpec.label,
      acidMolarity,
      analyteMolarity,
      analyteVolumeCm3: 25,
      indicatorId: useCarbonate ? 'methylOrange' : 'phenolphthalein',
      trueTitreCm3,
      molarMass: useCarbonate ? 106 : 40,
      analyteName: useCarbonate ? 'sodium carbonate' : 'sodium hydroxide',
    };
  },
};

// ---------------------------------------------------------------------------
// CHM-02 — Hydrated salt
// ---------------------------------------------------------------------------

export interface HydrateScenario {
  waterOfCrystallisation: number;
  molarMassHydrate: number;
  sampleMassG: number;
  acidMolarity: number;
  analyteMolarity: number;
  analyteVolumeCm3: number;
  trueTitreCm3: number;
  flaskVolumeCm3: number;
}

export const hydrateExperiment: ExperimentDefinition<HydrateScenario> = {
  score: (attempt, scenario) => {
    const titres = titreValues(attempt.rows);
    const titreCriteria = scoreTitres(titres, scenario.trueTitreCm3);
    const calcCriteria = scoreCalculations(
      attempt.answers,
      hydrateExperiment.calculations.map((spec) => ({
        id: spec.id,
        label: spec.label,
        unit: spec.unit,
        max: spec.max,
        tolerancePercent: spec.tolerancePercent,
        expected: spec.expected(scenario),
      })),
    );
    const procedure = scoreProcedure(attempt, [
      {
        id: 'indicator',
        label: 'Methyl orange used for the carbonate',
        max: 2,
        flag: 'indicator-correct',
        feedbackPass: 'Methyl orange marks the carbonic-acid end-point for Na₂CO₃.',
        feedbackFail: 'Use methyl orange: phenolphthalein only marks the first stage (NaHCO₃).',
      },
      {
        id: 'dropwise',
        label: 'End-point approached dropwise',
        max: 1,
        flag: 'dropwise',
        feedbackPass: 'The end-point was not overshot.',
        feedbackFail: 'Slow to dropwise near the end-point and watch for the first orange tint.',
      },
      {
        id: 'rinse',
        label: 'Burette rinsed with acid',
        max: 1,
        flag: 'rinsed-burette',
        feedbackPass: 'Rinsing prevents dilution of the titrant.',
        feedbackFail: 'Rinse the burette with the acid before filling.',
      },
    ]);
    const conclusion = scoreConclusion(
      attempt.notes,
      ['water of crystallisation', 'molar mass', 'hydrated'],
      2,
      `the formula is Na₂CO₃·${scenario.waterOfCrystallisation}H₂O`,
    );
    return summarise([...titreCriteria, ...calcCriteria, ...procedure, conclusion]);
  },
  meta: {
    code: 'CHM-02',
    slug: 'chm-02-hydrated-carbonate',
    title: 'Hydrated salt: molar mass and water of crystallisation',
    subject: 'CHEMISTRY',
    priority: 'P1',
    examBodies: ['WAEC', 'NECO'],
    summary:
      'Titrate a weighed hydrated carbonate, find its molar mass and deduce the number of water molecules of crystallisation.',
    durationMin: 22,
    apparatus: ['Burette', 'Pipette', 'Volumetric flask (250 cm³)', 'Hydrated sodium carbonate', 'Methyl orange'],
    skills: ['Solution preparation', 'Titration', 'Molar mass from titration', 'Formula determination'],
    objective: 'Determine n in Na₂CO₃·nH₂O from a titration and a weighed sample.',
    curriculum: 'SS3 volumetric analysis: hydrated salts and formula determination.',
  },
  scene: 'titration',
  theory: [
    {
      heading: 'From titre to moles',
      body: 'A pipette delivers 25.0 cm³ of the solution made up to 250 cm³. The titre gives the moles of acid, the ratio gives moles of carbonate, and scaling by 10 gives the moles in the flask.',
      formula: 'n(carbonate in flask) = c_acid × V_titre × 10 / (2 × 1000)',
    },
    {
      heading: 'Molar mass of the hydrate',
      body: 'Dividing the weighed mass by the moles of hydrate gives its molar mass. Subtract the anhydrous molar mass and divide by 18 to find n.',
      formula: 'M(hydrate) = m / n;  n = [M − 106]/18',
    },
    {
      heading: 'Indicator choice',
      body: 'Na₂CO₃ is titrated with methyl orange. The colour change from yellow to orange occurs near pH 4, after both protonation stages.',
    },
  ],
  procedure: [
    { title: 'Prepare the solution', detail: 'Weigh the hydrated carbonate and dissolve it in a 250 cm³ volumetric flask, making up to the mark.' },
    { title: 'Pipette an aliquot', detail: 'Pipette 25.0 cm³ into a conical flask and add methyl orange.' },
    { title: 'Titrate to orange', detail: 'Titrate with the standard acid to the first orange end-point and record concordant titres.' },
    { title: 'Scale up and deduce n', detail: 'Multiply the aliquot moles by 10, then divide the sample mass by those moles to get the molar mass of the hydrate.' },
  ],
  table: {
    columns: [
      { id: 'initial', label: 'Initial reading', unit: 'cm³', decimals: 2, kind: 'number', burette: true },
      { id: 'final', label: 'Final reading', unit: 'cm³', decimals: 2, kind: 'number', burette: true },
      { id: 'titre', label: 'Titre', unit: 'cm³', decimals: 2, kind: 'number', burette: true },
    ],
    minRows: 2,
    addRows: true,
    keyColumn: 'titre',
    instructions: 'Record at least three titres; only concordant titres count towards the average.',
  },
  calculations: [
    {
      id: 'molesAliquot',
      label: 'Moles of carbonate in the 25.0 cm³ aliquot',
      unit: 'mol',
      max: 2,
      tolerancePercent: 4,
      expected: (s) => (s.analyteMolarity * 25) / 1000,
      help: 'From the titre: n(acid) = cV/1000, then divide by 2 for the Na₂CO₃ ratio.',
      formula: 'n = c_acid V_titre / (2 × 1000)',
    },
    {
      id: 'molesFlask',
      label: 'Moles of carbonate in the whole flask',
      unit: 'mol',
      max: 2,
      tolerancePercent: 4,
      expected: (s) => (s.analyteMolarity * s.flaskVolumeCm3) / 1000,
      help: 'Multiply the aliquot moles by 250/25 = 10.',
    },
    {
      id: 'molarMass',
      label: 'Molar mass of the hydrated salt',
      unit: 'g/mol',
      max: 2,
      tolerancePercent: 3,
      expected: (s) => s.molarMassHydrate,
      help: 'M = mass of sample ÷ moles of hydrate in the flask.',
      formula: 'M = m / n',
    },
    {
      id: 'n',
      label: 'Number of water molecules of crystallisation',
      unit: '',
      max: 2,
      tolerancePercent: 6,
      expected: (s) => s.waterOfCrystallisation,
      help: 'n = (M_hydrate − 106) ÷ 18. It must be a whole number.',
      formula: 'n = (M − 106)/18',
    },
  ],
  coachTip: 'The first permanent orange (not pink) is the end-point with methyl orange. Boil off CO₂ only if the method tells you to.',
  generate: (seed) => {
    const rng = createRng(seed);
    const n = rng.int(2, 9);
    const molarMassHydrate = 106 + 18 * n;
    const sampleMassG = Math.round(rng.float(2.4, 4.2) * 10) / 10;
    const acidMolarity = Math.round(rng.float(0.08, 0.12) * 1000) / 1000;
    const molarity = sampleMassG / molarMassHydrate / 0.25;
    const trueTitreCm3 = expectedTitreCm3(
      TITRATION_SYSTEMS['hcl-na2co3'],
      acidMolarity,
      molarity,
      25,
    );
    return {
      waterOfCrystallisation: n,
      molarMassHydrate,
      sampleMassG,
      acidMolarity,
      analyteMolarity: molarity,
      analyteVolumeCm3: 25,
      trueTitreCm3,
      flaskVolumeCm3: 250,
    };
  },
};

// ---------------------------------------------------------------------------
// CHM-03 — Redox titration
// ---------------------------------------------------------------------------

export interface RedoxLabScenario {
  titrantMolarity: number;
  analyteMolarity: number;
  analyteVolumeCm3: number;
  trueTitreCm3: number;
  sampleMassG: number;
  molarMassFe: number;
}

export const redoxExperiment: ExperimentDefinition<RedoxLabScenario> = {
  score: (attempt, scenario) => {
    const titres = titreValues(attempt.rows);
    const titreCriteria = scoreTitres(titres, scenario.trueTitreCm3, {
      concordance: 3,
      accuracy: 2,
      precision: 1,
    });
    const calcCriteria = scoreCalculations(
      attempt.answers,
      redoxExperiment.calculations.map((spec) => ({
        id: spec.id,
        label: spec.label,
        unit: spec.unit,
        max: spec.max,
        tolerancePercent: spec.tolerancePercent,
        expected: spec.expected(scenario),
      })),
    );
    const procedure = scoreProcedure(attempt, [
      {
        id: 'self-indicating',
        label: 'Recognised the self-indicating end-point',
        max: 2,
        flag: 'self-indicating',
        feedbackPass: 'The first permanent pink is the end-point for permanganate.',
        feedbackFail: 'No indicator is needed: the first permanent pink permanganate colour marks the end-point.',
      },
      {
        id: 'dropwise',
        label: 'Added the last drops slowly',
        max: 1,
        flag: 'dropwise',
        feedbackPass: 'The end-point was not overshot.',
        feedbackFail: 'Add the last millilitres dropwise with constant swirling.',
      },
      {
        id: 'burette',
        label: 'Read the burette at the bottom of the meniscus',
        max: 1,
        flag: 'rinsed-burette',
        feedbackPass: 'Burette readings are consistent.',
        feedbackFail: 'Read the bottom of the meniscus at eye level and rinse the burette first.',
      },
    ]);
    const conclusion = scoreConclusion(
      attempt.notes,
      ['iron', 'percentage', 'oxidation', 'titration'],
      2,
      `the sample contains ${scenario.analyteMolarity.toFixed(3)} mol/dm³ Fe²⁺`,
    );
    return summarise([...titreCriteria, ...calcCriteria, ...procedure, conclusion]);
  },
  meta: {
    code: 'CHM-03',
    slug: 'chm-03-redox-permanganate',
    title: 'Redox titration with potassium manganate(VII)',
    subject: 'CHEMISTRY',
    priority: 'P1',
    examBodies: ['WAEC', 'NECO'],
    summary:
      'Titrate iron(II) with acidified KMnO₄, use the self-indicating end-point and determine the percentage of iron in a sample.',
    durationMin: 20,
    apparatus: ['Burette', 'Pipette', 'Conical flask', 'KMnO₄ solution', 'Dilute H₂SO₄', 'Iron sample'],
    skills: ['Redox stoichiometry', 'Self-indicating end-point', 'Percentage composition', 'Careful burette work'],
    objective: 'Determine the concentration of iron(II) and the percentage of iron in a sample by redox titration.',
    curriculum: 'SS3 volumetric analysis: redox titration with potassium manganate(VII).',
  },
  scene: 'titration',
  theory: [
    {
      heading: 'The redox reaction',
      body: 'Permanganate oxidises iron(II) in acid solution. The balanced equation gives a 1:5 ratio between MnO₄⁻ and Fe²⁺.',
      formula: 'MnO₄⁻ + 8H⁺ + 5Fe²⁺ → Mn²⁺ + 5Fe³⁺ + 4H₂O',
    },
    {
      heading: 'Self-indicating',
      body: 'Permanganate is intensely purple and its reduced form Mn²⁺ is almost colourless. The first permanent pink therefore marks the end-point — no indicator is added.',
    },
    {
      heading: 'Percentage of iron',
      body: 'Scale the moles from the aliquot to the flask, convert to mass with Aᵣ(Fe) = 55.85, then divide by the sample mass.',
      formula: '%Fe = (m_Fe / sample mass) × 100',
    },
  ],
  procedure: [
    { title: 'Acidify', detail: 'Pipette 25.0 cm³ of the iron(II) solution and add excess dilute sulphuric acid.' },
    { title: 'Fill the burette', detail: 'Fill with standard KMnO₄, record the initial reading and remove air bubbles.' },
    { title: 'Titrate to pink', detail: 'Run in KMnO₄ with swirling until the first permanent pink colour persists.' },
    { title: 'Repeat and calculate', detail: 'Obtain concordant titres, then find the Fe²⁺ concentration and the percentage of iron in the sample.' },
  ],
  table: {
    columns: [
      { id: 'initial', label: 'Initial reading', unit: 'cm³', decimals: 2, kind: 'number', burette: true },
      { id: 'final', label: 'Final reading', unit: 'cm³', decimals: 2, kind: 'number', burette: true },
      { id: 'titre', label: 'Titre', unit: 'cm³', decimals: 2, kind: 'number', burette: true },
    ],
    minRows: 2,
    addRows: true,
    keyColumn: 'titre',
    instructions: 'Record initial and final readings, then press “Record titre”. No indicator is used.',
  },
  calculations: [
    {
      id: 'feConc',
      label: 'Concentration of iron(II) in the solution',
      unit: 'mol/dm³',
      max: 2,
      tolerancePercent: 4,
      expected: (s) => s.analyteMolarity,
      help: 'n(Fe²⁺) = 5 × n(MnO₄⁻); then divide by 0.025 dm³.',
      formula: 'c(Fe²⁺) = 5 c(MnO₄⁻) V_titre / 25',
    },
    {
      id: 'feMass',
      label: 'Mass of iron in the 250 cm³ flask',
      unit: 'g',
      max: 2,
      tolerancePercent: 4,
      expected: (s) => s.analyteMolarity * 0.25 * s.molarMassFe,
      help: 'Multiply moles in the whole flask by 55.85 g/mol.',
      formula: 'm = n × 55.85',
    },
    {
      id: 'fePercent',
      label: 'Percentage of iron in the sample',
      unit: '%',
      max: 4,
      tolerancePercent: 5,
      expected: (s) => ((s.analyteMolarity * 0.25 * s.molarMassFe) / s.sampleMassG) * 100,
      help: 'Divide the mass of iron by the mass of the sample and multiply by 100.',
      formula: '%Fe = (m_Fe / sample mass) × 100',
    },
  ],
  coachTip: 'The first pink that lasts while you swirl is the end-point. A pink that fades is not the end-point.',
  generate: (seed) => {
    const rng = createRng(seed);
    const titrantMolarity = Math.round(rng.float(0.015, 0.025) * 1000) / 1000;
    const analyteMolarity = Math.round(rng.float(0.05, 0.12) * 1000) / 1000;
    const trueTitreCm3 = (analyteMolarity * 25) / (5 * titrantMolarity);
    return {
      titrantMolarity,
      analyteMolarity,
      analyteVolumeCm3: 25,
      trueTitreCm3,
      sampleMassG: Math.round(rng.float(1.2, 1.8) * 10) / 10,
      molarMassFe: 55.85,
    };
  },
};

// ---------------------------------------------------------------------------
// Qualitative analysis (CHM-04, CHM-05, CHM-06)
// ---------------------------------------------------------------------------

export interface QualitativeScenario {
  familyId: QualitativeFamilyId;
  unknownId: string;
}

function qualitativeChoices(familyId: QualitativeFamilyId): { id: string; label: string }[] {
  return family(familyId).species.map((s) => ({ id: s.id, label: s.name }));
}

function qualitativeTable(): ExperimentDefinition<QualitativeScenario>['table'] {
  return {
    columns: [
      { id: 'reagent', label: 'Test / reagent', kind: 'text', width: 'md' },
      { id: 'observation', label: 'Observation', kind: 'text', width: 'lg' },
      { id: 'inference', label: 'Inference', kind: 'text', width: 'md' },
    ],
    minRows: 2,
    addRows: true,
    keyColumn: 'reagent',
    instructions: 'Choose a reagent, observe carefully, then record what you saw and what it suggests.',
  };
}

function makeQualitative(
  familyId: QualitativeFamilyId,
  meta: ExperimentDefinition<QualitativeScenario>['meta'],
  scene: 'tubes' | 'food',
  theory: ExperimentDefinition<QualitativeScenario>['theory'],
  procedure: ExperimentDefinition<QualitativeScenario>['procedure'],
  coachTip: string,
  pool: string[],
): ExperimentDefinition<QualitativeScenario> {
  return {
    meta,
    scene,
    theory,
    procedure,
    table: qualitativeTable(),
    calculations: [],
    coachTip,
    choices: qualitativeChoices(familyId),
    generate: (seed) => {
      const rng = createRng(seed);
      return { familyId, unknownId: rng.pick(pool) };
    },
    score: (attempt, scenario) =>
      scoreQualitative(attempt, scenario.familyId, scenario.unknownId),
  };
}

export const cationsExperiment = makeQualitative(
  'cations',
  {
    code: 'CHM-04',
    slug: 'chm-04-cation-identification',
    title: 'Identification of cations',
    subject: 'CHEMISTRY',
    priority: 'P0',
    examBodies: ['WAEC', 'NECO', 'JAMB'],
    summary:
      'Test an unknown salt solution with sodium hydroxide, ammonia and a flame to identify the cation present.',
    durationMin: 15,
    apparatus: ['Test tubes and rack', 'Droppers', 'NaOH solution', 'NH₃ solution', 'Bunsen burner', 'Unknown salt'],
    skills: ['Qualitative analysis', 'Recording observations', 'Inference writing', 'Flame tests'],
    objective: 'Identify an unknown cation from the colour and solubility of its hydroxide precipitate.',
    curriculum: 'SS2 qualitative analysis: tests for cations.',
  },
  'tubes',
  [
    {
      heading: 'Hydroxide precipitates',
      body: 'Adding NaOH to a metal-ion solution forms an insoluble hydroxide. The colour identifies the ion, and solubility in excess separates Zn²⁺, Al³⁺ and Pb²⁺ from the rest.',
      formula: 'M²⁺ + 2OH⁻ → M(OH)₂(s)',
    },
    {
      heading: 'Ammonia as a confirmatory test',
      body: 'Ammonia gives the same hydroxide but can form soluble ammine complexes: copper(II) dissolves to deep blue and zinc(II) dissolves, while iron and aluminium precipitates do not.',
    },
    {
      heading: 'Ammonium ion',
      body: 'NH₄⁺ gives no precipitate. Warming with NaOH releases ammonia gas, identified by its pungent smell and by turning moist red litmus blue.',
    },
  ],
  [
    { title: 'Add NaOH', detail: 'Place 2 cm³ of the unknown solution in a test tube and add NaOH dropwise, then in excess.' },
    { title: 'Observe and record', detail: 'Note the colour of any precipitate and whether it dissolves in excess. Record the observation and inference.' },
    { title: 'Confirm with ammonia', detail: 'Repeat in a fresh tube with ammonia solution and compare the result.' },
    { title: 'Identify', detail: 'Use the combined evidence to choose the cation and write a conclusion.' },
  ],
  'A precipitate that dissolves in excess ammonia points to Zn²⁺ or Cu²⁺. Al³⁺ and Pb²⁺ dissolve in excess NaOH but not ammonia.',
  CATIONS.unknownPool,
);

export const anionsExperiment = makeQualitative(
  'anions',
  {
    code: 'CHM-05',
    slug: 'chm-05-anion-gas-identification',
    title: 'Identification of anions and gases',
    subject: 'CHEMISTRY',
    priority: 'P0',
    examBodies: ['WAEC', 'NECO', 'JAMB'],
    summary:
      'Test an unknown salt with dilute acid, barium chloride and silver nitrate, and identify any gas evolved.',
    durationMin: 15,
    apparatus: ['Test tubes', 'Dilute HCl', 'BaCl₂ solution', 'AgNO₃ solution', 'Limewater', 'Litmus paper'],
    skills: ['Anion tests', 'Gas identification', 'Degrees of solubility', 'Evidence-based inference'],
    objective: 'Identify an unknown anion using precipitation and gas tests.',
    curriculum: 'SS2 qualitative analysis: tests for anions and gases.',
  },
  'tubes',
  [
    {
      heading: 'Carbonate and sulphite',
      body: 'Both effervesce with dilute acid, but only CO₂ turns limewater milky. SO₂ has a choking smell and decolourises acidified KMnO₄.',
    },
    {
      heading: 'Sulphate and chloride',
      body: 'BaCl₂ gives a white precipitate with sulphate that is insoluble in dilute HCl. AgNO₃ gives a white precipitate with chloride that dissolves in ammonia; iodide gives a yellow precipitate that does not.',
    },
    {
      heading: 'Nitrate',
      body: 'The brown ring test confirms nitrate. Heating with NaOH and aluminium foil releases ammonia if nitrate is present.',
    },
  ],
  [
    { title: 'Add dilute acid', detail: 'Add dilute HCl and test any gas with limewater and moist litmus.' },
    { title: 'Test for sulphate', detail: 'Add BaCl₂ solution, then acidify with dilute HCl to check whether the precipitate dissolves.' },
    { title: 'Test for halides', detail: 'Add AgNO₃ solution and then excess ammonia. Note whether the precipitate dissolves.' },
    { title: 'Identify', detail: 'Combine the evidence and choose the anion, then write the ionic equation for one test.' },
  ],
  'A white precipitate with BaCl₂ that survives dilute HCl is sulphate. One that fizzes away is carbonate or sulphite.',
  ANIONS.unknownPool,
);

export const gasesExperiment = makeQualitative(
  'gases',
  {
    code: 'CHM-05B',
    slug: 'chm-05b-gas-identification',
    title: 'Identification of gases',
    subject: 'CHEMISTRY',
    priority: 'P2',
    examBodies: ['WAEC', 'NECO'],
    summary: 'Collect and test gases with limewater, splints, litmus and KMnO₄ to identify them.',
    durationMin: 12,
    apparatus: ['Gas jars', 'Delivery tube', 'Limewater', 'Splint', 'Litmus paper', 'KMnO₄'],
    skills: ['Gas collection', 'Flame tests on splints', 'Litmus tests', 'Observation wording'],
    objective: 'Identify an unknown gas from its physical properties and two confirmatory tests.',
    curriculum: 'SS2 qualitative analysis: tests for gases.',
  },
  'tubes',
  [
    {
      heading: 'Combustion tests',
      body: 'Oxygen relights a glowing splint, hydrogen burns with a pop, and carbon dioxide extinguishes a lighted splint.',
    },
    {
      heading: 'Acid–base tests',
      body: 'Ammonia turns moist red litmus blue; acidic gases such as CO₂, SO₂ and HCl turn moist blue litmus red.',
    },
    {
      heading: 'Confirmatory tests',
      body: 'Limewater is specific for CO₂. Acidified KMnO₄ is decolourised by SO₂ but not CO₂. A rod dipped in conc. HCl gives white fumes with ammonia.',
    },
  ],
  [
    { title: 'Note the appearance', detail: 'Record colour and smell first — never smell a gas directly.' },
    { title: 'Test with litmus', detail: 'Hold a piece of moist litmus paper at the mouth of the jar.' },
    { title: 'Use the splint', detail: 'Apply a glowing or lighted splint and record what happens.' },
    { title: 'Confirm and identify', detail: 'Use limewater or KMnO₄ to confirm, then name the gas.' },
  ],
  'A gas that turns limewater milky is carbon dioxide; one that pops is hydrogen; one that relights a glowing splint is oxygen.',
  GASES.unknownPool,
);

export const foodExperiment = makeQualitative(
  'food',
  {
    code: 'CHM-06',
    slug: 'chm-06-food-tests',
    title: 'Food tests and organic functional groups',
    subject: 'CHEMISTRY',
    priority: 'P2',
    examBodies: ['WAEC', 'NECO'],
    summary:
      'Use Benedict’s, iodine, Biuret, Sudan III, bromine water and DCPIP to identify constituents and functional groups.',
    durationMin: 14,
    apparatus: ['Test tubes', 'Water bath', 'Benedict’s solution', 'Iodine', 'Biuret reagent', 'Sudan III'],
    skills: ['Food tests', 'Colour observation', 'Functional group tests', 'Controlled conditions'],
    objective: 'Identify a food constituent or functional group using the appropriate chemical test.',
    curriculum: 'SS2 chemistry: food tests and tests for organic functional groups.',
  },
  'food',
  [
    {
      heading: 'Reducing sugars and starch',
      body: 'Benedict’s solution gives a brick-red precipitate with reducing sugars after heating. Iodine gives a blue-black colour with starch.',
    },
    {
      heading: 'Proteins and fats',
      body: 'Biuret turns purple in the presence of peptide bonds. Sudan III stains fats red.',
    },
    {
      heading: 'Unsaturation',
      body: 'Bromine water is decolourised by an alkene but not by an alkane. DCPIP is decolourised by vitamin C.',
    },
  ],
  [
    { title: 'Choose a test', detail: 'Pick the reagent that specifically tests the constituent you suspect.' },
    { title: 'Apply the condition', detail: 'Benedict’s needs a water bath; iodine and Biuret work at room temperature.' },
    { title: 'Record the result', detail: 'Note the starting colour and the final colour or precipitate.' },
    { title: 'Identify', detail: 'State the constituent or functional group and support it with the test result.' },
  ],
  'Record the colour before and after. "Turned brick-red on heating" is a stronger observation than "changed".',
  FOOD.unknownPool,
);

export const chemistryExperiments: ExperimentDefinition<any>[] = [
  titrationExperiment,
  hydrateExperiment,
  redoxExperiment,
  cationsExperiment,
  anionsExperiment,
  gasesExperiment,
  foodExperiment,
];
