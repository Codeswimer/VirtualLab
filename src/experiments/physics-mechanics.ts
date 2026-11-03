import { createRng } from '@sim/rng';
import {
  balancePositionForMass,
  limitingAngleDeg,
  resultant,
  springExtensionCm,
} from '@sim/physics/mechanics';
import { periodFiniteAmplitude } from '@sim/physics/pendulum';
import type { ExperimentDefinition } from './types';
import { scoreQuantitative } from './scoring';

const fx = (value: number, decimals = 1): string => value.toFixed(decimals);

// ---------------------------------------------------------------------------
// PHY-01 — Simple pendulum
// ---------------------------------------------------------------------------

export interface PendulumScenario {
  g: number;
  lengthsM: number[];
  amplitudeDeg: number;
  oscillations: number;
  stopwatchZeroS: number;
}

const pendulumBase: Omit<ExperimentDefinition<PendulumScenario>, 'score'> = {
  meta: {
    code: 'PHY-01',
    slug: 'phy-01-simple-pendulum',
    title: 'Simple pendulum: determine g',
    subject: 'PHYSICS',
    priority: 'P0',
    examBodies: ['WAEC', 'NECO', 'JAMB'],
    summary:
      'Time swings at five different lengths, plot T² against L and use the gradient to find the acceleration of free fall.',
    durationMin: 20,
    apparatus: ['Retort stand', 'Inextensible thread', 'Brass bob', 'Metre rule', 'Stopwatch'],
    skills: ['Timing oscillations', 'Plotting T² vs L', 'Gradient → g', 'Significant figures'],
    objective: 'Determine g to within 5 % using a simple pendulum, and explain why many swings are timed.',
    curriculum: 'SS2 mechanics: simple harmonic motion; WAEC/NECO practical paper 3 mechanics question.',
  },
  scene: 'pendulum',
  theory: [
    {
      heading: 'Period of a simple pendulum',
      body: 'For small oscillations the period depends only on the length and g. Timing many swings reduces the percentage error in reading the stopwatch.',
      formula: 'T = 2π√(L/g)',
    },
    {
      heading: 'Linearising the graph',
      body: 'Squaring both sides gives a straight line through the origin, so the gradient yields g and the intercept should be near zero.',
      formula: 'T² = (4π²/g)·L,  g = 4π² / gradient',
    },
    {
      heading: 'Length convention',
      body: 'L is measured from the point of suspension to the centre of the bob — not to its top. This is a common source of systematic error in the practical.',
    },
  ],
  procedure: [
    { title: 'Set the first length', detail: 'Attach the thread so that L = 0.30 m, measured to the centre of the bob with the metre rule.' },
    { title: 'Displace and release', detail: 'Pull the bob aside by about 5° and release without a push so it swings in one plane.' },
    { title: 'Time 20 oscillations', detail: 'Start the stopwatch as the bob passes the centre; count 20 complete oscillations, then stop.' },
    { title: 'Record and repeat', detail: 'Record L, the time for 20 oscillations, then T and T². Repeat for the other four lengths.' },
    { title: 'Plot and calculate', detail: 'Plot T² against L, draw the best-fit line, measure its gradient, then find g = 4π²/gradient.' },
  ],
  table: {
    columns: [
      { id: 'length', label: 'Length L', unit: 'm', decimals: 2, kind: 'number' },
      { id: 'time', label: 'Time for 20 oscillations', unit: 's', decimals: 2, kind: 'number' },
      { id: 'period', label: 'Period T', unit: 's', decimals: 2, kind: 'number' },
      { id: 't2', label: 'T²', unit: 's²', decimals: 3, kind: 'number' },
    ],
    minRows: 5,
    addRows: false,
    keyColumn: 'length',
    instructions: 'Use the five lengths supplied on the bench. Compute T = time ÷ 20 before squaring.',
    presets: (s) => s.lengthsM.map((l) => ({ length: fx(l, 2) })),
  },
  graph: {
    xColumn: 'length',
    yColumn: 't2',
    xLabel: 'Length L',
    yLabel: 'T²',
    xUnit: 'm',
    yUnit: 's²',
    prompt: 'Plot T² (vertical) against L (horizontal), draw the best-fit line and use its gradient to find g.',
    expectedGradient: (s) => (4 * Math.PI ** 2) / s.g,
    tolerancePercent: 12,
    minimumPoints: 4,
  },
  calculations: [
    {
      id: 'g',
      fromGradient: true,
      label: 'Acceleration of free fall from your gradient',
      unit: 'm/s²',
      max: 3,
      tolerancePercent: 6,
      expected: (s) => s.g,
      help: 'Take the gradient of your T²–L line, then g = 4π² ÷ gradient. Use the gradient value shown under your graph.',
      formula: 'g = 4π² / gradient',
    },
    {
      id: 'length2s',
      label: 'Length that would give a period of 2.0 s',
      unit: 'm',
      max: 1,
      tolerancePercent: 6,
      expected: (s) => (s.g * 4) / (4 * Math.PI ** 2),
      help: 'From T = 2π√(L/g), rearrange for L when T = 2.0 s.',
      formula: 'L = gT² / 4π²',
    },
  ],
  coachTip:
    'Time 20 swings, not one. Count "zero" as the bob passes the centre and start the watch on the next pass.',
  generate: (seed) => {
    const rng = createRng(seed);
    const g = 9.72 + rng.float(0, 0.16);
    const baseLengths = [0.3, 0.45, 0.6, 0.75, 0.9];
    const lengthsM = baseLengths.map((l) => Math.round((l + rng.float(-0.01, 0.01)) * 100) / 100);
    return {
      g,
      lengthsM,
      amplitudeDeg: Math.round(rng.float(4, 8) * 10) / 10,
      oscillations: 20,
      stopwatchZeroS: rng.next() < 0.5 ? 0 : Math.round(rng.float(0.03, 0.12) * 100) / 100,
    };
  },
};

