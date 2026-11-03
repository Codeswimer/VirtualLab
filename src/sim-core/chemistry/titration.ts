/**
 * Acid–base titration engine (Section 6.3, CHM-01/CHM-02).
 *
 * Exact charge balance at 25 °C, ideal solutions, strong monoprotic acids and
 * bases and sodium carbonate only. Weak/diprotic acids need extensions.
 */

import { concordantMean, isValidBuretteReading } from '../measurement';

export { concordantMean, isValidBuretteReading };

/** Ionic product of water at 25 °C. */
export const KW_25C = 1.0e-14;
/** Carbonic acid dissociation constants at 25 °C (zero ionic strength). */
export const KA1_CARBONIC = 4.45e-7;
export const KA2_CARBONIC = 4.69e-11;

export interface Solution {
  /** Volume in cm³ (equal to mL). */
  volumeCm3: number;
  /** Concentration in mol/dm³. */
  molarity: number;
}

const cm3ToDm3 = (v: number): number => v / 1000;

function assertValid(name: string, v: number): void {
  if (!Number.isFinite(v) || v < 0) {
    throw new RangeError(`${name} must be a finite number >= 0 (received ${v})`);
  }
}

/**
 * pH after adding `addedCm3` of a strong monoprotic acid (titrant) to a strong
 * monoprotic base (analyte): [H⁺] − Kw/[H⁺] = net excess strong-ion concentration.
 */
export function pHStrongAcidStrongBase(
  titrant: Solution,
  analyte: Solution,
  addedCm3: number,
  kw: number = KW_25C,
): number {
  assertValid('titrant.molarity', titrant.molarity);
  assertValid('analyte.molarity', analyte.molarity);
  assertValid('analyte.volumeCm3', analyte.volumeCm3);
  assertValid('addedCm3', addedCm3);

  const vTotal = cm3ToDm3(analyte.volumeCm3 + addedCm3);
  const net =
    (titrant.molarity * cm3ToDm3(addedCm3) -
      analyte.molarity * cm3ToDm3(analyte.volumeCm3)) /
    vTotal;
  const root = Math.sqrt(net * net + 4 * kw);
  const h = net >= 0 ? (net + root) / 2 : (2 * kw) / (root - net);
  return -Math.log10(h);
}

/**
 * pH after adding `addedCm3` of strong acid (e.g. HCl) to aqueous Na₂CO₃.
 * Closed system: dissolved CO₂ stays in solution.
 */
