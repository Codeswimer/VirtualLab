import { createRng } from '@sim/rng';
import {
  angleOfRefraction,
  apparentDepth,
  criticalAngle,
  imageDistance,
  minimumDeviation,
  prismDeviation,
  prismRefractiveIndex,
} from '@sim/physics/optics';
import type { ExperimentDefinition } from './types';
import { scoreQuantitative } from './scoring';

const fx = (value: number, decimals = 1): string => value.toFixed(decimals);

// ---------------------------------------------------------------------------
// PHY-08 — Refraction through a rectangular glass block
// ---------------------------------------------------------------------------

export interface RefractionScenario {
  refractiveIndex: number;
  incidences: number[];
  blockThicknessCm: number;
}

export const refractionExperiment: ExperimentDefinition<RefractionScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      refractionExperiment,
      {
        expectedKeys: () => scenario.incidences.map((i) => fx(i, 0)),
        values: () => {
          const refractions = scenario.incidences.map((i) =>
            angleOfRefraction(i, scenario.refractiveIndex),
          );
          return {
            incidence: scenario.incidences,
            refraction: refractions,
            sinI: scenario.incidences.map((i) => Math.sin((i * Math.PI) / 180)),
            sinR: refractions.map((r) => Math.sin((r * Math.PI) / 180)),
          };
        },
        compareColumns: ['refraction', 'sinI', 'sinR'],
        tolerancePercent: 4,
        decimals: { refraction: 0, sinI: 3, sinR: 3 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'normal',
            label: 'Measured angles from the normal',
            max: 2,
            flag: 'angles-from-normal',
            feedbackPass: 'Angles of incidence and refraction were measured from the normal.',
            feedbackFail: 'Always measure incidence and refraction from the normal, not the glass surface.',
          },
          {
            id: 'pins',
            label: 'Aligned the pins before marking the ray',
            max: 1,
            flag: 'pins-aligned',
            feedbackPass: 'The emergent ray was located by aligning two pins.',
            feedbackFail: 'Use two pins on each side and view them as one before marking the ray.',
          },
        ],
        conclusion: {
          keywords: ['refractive index', 'sine', 'snell', 'glass'],
          phrase: `n = sin i / sin r ≈ ${scenario.refractiveIndex.toFixed(2)}`,
          max: 2,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-08',
    slug: 'phy-08-refraction-glass-block',
    title: 'Refraction through a glass block',
    subject: 'PHYSICS',
    priority: 'P0',
    examBodies: ['WAEC', 'NECO', 'JAMB'],
    summary: 'Trace a ray through a rectangular block, measure angles and find the refractive index from a sine graph.',
    durationMin: 20,
    apparatus: ['Rectangular glass block', 'Ray box or pins', 'Protractor', 'Plain paper', 'Sharp pencil'],
    skills: ['Ray tracing', 'Measuring angles from the normal', 'Sine graph', 'Refractive index'],
    objective: 'Determine the refractive index of glass and use it to predict the critical angle.',
    curriculum: 'SS3 optics: refraction of light through a rectangular glass block.',
  },
  scene: 'optics',
  theory: [
    {
      heading: "Snell's law",
      body: 'When light passes from air into glass, the ratio of the sines of the angles in air and glass is constant. That constant is the refractive index.',
      formula: 'n = sin i / sin r',
    },
    {
      heading: 'Why we plot sines',
      body: 'Plotting sin i against sin r gives a straight line through the origin whose gradient is n. Plotting angles directly would be curved.',
      formula: 'sin i = n · sin r',
    },
    {
      heading: 'Critical angle',
      body: 'Light travelling the other way, from glass to air, is totally internally reflected beyond the critical angle.',
      formula: 'sin c = 1/n',
    },
  ],
  procedure: [
    { title: 'Place the block', detail: 'Trace the block on paper and mark its outline. Draw a normal at the point where the ray enters.' },
    { title: 'Set the first angle', detail: 'Direct the ray at 30.0° to the normal and mark the emergent ray with two pins.' },
    { title: 'Measure r', detail: 'Remove the block, join the ray marks and measure the angle of refraction from the normal.' },
    { title: 'Repeat', detail: 'Repeat for each incidence angle supplied, recording sin i and sin r.' },
    { title: 'Plot and calculate', detail: 'Plot sin i against sin r, draw the best-fit line and read its gradient as n.' },
  ],
  table: {
    columns: [
      { id: 'incidence', label: 'Angle of incidence i', unit: '°', decimals: 0, kind: 'number' },
      { id: 'refraction', label: 'Angle of refraction r', unit: '°', decimals: 0, kind: 'number' },
      { id: 'sinI', label: 'sin i', decimals: 3, kind: 'number' },
      { id: 'sinR', label: 'sin r', decimals: 3, kind: 'number' },
    ],
    minRows: 4,
    addRows: false,
    keyColumn: 'incidence',
    instructions: 'Use the four incidence angles on the bench. Compute the sines with your calculator.',
    presets: (s) => s.incidences.map((i) => ({ incidence: String(i) })),
  },
  graph: {
    xColumn: 'sinR',
    yColumn: 'sinI',
    xLabel: 'sin r',
    yLabel: 'sin i',
    xUnit: '',
    yUnit: '',
    prompt: 'Plot sin i (vertical) against sin r (horizontal). The gradient is the refractive index.',
    expectedGradient: (s) => s.refractiveIndex,
    tolerancePercent: 8,
    minimumPoints: 4,
  },
  calculations: [
    {
      id: 'n',
      fromGradient: true,
      label: 'Refractive index of the glass',
      unit: '',
      max: 2,
      tolerancePercent: 6,
      expected: (s) => s.refractiveIndex,
      help: 'The gradient of your sin i–sin r graph is n.',
      formula: 'n = gradient',
    },
    {
      id: 'critical',
      label: 'Critical angle for this glass',
      unit: '°',
      max: 1,
      tolerancePercent: 6,
      expected: (s) => criticalAngle(s.refractiveIndex),
      help: 'sin c = 1/n, so c = sin⁻¹(1/n).',
      formula: 'c = sin⁻¹(1/n)',
    },
    {
      id: 'apparent',
      label: 'Apparent depth of a coin under 12.0 cm of this glass',
      unit: 'cm',
      max: 1,
      tolerancePercent: 6,
      expected: (s) => apparentDepth(12, s.refractiveIndex),
      help: 'Apparent depth = real depth ÷ refractive index.',
      formula: 'apparent depth = real depth / n',
    },
  ],
  coachTip: 'Measure from the normal. A ray along the normal passes straight through, so avoid i = 0° when plotting.',
  generate: (seed) => {
    const rng = createRng(seed);
    return {
      refractiveIndex: Math.round(rng.float(1.45, 1.65) * 100) / 100,
      incidences: [30, 40, 50, 60],
      blockThicknessCm: Math.round(rng.float(4.5, 6.5) * 10) / 10,
    };
  },
};

