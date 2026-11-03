import { createRng } from '@sim/rng';
import type { ExperimentDefinition } from './types';
import { scoreQuantitative } from './scoring';

const fx = (value: number, decimals = 1): string => value.toFixed(decimals);

// ---------------------------------------------------------------------------
// PHY-11 — Ohm's law
// ---------------------------------------------------------------------------

export interface OhmsLawScenario {
  resistanceOhm: number;
  cellEmfV: number;
  internalOhm: number;
  currentsA: number[];
}

export const ohmsLawExperiment: ExperimentDefinition<OhmsLawScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      ohmsLawExperiment,
      {
        expectedKeys: () => scenario.currentsA.map((i) => fx(i, 2)),
        values: () => ({
          current: scenario.currentsA,
          voltage: scenario.currentsA.map((i) => i * scenario.resistanceOhm),
        }),
        compareColumns: ['current', 'voltage'],
        tolerancePercent: 4,
        decimals: { current: 2, voltage: 2 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'series',
            label: 'Ammeter connected in series',
            max: 1,
            flag: 'ammeter-series',
            feedbackPass: 'The ammeter is in series with the resistor.',
            feedbackFail: 'An ammeter goes in series; a voltmeter goes in parallel with the resistor.',
          },
          {
            id: 'voltmeter',
            label: 'Voltmeter connected across the resistor',
            max: 1,
            flag: 'voltmeter-parallel',
            feedbackPass: 'The voltmeter is across the resistor only.',
            feedbackFail: 'Connect the voltmeter in parallel with the resistor under test.',
          },
          {
            id: 'rheostat',
            label: 'Used the rheostat to vary current',
            max: 1,
            flag: 'rheostat-used',
            feedbackPass: 'Current was varied over a useful range.',
            feedbackFail: 'Vary the rheostat so the readings span a wide range.',
          },
        ],
        conclusion: {
          keywords: ['ohm', 'proportional', 'resistance', 'gradient'],
          phrase: `V is proportional to I with gradient R ≈ ${scenario.resistanceOhm.toFixed(1)} Ω`,
          max: 2,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-11',
    slug: 'phy-11-ohms-law',
    title: "Ohm's law: resistance of a wire",
    subject: 'PHYSICS',
    priority: 'P0',
    examBodies: ['WAEC', 'NECO', 'JAMB'],
    summary: 'Vary current with a rheostat, read ammeter and voltmeter, plot V against I and find the resistance.',
    durationMin: 20,
    apparatus: ['Cell / power supply', 'Rheostat', 'Ammeter', 'Voltmeter', 'Resistance wire', 'Connecting leads'],
    skills: ['Circuit assembly', 'Meter reading', 'V–I graph', 'Resistance calculations'],
    objective: 'Verify Ohm’s law and determine the resistance of a wire from the gradient of a V–I graph.',
    curriculum: 'SS2 electricity: Ohm’s law, series circuits and resistance.',
  },
  scene: 'circuit',
  theory: [
    {
      heading: "Ohm's law",
      body: 'For a metallic conductor at constant temperature, the current is proportional to the potential difference across it. The constant ratio is the resistance.',
      formula: 'V = IR',
    },
    {
      heading: 'The V–I graph',
      body: 'Plotting V against I gives a straight line through the origin. The gradient is the resistance; a curve would indicate a non-ohmic component or heating.',
      formula: 'R = gradient = ΔV / ΔI',
    },
    {
      heading: 'Meter placement',
      body: 'The ammeter is connected in series so the same current flows through it. The voltmeter is connected in parallel across the component.',
    },
  ],
  procedure: [
    { title: 'Build the circuit', detail: 'Connect the cell, rheostat, ammeter and wire in series; connect the voltmeter across the wire.' },
    { title: 'Start with maximum resistance', detail: 'Set the rheostat to its maximum before switching on.' },
    { title: 'Take readings', detail: 'Adjust the rheostat to each current supplied and record the ammeter and voltmeter readings.' },
    { title: 'Plot and calculate', detail: 'Plot V against I, draw the best-fit line and find the gradient in ohms.' },
  ],
  table: {
    columns: [
      { id: 'current', label: 'Current I', unit: 'A', decimals: 2, kind: 'number' },
      { id: 'voltage', label: 'Potential difference V', unit: 'V', decimals: 2, kind: 'number' },
    ],
    minRows: 5,
    addRows: false,
    keyColumn: 'current',
    instructions: 'Set the rheostat to give each current listed on the bench, then record V.',
    presets: (s) => s.currentsA.map((i) => ({ current: fx(i, 2) })),
  },
  graph: {
    xColumn: 'current',
    yColumn: 'voltage',
    xLabel: 'Current I',
    yLabel: 'Potential difference V',
    xUnit: 'A',
    yUnit: 'V',
    prompt: 'Plot V (vertical) against I (horizontal) and use the gradient to find the resistance.',
    expectedGradient: (s) => s.resistanceOhm,
    tolerancePercent: 10,
    minimumPoints: 4,
  },
  calculations: [
    {
      id: 'resistance',
      fromGradient: true,
      label: 'Resistance of the wire',
      unit: 'Ω',
      max: 3,
      tolerancePercent: 8,
      expected: (s) => s.resistanceOhm,
      help: 'The gradient of your V–I graph is the resistance in ohms.',
      formula: 'R = gradient',
    },
    {
      id: 'power',
      label: 'Power dissipated when I = 0.20 A',
      unit: 'W',
      max: 1,
      tolerancePercent: 8,
      expected: (s) => 0.2 ** 2 * s.resistanceOhm,
      help: 'P = I²R using the resistance you found.',
      formula: 'P = I²R',
    },
  ],
  coachTip: 'Keep the wire cool. A hot filament or wire becomes non-ohmic and the graph curves.',
  generate: (seed) => {
    const rng = createRng(seed);
    return {
      resistanceOhm: Math.round(rng.float(6, 18) * 10) / 10,
      cellEmfV: 3,
      internalOhm: 0.4,
      currentsA: [0.06, 0.1, 0.14, 0.18, 0.22],
    };
  },
};

