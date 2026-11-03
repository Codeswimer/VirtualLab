import { createRng } from '@sim/rng';
import {
  coolingTemperature,
  mixtureEquilibriumTemp,
  WATER_SPECIFIC_HEAT,
} from '@sim/physics/thermal';
import type { ExperimentDefinition } from './types';
import { scoreQuantitative } from './scoring';

// ---------------------------------------------------------------------------
// PHY-14 — Specific heat capacity by mixtures
// ---------------------------------------------------------------------------

export interface HeatScenario {
  metal: string;
  specificHeat: number;
  massMetalG: number;
  massWaterG: number;
  waterInitialC: number;
  metalInitialC: number;
  finalTempC: number;
  calorimeterCapacityJK: number;
}

export const heatExperiment: ExperimentDefinition<HeatScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      heatExperiment,
      {
        expectedKeys: () => ['1'],
        values: () => ({ final: [scenario.finalTempC] }),
        compareColumns: ['final'],
        tolerancePercent: 2,
        decimals: { final: 1 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'stirred',
            label: 'Stirred and read the highest steady temperature',
            max: 2,
            flag: 'stirred',
            feedbackPass: 'The mixture was stirred and the steady maximum temperature recorded.',
            feedbackFail: 'Stir gently and record the highest steady temperature, not the first reading.',
          },
          {
            id: 'transferred',
            label: 'Transferred the hot metal quickly',
            max: 2,
            flag: 'quick-transfer',
            feedbackPass: 'The metal reached the water before significant heat was lost.',
            feedbackFail: 'Move the metal from the boiling water to the calorimeter quickly to limit heat loss.',
          },
        ],
        conclusion: {
          keywords: ['specific heat', 'metal', 'j/g', 'temperature'],
          phrase: `c ≈ ${scenario.specificHeat.toFixed(2)} J g⁻¹ K⁻¹`,
          max: 2,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-14',
    slug: 'phy-14-specific-heat-capacity',
    title: 'Specific heat capacity by mixtures',
    subject: 'PHYSICS',
    priority: 'P1',
    examBodies: ['WAEC', 'NECO'],
    summary: 'Heat a metal in boiling water, transfer it to a calorimeter and use the temperature rise to find its specific heat.',
    durationMin: 20,
    apparatus: ['Calorimeter', 'Thermometer', 'Beaker of boiling water', 'Metal specimen', 'Balance'],
    skills: ['Method of mixtures', 'Heat balance', 'Temperature measurement', 'Heat-loss awareness'],
    objective: 'Determine the specific heat capacity of a metal using the method of mixtures.',
    curriculum: 'SS2 thermal physics: heat capacity, specific heat capacity and mixtures.',
  },
  scene: 'thermal',
  theory: [
    {
      heading: 'Energy balance',
      body: 'Heat lost by the hot metal equals heat gained by the water and calorimeter, provided losses to the surroundings are small.',
      formula: 'mₘcₘ(Tₘ − T_f) = (m_w c_w + C)(T_f − T_w)',
    },
    {
      heading: 'The unknown',
      body: 'Rearranging gives the specific heat of the metal. The calorimeter’s own heat capacity must be included or the result is systematically low.',
      formula: 'cₘ = (m_w c_w + C)(T_f − T_w) / [mₘ(Tₘ − T_f)]',
    },
    {
      heading: 'Reducing heat loss',
      body: 'Use a lid, transfer the metal quickly and work close to room temperature. Take the highest steady temperature after stirring.',
    },
  ],
  procedure: [
    { title: 'Weigh and heat', detail: 'Weigh the metal, then heat it in boiling water until it reaches a steady temperature.' },
    { title: 'Prepare the water', detail: 'Measure the mass of cold water and record its initial temperature.' },
    { title: 'Transfer', detail: 'Move the hot metal quickly into the calorimeter, stir gently and record the highest steady temperature.' },
    { title: 'Calculate', detail: 'Use the energy balance to find the specific heat capacity of the metal, in J g⁻¹ K⁻¹.' },
  ],
  table: {
    columns: [
      { id: 'trial', label: 'Trial', kind: 'text', width: 'sm' },
      { id: 'massWater', label: 'Mass of water', unit: 'g', decimals: 1, kind: 'number' },
      { id: 'waterTemp', label: 'Initial water temp.', unit: '°C', decimals: 1, kind: 'number' },
      { id: 'final', label: 'Final temperature', unit: '°C', decimals: 1, kind: 'number' },
      { id: 'massMetal', label: 'Mass of metal', unit: 'g', decimals: 1, kind: 'number' },
    ],
    minRows: 1,
    addRows: false,
    keyColumn: 'trial',
    instructions: 'One mixing run. Use the balance and thermometer readings shown on the bench.',
    presets: () => [{ trial: '1' }],
  },
  calculations: [
    {
      id: 'heatWater',
      label: 'Heat gained by the water',
      unit: 'J',
      max: 2,
      tolerancePercent: 5,
      expected: (s) => s.massWaterG * WATER_SPECIFIC_HEAT * (s.finalTempC - s.waterInitialC),
      help: 'Q = mcΔθ with c = 4.2 J g⁻¹ K⁻¹ for water.',
      formula: 'Q = m_w c_w (T_f − T_w)',
    },
    {
      id: 'specificHeat',
      label: 'Specific heat capacity of the metal',
      unit: 'J g⁻¹ K⁻¹',
      max: 6,
      tolerancePercent: 10,
      expected: (s) => s.specificHeat,
      help: 'The metal lost the heat the water gained. Divide by mₘ(Tₘ − T_f).',
      formula: 'cₘ = Q / [mₘ(Tₘ − T_f)]',
    },
  ],
  coachTip: 'Record the highest steady thermometer reading after stirring. The first reading is always a little low.',
  generate: (seed) => {
    const rng = createRng(seed);
    const metals = [
      { metal: 'aluminium', c: 0.9 },
      { metal: 'iron', c: 0.46 },
      { metal: 'copper', c: 0.39 },
      { metal: 'lead', c: 0.13 },
      { metal: 'zinc', c: 0.39 },
    ];
    const chosen = rng.pick(metals);
    const massMetalG = Math.round(rng.float(100, 200));
    const massWaterG = Math.round(rng.float(100, 160));
    const waterInitialC = Math.round(rng.float(24, 29) * 2) / 2;
    const metalInitialC = Math.round(rng.float(96, 100) * 2) / 2;
    const idealFinal = mixtureEquilibriumTemp(
      massWaterG,
      waterInitialC,
      massMetalG,
      metalInitialC,
      chosen.c,
    );
    const loss = rng.float(0.02, 0.05);
    const finalTempC = idealFinal - (idealFinal - waterInitialC) * loss;
    return {
      metal: chosen.metal,
      specificHeat: chosen.c,
      massMetalG,
      massWaterG,
      waterInitialC,
      metalInitialC,
      finalTempC: Math.round(finalTempC * 2) / 2,
      calorimeterCapacityJK: 0,
    };
  },
};

