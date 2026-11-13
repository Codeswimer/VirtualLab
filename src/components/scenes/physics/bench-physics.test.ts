import { describe, expect, it } from 'vitest';
import {
  angleFromVertical,
  bottleMouthOffset,
  buretteFlowRateCm3PerSecond,
  isDropwise,
  liquidFraction,
  pendulumTensionN,
  pourRateCm3PerSecond,
  springExtensionM,
  springForceN,
  tiltForNeckOffset,
  transferVolumeCm3,
} from './bench-physics';

describe('pendulum bench physics', () => {
  it('measures the angle from the downward vertical', () => {
    expect(angleFromVertical(0, 0, 0, 2)).toBeCloseTo(0);
    expect(angleFromVertical(1, 2, 0, 2)).toBeCloseTo(Math.PI / 2);
  });

  it('gives mg of tension at the bottom and more while swinging', () => {
    const atBottom = pendulumTensionN({
      massKg: 0.1,
      gravity: 9.81,
      lengthM: 0.6,
      angleRad: 0,
      speedMs: 0,
    });
    expect(atBottom).toBeCloseTo(0.981);

    const swinging = pendulumTensionN({
      massKg: 0.1,
      gravity: 9.81,
      lengthM: 0.6,
      angleRad: 0,
      speedMs: 1.2,
    });
    expect(swinging).toBeGreaterThan(atBottom);
  });
});

describe('spring bench physics', () => {
  it('follows Hooke’s law', () => {
    expect(springForceN(30, 0.05)).toBeCloseTo(1.5);
    expect(springExtensionM(0.2, 40)).toBeCloseTo((0.2 * 9.81) / 40);
  });
});

describe('pouring bench physics', () => {
  it('does not pour below the lip threshold', () => {
    expect(pourRateCm3PerSecond(10)).toBe(0);
    expect(pourRateCm3PerSecond(24)).toBe(0);
  });

  it('increases monotonically with tilt', () => {
    const rates = [30, 40, 55, 70, 80].map((tilt) => pourRateCm3PerSecond(tilt));
    for (let i = 1; i < rates.length; i += 1) {
      expect(rates[i]).toBeGreaterThan(rates[i - 1] ?? 0);
    }
  });

  it('maps a neck position to the tilt that reaches it', () => {
    const height = 0.42;
    const tilt = tiltForNeckOffset(0.18, height);
    expect(tilt).toBeLessThan(0);
    expect(bottleMouthOffset(tilt, height).x).toBeCloseTo(0.18, 6);
  });

  it('never transfers more liquid than is available', () => {
    expect(transferVolumeCm3(10, 0.5, 2)).toBe(2);
    expect(transferVolumeCm3(10, 0.1, 20)).toBeCloseTo(1);
    expect(transferVolumeCm3(0, 1, 20)).toBe(0);
  });

  it('clamps liquid fractions', () => {
    expect(liquidFraction(5, 10)).toBe(0.5);
    expect(liquidFraction(-1, 10)).toBe(0);
    expect(liquidFraction(20, 10)).toBe(1);
  });
});

describe('burette bench physics', () => {
  it('opens smoothly from a closed tap', () => {
    expect(buretteFlowRateCm3PerSecond(0)).toBe(0);
    expect(buretteFlowRateCm3PerSecond(1)).toBeCloseTo(2.4);
    expect(buretteFlowRateCm3PerSecond(0.5)).toBeLessThan(2.4);
    expect(buretteFlowRateCm3PerSecond(0.5)).toBeGreaterThan(
      buretteFlowRateCm3PerSecond(0.2),
    );
  });

  it('recognises a dropwise tap', () => {
    expect(isDropwise(buretteFlowRateCm3PerSecond(0.2))).toBe(true);
    expect(isDropwise(buretteFlowRateCm3PerSecond(0.15))).toBe(true);
    expect(isDropwise(buretteFlowRateCm3PerSecond(0.8))).toBe(false);
  });
});
