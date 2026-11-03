import { describe, expect, it } from 'vitest';
import { pendulumReleaseGeometry } from './pendulum-geometry';

const PIVOT: [number, number, number] = [0, 2.62, 0];

const distance = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe('pendulumReleaseGeometry', () => {
  it('hangs the bob directly below the pivot when released vertically', () => {
    const { bobPosition, pivotInBobFrame } = pendulumReleaseGeometry(PIVOT, 0.6, 0);
    expect(bobPosition[0]).toBeCloseTo(0, 12);
    expect(bobPosition[1]).toBeCloseTo(2.62 - 0.6, 12);
    expect(pivotInBobFrame[0]).toBeCloseTo(0, 12);
    expect(pivotInBobFrame[1]).toBeCloseTo(0.6, 12);
  });

  it('places a 90° release horizontally at the pivot height', () => {
    const { bobPosition, pivotInBobFrame } = pendulumReleaseGeometry(PIVOT, 0.5, 90 - 1e-9);
    expect(bobPosition[0]).toBeCloseTo(0.5, 7);
    expect(bobPosition[1]).toBeCloseTo(2.62, 7);
    expect(pivotInBobFrame[0]).toBeCloseTo(-0.5, 7);
    expect(pivotInBobFrame[1]).toBeCloseTo(0, 7);
  });

  it('keeps the joint length equal to L for every release angle', () => {
    for (const length of [0.3, 0.45, 0.6, 0.75, 0.9]) {
      for (const angle of [-20, -5, 0, 4, 10, 35]) {
        const { bobPosition, pivotInBobFrame } = pendulumReleaseGeometry(PIVOT, length, angle);
        expect(distance(bobPosition, PIVOT)).toBeCloseTo(length, 12);
        expect(distance(pivotInBobFrame, [0, 0, 0])).toBeCloseTo(length, 12);
      }
    }
  });

  it('mirrors the geometry for a negative release angle', () => {
    const left = pendulumReleaseGeometry(PIVOT, 0.6, -8);
    const right = pendulumReleaseGeometry(PIVOT, 0.6, 8);
    expect(left.bobPosition[0]).toBeCloseTo(-right.bobPosition[0], 12);
    expect(left.bobPosition[1]).toBeCloseTo(right.bobPosition[1], 12);
    expect(left.pivotInBobFrame[0]).toBeCloseTo(-right.pivotInBobFrame[0], 12);
  });

  it('rejects non-physical lengths and angles', () => {
    expect(() => pendulumReleaseGeometry(PIVOT, 0, 5)).toThrow(RangeError);
    expect(() => pendulumReleaseGeometry(PIVOT, -0.6, 5)).toThrow(RangeError);
    expect(() => pendulumReleaseGeometry(PIVOT, 0.6, 90)).toThrow(RangeError);
    expect(() => pendulumReleaseGeometry(PIVOT, 0.6, Number.NaN)).toThrow(RangeError);
  });
});
