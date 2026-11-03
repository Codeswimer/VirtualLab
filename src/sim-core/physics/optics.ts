/** Geometric optics: refraction, prism deviation, thin lenses and mirrors. */

export const deg = (rad: number): number => (rad * 180) / Math.PI;
export const rad = (degrees: number): number => (degrees * Math.PI) / 180;

// ---------------------------------------------------------------------------
// Refraction through a rectangular glass block (PHY-08)
// ---------------------------------------------------------------------------

export function angleOfRefraction(incidenceDeg: number, refractiveIndex: number): number {
  const sinR = Math.sin(rad(incidenceDeg)) / refractiveIndex;
  return deg(Math.asin(Math.max(-1, Math.min(1, sinR))));
}

export function refractiveIndexFromAngles(incidenceDeg: number, refractionDeg: number): number {
  const sinR = Math.sin(rad(refractionDeg));
  if (Math.abs(sinR) < 1e-12) return NaN;
  return Math.sin(rad(incidenceDeg)) / sinR;
}

export function criticalAngle(refractiveIndex: number): number {
  return deg(Math.asin(1 / refractiveIndex));
}

/** Real depth below a liquid surface, apparent depth seen from normal incidence. */
export function apparentDepth(realDepthCm: number, refractiveIndex: number): number {
  return realDepthCm / refractiveIndex;
}

/** Lateral displacement of a ray through a parallel-sided block of thickness t. */
export function lateralDisplacementCm(
  incidenceDeg: number,
  thicknessCm: number,
  refractiveIndex: number,
): number {
  const r = rad(angleOfRefraction(incidenceDeg, refractiveIndex));
  return (thicknessCm * Math.sin(rad(incidenceDeg) - r)) / Math.cos(r);
}

// ---------------------------------------------------------------------------
// Triangular prism (PHY-09)
// ---------------------------------------------------------------------------

/** Deviation produced by a prism of apex angle A at incidence i. */
export function prismDeviation(
  incidenceDeg: number,
  apexAngleDeg: number,
  refractiveIndex: number,
): number {
  const r1 = deg(Math.asin(Math.sin(rad(incidenceDeg)) / refractiveIndex));
  const theta2 = apexAngleDeg - r1;
  const s = Math.sin(rad(theta2)) * refractiveIndex;
  if (Math.abs(s) > 1) return NaN; // total internal reflection at the second face
  const r2 = deg(Math.asin(s));
  return incidenceDeg + r2 - apexAngleDeg;
}

/** Minimum deviation by scanning incidence angles (robust near TIR). */
export function minimumDeviation(apexAngleDeg: number, refractiveIndex: number): number {
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < 89; i += 0.05) {
    const d = prismDeviation(i, apexAngleDeg, refractiveIndex);
    if (Number.isFinite(d) && d < best) best = d;
  }
  return best;
}

export function prismRefractiveIndex(minDeviationDeg: number, apexAngleDeg: number): number {
  return (
    Math.sin(rad((apexAngleDeg + minDeviationDeg) / 2)) /
    Math.sin(rad(apexAngleDeg / 2))
  );
}

// ---------------------------------------------------------------------------
// Thin lens / concave mirror (PHY-10)
// ---------------------------------------------------------------------------

export function imageDistance(objectDistanceCm: number, focalLengthCm: number): number {
  const inv = 1 / focalLengthCm - 1 / objectDistanceCm;
  if (Math.abs(inv) < 1e-12) return Infinity;
  return 1 / inv;
}

export function linearMagnification(objectDistanceCm: number, imageDistanceCm: number): number {
  return -imageDistanceCm / objectDistanceCm;
}

/** Focal length from a 1/v against 1/u plot (intercept = 1/f). */
export function focalLengthFromPlot(interceptPerCm: number): number {
  return 1 / interceptPerCm;
}