// ---------------------------------------------------------------------------
// PHY-15 — Newton's law of cooling
// ---------------------------------------------------------------------------

export interface CoolingScenario {
  initialTempC: number;
  roomTempC: number;
  kPerMinute: number;
  timesMin: number[];
}

export const coolingExperiment: ExperimentDefinition<CoolingScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      coolingExperiment,
      {
        expectedKeys: () => scenario.timesMin.map((t) => String(t)),
        values: () => {
          const temps = scenario.timesMin.map((t) =>
            coolingTemperature(scenario.initialTempC, scenario.roomTempC, scenario.kPerMinute, t),
          );
          return {
            temp: temps,
            lnTheta: temps.map((temp) => Math.log(temp - scenario.roomTempC)),
          };
        },
        compareColumns: ['temp', 'lnTheta'],
        tolerancePercent: 2,
        decimals: { temp: 1, lnTheta: 3 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'steady-room',
            label: 'Recorded the room temperature',
            max: 1,
            flag: 'room-recorded',
            feedbackPass: 'Room temperature is needed before taking logarithms.',
            feedbackFail: 'Record the room temperature at the start; every log uses it.',
          },
          {
            id: 'timed',
            label: 'Timed readings at regular intervals',
            max: 1,
            flag: 'regular-intervals',
            feedbackPass: 'Readings were taken at the prescribed intervals.',
            feedbackFail: 'Take the temperature at each time interval without skipping.',
          },
        ],
        conclusion: {
          keywords: ['cooling', 'newton', 'exponential', 'room temperature'],
          phrase: 'the cooling rate is proportional to the excess temperature above the room',
          max: 2,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-15',
    slug: 'phy-15-newtons-law-of-cooling',
    title: "Newton's law of cooling",
    subject: 'PHYSICS',
    priority: 'P2',
    examBodies: ['NECO', 'WAEC'],
    summary: 'Record a cooling curve, plot ln(θ) against time and show that heat loss is proportional to temperature excess.',
    durationMin: 20,
    apparatus: ['Calorimeter with hot water', 'Thermometer', 'Stopwatch', 'Lid', 'Retort stand'],
    skills: ['Recording a cooling curve', 'Logarithmic transformation', 'Exponential decay', 'Graph interpretation'],
    objective: 'Verify Newton’s law of cooling and determine the cooling constant from a log graph.',
    curriculum: 'SS2 thermal physics: cooling curves and Newton’s law of cooling.',
  },
  scene: 'cooling',
  theory: [
    {
      heading: "Newton's law of cooling",
      body: 'The rate of heat loss is proportional to the excess temperature above the surroundings. With room temperature θᵣ, the excess falls exponentially.',
      formula: 'θ = θᵣ + (θ₀ − θᵣ)e^{−kt}',
    },
    {
      heading: 'Linearising',
      body: 'Taking natural logarithms gives a straight line whose gradient is −k.',
      formula: 'ln(θ − θᵣ) = ln(θ₀ − θᵣ) − kt',
    },
    {
      heading: 'Conditions',
      body: 'The law holds for small temperature differences, with no draughts and no change of state.',
    },
  ],
  procedure: [
    { title: 'Set up', detail: 'Fill the calorimeter with hot water, insert the thermometer and note the room temperature.' },
    { title: 'Start timing', detail: 'Record the temperature at t = 0 and then at each interval supplied.' },
    { title: 'Convert to excess', detail: 'For each reading compute θ = T − room temperature, then ln θ.' },
    { title: 'Plot', detail: 'Plot ln θ against time and find the gradient; k = −gradient.' },
  ],
  table: {
    columns: [
      { id: 'time', label: 'Time t', unit: 'min', decimals: 0, kind: 'number' },
      { id: 'temp', label: 'Temperature T', unit: '°C', decimals: 1, kind: 'number' },
      { id: 'lnTheta', label: 'ln(T − θᵣ)', decimals: 3, kind: 'number' },
    ],
    minRows: 7,
    addRows: false,
    keyColumn: 'time',
    instructions: 'Use the times on the bench. θᵣ is the room-temperature reading shown on the bench.',
    presets: (s) => s.timesMin.map((t) => ({ time: String(t) })),
  },
  graph: {
    xColumn: 'time',
    yColumn: 'lnTheta',
    xLabel: 'Time t',
    yLabel: 'ln(T − θᵣ)',
    xUnit: 'min',
    yUnit: '',
    prompt: 'Plot ln(T − θᵣ) against time. The gradient is −k.',
    expectedGradient: (s) => -s.kPerMinute,
    tolerancePercent: 15,
    minimumPoints: 5,
  },
  calculations: [
    {
      id: 'k',
      fromGradient: true,
      label: 'Cooling constant k',
      unit: 'min⁻¹',
      max: 4,
      tolerancePercent: 12,
      expected: (s) => s.kPerMinute,
      help: 'k = −gradient of your ln θ–time graph.',
      formula: 'k = −gradient',
    },
    {
      id: 'time40',
      label: 'Time for the water to cool to 40.0 °C',
      unit: 'min',
      max: 2,
      tolerancePercent: 12,
      expected: (s) =>
        -Math.log((40 - s.roomTempC) / (s.initialTempC - s.roomTempC)) / s.kPerMinute,
      help: 'Use t = [ln(θ₀ − θᵣ) − ln(θ − θᵣ)] / k.',
      formula: 't = ln(θ₀/θ)/k',
    },
  ],
  coachTip: 'Let the thermometer settle at each interval. Use the same thermometer throughout.',
  generate: (seed) => {
    const rng = createRng(seed);
    return {
      initialTempC: Math.round(rng.float(78, 86) * 2) / 2,
      roomTempC: Math.round(rng.float(26, 30)),
      kPerMinute: Math.round(rng.float(0.04, 0.08) * 1000) / 1000,
      timesMin: [0, 2, 4, 6, 8, 10, 12],
    };
  },
};