// ---------------------------------------------------------------------------
// PHY-09 — Triangular prism
// ---------------------------------------------------------------------------

export interface PrismScenario {
  refractiveIndex: number;
  apexAngleDeg: number;
  incidences: number[];
}

export const prismExperiment: ExperimentDefinition<PrismScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      prismExperiment,
      {
        expectedKeys: () => scenario.incidences.map((i) => fx(i, 0)),
        values: () => ({
          deviation: scenario.incidences.map((i) =>
            prismDeviation(i, scenario.apexAngleDeg, scenario.refractiveIndex),
          ),
        }),
        compareColumns: ['deviation'],
        tolerancePercent: 5,
        decimals: { deviation: 1 },
        tableMarks: { recorded: 3, accurate: 4, precision: 1 },
        procedure: [
          {
            id: 'min',
            label: 'Searched both sides of the minimum',
            max: 2,
            flag: 'min-deviation-found',
            feedbackPass: 'You bracketed the minimum deviation by rotating the prism in both directions.',
            feedbackFail: 'Rotate the prism slowly until the deviation stops decreasing, then increases again.',
          },
          {
            id: 'readings',
            label: 'Recorded deviations for all incidence angles',
            max: 1,
            check: (a) => a.rows.filter((r) => (r.deviation ?? '').trim() !== '').length >= 4,
            feedbackPass: 'Enough readings to locate the minimum.',
            feedbackFail: 'Record a deviation for each incidence angle supplied.',
          },
        ],
        conclusion: {
          keywords: ['minimum deviation', 'refractive index', 'prism', 'apex'],
          phrase: `n = sin[(A + Dm)/2] / sin(A/2) with A = ${scenario.apexAngleDeg}°`,
          max: 2,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-09',
    slug: 'phy-09-prism-minimum-deviation',
    title: 'Triangular prism: minimum deviation',
    subject: 'PHYSICS',
    priority: 'P1',
    examBodies: ['WAEC', 'NECO'],
    summary: 'Trace a ray through a 60° prism, find the minimum deviation and calculate the refractive index.',
    durationMin: 18,
    apparatus: ['Glass prism', 'Ray box', 'Protractor', 'Plain paper', 'Pencil'],
    skills: ['Prism geometry', 'Locating minimum deviation', 'Refractive index from Dm', 'Dispersion'],
    objective: 'Find the angle of minimum deviation and use it to calculate the refractive index of the prism.',
    curriculum: 'SS3 optics: refraction through a triangular prism, minimum deviation.',
  },
  scene: 'optics',
  theory: [
    {
      heading: 'Deviation by a prism',
      body: 'A ray passing through a prism is deviated by an angle that depends on the angle of incidence. The deviation passes through a minimum as the prism rotates.',
      formula: 'D = i₁ + i₂ − A',
    },
    {
      heading: 'Refractive index at minimum deviation',
      body: 'At minimum deviation the ray passes symmetrically through the prism, and the refractive index can be found from A and Dm alone.',
      formula: 'n = sin[(A + Dm)/2] / sin(A/2)',
    },
    {
      heading: 'Dispersion',
      body: 'The refractive index is slightly different for each colour, so white light emerges as a spectrum. Violet deviates most, red least.',
    },
  ],
  procedure: [
    { title: 'Set the prism', detail: 'Trace the 60° prism on paper and mark its apex and base.' },
    { title: 'Send a ray in', detail: 'Set the incidence angle supplied and mark the emergent ray with pins.' },
    { title: 'Measure deviation', detail: 'Extend the incident and emergent rays until they meet and measure the angle between them.' },
    { title: 'Find the minimum', detail: 'Rotate the prism slowly to find the smallest deviation and record it.' },
    { title: 'Calculate n', detail: 'Use A = 60° and your minimum deviation in n = sin[(A + Dm)/2] / sin(A/2).' },
  ],
  table: {
    columns: [
      { id: 'incidence', label: 'Angle of incidence i', unit: '°', decimals: 0, kind: 'number' },
      { id: 'deviation', label: 'Angle of deviation D', unit: '°', decimals: 1, kind: 'number' },
    ],
    minRows: 5,
    addRows: false,
    keyColumn: 'incidence',
    instructions: 'Use the incidence angles supplied. The smallest deviation in your table is the minimum deviation.',
    presets: (s) => s.incidences.map((i) => ({ incidence: String(i) })),
  },
  calculations: [
    {
      id: 'dm',
      label: 'Angle of minimum deviation',
      unit: '°',
      max: 3,
      tolerancePercent: 4,
      expected: (s) => minimumDeviation(s.apexAngleDeg, s.refractiveIndex),
      help: 'The minimum value of D in your table. Read it from the graph of D against i, or from your readings.',
      formula: 'Dm = D(min)',
    },
    {
      id: 'n',
      label: 'Refractive index of the prism',
      unit: '',
      max: 4,
      tolerancePercent: 4,
      expected: (s) => prismRefractiveIndex(minimumDeviation(s.apexAngleDeg, s.refractiveIndex), s.apexAngleDeg),
      help: 'Use A = 60° and your Dm: n = sin[(60 + Dm)/2] / sin(30°).',
      formula: 'n = sin[(A + Dm)/2] / sin(A/2)',
    },
  ],
  coachTip: 'At minimum deviation the ray inside the prism is parallel to the base. Use that as a visual check.',
  generate: (seed) => {
    const rng = createRng(seed);
    return {
      refractiveIndex: Math.round(rng.float(1.48, 1.62) * 100) / 100,
      apexAngleDeg: 60,
      incidences: [40, 45, 50, 55, 60],
    };
  },
};