export const pendulumExperiment: ExperimentDefinition<PendulumScenario> = {
  ...pendulumBase,
  score: (attempt, scenario) => {
    const periods = scenario.lengthsM.map((l) =>
      periodFiniteAmplitude(l, scenario.amplitudeDeg, scenario.g),
    );
    return scoreQuantitative(
      pendulumExperiment,
      {
        expectedKeys: () => scenario.lengthsM.map((l) => fx(l, 2)),
        values: () => ({
          time: periods.map((t) => t * scenario.oscillations),
          period: periods,
          t2: periods.map((t) => t * t),
        }),
        compareColumns: ['time', 'period', 't2'],
        tolerancePercent: 4,
        decimals: { time: 2, period: 2, t2: 3 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'many-swings',
            label: 'Timed at least 10 oscillations',
            max: 1,
            flag: 'multiple-swings',
            feedbackPass: 'Good — timing many swings reduces the stopwatch error.',
            feedbackFail: 'Time 20 oscillations and divide, instead of timing a single swing.',
          },
          {
            id: 'repeated',
            label: 'Collected at least four lengths',
            max: 1,
            check: (a) => a.rows.filter((r) => (r.length ?? '').trim() !== '').length >= 4,
            feedbackPass: 'Enough points for a reliable line of best fit.',
            feedbackFail: 'Record readings for at least four of the five lengths.',
          },
        ],
        conclusion: {
          keywords: ['g', 'acceleration', 'free', 'm/s'],
          phrase: `g ≈ ${scenario.g.toFixed(2)} m/s²`,
          max: 3,
        },
      },
      attempt,
      scenario,
    );
  },
};

// ---------------------------------------------------------------------------
// PHY-02 — Hooke's law
// ---------------------------------------------------------------------------

export interface SpringScenario {
  springConstantNm: number;
  massesG: number[];
  zeroErrorCm: number;
}

export const springExperiment: ExperimentDefinition<SpringScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      springExperiment,
      {
        expectedKeys: () => scenario.massesG.map((m) => String(m)),
        values: () => ({
          force: scenario.massesG.map((m) => (m / 1000) * 9.81),
          extension: scenario.massesG.map((m) => springExtensionCm(m, scenario.springConstantNm)),
        }),
        compareColumns: ['force', 'extension'],
        tolerancePercent: 6,
        decimals: { force: 2, extension: 1 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'zero-check',
            label: 'Checked the zero of the metre rule',
            max: 1,
            flag: 'zero-checked',
            feedbackPass: 'Zero error handled before taking readings.',
            feedbackFail: 'Check the ruler’s zero before hanging any mass.',
          },
          {
            id: 'no-overload',
            label: 'Stayed within the elastic limit',
            max: 1,
            flag: 'within-elastic-limit',
            feedbackPass: 'The spring returned to its original length each time.',
            feedbackFail: 'Do not exceed the load that permanently stretches the spring.',
          },
          {
            id: 'unloaded-zero',
            label: 'Recorded the unloaded pointer position',
            max: 1,
            flag: 'recorded-zero',
            feedbackPass: 'Extension measured from the unloaded position.',
            feedbackFail: 'Record the pointer position with only the hanger attached.',
          },
        ],
        conclusion: {
          keywords: ['spring', 'constant', 'n/m', 'hooke'],
          phrase: `k ≈ ${Math.round(scenario.springConstantNm)} N/m`,
          max: 3,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-02',
    slug: 'phy-02-hookes-law',
    title: "Hooke's law: spring constant",
    subject: 'PHYSICS',
    priority: 'P1',
    examBodies: ['WAEC', 'NECO'],
    summary:
      'Hang increasing masses on a spring, measure the extension with a metre rule and find k from the F–e graph.',
    durationMin: 18,
    apparatus: ['Retort stand', 'Helical spring', 'Mass hanger + slotted masses', 'Metre rule', 'Pointer'],
    skills: ['Measuring extension', 'Converting g to N', 'F–e graph', 'Hooke’s law limits'],
    objective: 'Determine the force constant of a spring and explain where Hooke’s law stops applying.',
    curriculum: 'SS1/SS2 mechanics: elasticity; Hooke’s law practical.',
  },
  scene: 'spring',
  theory: [
    {
      heading: "Hooke's law",
      body: 'Within the elastic limit the extension is directly proportional to the applied force. The gradient of F against e is the spring constant.',
      formula: 'F = ke,  k = gradient',
    },
    {
      heading: 'Getting force from mass',
      body: 'The slotted masses are quoted in grams. Convert to newtons before plotting, otherwise the gradient is not k.',
      formula: 'F = mg,  g = 9.81 m/s²',
    },
    {
      heading: 'Elastic limit',
      body: 'Beyond the elastic limit the graph curves and the spring does not return to its original length. Only the straight section may be used to find k.',
    },
  ],
  procedure: [
    { title: 'Record the zero', detail: 'With only the hanger on the spring, note the pointer position against the metre rule.' },
    { title: 'Add masses', detail: 'Add 50 g at a time up to 250 g, recording the pointer position after the spring settles.' },
    { title: 'Find extensions', detail: 'Subtract the unloaded position to get the extension for each load, in cm.' },
    { title: 'Plot F against e', detail: 'Convert each mass to a force in N, plot F (vertical) against e (horizontal) and draw the best-fit line.' },
    { title: 'Find k', detail: 'Gradient in N/cm × 100 gives k in N/m. State it to 2 significant figures.' },
  ],
  table: {
    columns: [
      { id: 'mass', label: 'Mass added', unit: 'g', decimals: 0, kind: 'number' },
      { id: 'force', label: 'Force F = mg', unit: 'N', decimals: 2, kind: 'number' },
      { id: 'extension', label: 'Extension e', unit: 'cm', decimals: 1, kind: 'number' },
    ],
    minRows: 5,
    addRows: false,
    keyColumn: 'mass',
    instructions: 'Add each mass in turn. The extension is the loaded pointer reading minus the unloaded reading.',
    presets: (s) => s.massesG.map((m) => ({ mass: String(m) })),
  },
  graph: {
    xColumn: 'extension',
    yColumn: 'force',
    xLabel: 'Extension e',
    yLabel: 'Force F',
    xUnit: 'cm',
    yUnit: 'N',
    prompt: 'Plot force F (N) against extension e (cm) and use the gradient to find the spring constant.',
    expectedGradient: (s) => s.springConstantNm / 100,
    tolerancePercent: 12,
    minimumPoints: 4,
  },
  calculations: [
    {
      id: 'k',
      fromGradient: true,
      label: 'Spring constant from your gradient',
      unit: 'N/m',
      max: 3,
      tolerancePercent: 10,
      expected: (s) => s.springConstantNm,
      help: 'Gradient (N/cm) × 100 = k in N/m.',
      formula: 'k = 100 × gradient',
    },
    {
      id: 'ext400',
      label: 'Extension produced by a 400 g load',
      unit: 'cm',
      max: 1,
      tolerancePercent: 8,
      expected: (s) => springExtensionCm(400, s.springConstantNm),
      help: 'Use F = mg and e = F/k, then convert metres to centimetres.',
      formula: 'e = mg / k',
    },
  ],
  coachTip: 'Use F = mg, not the mass in grams, on the vertical axis. Convert the gradient to N/m at the end.',
  generate: (seed) => {
    const rng = createRng(seed);
    return {
      springConstantNm: Math.round(rng.float(18, 42) * 10) / 10,
      massesG: [50, 100, 150, 200, 250],
      zeroErrorCm: Math.round(rng.float(-0.05, 0.05) * 100) / 100,
    };
  },
};