// ---------------------------------------------------------------------------
// PHY-16 — Boyle's law
// ---------------------------------------------------------------------------

export interface GasScenario {
  initialPressureKPa: number;
  initialVolumeCm3: number;
  volumesCm3: number[];
  temperatureC: number;
}

export const gasExperiment: ExperimentDefinition<GasScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      gasExperiment,
      {
        expectedKeys: () => scenario.volumesCm3.map((v) => String(v)),
        values: () => ({
          invVolume: scenario.volumesCm3.map((v) => 1 / v),
          pressure: scenario.volumesCm3.map(
            (v) => (scenario.initialPressureKPa * scenario.initialVolumeCm3) / v,
          ),
        }),
        compareColumns: ['invVolume', 'pressure'],
        tolerancePercent: 3,
        decimals: { invVolume: 4, pressure: 1 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'sealed',
            label: 'Kept the gas sealed and at room temperature',
            max: 1,
            flag: 'sealed',
            feedbackPass: 'No gas escaped and the temperature stayed steady.',
            feedbackFail: 'Check the seal and let the apparatus settle to room temperature.',
          },
          {
            id: 'slow',
            label: 'Compressed slowly',
            max: 1,
            flag: 'compressed-slowly',
            feedbackPass: 'Slow compression kept the temperature constant.',
            feedbackFail: 'Compressing quickly heats the gas and breaks the isothermal assumption.',
          },
        ],
        conclusion: {
          keywords: ['boyle', 'inversely', 'pressure', 'volume', 'constant'],
          phrase: 'pressure is inversely proportional to volume at constant temperature',
          max: 2,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-16',
    slug: 'phy-16-boyles-law',
    title: "Boyle's law: pressure and volume",
    subject: 'PHYSICS',
    priority: 'P2',
    examBodies: ['WAEC', 'NECO', 'JAMB'],
    summary: 'Compress a trapped gas at constant temperature, plot P against 1/V and show that PV is constant.',
    durationMin: 16,
    apparatus: ['Boyle’s law apparatus', 'Foot pump', 'Pressure gauge', 'Measuring scale'],
    skills: ['Reading a pressure gauge', 'Inverse proportionality', 'P–1/V graph', 'Isothermal conditions'],
    objective: 'Verify Boyle’s law and determine the constant for a fixed mass of gas.',
    curriculum: 'SS2 gas laws: Boyle’s law and the kinetic theory.',
  },
  scene: 'gas',
  theory: [
    {
      heading: "Boyle's law",
      body: 'At constant temperature the pressure of a fixed mass of gas is inversely proportional to its volume.',
      formula: 'P₁V₁ = P₂V₂',
    },
    {
      heading: 'The linear graph',
      body: 'Plotting P against 1/V gives a straight line through the origin whose gradient is the constant PV.',
      formula: 'P = (PV)·(1/V)',
    },
    {
      heading: 'Temperature must stay constant',
      body: 'Compressing a gas heats it. Compress slowly and allow the apparatus to settle, otherwise P–V does not follow Boyle’s law.',
    },
  ],
  procedure: [
    { title: 'Record the initial state', detail: 'Note the pressure and volume of the trapped gas with no extra load.' },
    { title: 'Compress in steps', detail: 'Use the pump to reach each volume supplied, letting the temperature settle before reading P.' },
    { title: 'Tabulate', detail: 'Record V, 1/V, P and the product PV for each setting.' },
    { title: 'Plot and conclude', detail: 'Plot P against 1/V, draw the best-fit line and comment on whether PV is constant.' },
  ],
  table: {
    columns: [
      { id: 'volume', label: 'Volume V', unit: 'cm³', decimals: 0, kind: 'number' },
      { id: 'invVolume', label: '1/V', unit: 'cm⁻³', decimals: 4, kind: 'number' },
      { id: 'pressure', label: 'Pressure P', unit: 'kPa', decimals: 1, kind: 'number' },
    ],
    minRows: 5,
    addRows: false,
    keyColumn: 'volume',
    instructions: 'Use the five volumes on the bench. Keep the temperature steady and read P each time.',
    presets: (s) => s.volumesCm3.map((v) => ({ volume: String(v) })),
  },
  graph: {
    xColumn: 'invVolume',
    yColumn: 'pressure',
    xLabel: '1/V',
    yLabel: 'Pressure P',
    xUnit: 'cm⁻³',
    yUnit: 'kPa',
    prompt: 'Plot P against 1/V. A straight line through the origin confirms Boyle’s law.',
    expectedGradient: (s) => s.initialPressureKPa * s.initialVolumeCm3,
    tolerancePercent: 8,
    minimumPoints: 4,
  },
  calculations: [
    {
      id: 'pv',
      fromGradient: true,
      label: 'Value of the constant PV',
      unit: 'kPa·cm³',
      max: 2,
      tolerancePercent: 4,
      expected: (s) => s.initialPressureKPa * s.initialVolumeCm3,
      help: 'Multiply any pair of readings. It should be the same for every row.',
      formula: 'PV = constant',
    },
    {
      id: 'p15',
      label: 'Pressure when the volume is 15 cm³',
      unit: 'kPa',
      max: 2,
      tolerancePercent: 4,
      expected: (s) => (s.initialPressureKPa * s.initialVolumeCm3) / 15,
      help: 'Use P₂ = P₁V₁/V₂ with V₂ = 15 cm³.',
      formula: 'P₂ = P₁V₁ / V₂',
    },
  ],
  coachTip: 'Let the gauge settle after each pump stroke. A fast compression gives a higher pressure than Boyle predicts.',
  generate: (seed) => {
    const rng = createRng(seed);
    return {
      initialPressureKPa: Math.round(rng.float(98, 106) * 10) / 10,
      initialVolumeCm3: 40,
      volumesCm3: [20, 25, 30, 40, 50],
      temperatureC: 25,
    };
  },
};

export const thermalExperiments: ExperimentDefinition<any>[] = [
  heatExperiment,
  coolingExperiment,
  gasExperiment,
];
