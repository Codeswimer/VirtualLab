import { describe, expect, it } from 'vitest';
import {
  buretteInputIssue,
  concordantMean,
  isValidBuretteReading,
  measure,
  INSTRUMENTS,
  roundToStep,
} from './measurement';
import { createRng, hashSeed, mulberry32 } from './rng';
import { gFromT2Gradient, periodFiniteAmplitude, periodSmallAngle } from './physics/pendulum';
import { linearFit } from './math';
import { resultant, relativeDensityFromWeights, springExtensionCm } from './physics/mechanics';
import {
  angleOfRefraction,
  minimumDeviation,
  prismRefractiveIndex,
  refractiveIndexFromAngles,
  imageDistance,
} from './physics/optics';
import {
  cellCurrent,
  metreBridgeResistance,
  potentiometerEmf,
  terminalPdv,
} from './physics/electricity';
import { specificHeatFromMixture, coolingTemperature } from './physics/thermal';
import {
  analyteMolarityFromTitre,
  carbonateFirstEquivalencePH,
  expectedTitreCm3,
  indicatorColourName,
  METHYL_ORANGE,
  mixturePH,
  PHENOLPHTHALEIN,
  pHCarbonateWithStrongAcid,
  pHStrongAcidStrongBase,
  TITRATION_SYSTEMS,
  titrationCurve,
} from './chemistry/titration';
import { redoxAnalyteMolarity, redoxSystem } from './chemistry/redox';
import { observationMatches, testObservation, validateQualitativeData } from './chemistry/qualitative';
import { vernierReading, micrometerReading } from './physics/instruments';

describe('seeded RNG', () => {
  it('reproduces the same stream for the same seed', () => {
    const a = mulberry32(1234);
    const b = mulberry32(1234);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('derives independent streams from (seed, counter)', () => {
    expect(hashSeed(42, 1)).not.toBe(hashSeed(42, 2));
    expect(hashSeed(42, 1)).toBe(hashSeed(42, 1));
  });

  it('keeps normal deviates inside 4 sigma', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const v = rng.normal(0, 1);
      expect(Math.abs(v)).toBeLessThanOrEqual(4);
    }
  });
});

describe('measurement model', () => {
  it('rounds to the least count', () => {
    expect(roundToStep(12.347, 0.05)).toBeCloseTo(12.35);
    expect(roundToStep(4.44, 0.1)).toBeCloseTo(4.4);
  });

  it('applies a fixed zero error', () => {
    const reading = measure(2.0, 'vernierCalliper', { zeroError: 0.02 });
    expect(reading).toBeCloseTo(2.02, 2);
  });

  it('is deterministic for a seed and counter', () => {
    const first = measure(1.5, 'micrometer', { random: createRng(hashSeed(9, 1)).next });
    const second = measure(1.5, 'micrometer', { random: createRng(hashSeed(9, 1)).next });
    expect(first).toBe(second);
  });

  it('validates burette readings (2 d.p., final digit 0 or 5)', () => {
    expect(isValidBuretteReading(12.35)).toBe(true);
    expect(isValidBuretteReading(12.34)).toBe(false);
    expect(isValidBuretteReading(50.05)).toBe(false);
    expect(isValidBuretteReading(0)).toBe(true);
    expect(buretteInputIssue('12.30')).toBeNull();
    expect(buretteInputIssue('12.3')).toMatch(/2 decimal/);
    expect(buretteInputIssue('12.34')).toMatch(/last digit/);
  });

  it('picks the largest concordant group', () => {
    const result = concordantMean([24.1, 24.3, 24.2, 25.8, 24.15]);
    expect(result?.titres).toEqual([24.1, 24.15, 24.2, 24.3]);
    expect(result?.mean).toBeCloseTo(24.1875);
    expect(concordantMean([10, 20])).toBeNull();
  });

  it('exposes realistic least counts', () => {
    expect(INSTRUMENTS.burette.decimals).toBe(2);
    expect(INSTRUMENTS.vernierCalliper.leastCount).toBe(0.01);
    expect(INSTRUMENTS.thermometer.leastCount).toBe(0.5);
  });
});

