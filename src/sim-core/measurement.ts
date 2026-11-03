/**
 * Measurement model (Section 6.1 / FR-02).
 *
 *   reading = round_to_least_count(true_value + zero_error + noise)
 *
 * True values never reach the UI directly: they pass through this module, then
 * through the student's data table.
 */

export type InstrumentId =
  | 'metreRule'
  | 'vernierCalliper'
  | 'micrometer'
  | 'stopwatch'
  | 'stopwatchAnalogue'
  | 'burette'
  | 'thermometer'
  | 'ammeter'
  | 'voltmeter'
  | 'measuringCylinder'
  | 'balance'
  | 'protractor'
  | 'rulerMm';

export interface InstrumentSpec {
  id: InstrumentId;
  name: string;
  unit: string;
  /** Smallest step the instrument resolves, in `unit`. */
  leastCount: number;
  /** Decimal places expected in a recorded value. */
  decimals: number;
  /** Reading noise as a multiple of the least count (uniform ±k·lc). */
  noiseLeastCounts: number;
  /** Restrict the reading to multiples of this step (burette: 0.05). */
  resolution?: number;
}

export const INSTRUMENTS: Record<InstrumentId, InstrumentSpec> = {
  metreRule: {
    id: 'metreRule',
    name: 'Metre rule',
    unit: 'cm',
    leastCount: 0.1,
    decimals: 1,
    noiseLeastCounts: 0.25,
  },
  rulerMm: {
    id: 'rulerMm',
    name: 'Ruler (mm)',
    unit: 'mm',
    leastCount: 1,
    decimals: 0,
    noiseLeastCounts: 0,
  },
  vernierCalliper: {
    id: 'vernierCalliper',
    name: 'Vernier callipers',
    unit: 'cm',
    leastCount: 0.01,
    decimals: 2,
    noiseLeastCounts: 0.5,
  },
  micrometer: {
    id: 'micrometer',
    name: 'Micrometer screw gauge',
    unit: 'mm',
    leastCount: 0.01,
    decimals: 2,
    noiseLeastCounts: 0.5,
  },
  stopwatch: {
    id: 'stopwatch',
    name: 'Digital stopwatch',
    unit: 's',
    leastCount: 0.01,
    decimals: 2,
    noiseLeastCounts: 0.15,
  },
  stopwatchAnalogue: {
    id: 'stopwatchAnalogue',
    name: 'Stopwatch (0.1 s)',
    unit: 's',
    leastCount: 0.1,
    decimals: 1,
    noiseLeastCounts: 0.3,
  },
  burette: {
    id: 'burette',
    name: 'Burette',
    unit: 'cm³',
    leastCount: 0.1,
    decimals: 2,
    noiseLeastCounts: 0,
    resolution: 0.05,
  },
  thermometer: {
    id: 'thermometer',
    name: 'Thermometer',
    unit: '°C',
    leastCount: 0.5,
    decimals: 1,
    noiseLeastCounts: 0.3,
    resolution: 0.5,
  },
  ammeter: {
    id: 'ammeter',
    name: 'Ammeter',
    unit: 'A',
    leastCount: 0.02,
    decimals: 2,
    noiseLeastCounts: 0.3,
    resolution: 0.02,
  },
  voltmeter: {
    id: 'voltmeter',
    name: 'Voltmeter',
    unit: 'V',
    leastCount: 0.05,
    decimals: 2,
    noiseLeastCounts: 0.3,
    resolution: 0.05,
  },
  measuringCylinder: {
    id: 'measuringCylinder',
    name: 'Measuring cylinder',
    unit: 'cm³',
    leastCount: 1,
    decimals: 1,
    noiseLeastCounts: 0.3,
    resolution: 0.5,
  },
  balance: {
    id: 'balance',
    name: 'Electronic balance',
    unit: 'g',
    leastCount: 0.1,
    decimals: 1,
    noiseLeastCounts: 0.2,
  },
  protractor: {
    id: 'protractor',
    name: 'Protractor',
    unit: '°',
    leastCount: 1,
    decimals: 0,
    noiseLeastCounts: 0,
  },
};