// ---------------------------------------------------------------------------
// PHY-03 — Principle of moments
// ---------------------------------------------------------------------------

export interface MomentsScenario {
  ruleMassG: number;
  cgCm: number;
  pivotsCm: number[];
  massG: number;
}

export const momentsExperiment: ExperimentDefinition<MomentsScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      momentsExperiment,
      {
        expectedKeys: () => scenario.pivotsCm.map((p) => fx(p, 1)),
        values: () => {
          const positions = scenario.pivotsCm.map((pivotCm) =>
            balancePositionForMass({ ...scenario, pivotCm }),
          );
          return {
            position: positions,
            distance: positions.map((p, i) => p - (scenario.pivotsCm[i] ?? 0)),
          };
        },
        compareColumns: ['position', 'distance'],
        tolerancePercent: 3,
        decimals: { position: 1, distance: 1 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'balanced',
            label: 'Found a balance position',
            max: 2,
            flag: 'balanced',
            feedbackPass: 'The rule was level before you recorded the reading.',
            feedbackFail: 'Slide the mass until the rule just balances, then record the position.',
          },
          {
            id: 'cg',
            label: 'Located the centre of gravity first',
            max: 2,
            flag: 'cg-found',
            feedbackPass: 'Balancing the bare rule first makes the calculation valid.',
            feedbackFail: 'Balance the rule alone on the knife-edge to locate its centre of gravity.',
          },
        ],
        conclusion: {
          keywords: ['moment', 'clockwise', 'anticlockwise', 'balance'],
          phrase: 'clockwise moment = anticlockwise moment about the pivot',
          max: 2,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-03',
    slug: 'phy-03-principle-of-moments',
    title: 'Principle of moments: mass of a metre rule',
    subject: 'PHYSICS',
    priority: 'P1',
    examBodies: ['WAEC', 'NECO'],
    summary: 'Balance a metre rule with a known mass to locate its centre of gravity and determine its mass.',
    durationMin: 18,
    apparatus: ['Metre rule', 'Knife-edge on a retort stand', '50 g mass', 'Thread loop'],
    skills: ['Locating centre of gravity', 'Taking moments', 'Balancing a rigid body', 'Systematic errors'],
    objective: 'Use the principle of moments to find the mass of a metre rule and its centre of gravity.',
    curriculum: 'SS2 mechanics: moments, couple and equilibrium of rigid bodies.',
  },
  scene: 'moments',
  theory: [
    {
      heading: 'Principle of moments',
      body: 'When a body is in equilibrium about a pivot, the total clockwise moment equals the total anticlockwise moment. The weight acts through the centre of gravity.',
      formula: 'ΣFd(clockwise) = ΣFd(anticlockwise)',
    },
    {
      heading: 'Finding the rule’s mass',
      body: 'Balance the bare rule to locate its centre of gravity, then hang a known mass and balance at a new pivot. The rule’s mass follows from moments about the pivot.',
      formula: 'M = m(p − b) / (c − p)',
    },
    {
      heading: 'Why distance matters',
      body: 'Record positions from the same end of the rule and take distances from the pivot, not from the zero mark.',
    },
  ],
  procedure: [
    { title: 'Find the centre of gravity', detail: 'Balance the bare rule on the knife-edge and record the position where it stays horizontal.' },
    { title: 'Hang the mass', detail: 'Suspend the 50 g mass near one end and move the pivot until the rule balances again.' },
    { title: 'Record positions', detail: 'Record the pivot position and the mass position for three different pivot points.' },
    { title: 'Take moments', detail: 'Compute the distance of the mass from the pivot and use moments to find the rule’s mass.' },
  ],
  table: {
    columns: [
      { id: 'pivot', label: 'Pivot position', unit: 'cm', decimals: 1, kind: 'number' },
      { id: 'position', label: 'Balance position of mass', unit: 'cm', decimals: 1, kind: 'number' },
      { id: 'distance', label: 'Distance from pivot', unit: 'cm', decimals: 1, kind: 'number' },
    ],
    minRows: 3,
    addRows: true,
    keyColumn: 'pivot',
    instructions: 'Pivots are supplied on the bench. Record the balance position of the 50 g mass for each pivot.',
    presets: (s) => s.pivotsCm.map((p) => ({ pivot: fx(p, 1) })),
  },
  calculations: [
    {
      id: 'cg',
      label: 'Position of the centre of gravity of the rule',
      unit: 'cm',
      max: 4,
      tolerancePercent: 1.5,
      expected: (s) => s.cgCm,
      help: 'This is where the bare rule balanced. It need not be exactly 50.0 cm.',
      formula: 'cg = balance position of the bare rule',
    },
    {
      id: 'ruleMass',
      label: 'Mass of the metre rule',
      unit: 'g',
      max: 4,
      tolerancePercent: 6,
      expected: (s) => s.ruleMassG,
      help: 'M = m(p − b)/(cg − p), using your recorded pivot p, balance position b and centre of gravity cg.',
      formula: 'M = m(p − b) / (cg − p)',
    },
  ],
  coachTip: 'Balance the bare rule first. Without the centre of gravity, the mass calculation cannot be trusted.',
  generate: (seed) => {
    const rng = createRng(seed);
    const ruleMassG = Math.round(rng.float(85, 135));
    const cgCm = Math.round(rng.float(49.4, 50.8) * 10) / 10;
    const firstPivot = Math.round(rng.float(28, 34));
    return {
      ruleMassG,
      cgCm,
      pivotsCm: [firstPivot, firstPivot + 4, firstPivot + 8],
      massG: 50,
    };
  },
};