describe('pendulum', () => {
  it('matches the analytic 30 cm period', () => {
    expect(periodSmallAngle(0.3)).toBeCloseTo(1.0989, 3);
  });

  it('grows with amplitude', () => {
    expect(periodFiniteAmplitude(1, 20)).toBeGreaterThan(periodSmallAngle(1));
  });

  it('recovers g from the T² vs L gradient', () => {
    const fit = linearFit([
      { x: 0.2, y: (2 * Math.PI) ** 2 * 0.2 / 9.81 + 0.0025 },
      { x: 0.5, y: (2 * Math.PI) ** 2 * 0.5 / 9.81 - 0.001 },
      { x: 0.8, y: (2 * Math.PI) ** 2 * 0.8 / 9.81 + 0.003 },
      { x: 1.0, y: (2 * Math.PI) ** 2 * 1.0 / 9.81 },
    ]);
    expect(fit).not.toBeNull();
    expect(gFromT2Gradient(fit!.gradient)).toBeCloseTo(9.81, 0);
  });
});

describe('mechanics', () => {
  it('computes spring extension in cm', () => {
    expect(springExtensionCm(100, 20)).toBeCloseTo(4.905, 2);
  });

  it('adds perpendicular concurrent forces', () => {
    const r = resultant([
      { magnitudeN: 3, angleDeg: 0 },
      { magnitudeN: 4, angleDeg: 90 },
    ]);
    expect(r.magnitudeN).toBeCloseTo(5);
    expect(r.angleDeg).toBeCloseTo(53.13, 1);
  });

  it('computes relative density from weights', () => {
    expect(relativeDensityFromWeights(54, 34)).toBeCloseTo(2.7);
    expect(() => relativeDensityFromWeights(30, 40)).toThrow();
  });
});

describe('optics', () => {
  it('obeys Snell’s law and recovers n', () => {
    const r = angleOfRefraction(45, 1.5);
    expect(refractiveIndexFromAngles(45, r)).toBeCloseTo(1.5, 6);
  });

  it('recovers n from minimum deviation of a 60° prism', () => {
    const n = 1.52;
    const dm = minimumDeviation(60, n);
    expect(prismRefractiveIndex(dm, 60)).toBeCloseTo(n, 2);
  });

  it('uses 1/f = 1/u + 1/v', () => {
    expect(imageDistance(30, 20)).toBeCloseTo(60);
  });
});

describe('electricity', () => {
  it('accounts for internal resistance', () => {
    const cell = { emfV: 1.5, internalResistanceOhm: 0.5 };
    expect(cellCurrent(cell, 2.5)).toBeCloseTo(0.5);
    expect(terminalPdv(cell, 2.5)).toBeCloseTo(1.25);
  });

  it('solves the metre bridge', () => {
    expect(metreBridgeResistance(2, 40)).toBeCloseTo((2 * 40) / 60);
  });

  it('scales EMF with balance length', () => {
    expect(potentiometerEmf(1.018, 50, 75)).toBeCloseTo(1.527);
  });
});

describe('thermal', () => {
  it('finds specific heat capacity by mixtures', () => {
    const c = specificHeatFromMixture({
      massWaterG: 100,
      initialWaterTempC: 25,
      massMetalG: 50,
      initialMetalTempC: 100,
      finalTempC: 35,
    });
    expect(c).toBeCloseTo((100 * 4.2 * 10) / (50 * 65), 4);
  });

  it('follows Newton’s law of cooling', () => {
    expect(coolingTemperature(80, 30, 0.05, 10)).toBeCloseTo(30 + 50 * Math.exp(-0.5));
  });
});