// ---------------------------------------------------------------------------
// PHY-10 — Converging lens
// ---------------------------------------------------------------------------

export interface LensScenario {
  focalLengthCm: number;
  objectDistancesCm: number[];
}

export const lensExperiment: ExperimentDefinition<LensScenario> = {
  score: (attempt, scenario) =>
    scoreQuantitative(
      lensExperiment,
      {
        expectedKeys: () => scenario.objectDistancesCm.map((u) => fx(u, 0)),
        values: () => {
          const images = scenario.objectDistancesCm.map((u) => imageDistance(u, scenario.focalLengthCm));
          return {
            image: images,
            invU: scenario.objectDistancesCm.map((u) => 1 / u),
            invV: images.map((v) => 1 / v),
          };
        },
        compareColumns: ['image', 'invU', 'invV'],
        tolerancePercent: 5,
        decimals: { image: 1, invU: 4, invV: 4 },
        tableMarks: { recorded: 2, accurate: 3, precision: 1 },
        procedure: [
          {
            id: 'focused',
            label: 'Focused a sharp image before measuring',
            max: 2,
            flag: 'image-focused',
            feedbackPass: 'The screen was adjusted until the image was sharp, not just visible.',
            feedbackFail: 'Move the screen until the image is sharpest, then measure v.',
          },
          {
            id: 'measure-centre',
            label: 'Measured distances from the lens centre',
            max: 1,
            flag: 'measured-from-centre',
            feedbackPass: 'Both u and v were taken from the optical centre.',
            feedbackFail: 'Measure object and image distances from the centre of the lens, not its edge.',
          },
        ],
        conclusion: {
          keywords: ['focal length', 'lens', 'image', 'intercept'],
          phrase: `f ≈ ${scenario.focalLengthCm.toFixed(1)} cm`,
          max: 2,
        },
      },
      attempt,
      scenario,
    ),
  meta: {
    code: 'PHY-10',
    slug: 'phy-10-converging-lens',
    title: 'Converging lens: focal length',
    subject: 'PHYSICS',
    priority: 'P1',
    examBodies: ['WAEC', 'NECO', 'JAMB'],
    summary: 'Move an object along the bench, focus its image on a screen and find f from a 1/v against 1/u graph.',
    durationMin: 20,
    apparatus: ['Converging lens', 'Illuminated object', 'Screen', 'Metre rule', 'Lens holder'],
    skills: ['Focusing images', 'Lens formula', 'Reciprocal graph', 'Graph interpretation'],
    objective: 'Determine the focal length of a converging lens and describe the image formed.',
    curriculum: 'SS3 optics: lenses, image formation and the lens formula.',
  },
  scene: 'optics',
  theory: [
    {
      heading: 'The lens formula',
      body: 'Object distance, image distance and focal length are linked by the thin lens equation. Distances are measured from the optical centre.',
      formula: '1/f = 1/u + 1/v',
    },
    {
      heading: 'The reciprocal graph',
      body: 'Plotting 1/v against 1/u gives a straight line of gradient −1. The intercepts equal 1/f, which is why the graph is preferred to a single reading.',
      formula: '1/v = −(1/u) + 1/f',
    },
    {
      heading: 'Real images',
      body: 'When u > f the image is real, inverted and can be caught on a screen. When u < f it is virtual, upright and magnified.',
    },
  ],
  procedure: [
    { title: 'Set the object distance', detail: 'Place the object at u = 25.0 cm from the lens centre.' },
    { title: 'Focus the image', detail: 'Move the screen until the image is sharp, then measure v from the lens centre.' },
    { title: 'Repeat', detail: 'Repeat for each object distance supplied and compute 1/u and 1/v.' },
    { title: 'Plot', detail: 'Plot 1/v against 1/u and draw the best-fit line; its intercept gives 1/f.' },
    { title: 'Check f', detail: 'Average f = uv/(u + v) across your rows and compare with the graph.' },
  ],
  table: {
    columns: [
      { id: 'object', label: 'Object distance u', unit: 'cm', decimals: 1, kind: 'number' },
      { id: 'image', label: 'Image distance v', unit: 'cm', decimals: 1, kind: 'number' },
      { id: 'invU', label: '1/u', unit: 'cm⁻¹', decimals: 4, kind: 'number' },
      { id: 'invV', label: '1/v', unit: 'cm⁻¹', decimals: 4, kind: 'number' },
    ],
    minRows: 5,
    addRows: false,
    keyColumn: 'object',
    instructions: 'Use the five object distances on the bench. Record v from the screen scale.',
    presets: (s) => s.objectDistancesCm.map((u) => ({ object: fx(u, 0) })),
  },
  graph: {
    xColumn: 'invU',
    yColumn: 'invV',
    xLabel: '1/u',
    yLabel: '1/v',
    xUnit: 'cm⁻¹',
    yUnit: 'cm⁻¹',
    prompt: 'Plot 1/v against 1/u. The line has gradient −1, and its intercept on the 1/v axis is 1/f.',
    expectedGradient: () => -1,
    tolerancePercent: 15,
    minimumPoints: 4,
  },
  calculations: [
    {
      id: 'focal',
      label: 'Focal length of the lens',
      unit: 'cm',
      max: 3,
      tolerancePercent: 8,
      expected: (s) => s.focalLengthCm,
      help: 'Average f = uv/(u+v) over your readings, or use f = 1/intercept.',
      formula: 'f = uv / (u + v)',
    },
    {
      id: 'magnification',
      label: 'Magnification when u = 30.0 cm',
      unit: '',
      max: 1,
      tolerancePercent: 8,
      expected: (s) => Math.abs(imageDistance(30, s.focalLengthCm) / 30),
      help: 'm = v/u with v from the lens formula, using the focal length you found.',
      formula: 'm = v / u',
    },
  ],
  coachTip: 'A sharp image is small and crisp. "Visible but blurry" will give a wrong v — adjust slowly.',
  generate: (seed) => {
    const rng = createRng(seed);
    return {
      focalLengthCm: Math.round(rng.float(12, 20) * 10) / 10,
      objectDistancesCm: [25, 30, 35, 40, 45],
    };
  },
};

export const opticsExperiments: ExperimentDefinition<any>[] = [
  refractionExperiment,
  prismExperiment,
  lensExperiment,
];