// ---------------------------------------------------------------------------
// PHY-04 — Density and relative density
// ---------------------------------------------------------------------------

export interface DensityScenario {
  samples: { name: string; massG: number; densityGcm3: number; material: string }[];
}

export const densityExperiment: ExperimentDefinition<DensityScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      densityExperiment,
      {
        expectedKeys: () => scenario.samples.map((s) => s.name),
        values: () => ({
          massWater: scenario.samples.map((s) => s.massG * (1 - 1 / s.densityGcm3)),
          upthrust: scenario.samples.map((s) => s.massG / s.densityGcm3),
        }),
        compareColumns: ['massWater', 'upthrust'],
        tolerancePercent: 4,
        decimals: { massWater: 1, upthrust: 1 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'submerged',
            label: 'Fully submerged each sample',
            max: 2,
            flag: 'submerged',
            feedbackPass: 'Samples were completely immersed, so upthrust is full.',
            feedbackFail: 'Lower each sample completely below the water surface before reading the balance.',
          },
        ],
        conclusion: {
          keywords: ['density', 'relative', 'water', 'material'],
          phrase: `the metal is ${scenario.samples[0]?.material ?? 'aluminium'}`,
          max: 4,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-04',
    slug: 'phy-04-density-archimedes',
    title: 'Density and relative density',
    subject: 'PHYSICS',
    priority: 'P1',
    examBodies: ['WAEC', 'NECO'],
    summary: 'Weigh solids in air and in water to find upthrust, relative density and identify the material.',
    durationMin: 16,
    apparatus: ['Spring balance', 'Beaker of water', 'Thread', 'Metal samples', 'Electronic balance'],
    skills: ['Archimedes’ principle', 'Relative density', 'Data reduction', 'Material identification'],
    objective: 'Use Archimedes’ principle to find the density of a solid and identify its material.',
    curriculum: 'SS1/SS2 mechanics: upthrust, flotation and Archimedes’ principle.',
  },
  scene: 'displacement',
  theory: [
    {
      heading: 'Archimedes’ principle',
      body: 'The upthrust on a fully immersed body equals the weight of the liquid displaced. In grams, the apparent loss of weight equals the mass of water displaced.',
      formula: 'upthrust = W(air) − W(water)',
    },
    {
      heading: 'Relative density',
      body: 'Relative density is the ratio of the body’s mass to the mass of an equal volume of water. For a body denser than water it equals density in g/cm³.',
      formula: 'RD = m(air) / [m(air) − m(water)]',
    },
    {
      heading: 'Reading the balance',
      body: 'The spring balance reads in newtons; the electronic balance in grams. Keep one system of units throughout your table.',
    },
  ],
  procedure: [
    { title: 'Weigh in air', detail: 'Suspend each sample from the balance and record its mass in air.' },
    { title: 'Weigh in water', detail: 'Lower the sample fully into water without touching the beaker and record the apparent mass.' },
    { title: 'Find upthrust', detail: 'Subtract the apparent mass from the mass in air to get the upthrust in grams.' },
    { title: 'Calculate density', detail: 'Relative density = mass in air ÷ upthrust. Compare with tabulated densities to identify the metal.' },
  ],
  table: {
    columns: [
      { id: 'sample', label: 'Sample', kind: 'text', width: 'md' },
      { id: 'massAir', label: 'Mass in air', unit: 'g', decimals: 1, kind: 'number' },
      { id: 'massWater', label: 'Mass in water', unit: 'g', decimals: 1, kind: 'number' },
      { id: 'upthrust', label: 'Upthrust', unit: 'g', decimals: 1, kind: 'number' },
    ],
    minRows: 3,
    addRows: false,
    keyColumn: 'sample',
    instructions: 'Use the three labelled samples. Upthrust = mass in air − mass in water.',
    presets: (s) => s.samples.map((sample) => ({ sample: sample.name })),
  },
  calculations: [
    {
      id: 'rd',
      label: 'Relative density of the first sample',
      unit: '',
      max: 3,
      tolerancePercent: 5,
      expected: (s) => s.samples[0]?.densityGcm3 ?? 0,
      help: 'RD = mass in air ÷ upthrust. It has no unit.',
      formula: 'RD = m / upthrust',
    },
    {
      id: 'density1',
      label: 'Density of the first sample',
      unit: 'g/cm³',
      max: 2,
      tolerancePercent: 5,
      expected: (s) => s.samples[0]?.densityGcm3 ?? 0,
      help: 'For a body denser than water, density in g/cm³ equals the relative density.',
    },
    {
      id: 'density2',
      label: 'Density of the second sample',
      unit: 'g/cm³',
      max: 3,
      tolerancePercent: 5,
      expected: (s) => s.samples[1]?.densityGcm3 ?? 0,
      help: 'Repeat the same reduction for the second sample.',
    },
  ],
  coachTip: 'The upthrust is a loss of weight, not a new reading. Keep the sample clear of the beaker walls.',
  generate: (seed) => {
    const rng = createRng(seed);
    const catalogue = [
      { material: 'aluminium', densityGcm3: 2.7 },
      { material: 'iron', densityGcm3: 7.9 },
      { material: 'copper', densityGcm3: 8.9 },
      { material: 'lead', densityGcm3: 11.3 },
      { material: 'zinc', densityGcm3: 7.1 },
    ];
    const chosen = rng.shuffle(catalogue).slice(0, 3);
    const samples = chosen.map((entry, index) => ({
      name: `Sample ${String.fromCharCode(65 + index)}`,
      massG: Math.round(rng.float(45, 120) * 10) / 10,
      densityGcm3: Math.round((entry.densityGcm3 + rng.float(-0.06, 0.06)) * 100) / 100,
      material: entry.material,
    }));
    return { samples };
  },
};