describe('titration engine', () => {
  it('starts basic and ends acidic for HCl into NaOH', () => {
    const acid = { volumeCm3: 0, molarity: 0.1 };
    const base = { volumeCm3: 25, molarity: 0.1 };
    expect(pHStrongAcidStrongBase(acid, base, 0)).toBeGreaterThan(12);
    expect(pHStrongAcidStrongBase(acid, base, 25)).toBeCloseTo(7, 2);
    expect(pHStrongAcidStrongBase(acid, base, 30)).toBeLessThan(2.5);
  });

  it('has two buffer stages for carbonate', () => {
    const acid = { volumeCm3: 0, molarity: 0.1 };
    const carbonate = { volumeCm3: 25, molarity: 0.05 };
    const first = carbonateFirstEquivalencePH(0.1, 0.05, 25);
    expect(first).toBeGreaterThan(8);
    expect(first).toBeLessThan(9);
    const nearCarbonic = pHCarbonateWithStrongAcid(acid, carbonate, 25);
    expect(nearCarbonic).toBeLessThan(5);
  });

  it('is continuous across equivalence', () => {
    const acid = { volumeCm3: 0, molarity: 0.1 };
    const base = { volumeCm3: 25, molarity: 0.1 };
    // The curve is steep but continuous through equivalence: no branch swap.
    const before = pHStrongAcidStrongBase(acid, base, 24.9);
    const after = pHStrongAcidStrongBase(acid, base, 25.1);
    expect(Number.isFinite(before)).toBe(true);
    expect(before).toBeGreaterThan(after);
    expect(before - after).toBeGreaterThan(2);
  });

  it('computes the expected titre and reverses it', () => {
    const system = TITRATION_SYSTEMS['hcl-na2co3'];
    const titre = expectedTitreCm3(system, 0.1, 0.05, 25);
    expect(titre).toBeCloseTo(25);
    expect(analyteMolarityFromTitre(system, 0.1, 25, 25)).toBeCloseTo(0.05);
  });

  it('produces an indicator colour name alongside the colour', () => {
    expect(indicatorColourName(METHYL_ORANGE, 2)).toBe('red');
    expect(indicatorColourName(METHYL_ORANGE, 7)).toBe('yellow');
    expect(indicatorColourName(PHENOLPHTHALEIN, 12)).toBe('pink');
    expect(indicatorColourName(PHENOLPHTHALEIN, 3)).toBe('colourless');
  });

  it('samples a monotonic falling curve', () => {
    const curve = titrationCurve('hcl-naoh', 0.1, 0.1, 25, 50, 1);
    expect(curve[0]!.pH).toBeGreaterThan(curve[curve.length - 1]!.pH);
    expect(mixturePH('hcl-naoh', 0.1, 0.1, 25, 25)).toBeCloseTo(7, 2);
  });
});

describe('redox', () => {
  it('scales moles by the balanced ratio', () => {
    const system = redoxSystem('permanganate-iron');
    const molarity = redoxAnalyteMolarity(system, 0.02, 25, 25);
    expect(molarity).toBeCloseTo(0.1);
  });
});

describe('qualitative rule tables', () => {
  it('passes schema validation', () => {
    expect(validateQualitativeData()).toEqual([]);
  });

  it('matches a well-written observation', () => {
    const test = testObservation('cations', 'cu2', 'nh3');
    expect(test).toBeDefined();
    expect(
      observationMatches('Pale blue precipitate, soluble in excess giving a deep blue solution', test!),
    ).toBe(true);
    expect(observationMatches('White precipitate', test!)).toBe(false);
  });
});

describe('instrument scales', () => {
  it('splits a vernier reading into main scale and vernier division', () => {
    const reading = vernierReading(2.34);
    expect(reading.mainCm).toBe(2.3);
    expect(reading.vernierIndex).toBe(4);
    expect(reading.readingCm).toBeCloseTo(2.34);
  });

  it('splits a micrometer reading into sleeve and thimble', () => {
    const reading = micrometerReading(3.47);
    expect(reading.sleeveMm).toBe(3.0);
    expect(reading.thimbleIndex).toBe(47);
    expect(reading.readingMm).toBeCloseTo(3.47, 2);
  });
});
