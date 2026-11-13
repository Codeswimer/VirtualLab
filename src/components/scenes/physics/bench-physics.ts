/**
 * Pure physics helpers for the direct-manipulation benches.
 *
 * The 3D scenes use Rapier for the rigid-body behaviour; these functions cover
 * the quantities the apparatus must read back (tension, spring force, pour and
 * burette flow) so the numbers stay testable without a WebGL context.
 */

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

// ---------------------------------------------------------------------------
// Pendulum
// ---------------------------------------------------------------------------

/** Angle of a pendulum from the downward vertical, radians. */
export function angleFromVertical(
  x: number,
  y: number,
  pivotX: number,
  pivotY: number,
): number {
  return Math.atan2(x - pivotX, pivotY - y);
}

/**
 * Tension in the pendulum thread at an instant:
 * T = m(g cosθ + v²/L).
 */
export function pendulumTensionN({
  massKg,
  gravity,
  lengthM,
  angleRad,
  speedMs,
}: {
  massKg: number;
  gravity: number;
  lengthM: number;
  angleRad: number;
  speedMs: number;
}): number {
  if (!Number.isFinite(massKg) || massKg <= 0) return 0;
  if (!Number.isFinite(lengthM) || lengthM <= 0) return 0;
  const speed = Number.isFinite(speedMs) ? speedMs : 0;
  return massKg * (gravity * Math.cos(angleRad) + (speed * speed) / lengthM);
}

// ---------------------------------------------------------------------------
// Spring
// ---------------------------------------------------------------------------

/** Hooke's law force in newtons for an extension in metres. */
export function springForceN(stiffnessNm: number, extensionM: number): number {
  return stiffnessNm * Math.max(0, extensionM);
}

/** Extension in metres for a hanging load. */
export function springExtensionM(massKg: number, stiffnessNm: number, gravity = 9.81): number {
  if (stiffnessNm <= 0) return 0;
  return (massKg * gravity) / stiffnessNm;
}

// ---------------------------------------------------------------------------
// Pouring
// ---------------------------------------------------------------------------

/** Tilt at which liquid just reaches the lip of a bottle. */
export const POUR_THRESHOLD_DEG = 24;
/** Tilt at which the bottle is fully inverted. */
export const POUR_FULL_DEG = 82;
/** Flow at full inversion, cm³/s. Slow enough to watch the level rise. */
export const POUR_MAX_RATE_CM3_S = 4.2;

/**
 * Gravity-driven pour rate as a function of tilt. Below the lip threshold no
 * liquid leaves the bottle; close to the threshold the flow is a slow drip.
 */
export function pourRateCm3PerSecond(
  tiltDeg: number,
  maxRateCm3PerSecond = POUR_MAX_RATE_CM3_S,
): number {
  if (!Number.isFinite(tiltDeg) || tiltDeg <= POUR_THRESHOLD_DEG) return 0;
  const t = clamp(
    (tiltDeg - POUR_THRESHOLD_DEG) / (POUR_FULL_DEG - POUR_THRESHOLD_DEG),
    0,
    1,
  );
  return maxRateCm3PerSecond * t ** 1.35;
}

/** Where the mouth of a bottle sits relative to its base when tilted. */
export function bottleMouthOffset(
  tiltRad: number,
  heightM: number,
): { x: number; y: number } {
  return {
    x: -heightM * Math.sin(tiltRad),
    y: heightM * Math.cos(tiltRad),
  };
}

/** Tilt that brings the neck to a given horizontal offset from the base. */
export function tiltForNeckOffset(offsetX: number, heightM: number): number {
  if (heightM <= 0) return 0;
  const limit = Math.sin((POUR_FULL_DEG * Math.PI) / 180);
  return -Math.asin(clamp(offsetX / heightM, -limit, limit));
}

/** Volume delivered in one frame, never more than remains in the source. */
export function transferVolumeCm3(
  rateCm3PerSecond: number,
  deltaSeconds: number,
  availableCm3: number,
): number {
  if (rateCm3PerSecond <= 0 || deltaSeconds <= 0 || availableCm3 <= 0) return 0;
  return Math.min(availableCm3, rateCm3PerSecond * deltaSeconds);
}

/** Liquid level as a fraction of a vessel's capacity, clamped to [0, 1]. */
export function liquidFraction(volumeCm3: number, capacityCm3: number): number {
  if (capacityCm3 <= 0) return 0;
  return clamp(volumeCm3 / capacityCm3, 0, 1);
}

// ---------------------------------------------------------------------------
// Burette
// ---------------------------------------------------------------------------

/** Maximum flow from a fully open burette tap, cm³/s. */
export const BURETTE_MAX_RATE_CM3_S = 2.4;

/**
 * Flow from a burette tap. The exponent makes the last part of a turn very
 * fine, which is how a real stopcock behaves near the end-point.
 */
export function buretteFlowRateCm3PerSecond(
  opening: number,
  maxRateCm3PerSecond = BURETTE_MAX_RATE_CM3_S,
): number {
  const o = clamp(opening, 0, 1);
  return maxRateCm3PerSecond * o ** 1.8;
}

/** True when the tap is passing only drops. */
export function isDropwise(rateCm3PerSecond: number): boolean {
  return rateCm3PerSecond > 0 && rateCm3PerSecond <= 0.16;
}
