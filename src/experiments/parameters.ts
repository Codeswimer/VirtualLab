import { expectedTitreCm3, TITRATION_SYSTEMS } from '@sim/chemistry/titration';
import type { ExperimentDefinition, ParameterSpec } from './types';

/**
 * Manual bench parameters.
 *
 * Each module may expose one or more physical quantities the student (or a
 * teacher preparing a test) can set before taking readings. Parameters are kept
 * out of the experiment files so every adapter can be reviewed together, and
 * each `apply` rebuilds any derived values in the scenario so marking always
 * agrees with the apparatus.
 */
export type ParameterValues = Record<string, number>;

const round = (value: number, decimals = 2): number =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

const scale = (value: number, factor: number, decimals = 2): number =>
  round(value * factor, decimals);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const PARAMETER_SPECS: Record<string, ParameterSpec<any>[]> = {
  'phy-01-simple-pendulum': [
    {
      id: 'amplitudeDeg',
      label: 'Release amplitude',
      unit: '°',
      hint: 'The theory assumes small angles. Push past 10° and the measured period starts to drift.',
      min: 2,
      max: 12,
      step: 0.5,
      read: (s) => s.amplitudeDeg,
      apply: (s, value) => ({ ...s, amplitudeDeg: round(value, 1) }),
    },
  ],
  'phy-02-hookes-law': [
    {
      id: 'springConstantNm',
      label: 'Spring stiffness',
      unit: 'N/m',
      hint: 'A stiffer spring gives smaller extensions for the same load.',
      min: 12,
      max: 45,
      step: 0.5,
      read: (s) => s.springConstantNm,
      apply: (s, value) => ({ ...s, springConstantNm: round(value, 1) }),
    },
  ],
  'phy-03-principle-of-moments': [
    {
      id: 'ruleMassG',
      label: 'Metre-rule mass',
      unit: 'g',
      hint: 'Heavier rules balance closer to the 50 cm mark when the 50 g mass is hung.',
      min: 70,
      max: 160,
      step: 1,
      read: (s) => s.ruleMassG,
      apply: (s, value) => ({ ...s, ruleMassG: Math.round(value) }),
    },
  ],
  'phy-04-density-archimedes': [
    {
      id: 'massScale',
      label: 'Sample mass',
      unit: '×',
      hint: 'Scales all three samples together. Densities, and therefore the material, stay the same.',
      min: 0.6,
      max: 1.5,
      step: 0.05,
      read: () => 1,
      apply: (s, value) => ({
        ...s,
        samples: s.samples.map((sample: { massG: number }) => ({
          ...sample,
          massG: scale(sample.massG, value, 1),
        })),
      }),
    },
  ],
  'phy-05-concurrent-forces': [
    {
      id: 'forceScale',
      label: 'Force magnitude',
      unit: '×',
      hint: 'Scales both spring-balance readings while keeping the angles between them fixed.',
      min: 0.5,
      max: 1.5,
      step: 0.05,
      read: () => 1,
      apply: (s, value) => ({
        ...s,
        configurations: s.configurations.map((config: { f1: number; f2: number }) => ({
          ...config,
          f1: scale(config.f1, value, 1),
          f2: scale(config.f2, value, 1),
        })),
      }),
    },
  ],
  'phy-06-inclined-plane-friction': [
    {
      id: 'frictionScale',
      label: 'Surface roughness',
      unit: '×',
      hint: 'Changes all three coefficients together, so the ranking of the surfaces is preserved.',
      min: 0.6,
      max: 1.4,
      step: 0.05,
      read: () => 1,
      apply: (s, value) => ({
        ...s,
        surfaces: s.surfaces.map((surface: { mu: number }) => ({
          ...surface,
          mu: round(clamp(surface.mu * value, 0.05, 0.85), 2),
        })),
      }),
    },
  ],
  'phy-07-vernier-micrometer': [
    {
      id: 'sizeScale',
      label: 'Specimen size',
      unit: '×',
      hint: 'Scales the wire, cylinder and slide. Use smaller specimens to practise finer readings.',
      min: 0.6,
      max: 1.4,
      step: 0.05,
      read: () => 1,
      apply: (s, value) => ({
        ...s,
        items: s.items.map((item: { trueValue: number }) => ({
          ...item,
          trueValue: round(item.trueValue * value, 2),
        })),
      }),
    },
  ],
  'phy-08-refraction-glass-block': [
    {
      id: 'refractiveIndex',
      label: 'Glass refractive index',
      hint: 'The block is swapped for a different glass. Students should not assume n = 1.50.',
      min: 1.4,
      max: 1.75,
      step: 0.01,
      read: (s) => s.refractiveIndex,
      apply: (s, value) => ({ ...s, refractiveIndex: round(value, 2) }),
    },
  ],
  'phy-09-prism-minimum-deviation': [
    {
      id: 'refractiveIndex',
      label: 'Prism refractive index',
      hint: 'A denser prism deviates the ray more, shifting the minimum-deviation angle.',
      min: 1.4,
      max: 1.7,
      step: 0.01,
      read: (s) => s.refractiveIndex,
      apply: (s, value) => ({ ...s, refractiveIndex: round(value, 2) }),
    },
  ],
  'phy-10-converging-lens': [
    {
      id: 'focalLengthCm',
      label: 'Focal length',
      unit: 'cm',
      hint: 'Swap the lens for one of a different power. Image distances change accordingly.',
      min: 8,
      max: 24,
      step: 0.5,
      read: (s) => s.focalLengthCm,
      apply: (s, value) => ({ ...s, focalLengthCm: round(value, 1) }),
    },
  ],
  'phy-11-ohms-law': [
    {
      id: 'resistanceOhm',
      label: 'Resistance wire',
      unit: 'Ω',
      hint: 'A longer or thinner wire increases resistance and lowers the current for the same p.d.',
      min: 3,
      max: 25,
      step: 0.5,
      read: (s) => s.resistanceOhm,
      apply: (s, value) => ({ ...s, resistanceOhm: round(value, 1) }),
    },
  ],
  'phy-12-metre-bridge': [
    {
      id: 'unknownOhm',
      label: 'Unknown resistor',
      unit: 'Ω',
      hint: 'Keep the resistance-box values fixed; the balance length moves with the unknown.',
      min: 1.5,
      max: 12,
      step: 0.1,
      read: (s) => s.unknownOhm,
      apply: (s, value) => ({ ...s, unknownOhm: round(value, 1) }),
    },
  ],
  'phy-13-potentiometer': [
    {
      id: 'unknownEmfV',
      label: 'Unknown cell e.m.f.',
      unit: 'V',
      hint: 'The standard cell stays at 1.018 V, so the balance length scales with this value.',
      min: 1.1,
      max: 1.75,
      step: 0.01,
      read: (s) => s.unknownEmfV,
      apply: (s, value) => ({ ...s, unknownEmfV: round(value, 2) }),
    },
  ],
  'phy-14-specific-heat-capacity': [
    {
      id: 'metalInitialC',
      label: 'Metal starting temperature',
      unit: '°C',
      hint: 'Cooler metal transfers less heat, which makes the temperature rise harder to read.',
      min: 70,
      max: 100,
      step: 1,
      read: (s) => s.metalInitialC,
      apply: (s, value) => ({ ...s, metalInitialC: Math.round(value) }),
    },
  ],
  'phy-15-newtons-law-of-cooling': [
    {
      id: 'kPerMinute',
      label: 'Cooling constant',
      unit: 'min⁻¹',
      hint: 'A larger constant means the water loses heat faster between readings.',
      min: 0.025,
      max: 0.095,
      step: 0.005,
      read: (s) => s.kPerMinute,
      apply: (s, value) => ({ ...s, kPerMinute: round(value, 3) }),
    },
  ],
  'phy-16-boyles-law': [
    {
      id: 'initialPressureKPa',
      label: 'Atmospheric pressure',
      unit: 'kPa',
      hint: 'Simulates a different day or altitude. PV stays constant for every volume setting.',
      min: 92,
      max: 110,
      step: 0.5,
      read: (s) => s.initialPressureKPa,
      apply: (s, value) => ({ ...s, initialPressureKPa: round(value, 1) }),
    },
  ],
  'chm-01-acid-base-titration': [
    {
      id: 'analyteMolarity',
      label: 'Base concentration',
      unit: 'mol/dm³',
      hint: 'A more concentrated base needs a larger titre of the same acid.',
      min: 0.04,
      max: 0.2,
      step: 0.005,
      read: (s) => s.analyteMolarity,
      apply: (s, value) => {
        const analyteMolarity = round(value, 3);
        const system = TITRATION_SYSTEMS[s.system as keyof typeof TITRATION_SYSTEMS];
        return {
          ...s,
          analyteMolarity,
          trueTitreCm3: expectedTitreCm3(
            system,
            s.acidMolarity,
            analyteMolarity,
            s.analyteVolumeCm3,
          ),
        };
      },
    },
  ],
  'chm-02-hydrated-carbonate': [
    {
      id: 'waterOfCrystallisation',
      label: 'Water of crystallisation',
      unit: 'n',
      hint: 'Changing n changes the molar mass of the hydrate and the concentration of the solution.',
      min: 2,
      max: 9,
      step: 1,
      read: (s) => s.waterOfCrystallisation,
      apply: (s, value) => {
        const waterOfCrystallisation = Math.round(value);
        const molarMassHydrate = 106 + 18 * waterOfCrystallisation;
        const analyteMolarity = s.sampleMassG / molarMassHydrate / 0.25;
        return {
          ...s,
          waterOfCrystallisation,
          molarMassHydrate,
          analyteMolarity,
          trueTitreCm3: expectedTitreCm3(
            TITRATION_SYSTEMS['hcl-na2co3'],
            s.acidMolarity,
            analyteMolarity,
            s.analyteVolumeCm3 ?? 25,
          ),
        };
      },
    },
  ],
  'chm-03-redox-permanganate': [
    {
      id: 'titrantMolarity',
      label: 'Permanganate concentration',
      unit: 'mol/dm³',
      hint: 'A stronger titrant reaches the end-point in a smaller volume.',
      min: 0.01,
      max: 0.03,
      step: 0.001,
      read: (s) => s.titrantMolarity,
      apply: (s, value) => {
        const titrantMolarity = round(value, 3);
        return {
          ...s,
          titrantMolarity,
          trueTitreCm3:
            (s.analyteMolarity * (s.analyteVolumeCm3 ?? 25)) / (5 * titrantMolarity),
        };
      },
    },
  ],
};

