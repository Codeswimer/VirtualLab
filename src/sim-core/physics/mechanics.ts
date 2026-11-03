/** Mechanics solvers: springs, moments, upthrust, concurrent forces, friction. */

export const G = 9.81;

// ---------------------------------------------------------------------------
// Hooke's law (PHY-02)
// ---------------------------------------------------------------------------

export function springExtensionCm(massG: number, springConstantNm: number): number {
  const forceN = (massG / 1000) * G;
  // k is N/m, extension returned in cm
  return (forceN / springConstantNm) * 100;
}

/** k (N/m) from the gradient of F (N) against extension e (cm). */
export function springConstantFromGradient(gradientNPerCm: number): number {
  return gradientNPerCm * 100;
}

// ---------------------------------------------------------------------------
// Principle of moments (PHY-03)
// ---------------------------------------------------------------------------

export interface MomentState {
  /** Metre-rule mass in g. */
  ruleMassG: number;
  /** Centre of gravity of the rule, cm from the zero end. */
  cgCm: number;
  /** Pivot (knife-edge) position, cm from the zero end. */
  pivotCm: number;
  /** Hanging mass in g. */
  massG: number;
  /** Position of the hanging mass, cm from the zero end. */
  massPositionCm: number;
}

/**
 * Net clockwise moment about the pivot, in arbitrary units (g·cm).
 * Positive = clockwise (mass side), negative = anticlockwise (rule side).
 */
export function netMoment(state: MomentState): number {
  const massMoment = state.massG * (state.massPositionCm - state.pivotCm);
  const ruleMoment = state.ruleMassG * (state.cgCm - state.pivotCm);
  return massMoment + ruleMoment;
}

export function isBalanced(state: MomentState, toleranceGCm = 0.5): boolean {
  return Math.abs(netMoment(state)) <= toleranceGCm;
}

/** Position at which a hanging mass balances the rule, from moments. */
export function balancePositionForMass(state: Omit<MomentState, 'massPositionCm'>): number {
  const ruleMoment = state.ruleMassG * (state.cgCm - state.pivotCm);
  return state.pivotCm - ruleMoment / state.massG;
}

/** Rule mass from two balance experiments (pivot fixed, positions known). */
export function ruleMassFromBalances(
  massG: number,
  pivotCm: number,
  cgCm: number,
  balancePositionCm: number,
): number {
  const distance = balancePositionCm - pivotCm;
  if (Math.abs(cgCm - pivotCm) < 1e-9) return 0;
  return (-massG * distance) / (cgCm - pivotCm);
}

// ---------------------------------------------------------------------------
// Density and relative density (PHY-04)
// ---------------------------------------------------------------------------

export function relativeDensityFromWeights(massInAirG: number, massInWaterG: number): number {
  const upthrust = massInAirG - massInWaterG;
  if (upthrust <= 0) throw new RangeError('mass in water must be less than mass in air');
  return massInAirG / upthrust;
}

export function densityGcm3(massG: number, volumeCm3: number): number {
  if (volumeCm3 <= 0) throw new RangeError('volume must be positive');
  return massG / volumeCm3;
}

// ---------------------------------------------------------------------------
// Concurrent forces (PHY-05)
// ---------------------------------------------------------------------------

export interface ForceVector {
  magnitudeN: number;
  /** Degrees, measured anticlockwise from the +x axis. */
  angleDeg: number;
}

function toComponents(v: ForceVector): { x: number; y: number } {
  const rad = (v.angleDeg * Math.PI) / 180;
  return { x: v.magnitudeN * Math.cos(rad), y: v.magnitudeN * Math.sin(rad) };
}

export function resultant(vectors: readonly ForceVector[]): {
  magnitudeN: number;
  angleDeg: number;
} {
  let x = 0;
  let y = 0;
  for (const v of vectors) {
    const c = toComponents(v);
    x += c.x;
    y += c.y;
  }
  const magnitudeN = Math.hypot(x, y);
  let angleDeg = (Math.atan2(y, x) * 180) / Math.PI;
  if (angleDeg < 0) angleDeg += 360;
  return { magnitudeN, angleDeg };
}

/** The single force that would hold three concurrent forces in equilibrium. */
export function equilibrant(vectors: readonly ForceVector[]): {
  magnitudeN: number;
  angleDeg: number;
} {
  const r = resultant(vectors);
  return { magnitudeN: r.magnitudeN, angleDeg: (r.angleDeg + 180) % 360 };
}

// ---------------------------------------------------------------------------
// Inclined plane (PHY-06)
// ---------------------------------------------------------------------------

export function limitingAngleDeg(coefficientOfFriction: number): number {
  return (Math.atan(coefficientOfFriction) * 180) / Math.PI;
}

export function coefficientFromAngle(angleDeg: number): number {
  return Math.tan((angleDeg * Math.PI) / 180);
}

export function accelerationOnIncline(
  angleDeg: number,
  coefficientOfFriction: number,
  g = G,
): number {
  const rad = (angleDeg * Math.PI) / 180;
  const net = g * (Math.sin(rad) - coefficientOfFriction * Math.cos(rad));
  return net > 0 ? net : 0;
}
