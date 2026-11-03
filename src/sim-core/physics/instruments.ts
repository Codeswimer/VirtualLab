/**
 * Scale models for the reading-skills module (PHY-07). These turn a true
 * dimension into the physical scale positions a student reads off-screen.
 */

export interface VernierReading {
  /** Whole millimetres on the main scale, in cm. */
  mainCm: number;
  /** Which vernier division coincides with a main-scale division, 0–9. */
  vernierIndex: number;
  /** Reading with the zero error applied, in cm. */
  readingCm: number;
  /** True dimension (without zero error), in cm. */
  trueCm: number;
  zeroErrorCm: number;
}

export function vernierReading(trueCm: number, zeroErrorCm = 0): VernierReading {
  const observed = trueCm + zeroErrorCm;
  const mainCm = Math.floor(observed * 10 + 1e-9) / 10;
  const vernierIndex = Math.min(9, Math.round((observed - mainCm) * 100));
  return {
    mainCm: Number(mainCm.toFixed(1)),
    vernierIndex,
    readingCm: Number((mainCm + vernierIndex * 0.01).toFixed(2)),
    trueCm,
    zeroErrorCm,
  };
}

export interface MicrometerReading {
  /** Sleeve reading (0.5 mm increments), in mm. */
  sleeveMm: number;
  /** Thimble division, 0–49. */
  thimbleIndex: number;
  readingMm: number;
  trueMm: number;
  zeroErrorMm: number;
}

export function micrometerReading(trueMm: number, zeroErrorMm = 0): MicrometerReading {
  const observed = Math.max(0, trueMm + zeroErrorMm);
  // The sleeve is graduated in 0.5 mm, so take the 0.5 mm step below the value.
  const sleeveMm = Math.floor(observed * 2 + 1e-9) / 2;
  const thimbleIndex = Math.min(49, Math.max(0, Math.round((observed - sleeveMm) * 100)));
  return {
    sleeveMm: Number(sleeveMm.toFixed(1)),
    thimbleIndex,
    readingMm: Number((sleeveMm + thimbleIndex * 0.01).toFixed(2)),
    trueMm,
    zeroErrorMm,
  };
}

/** Correct a vernier reading for a zero error: true = observed − zero error. */
export function correctForZeroError(observed: number, zeroError: number): number {
  return Number((observed - zeroError).toFixed(2));
}