export function parametersFor(experiment: ExperimentDefinition): ParameterSpec<any>[] {
  return PARAMETER_SPECS[experiment.meta.slug] ?? [];
}

/** Clamp raw (possibly string) values into each parameter's range, dropping unknowns. */
export function normaliseParameters(
  experiment: ExperimentDefinition,
  values: Record<string, unknown> | null | undefined,
): ParameterValues {
  const specs = parametersFor(experiment);
  const result: ParameterValues = {};
  if (!values) return result;
  for (const spec of specs) {
    const raw = values[spec.id];
    const numeric = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof numeric !== 'number' || !Number.isFinite(numeric)) continue;
    result[spec.id] = clamp(numeric, spec.min, spec.max);
  }
  return result;
}

/**
 * Regenerates the scenario for a seed, then applies the manual parameters the
 * student or teacher chose. Marking uses this same function, so the hidden
 * truth matches the apparatus exactly.
 */
export function scenarioFor<S>(
  experiment: ExperimentDefinition<S>,
  seed: number,
  params?: Record<string, unknown> | null,
): S {
  let scenario = experiment.generate(seed);
  const specs = parametersFor(experiment as ExperimentDefinition);
  if (specs.length === 0 || !params) return scenario;
  for (const spec of specs) {
    const raw = params[spec.id];
    const numeric = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof numeric !== 'number' || !Number.isFinite(numeric)) continue;
    scenario = spec.apply(scenario, clamp(numeric, spec.min, spec.max));
  }
  return scenario;
}