// ---------------------------------------------------------------------------
// PHY-05 — Concurrent forces
// ---------------------------------------------------------------------------

export interface ForcesScenario {
  configurations: { f1: number; f2: number; angleDeg: number }[];
}

export const forcesExperiment: ExperimentDefinition<ForcesScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      forcesExperiment,
      {
        expectedKeys: () => scenario.configurations.map((c) => String(c.angleDeg)),
        values: () => ({
          f1: scenario.configurations.map((c) => c.f1),
          f2: scenario.configurations.map((c) => c.f2),
          resultant: scenario.configurations.map(
            (c) => resultant([
              { magnitudeN: c.f1, angleDeg: 0 },
              { magnitudeN: c.f2, angleDeg: c.angleDeg },
            ]).magnitudeN,
          ),
        }),
        compareColumns: ['f1', 'f2', 'resultant'],
        tolerancePercent: 4,
        decimals: { f1: 1, f2: 1, resultant: 1 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'equilibrium',
            label: 'Found the equilibrant direction',
            max: 2,
            flag: 'equilibrant-found',
            feedbackPass: 'The ring sat at the centre with the third string opposing the resultant.',
            feedbackFail: 'Adjust the third spring balance until the ring is centred, then read its direction.',
          },
          {
            id: 'angles',
            label: 'Measured angles from a fixed direction',
            max: 1,
            flag: 'angles-measured',
            feedbackPass: 'Angles referenced to the same axis.',
            feedbackFail: 'Measure every angle from the same reference mark, not between arbitrary strings.',
          },
        ],
        conclusion: {
          keywords: ['resultant', 'equilibrant', 'opposite', 'equal'],
          phrase: 'the equilibrant is equal and opposite to the resultant',
          max: 3,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-05',
    slug: 'phy-05-concurrent-forces',
    title: 'Concurrent forces: resultant and equilibrant',
    subject: 'PHYSICS',
    priority: 'P2',
    examBodies: ['WAEC', 'NECO'],
    summary: 'Use a force board with three spring balances to find the resultant of two forces and its equilibrant.',
    durationMin: 20,
    apparatus: ['Force board', 'Three spring balances', 'Pulley', 'Protractor', 'Ring and strings'],
    skills: ['Vector addition', 'Resolving forces', 'Angle measurement', 'Equilibrium'],
    objective: 'Verify the parallelogram law of forces and find the equilibrant experimentally.',
    curriculum: 'SS2 mechanics: composition and resolution of vectors.',
  },
  scene: 'forces',
  theory: [
    {
      heading: 'Resultant of two forces',
      body: 'Two forces acting at a point can be replaced by a single resultant. Its magnitude follows the cosine rule, and its direction from the tangent of the components.',
      formula: 'R² = F₁² + F₂² + 2F₁F₂cosθ',
    },
    {
      heading: 'Equilibrant',
      body: 'The equilibrant is the force that balances the resultant: equal in magnitude, opposite in direction.',
    },
    {
      heading: 'Components',
      body: 'Resolve each force into horizontal and vertical components, then add components in each direction.',
      formula: 'R = √(ΣFx² + ΣFy²)',
    },
  ],
  procedure: [
    { title: 'Set two forces', detail: 'Hook two spring balances to the ring at the angles supplied and note their readings.' },
    { title: 'Balance with a third', detail: 'Pull with the third balance until the ring sits at the centre mark.' },
    { title: 'Read the equilibrant', detail: 'Record the third balance reading and its angle from the reference direction.' },
    { title: 'Repeat and calculate', detail: 'Repeat for each angle supplied, then compute the resultant using components.' },
  ],
  table: {
    columns: [
      { id: 'angle', label: 'Angle between F₁ and F₂', unit: '°', decimals: 0, kind: 'number' },
      { id: 'f1', label: 'F₁', unit: 'N', decimals: 1, kind: 'number' },
      { id: 'f2', label: 'F₂', unit: 'N', decimals: 1, kind: 'number' },
      { id: 'resultant', label: 'Equilibrant / resultant', unit: 'N', decimals: 1, kind: 'number' },
    ],
    minRows: 3,
    addRows: false,
    keyColumn: 'angle',
    instructions: 'Use the three angle settings. The equilibrant has the same magnitude as the resultant.',
    presets: (s) => s.configurations.map((c) => ({ angle: String(c.angleDeg) })),
  },
  calculations: [
    {
      id: 'resultant1',
      label: 'Resultant magnitude for the first configuration',
      unit: 'N',
      max: 3,
      tolerancePercent: 5,
      expected: (s) => {
        const first = s.configurations[0];
        if (!first) return 0;
        return resultant([
          { magnitudeN: first.f1, angleDeg: 0 },
          { magnitudeN: first.f2, angleDeg: first.angleDeg },
        ]).magnitudeN;
      },
      help: 'Resolve both forces into components, add them and find the magnitude.',
      formula: 'R² = F₁² + F₂² + 2F₁F₂cosθ',
    },
    {
      id: 'angle1',
      label: 'Direction of the resultant for the first configuration',
      unit: '°',
      max: 3,
      tolerancePercent: 8,
      expected: (s) => {
        const first = s.configurations[0];
        if (!first) return 0;
        return resultant([
          { magnitudeN: first.f1, angleDeg: 0 },
          { magnitudeN: first.f2, angleDeg: first.angleDeg },
        ]).angleDeg;
      },
      help: 'θ = tan⁻¹(Fᵧ / Fₓ) measured anticlockwise from F₁.',
      formula: 'θ = tan⁻¹(ΣFy / ΣFx)',
    },
    {
      id: 'equilibrant1',
      label: 'Direction of the equilibrant for the first configuration',
      unit: '°',
      max: 2,
      tolerancePercent: 8,
      expected: (s) => {
        const first = s.configurations[0];
        if (!first) return 0;
        return (
          (resultant([
            { magnitudeN: first.f1, angleDeg: 0 },
            { magnitudeN: first.f2, angleDeg: first.angleDeg },
          ]).angleDeg +
            180) %
          360
        );
      },
      help: 'Add 180° to the resultant direction.',
    },
  ],
  coachTip: 'Check that the ring is centred before reading the balances. Friction in the pulleys is a systematic error.',
  generate: (seed) => {
    const rng = createRng(seed);
    return {
      configurations: [90, 120, 60].map((angleDeg) => ({
        f1: Math.round(rng.float(2, 9) * 10) / 10,
        f2: Math.round(rng.float(2, 9) * 10) / 10,
        angleDeg,
      })),
    };
  },
};

