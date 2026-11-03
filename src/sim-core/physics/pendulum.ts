/**
 * Simple pendulum (PHY-01). Analytic period is the measurement source of truth
 * (ADR-002); the 3D scene is cosmetic and never feeds readings to the table.
 */

export const G_STANDARD = 9.81;

/** Small-angle period, seconds. `lengthM` is pivot → centre of bob. */
export function periodSmallAngle(lengthM: number, g = G_STANDARD): number {
  if (lengthM <= 0 || g <= 0) throw new RangeError('length and g must be positive');
  return 2 * Math.PI * Math.sqrt(lengthM / g);
}

/**
 * Period including the finite-amplitude correction to third order:
 * T = T0 (1 + θ₀²/16 + 11θ₀⁴/3072 + 173θ₀⁶/737280).
 */
export function periodFiniteAmplitude(
  lengthM: number,
  amplitudeDeg: number,
  g = G_STANDARD,
): number {
  const theta = (amplitudeDeg * Math.PI) / 180;
  const t0 = periodSmallAngle(lengthM, g);
  const correction =
    1 +
    theta ** 2 / 16 +
    (11 * theta ** 4) / 3072 +
    (173 * theta ** 6) / 737280;
  return t0 * correction;
}

/** g from the gradient of T² (s²) against L (m): g = 4π² / gradient. */
export function gFromT2Gradient(gradient: number): number {
  if (gradient <= 0) throw new RangeError('gradient must be positive');
  return (4 * Math.PI * Math.PI) / gradient;
}

/** Percentage difference of an experimental g from the accepted value. */
export function gPercentError(experimental: number, accepted = G_STANDARD): number {
  return (Math.abs(experimental - accepted) / accepted) * 100;
}

/**
 * Time for `oscillations` swings as a stopwatch would register it, including
 * the examiner-style reaction-time error applied by the student (not the sim).
 */
export function timeForOscillations(
  lengthM: number,
  amplitudeDeg: number,
  oscillations: number,
  g = G_STANDARD,
): number {
  return periodFiniteAmplitude(lengthM, amplitudeDeg, g) * oscillations;
}
