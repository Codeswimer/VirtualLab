/** Numeric helpers shared by solvers, the graph tool and the scoring engine. */

export interface Point {
  x: number;
  y: number;
}

export interface LineFit {
  gradient: number;
  intercept: number;
  r2: number;
}

/** Ordinary least squares; safe for vertical-ish data because x is the regressor. */
export function linearFit(points: readonly Point[]): LineFit | null {
  const n = points.length;
  if (n < 2) return null;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const meanX = sumX / n;
  const meanY = sumY / n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    sxx += (p.x - meanX) ** 2;
    sxy += (p.x - meanX) * (p.y - meanY);
    syy += (p.y - meanY) ** 2;
  }
  if (sxx === 0) return null;
  const gradient = sxy / sxx;
  const intercept = meanY - gradient * meanX;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { gradient, intercept, r2 };
}

export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, dp = 2): number {
  const factor = 10 ** dp;
  return Math.round(value * factor) / factor;
}

export function percentError(measured: number, expected: number): number {
  if (expected === 0) return Math.abs(measured) < 1e-12 ? 0 : Infinity;
  return Math.abs((measured - expected) / expected) * 100;
}

export function isWithin(value: number, expected: number, tolerance: number): boolean {
  return Math.abs(value - expected) <= tolerance;
}

/** Parse a student's numeric answer; tolerates units, commas and spaces. */
export function parseNumberAnswer(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/,/g, '')
    .replace(/[^\d.eE+\-–]/g, ' ')
    .trim()
    .split(/\s+/)[0];
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Verify a regression slope reported by a student against expected, in %. */
export function gradientWithin(grade: number, expected: number, tolerancePercent: number): boolean {
  if (!Number.isFinite(grade) || expected === 0) return false;
  return Math.abs((grade - expected) / expected) * 100 <= tolerancePercent;
}

/** A best-fit line drawn as two endpoints, scored against the expected slope. */
export interface DrawnLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function drawnLineGradient(line: DrawnLine): number | null {
  const dx = line.x2 - line.x1;
  if (Math.abs(dx) < 1e-12) return null;
  return (line.y2 - line.y1) / dx;
}
