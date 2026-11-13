import { describe, expect, it } from 'vitest';
import { pendulumBobPosition } from './pendulum-geometry';

const PIVOT: [number, number, number] = [0, 2.62, 0];

const distance = (a: readonly number[], b: readonly number[]): number =>
  Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

describe('pendulumBobPosition', () => {
  it('hangs the bob directly below the pivot when released vertically', () => {
    const bob = pendulumBobPosition(PIVOT, 0.6, 0);
    expect(bob[0]).toBeCloseTo(0, 12);
    expect(bob[1]).toBeCloseTo(2.62 - 0.6, 12);
    expect(bob[2]).toBeCloseTo(0, 12);
  });

  it('places a 90° release horizontally at the pivot height', () => {
    const bob = pendulumBobPosition(PIVOT, 0.5, Math.PI / 2);
    expect(bob[0]).toBeCloseTo(0.5, 12);
    expect(bob[1]).toBeCloseTo(2.62, 12);
  });

  it('keeps the string length equal to L at every angle', () => {
    for (const length of [0.3, 0.45, 0.6, 0.75, 0.9]) {
      for (const degrees of [-20, -5, 0, 4, 10, 35]) {
        const bob = pendulumBobPosition(PIVOT, length, (degrees * Math.PI) / 180);
        expect(distance(bob, PIVOT)).toBeCloseTo(length, 12);
      }
    }
  });

  it('mirrors the geometry for a negative angle', () => {
    const left = pendulumBobPosition(PIVOT, 0.6, -0.14);
    const right = pendulumBobPosition(PIVOT, 0.6, 0.14);
    expect(left[0]).toBeCloseTo(-right[0]!, 12);
    expect(left[1]).toBeCloseTo(right[1]!, 12);
  });

  it('rejects non-physical lengths and angles', () => {
    expect(() => pendulumBobPosition(PIVOT, 0, 0.1)).toThrow(RangeError);
    expect(() => pendulumBobPosition(PIVOT, -0.6, 0.1)).toThrow(RangeError);
    expect(() => pendulumBobPosition(PIVOT, 0.6, Number.NaN)).toThrow(RangeError);
  });
});