// ---------------------------------------------------------------------------
// PHY-06 — Inclined plane and friction
// ---------------------------------------------------------------------------

export interface InclineScenario {
  surfaces: { name: string; mu: number }[];
}

export const inclineExperiment: ExperimentDefinition<InclineScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      inclineExperiment,
      {
        expectedKeys: () => scenario.surfaces.map((s) => s.name),
        values: () => ({
          angle: scenario.surfaces.map((s) => limitingAngleDeg(s.mu)),
          coefficient: scenario.surfaces.map((s) => s.mu),
        }),
        compareColumns: ['angle', 'coefficient'],
        tolerancePercent: 4,
        decimals: { angle: 0, coefficient: 2 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'limiting',
            label: 'Found the angle of limiting friction',
            max: 2,
            flag: 'limiting-found',
            feedbackPass: 'The block was just about to slide when the angle was recorded.',
            feedbackFail: 'Increase the angle slowly and stop at the instant the block begins to slide.',
          },
          {
            id: 'repeat',
            label: 'Repeated on all three surfaces',
            max: 2,
            check: (a) => new Set(a.rows.map((r) => (r.surface ?? '').trim()).filter(Boolean)).size >= 3,
            feedbackPass: 'Compared three surfaces for a better conclusion.',
            feedbackFail: 'Test all three surfaces so you can compare the coefficients.',
          },
        ],
        conclusion: {
          keywords: ['friction', 'coefficient', 'tan', 'surface'],
          phrase: 'μ = tan θ at the angle of limiting friction',
          max: 2,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-06',
    slug: 'phy-06-inclined-plane-friction',
    title: 'Inclined plane: coefficient of friction',
    subject: 'PHYSICS',
    priority: 'P2',
    examBodies: ['NECO', 'WAEC'],
    summary: 'Raise an inclined plane until a block just slides and use μ = tan θ to compare three surfaces.',
    durationMin: 15,
    apparatus: ['Inclined plane with protractor', 'Wooden block', 'Slotted masses', 'Surfaces (wood, glass, sandpaper)'],
    skills: ['Limiting friction', 'Resolving weight', 'Angle measurement', 'Comparing surfaces'],
    objective: 'Determine the coefficient of static friction between a block and different surfaces.',
    curriculum: 'SS2 mechanics: friction and equilibrium on an inclined plane.',
  },
  scene: 'incline',
  theory: [
    {
      heading: 'Limiting friction',
      body: 'At the angle where the block is just about to slide, the component of weight down the plane equals the limiting friction up the plane.',
      formula: 'mg sinθ = μ mg cosθ  ⇒  μ = tanθ',
    },
    {
      heading: 'Independent of mass',
      body: 'Because mass cancels, adding load to the block should not change the critical angle. A mass-independent check is a good conclusion.',
    },
    {
      heading: 'Static vs kinetic',
      body: 'The angle at which motion starts gives static friction. Once sliding, the coefficient falls and acceleration increases.',
    },
  ],
  procedure: [
    { title: 'Set the block', detail: 'Place the block on the first surface with its largest face in contact.' },
    { title: 'Raise slowly', detail: 'Increase the incline angle a degree at a time until the block is just about to slide.' },
    { title: 'Record the angle', detail: 'Record the critical angle and compute μ = tan θ.' },
    { title: 'Repeat per surface', detail: 'Repeat for glass and sandpaper. Compare the coefficients in your conclusion.' },
  ],
  table: {
    columns: [
      { id: 'surface', label: 'Surface', kind: 'text', width: 'md' },
      { id: 'angle', label: 'Angle of limiting friction', unit: '°', decimals: 0, kind: 'number' },
      { id: 'coefficient', label: 'μ = tan θ', decimals: 2, kind: 'number' },
    ],
    minRows: 3,
    addRows: false,
    keyColumn: 'surface',
    instructions: 'Test the three labelled surfaces. Record the angle at which the block just begins to slide.',
    presets: (s) => s.surfaces.map((surface) => ({ surface: surface.name })),
  },
  calculations: [
    {
      id: 'mu1',
      label: 'Coefficient of friction for the first surface',
      unit: '',
      max: 4,
      tolerancePercent: 6,
      expected: (s) => s.surfaces[0]?.mu ?? 0,
      help: 'μ = tan(angle). Use the recorded angle, not the preset value.',
      formula: 'μ = tan θ',
    },
    {
      id: 'meanMu',
      label: 'Mean coefficient of friction across the surfaces',
      unit: '',
      max: 4,
      tolerancePercent: 6,
      expected: (s) => s.surfaces.reduce((sum, x) => sum + x.mu, 0) / s.surfaces.length,
      help: 'Add the three coefficients and divide by three. Do not convert to angle.',
    },
  ],
  coachTip: 'Tap the plane gently while raising it — it exposes the true point of limiting friction.',
  generate: (seed) => {
    const rng = createRng(seed);
    return {
      surfaces: [
        { name: 'Wood', mu: Math.round(rng.float(0.2, 0.42) * 100) / 100 },
        { name: 'Glass', mu: Math.round(rng.float(0.12, 0.3) * 100) / 100 },
        { name: 'Sandpaper', mu: Math.round(rng.float(0.45, 0.72) * 100) / 100 },
      ],
    };
  },
};