export function pHCarbonateWithStrongAcid(
  titrant: Solution,
  analyte: Solution,
  addedCm3: number,
  constants: { kw?: number; ka1?: number; ka2?: number } = {},
): number {
  const { kw = KW_25C, ka1 = KA1_CARBONIC, ka2 = KA2_CARBONIC } = constants;
  assertValid('titrant.molarity', titrant.molarity);
  assertValid('analyte.molarity', analyte.molarity);
  assertValid('analyte.volumeCm3', analyte.volumeCm3);
  assertValid('addedCm3', addedCm3);

  const vTotal = cm3ToDm3(analyte.volumeCm3 + addedCm3);
  const totalCarbonate = (analyte.molarity * cm3ToDm3(analyte.volumeCm3)) / vTotal;
  const sodium = 2 * totalCarbonate;
  const chloride = (titrant.molarity * cm3ToDm3(addedCm3)) / vTotal;

  // Strictly decreasing in pH, so bisection is safe.
  const residual = (pH: number): number => {
    const h = Math.pow(10, -pH);
    const d = h * h + ka1 * h + ka1 * ka2;
    const negativeCarbonate = (totalCarbonate * (ka1 * h + 2 * ka1 * ka2)) / d;
    return sodium + h - kw / h - chloride - negativeCarbonate;
  };

  let lo = -2;
  let hi = 16;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (residual(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Indicators
// ---------------------------------------------------------------------------

export type RGBA = readonly [r: number, g: number, b: number, a: number];

export interface IndicatorSpec {
  id: 'methylOrange' | 'phenolphthalein' | 'starch' | 'none';
  name: string;
  transitionStartPH: number;
  transitionEndPH: number;
  lowPHColor: RGBA;
  highPHColor: RGBA;
  /** Human-readable colour names, because colour is never the only signal. */
  lowPHName: string;
  highPHName: string;
  midpointName: string;
}

export const METHYL_ORANGE: IndicatorSpec = {
  id: 'methylOrange',
  name: 'Methyl orange',
  transitionStartPH: 3.1,
  transitionEndPH: 4.4,
  lowPHColor: [220, 38, 38, 1],
  highPHColor: [250, 204, 21, 1],
  lowPHName: 'red',
  highPHName: 'yellow',
  midpointName: 'orange',
};

export const PHENOLPHTHALEIN: IndicatorSpec = {
  id: 'phenolphthalein',
  name: 'Phenolphthalein',
  transitionStartPH: 8.2,
  transitionEndPH: 10.0,
  lowPHColor: [255, 255, 255, 0],
  highPHColor: [219, 39, 119, 1],
  lowPHName: 'colourless',
  highPHName: 'pink',
  midpointName: 'pale pink',
};

export const INDICATORS: IndicatorSpec[] = [METHYL_ORANGE, PHENOLPHTHALEIN];

export function indicatorSpec(id: IndicatorSpec['id']): IndicatorSpec {
  if (id === 'methylOrange') return METHYL_ORANGE;
  if (id === 'phenolphthalein') return PHENOLPHTHALEIN;
  return {
    id: 'none',
    name: 'No indicator',
    transitionStartPH: 0,
    transitionEndPH: 0,
    lowPHColor: [255, 255, 255, 0],
    highPHColor: [255, 255, 255, 0],
    lowPHName: 'colourless',
    highPHName: 'colourless',
    midpointName: 'colourless',
  };
}

/** CSS rgba() colour of an indicator at a given pH (linear blend). */
export function indicatorColor(spec: IndicatorSpec, pH: number): string {
  const span = spec.transitionEndPH - spec.transitionStartPH || 1;
  const t = Math.min(1, Math.max(0, (pH - spec.transitionStartPH) / span));
  const [r, g, b, a] = spec.lowPHColor.map(
    (low, i) => low + ((spec.highPHColor[i] ?? low) - low) * t,
  );
  return `rgba(${Math.round(r ?? 0)}, ${Math.round(g ?? 0)}, ${Math.round(b ?? 0)}, ${(a ?? 1).toFixed(2)})`;
}

/** Colour name for the same pH — the accessible version of the signal. */
export function indicatorColourName(spec: IndicatorSpec, pH: number): string {
  if (spec.id === 'none') return 'colourless';
  if (pH <= spec.transitionStartPH) return spec.lowPHName;
  if (pH >= spec.transitionEndPH) return spec.highPHName;
  return spec.midpointName;
}

// ---------------------------------------------------------------------------
// Stoichiometry
// ---------------------------------------------------------------------------

/**
 * Balanced mole ratio (moles acid : moles base) for the supported systems.
 * HCl + NaOH is 1:1, HCl + Na₂CO₃ is 2:1, H₂SO₄ + NaOH is 1:2.
 */
export type TitrationSystem = 'hcl-naoh' | 'hcl-na2co3' | 'h2so4-naoh';

export interface SystemSpec {
  id: TitrationSystem;
  label: string;
  equation: string;
  acidPerBase: number;
  /** pH near the end-point with the recommended indicator. */
  endpointPH: number;
  recommendedIndicator: IndicatorSpec['id'];
  molesOfBasePerMole: number;
}

export const TITRATION_SYSTEMS: Record<TitrationSystem, SystemSpec> = {
  'hcl-naoh': {
    id: 'hcl-naoh',
    label: 'HCl against NaOH',
    equation: 'HCl + NaOH → NaCl + H₂O',
    acidPerBase: 1,
    endpointPH: 7,
    recommendedIndicator: 'phenolphthalein',
    molesOfBasePerMole: 1,
  },
  'hcl-na2co3': {
    id: 'hcl-na2co3',
    label: 'HCl against Na₂CO₃',
    equation: '2HCl + Na₂CO₃ → 2NaCl + H₂O + CO₂',
    acidPerBase: 2,
    endpointPH: 3.9,
    recommendedIndicator: 'methylOrange',
    molesOfBasePerMole: 1,
  },
  'h2so4-naoh': {
    id: 'h2so4-naoh',
    label: 'H₂SO₄ against NaOH',
    equation: 'H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O',
    acidPerBase: 0.5,
    endpointPH: 7,
    recommendedIndicator: 'phenolphthalein',
    molesOfBasePerMole: 1,
  },
};

/** Expected titre (cm³ of acid) from the analyte concentration. */
export function expectedTitreCm3(
  system: SystemSpec,
  acidMolarity: number,
  analyteMolarity: number,
  analyteVolumeCm3: number,
): number {
  if (acidMolarity <= 0) return Infinity;
  return (system.acidPerBase * analyteMolarity * analyteVolumeCm3) / acidMolarity;
}

/** Analyte concentration from a titre (the calculation students must show). */
export function analyteMolarityFromTitre(
  system: SystemSpec,
  acidMolarity: number,
  titreCm3: number,
  analyteVolumeCm3: number,
): number {
  if (analyteVolumeCm3 <= 0) return NaN;
  return (acidMolarity * titreCm3) / (system.acidPerBase * analyteVolumeCm3);
}

/** Mass concentration (g/dm³) from molarity and molar mass. */
export function massConcentration(molarity: number, molarMass: number): number {
  return molarity * molarMass;
}

/** Mass of solute in the whole volumetric flask, in g. */
export function massInFlask(
  molarity: number,
  molarMass: number,
  flaskVolumeCm3 = 250,
): number {
  return molarity * (flaskVolumeCm3 / 1000) * molarMass;
}

/** Relative purity (%) of an impure sample from the mass found by titration. */
export function relativePurity(measuredMassG: number, sampleMassG: number): number {
  return (measuredMassG / sampleMassG) * 100;
}

/**
 * Water of crystallisation, n, in Na₂CO₃·nH₂O:
 * n = (molar mass of hydrate − molar mass of anhydrous salt) / 18.
 */
export function waterOfCrystallisation(
  hydrateMolarMass: number,
  anhydrousMolarMass: number,
): number {
  return (hydrateMolarMass - anhydrousMolarMass) / 18;
}

export interface TitrationPoint {
  volumeCm3: number;
  pH: number;
}

/** Sample a titration curve for plotting and for the animated pH meter. */
export function titrationCurve(
  system: TitrationSystem,
  acidMolarity: number,
  analyteMolarity: number,
  analyteVolumeCm3: number,
  maxVolumeCm3: number,
  stepCm3 = 0.2,
): TitrationPoint[] {
  const points: TitrationPoint[] = [];
  const acid: Solution = { volumeCm3: 0, molarity: acidMolarity };
  const analyte: Solution = { volumeCm3: analyteVolumeCm3, molarity: analyteMolarity };
  for (let v = 0; v <= maxVolumeCm3 + 1e-9; v += stepCm3) {
    const pH =
      system === 'hcl-na2co3'
        ? pHCarbonateWithStrongAcid(acid, analyte, v)
        : pHStrongAcidStrongBase(acid, analyte, v);
    points.push({ volumeCm3: Number(v.toFixed(2)), pH });
  }
  return points;
}

/** pH of the mixture at the current burette volume. */
export function mixturePH(
  system: TitrationSystem,
  acidMolarity: number,
  analyteMolarity: number,
  analyteVolumeCm3: number,
  addedCm3: number,
): number {
  const acid: Solution = { volumeCm3: 0, molarity: acidMolarity };
  const analyte: Solution = { volumeCm3: analyteVolumeCm3, molarity: analyteMolarity };
  return system === 'hcl-na2co3'
    ? pHCarbonateWithStrongAcid(acid, analyte, addedCm3)
    : pHStrongAcidStrongBase(acid, analyte, addedCm3);
}

/** First equivalence point of the carbonate titration (pH ≈ 8.3). */
export function carbonateFirstEquivalencePH(
  acidMolarity: number,
  analyteMolarity: number,
  analyteVolumeCm3: number,
): number {
  // First equivalence: every carbonate ion has accepted one proton.
  const halfTitre = (analyteMolarity * analyteVolumeCm3) / Math.max(acidMolarity, 1e-12);
  return pHCarbonateWithStrongAcid(
    { volumeCm3: 0, molarity: acidMolarity },
    { volumeCm3: analyteVolumeCm3, molarity: analyteMolarity },
    halfTitre,
  );
}