export function roundToStep(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round((value + Number.EPSILON) / step) * step;
}

function clean(value: number): number {
  return Number.parseFloat(value.toFixed(6));
}

export interface MeasureOptions {
  /** Fixed instrumental zero error in instrument units (subtracted from the reading). */
  zeroError?: number;
  /** Deterministic noise source, normally `createRng(hashSeed(seed, counter))`. */
  random?: () => number;
  /** Override the spec's noise magnitude. */
  noiseLeastCounts?: number;
}

/**
 * Pass a true value through the instrument model.
 * The returned value is already rounded to the instrument's resolution.
 */
export function measure(
  trueValue: number,
  instrument: InstrumentSpec | InstrumentId,
  options: MeasureOptions = {},
): number {
  const spec = typeof instrument === 'string' ? INSTRUMENTS[instrument] : instrument;
  const noiseScale = options.noiseLeastCounts ?? spec.noiseLeastCounts;
  const noise =
    options.random && noiseScale > 0
      ? (options.random() * 2 - 1) * noiseScale * spec.leastCount
      : 0;
  const step = spec.resolution ?? spec.leastCount;
  const value = roundToStep(trueValue + (options.zeroError ?? 0) + noise, step);
  // Recorded readings are never negative on these instruments (a burette can
  // read a little above 50 only by misreading; clamp for sanity).
  return clean(Math.max(0, value));
}

/** Which decimal places a raw numeric answer actually carries. */
export function countDecimals(value: number | string): number {
  const text = typeof value === 'string' ? value.trim() : String(value);
  if (!text.includes('.')) return 0;
  const fraction = text.split('.')[1] ?? '';
  return fraction.replace(/0+$/, '').length;
}

export function formatReading(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

/** Burette readings: 0–50 cm³, 2 d.p., final digit 0 or 5 (e.g. 12.35). */
export function isValidBuretteReading(reading: number): boolean {
  if (!Number.isFinite(reading) || reading < 0 || reading > 50) return false;
  const hundredths = Math.round(reading * 100);
  return Math.abs(reading * 100 - hundredths) < 1e-6 && hundredths % 5 === 0;
}

/**
 * String-level bureau validation: examiners require 2 d.p. and a final digit
 * of 0 or 5. Numbers cannot carry trailing zeros, so this is checked on text.
 */
export function buretteInputIssue(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 'Enter a burette reading.';
  if (!/^\d{1,2}\.\d{2}$/.test(trimmed)) {
    return 'Record to 2 decimal places, e.g. 12.35 cm³.';
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 50) {
    return 'A burette reads between 0.00 and 50.00 cm³.';
  }
  const hundredths = Math.round(value * 100);
  if (hundredths % 5 !== 0) return 'The last digit of a burette reading must be 0 or 5.';
  return null;
}

/**
 * Largest group of titres whose spread is within `toleranceCm3`, and their mean.
 * Returns null when fewer than two titres are concordant.
 */
export function concordantMean(
  titres: readonly number[],
  toleranceCm3 = 0.2,
): { titres: number[]; mean: number } | null {
  const sorted = [...titres].sort((a, b) => a - b);
  let best: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (
      j + 1 < sorted.length &&
      (sorted[j + 1] ?? 0) - (sorted[i] ?? 0) <= toleranceCm3 + 1e-9
    ) {
      j++;
    }
    if (j - i + 1 > best.length) best = sorted.slice(i, j + 1);
  }
  if (best.length < 2) return null;
  return { titres: best, mean: best.reduce((s, t) => s + t, 0) / best.length };
}

/** Spread of the concordant group (max − min), 0 when not concordant. */
export function titreSpread(titres: readonly number[]): number | null {
  const group = concordantMean(titres);
  if (!group) return null;
  return Math.max(...group.titres) - Math.min(...group.titres);
}

export function decimalPlacesOfStep(step: number): number {
  if (step >= 1) return 0;
  return Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
}