// ---------------------------------------------------------------------------
// PHY-07 — Vernier callipers and micrometer
// ---------------------------------------------------------------------------

export interface MeasureItem {
  id: string;
  label: string;
  instrument: 'vernier' | 'micrometer';
  trueValue: number;
  unit: 'cm' | 'mm';
  zeroError: number;
}

export interface MeasureScenario {
  items: MeasureItem[];
}

export const measureExperiment: ExperimentDefinition<MeasureScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      measureExperiment,
      {
        expectedKeys: () => scenario.items.map((i) => i.label),
        values: () => ({
          reading: scenario.items.map((i) => Number((i.trueValue + i.zeroError).toFixed(2))),
          corrected: scenario.items.map((i) => i.trueValue),
        }),
        compareColumns: ['reading', 'corrected'],
        tolerancePercent: 1.2,
        decimals: { reading: 2, corrected: 2 },
        tableMarks: { recorded: 3, accurate: 4, precision: 1 },
        procedure: [
          {
            id: 'zero-check',
            label: 'Checked the zero error of each instrument',
            max: 2,
            flag: 'zero-checked',
            feedbackPass: 'Zero errors were identified before measuring.',
            feedbackFail: 'Close the jaws/faces fully and note where the zero of the vernier or thimble sits.',
          },
          {
            id: 'correct-instrument',
            label: 'Used the right instrument for each object',
            max: 2,
            flag: 'instrument-matched',
            feedbackPass: 'Vernier for the cylinder, micrometer for the wire.',
            feedbackFail: 'Use the micrometer for thin wire and the vernier for the cylinder.',
          },
        ],
        conclusion: {
          keywords: ['zero error', 'corrected', 'vernier', 'micrometer'],
          phrase: 'true value = observed reading − zero error',
          max: 2,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-07',
    slug: 'phy-07-vernier-micrometer',
    title: 'Vernier callipers and micrometer gauge',
    subject: 'PHYSICS',
    priority: 'P0',
    examBodies: ['WAEC', 'NECO', 'JAMB'],
    summary: 'Read the vernier and micrometer scales, detect their zero errors, and record corrected dimensions.',
    durationMin: 12,
    apparatus: ['Vernier callipers', 'Micrometer screw gauge', 'Metal cylinder', 'Copper wire', 'Glass slide'],
    skills: ['Reading vernier scales', 'Reading thimble scales', 'Zero-error correction', 'Decimal places'],
    objective: 'Read both instruments to their least count and correct for zero error every time.',
    curriculum: 'SS1 measurement: measuring instruments, least count and zero error.',
  },
  scene: 'measure',
  theory: [
    {
      heading: 'Vernier least count',
      body: 'The vernier has 10 divisions spanning 9 main-scale divisions, so the least count is 0.1 mm ÷ 10 = 0.01 cm.',
      formula: 'least count = 1 main division − 1 vernier division = 0.01 cm',
    },
    {
      heading: 'Micrometer least count',
      body: 'The thimble has 50 divisions for one 0.5 mm sleeve step, so each division is 0.01 mm.',
      formula: 'reading = sleeve + (thimble division × 0.01) mm',
    },
    {
      heading: 'Zero error',
      body: 'Close the instrument fully. If the vernier zero is to the right of the main zero the error is positive and must be subtracted; if to the left it is negative and is added.',
      formula: 'true = observed − zero error',
    },
  ],
  procedure: [
    { title: 'Find the zero error', detail: 'Close the jaws/faces fully and record where the zero marks line up.' },
    { title: 'Measure the cylinder', detail: 'Grip the cylinder with the vernier callipers and read main scale + vernier coincidence.' },
    { title: 'Measure the wire', detail: 'Use the micrometer on the copper wire, reading the sleeve and thimble.' },
    { title: 'Correct and record', detail: 'Subtract each zero error and record the corrected value to 2 decimal places.' },
  ],
  table: {
    columns: [
      { id: 'object', label: 'Object', kind: 'text', width: 'md' },
      { id: 'reading', label: 'Observed reading', decimals: 2, kind: 'number' },
      { id: 'corrected', label: 'Corrected reading', decimals: 2, kind: 'number' },
    ],
    minRows: 3,
    addRows: false,
    keyColumn: 'object',
    instructions: 'Use the units printed beside each object. Enter the observed reading first, then apply the zero error.',
    presets: (s) => s.items.map((item) => ({ object: item.label })),
  },
  calculations: [
    {
      id: 'wire',
      label: 'Corrected diameter of the copper wire',
      unit: 'mm',
      max: 3,
      tolerancePercent: 0.6,
      expected: (s) => s.items.find((i) => i.label.includes('wire'))?.trueValue ?? 0,
      help: 'Subtract the micrometer zero error from the observed reading.',
    },
    {
      id: 'cylinder',
      label: 'Corrected diameter of the cylinder',
      unit: 'cm',
      max: 3,
      tolerancePercent: 0.6,
      expected: (s) => s.items.find((i) => i.label.includes('cylinder'))?.trueValue ?? 0,
      help: 'Subtract the calliper zero error from the observed reading.',
    },
  ],
  coachTip: 'Read the main scale first, then count which vernier line coincides. Always check the zero before and after.',
  generate: (seed) => {
    const rng = createRng(seed);
    return {
      items: [
        {
          id: 'wire',
          label: 'Copper wire (mm)',
          instrument: 'micrometer',
          trueValue: Math.round(rng.float(0.36, 0.82) * 100) / 100,
          unit: 'mm',
          zeroError: Math.round(rng.float(-0.03, 0.03) * 100) / 100,
        },
        {
          id: 'cylinder',
          label: 'Metal cylinder (cm)',
          instrument: 'vernier',
          trueValue: Math.round(rng.float(1.2, 3.4) * 100) / 100,
          unit: 'cm',
          zeroError: Math.round(rng.float(-0.04, 0.04) * 100) / 100,
        },
        {
          id: 'slide',
          label: 'Glass slide (mm)',
          instrument: 'micrometer',
          trueValue: Math.round(rng.float(0.9, 1.6) * 100) / 100,
          unit: 'mm',
          zeroError: 0,
        },
      ],
    };
  },
};

export const mechanicsExperiments: ExperimentDefinition<any>[] = [
  pendulumExperiment,
  springExperiment,
  momentsExperiment,
  densityExperiment,
  forcesExperiment,
  inclineExperiment,
  measureExperiment,
];