// ---------------------------------------------------------------------------
// PHY-12 — Metre bridge
// ---------------------------------------------------------------------------

export interface BridgeScenario {
  unknownOhm: number;
  boxValuesOhm: number[];
}

export const bridgeExperiment: ExperimentDefinition<BridgeScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      bridgeExperiment,
      {
        expectedKeys: () => scenario.boxValuesOhm.map((r) => fx(r, 1)),
        values: () => ({
          balance: scenario.boxValuesOhm.map((r) => (100 * scenario.unknownOhm) / (scenario.unknownOhm + r)),
        }),
        compareColumns: ['balance'],
        tolerancePercent: 4,
        decimals: { balance: 1 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'null',
            label: 'Found the null point on the galvanometer',
            max: 2,
            flag: 'null-found',
            feedbackPass: 'The galvanometer read zero at the balance point.',
            feedbackFail: 'Slide the jockey until the galvanometer deflection is zero; do not just minimise it.',
          },
          {
            id: 'tap',
            label: 'Tapped the jockey lightly',
            max: 1,
            flag: 'jockey-tapped',
            feedbackPass: 'Light tapping avoids scratching the wire and gives a stable point.',
            feedbackFail: 'Tap the jockey briefly rather than dragging it along the wire.',
          },
          {
            id: 'each-box',
            label: 'Used each resistance box value',
            max: 1,
            check: (a) => new Set(a.rows.map((r) => (r.box ?? '').trim()).filter(Boolean)).size >= 3,
            feedbackPass: 'Repeated with all three known resistances.',
            feedbackFail: 'Take readings for all three resistance box values.',
          },
        ],
        conclusion: {
          keywords: ['unknown', 'resistance', 'balance', 'wheatstone'],
          phrase: `R ≈ ${scenario.unknownOhm.toFixed(1)} Ω`,
          max: 2,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-12',
    slug: 'phy-12-metre-bridge',
    title: 'Metre bridge: unknown resistance',
    subject: 'PHYSICS',
    priority: 'P1',
    examBodies: ['WAEC', 'NECO'],
    summary: 'Balance a metre bridge at three known resistances and use the balance lengths to find an unknown resistance.',
    durationMin: 18,
    apparatus: ['Metre bridge', 'Resistance box', 'Galvanometer', 'Cell and key', 'Jockey'],
    skills: ['Bridge balancing', 'Null detection', 'Proportion calculations', 'Reducing systematic error'],
    objective: 'Determine an unknown resistance using the metre bridge and the Wheatstone principle.',
    curriculum: 'SS3 electricity: Wheatstone bridge and the metre bridge practical.',
  },
  scene: 'bridge',
  theory: [
    {
      heading: 'The Wheatstone bridge',
      body: 'A metre bridge compares an unknown resistance with a known one. At balance, the ratio of the resistances equals the ratio of the two wire lengths.',
      formula: 'R_unknown / R_box = ℓ / (100 − ℓ)',
    },
    {
      heading: 'Why three readings',
      body: 'Repeating with different known resistances and averaging reduces the effect of end corrections and contact resistance.',
      formula: 'R = mean[R_box · ℓ / (100 − ℓ)]',
    },
    {
      heading: 'End error',
      body: 'The wire does not start exactly at 0 cm and the bridge has end resistance. Interchanging the known and unknown resistances (not done here) cancels the error.',
    },
  ],
  procedure: [
    { title: 'Connect the bridge', detail: 'Insert the unknown resistance in the left gap and the resistance box in the right gap.' },
    { title: 'Find the null point', detail: 'Slide the jockey along the wire until the galvanometer deflection is zero.' },
    { title: 'Record the lengths', detail: 'Record ℓ (from the left) and (100 − ℓ) for each resistance box setting.' },
    { title: 'Calculate', detail: 'Compute R for each setting with R = R_box·ℓ/(100 − ℓ) and average.' },
  ],
  table: {
    columns: [
      { id: 'box', label: 'Resistance box R', unit: 'Ω', decimals: 1, kind: 'number' },
      { id: 'balance', label: 'Balance length ℓ', unit: 'cm', decimals: 1, kind: 'number' },
    ],
    minRows: 3,
    addRows: false,
    keyColumn: 'box',
    instructions: 'Use each of the three resistance box values. ℓ is measured from the left end next to the unknown.',
    presets: (s) => s.boxValuesOhm.map((r) => ({ box: fx(r, 1) })),
  },
  calculations: [
    {
      id: 'rFirst',
      label: 'Unknown resistance for your first balance',
      unit: 'Ω',
      max: 4,
      tolerancePercent: 6,
      expected: (s) => s.unknownOhm,
      help: 'R = R_box × ℓ / (100 − ℓ).',
      formula: 'R = R_box ℓ / (100 − ℓ)',
    },
    {
      id: 'rMean',
      label: 'Mean unknown resistance',
      unit: 'Ω',
      max: 4,
      tolerancePercent: 6,
      expected: (s) => s.unknownOhm,
      help: 'Average the three values you computed. They should agree closely.',
    },
  ],
  coachTip: 'If the null point is near an end, change the resistance box so ℓ sits between 30 cm and 70 cm.',
  generate: (seed) => {
    const rng = createRng(seed);
    return {
      unknownOhm: Math.round(rng.float(2.5, 8) * 10) / 10,
      boxValuesOhm: [2, 4, 6],
    };
  },
};

// ---------------------------------------------------------------------------
// PHY-13 — Potentiometer
// ---------------------------------------------------------------------------

export interface PotentiometerScenario {
  standardEmfV: number;
  standardLengthCm: number;
  unknownEmfV: number;
  externalOhm: number;
  internalOhm: number;
}

export const potentiometerExperiment: ExperimentDefinition<PotentiometerScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      potentiometerExperiment,
      {
        expectedKeys: () => ['Standard cell', 'Unknown cell (open circuit)', 'Unknown cell with resistor'],
        values: () => {
          const openLength = (scenario.unknownEmfV / scenario.standardEmfV) * scenario.standardLengthCm;
          const terminalV =
            scenario.unknownEmfV * (scenario.externalOhm / (scenario.externalOhm + scenario.internalOhm));
          return {
            length: [
              scenario.standardLengthCm,
              openLength,
              (terminalV / scenario.standardEmfV) * scenario.standardLengthCm,
            ],
            pd: [scenario.standardEmfV, scenario.unknownEmfV, terminalV],
          };
        },
        compareColumns: ['length'],
        tolerancePercent: 3,
        decimals: { length: 1 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'calibrated',
            label: 'Calibrated with the standard cell first',
            max: 2,
            flag: 'calibrated',
            feedbackPass: 'The potentiometer was standardised before measuring the unknown.',
            feedbackFail: 'Always set the standard cell balance length before replacing it with the unknown.',
          },
          {
            id: 'null',
            label: 'Found a true null deflection',
            max: 2,
            flag: 'null-found',
            feedbackPass: 'Balance was taken at zero galvanometer deflection.',
            feedbackFail: 'Move the jockey until the galvanometer reads exactly zero.',
          },
        ],
        conclusion: {
          keywords: ['emf', 'balance length', 'internal resistance', 'potentiometer'],
          phrase: `E ≈ ${scenario.unknownEmfV.toFixed(2)} V with r ≈ ${scenario.internalOhm.toFixed(2)} Ω`,
          max: 2,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-13',
    slug: 'phy-13-potentiometer',
    title: 'Potentiometer: e.m.f. and internal resistance',
    subject: 'PHYSICS',
    priority: 'P1',
    examBodies: ['NECO', 'WAEC'],
    summary: 'Standardise a potentiometer, measure an unknown e.m.f. and use a load resistor to find internal resistance.',
    durationMin: 20,
    apparatus: ['Potentiometer wire', 'Standard cell', 'Unknown cell', 'Galvanometer', 'Jockey', 'Resistor'],
    skills: ['Calibration', 'Null method', 'E.m.f. comparison', 'Internal resistance'],
    objective: 'Measure an e.m.f. without drawing current and determine the internal resistance of a cell.',
    curriculum: 'SS3 electricity: potentiometer, e.m.f. and internal resistance.',
  },
  scene: 'bridge',
  theory: [
    {
      heading: 'Potential gradient',
      body: 'A steady current in a uniform wire gives a constant potential drop per centimetre. Balance lengths are therefore proportional to e.m.f.',
      formula: 'E₁ / E₀ = ℓ₁ / ℓ₀',
    },
    {
      heading: 'Null method',
      body: 'At balance no current is drawn from the test cell, so the reading is its true e.m.f. rather than its terminal p.d.',
    },
    {
      heading: 'Internal resistance',
      body: 'With a known resistor across the cell the terminal p.d. falls. Comparing the two balance lengths gives r.',
      formula: 'r = R(E − V) / V',
    },
  ],
  procedure: [
    { title: 'Standardise', detail: 'Connect the standard cell and find the balance length ℓ₀.' },
    { title: 'Measure the unknown', detail: 'Replace the standard cell with the unknown cell and record its balance length ℓ₁ at zero deflection.' },
    { title: 'Add the load', detail: 'Connect the 10 Ω resistor across the unknown cell and record the new balance length.' },
    { title: 'Calculate', detail: 'Use E₁/E₀ = ℓ₁/ℓ₀ for the e.m.f., then r = R(E − V)/V.' },
  ],
  table: {
    columns: [
      { id: 'cell', label: 'Connection', kind: 'text', width: 'lg' },
      { id: 'length', label: 'Balance length', unit: 'cm', decimals: 1, kind: 'number' },
    ],
    minRows: 3,
    addRows: false,
    keyColumn: 'cell',
    instructions: 'Use the three listed connections in order. Record the balance length at zero galvanometer deflection.',
    presets: () => [
      { cell: 'Standard cell' },
      { cell: 'Unknown cell (open circuit)' },
      { cell: 'Unknown cell with resistor' },
    ],
  },
  calculations: [
    {
      id: 'emf',
      label: 'E.m.f. of the unknown cell',
      unit: 'V',
      max: 4,
      tolerancePercent: 3,
      expected: (s) => s.unknownEmfV,
      help: 'E₁ = E₀ × ℓ₁/ℓ₀ using the open-circuit balance length.',
      formula: 'E₁ = E₀ ℓ₁ / ℓ₀',
    },
    {
      id: 'internal',
      label: 'Internal resistance of the unknown cell',
      unit: 'Ω',
      max: 4,
      tolerancePercent: 8,
      expected: (s) => s.internalOhm,
      help: 'First find V from the loaded balance length, then r = R(E − V)/V.',
      formula: 'r = R(E − V) / V',
    },
  ],
  coachTip: 'Use the open-circuit balance for the e.m.f. The loaded reading gives the terminal p.d., not the e.m.f.',
  generate: (seed) => {
    const rng = createRng(seed);
    return {
      standardEmfV: 1.018,
      standardLengthCm: Math.round(rng.float(42, 58) * 10) / 10,
      unknownEmfV: Math.round(rng.float(1.2, 1.6) * 100) / 100,
      externalOhm: 10,
      internalOhm: Math.round(rng.float(0.4, 1.8) * 100) / 100,
    };
  },
};

export const electricityExperiments: ExperimentDefinition<any>[] = [
  ohmsLawExperiment,
  bridgeExperiment,
  potentiometerExperiment,
];
