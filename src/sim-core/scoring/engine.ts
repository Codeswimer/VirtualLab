/**
 * Rubric engine helpers. Scoring runs in the marking service (ADR-003): the
 * client submits the attempt, the service regenerates the scenario from `seed`
 * and recomputes every expected value with the same sim-core solvers.
 */

import { buretteInputIssue, concordantMean, countDecimals } from '../measurement';
import { drawnLineGradient, parseNumberAnswer } from '../math';
import type {
  AttemptData,
  AttemptRow,
  CriterionKind,
  CriterionResult,
  GraphAnswer,
  ScoreResult,
} from './types';
import { gradeFor } from './types';

export interface CriterionSpec {
  id: string;
  label: string;
  kind: CriterionKind;
  max: number;
  awarded: number;
  feedback: string;
}

export function criterion(spec: CriterionSpec): CriterionResult {
  const max = Math.max(0, spec.max);
  const awarded = Math.max(0, Math.min(max, Math.round(spec.awarded * 2) / 2));
  return {
    id: spec.id,
    label: spec.label,
    kind: spec.kind,
    max,
    awarded,
    feedback: spec.feedback,
  };
}

export function summarise(criteria: CriterionResult[]): ScoreResult {
  const max = criteria.reduce((s, c) => s + c.max, 0);
  const total = criteria.reduce((s, c) => s + c.awarded, 0);
  const percent = max === 0 ? 0 : Math.round((total / max) * 1000) / 10;
  const weakest = [...criteria].sort(
    (a, b) => a.max - a.awarded - (b.max - b.awarded),
  )[0];
  const summary =
    percent >= 75
      ? 'Excellent practical work — your readings, graph and calculations are examination-ready.'
      : total === 0
        ? 'No marks yet. Record readings, plot the graph and answer the calculations.'
        : `Solid start. Focus next on: ${weakest?.label.toLowerCase() ?? 'your report'} — ${
            weakest ? `${Math.max(0, weakest.max - weakest.awarded)} mark(s) still available` : ''
          }.`;
  return { total, max, percent, grade: gradeFor(percent), criteria, summary };
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export interface TableScoreOptions {
  /** Column that identifies a row (length used, mass added, etc.). */
  keyColumn: string;
  /** Numeric columns compared with tolerance. */
  compareColumns: string[];
  tolerancePercent?: number;
  /** Decimal places required per column (exam convention). */
  decimals?: Record<string, number>;
  /** Burette-style columns (0–50, 2 d.p., final digit 0 or 5). */
  buretteColumns?: string[];
  marks: { recorded: number; accurate: number; precision: number };
}

function normKey(value: string | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, '').replace(/,/g, '');
}

function keyMatches(a: string, b: string): boolean {
  const parsedA = Number(a);
  const parsedB = Number(b);
  if (Number.isFinite(parsedA) && Number.isFinite(parsedB) && a !== '' && b !== '') {
    return Math.abs(parsedA - parsedB) < 1e-6;
  }
  return normKey(a) === normKey(b);
}

export interface ExpectedTable {
  keys: string[];
  /** Column id → true value for each expected row, aligned with `keys`. */
  values?: Record<string, number[]>;
}

export function scoreTable(
  rows: AttemptRow[],
  expected: ExpectedTable,
  options: TableScoreOptions,
): CriterionResult[] {
  const tolerance = options.tolerancePercent ?? 5;
  const found: (AttemptRow | null)[] = expected.keys.map(
    (key) => rows.find((r) => keyMatches(r[options.keyColumn] ?? '', key)) ?? null,
  );
  const present = found.filter((r): r is AttemptRow => r !== null);
  const recordedFraction = expected.keys.length === 0 ? 0 : present.length / expected.keys.length;

  const cells: { row: number; column: string; ok: boolean; given: string; want: number }[] = [];
  if (expected.values) {
    for (const column of options.compareColumns) {
      const wanted = expected.values[column];
      if (!wanted) continue;
      found.forEach((row, index) => {
        const want = wanted[index];
        if (want === undefined) return;
        const given = row?.[column] ?? '';
        const value = parseNumberAnswer(given);
        if (value === null || want === 0) return;
        cells.push({
          row: index,
          column,
          ok: Math.abs((value - want) / want) * 100 <= tolerance,
          given,
          want,
        });
      });
    }
  }
  const accurateFraction =
    cells.length === 0 ? 0 : cells.filter((c) => c.ok).length / cells.length;

  let precisionChecks = 0;
  let precisionGood = 0;
  for (const row of present) {
    for (const column of options.compareColumns) {
      const required = options.decimals?.[column];
      const raw = row[column];
      if (required === undefined || !raw) continue;
      precisionChecks++;
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      const decimals = countDecimals(raw);
      if (decimals === required) precisionGood++;
    }
    for (const column of options.buretteColumns ?? []) {
      const raw = row[column];
      if (!raw) continue;
      precisionChecks++;
      if (buretteInputIssue(raw) === null) precisionGood++;
    }
  }
  const precisionFraction = precisionChecks === 0 ? 1 : precisionGood / precisionChecks;

  const missing = expected.keys.filter((_key, i) => found[i] === null);
  const feedbackBits: string[] = [];
  if (missing.length > 0) {
    feedbackBits.push(`${missing.length} required row(s) missing (${missing.slice(0, 3).join(', ')}).`);
  } else {
    feedbackBits.push('All required rows recorded.');
  }
  const bad = cells.filter((c) => !c.ok);
  if (bad.length > 0) {
    feedbackBits.push(
      `${bad.length} reading(s) outside ±${tolerance}% — recheck the instrument or repeat the trial.`,
    );
  }
  if (precisionChecks > 0 && precisionFraction < 1) {
    feedbackBits.push('Some values were not recorded to the required number of decimal places.');
  }

  const round = (v: number): number => Math.round(v * 2) / 2;
  return [
    criterion({
      id: 'table-recorded',
      label: 'Readings recorded',
      kind: 'table',
      max: options.marks.recorded,
      awarded: options.marks.recorded * recordedFraction,
      feedback: feedbackBits[0] ?? '',
    }),
    criterion({
      id: 'table-accurate',
      label: 'Readings accurate',
      kind: 'table',
      max: options.marks.accurate,
      awarded: options.marks.accurate * accurateFraction,
      feedback:
        cells.length === 0
          ? 'No comparable numeric readings yet.'
          : `${cells.filter((c) => c.ok).length}/${cells.length} numeric readings within ±${tolerance}%.`,
    }),
    criterion({
      id: 'table-precision',
      label: 'Instrument precision respected',
      kind: 'table',
      max: options.marks.precision,
      awarded: options.marks.precision * precisionFraction,
      feedback:
        precisionChecks === 0
          ? 'No precision checks applicable.'
          : `${precisionGood}/${precisionChecks} values recorded to the examination convention.`,
    }),
  ].map((c) => ({ ...c, awarded: round(c.awarded) }));
}

// ---------------------------------------------------------------------------
// Graphs
// ---------------------------------------------------------------------------

export interface GraphScoreOptions {
  expectedGradient: number;
  gradientTolerancePercent?: number;
  xLabelHint?: string;
  yLabelHint?: string;
  minimumPoints?: number;
  marks?: { points: number; labels: number; scale: number; gradient: number };
}

export function scoreGraph(
  graph: GraphAnswer | null,
  options: GraphScoreOptions,
): CriterionResult[] {
  const marks = options.marks ?? { points: 1, labels: 1, scale: 1, gradient: 2 };
  if (!graph) {
    return [
      criterion({
        id: 'graph',
        label: 'Graph plotted',
        kind: 'graph',
        max: marks.points + marks.labels + marks.scale + marks.gradient,
        awarded: 0,
        feedback: 'No graph submitted. Plot your readings and draw the best-fit line.',
      }),
    ];
  }
  const minimumPoints = options.minimumPoints ?? 4;
  const pointsOk = graph.points.length >= minimumPoints;
  const labelsOk = graph.xLabel.trim().length > 0 && graph.yLabel.trim().length > 0;
  const scaleOk =
    Number.isFinite(graph.xMin) &&
    Number.isFinite(graph.yMin) &&
    graph.xMax > graph.xMin &&
    graph.yMax > graph.yMin;
  const gradient = graph.line ? drawnLineGradient(graph.line) : null;
  const tol = options.gradientTolerancePercent ?? 12;
  const gradientOk =
    gradient !== null &&
    options.expectedGradient !== 0 &&
    Math.abs((gradient - options.expectedGradient) / options.expectedGradient) * 100 <= tol;

  return [
    criterion({
      id: 'graph-points',
      label: 'Points plotted',
      kind: 'graph',
      max: marks.points,
      awarded: pointsOk ? marks.points : marks.points * Math.min(1, graph.points.length / minimumPoints),
      feedback: pointsOk
        ? `${graph.points.length} points plotted.`
        : `Plot at least ${minimumPoints} points from your table (currently ${graph.points.length}).`,
    }),
    criterion({
      id: 'graph-labels',
      label: 'Axes labelled with units',
      kind: 'graph',
      max: marks.labels,
      awarded: labelsOk ? marks.labels : 0,
      feedback: labelsOk
        ? 'Both axes carry a quantity and unit.'
        : `Label both axes with quantity and unit, e.g. "${options.yLabelHint ?? 'y'}".`,
    }),
    criterion({
      id: 'graph-scale',
      label: 'Sensible scale',
      kind: 'graph',
      max: marks.scale,
      awarded: scaleOk ? marks.scale : 0,
      feedback: scaleOk ? 'Scale covers the data with room to read it.' : 'Choose a scale that covers all points.',
    }),
    criterion({
      id: 'graph-gradient',
      label: 'Best-fit line and gradient',
      kind: 'graph',
      max: marks.gradient,
      awarded: gradientOk ? marks.gradient : 0,
      feedback:
        gradient === null
          ? 'Draw a best-fit line through the plotted points.'
          : gradientOk
            ? `Gradient ${gradient.toPrecision(3)} is consistent with the expected value.`
            : `Gradient ${gradient.toPrecision(3)} is outside ±${tol}% of the expected value — check the scale and the fit.`,
    }),
  ];
}

// ---------------------------------------------------------------------------
// Calculations and procedure
// ---------------------------------------------------------------------------

export interface CalcSpecLike {
  id: string;
  label: string;
  unit: string;
  max: number;
  tolerancePercent: number;
  expected: number;
}

export function scoreCalculations(
  answers: Record<string, string>,
  specs: CalcSpecLike[],
): CriterionResult[] {
  return specs.map((spec) => {
    const value = parseNumberAnswer(answers[spec.id] ?? '');
    if (value === null) {
      return criterion({
        id: `calc-${spec.id}`,
        label: spec.label,
        kind: 'calculation',
        max: spec.max,
        awarded: 0,
        feedback: `No answer given (expected in ${spec.unit}).`,
      });
    }
    const ok =
      Math.abs(value - spec.expected) <=
      Math.abs(spec.expected) * (spec.tolerancePercent / 100);
    const near =
      Math.abs(value - spec.expected) <=
      Math.abs(spec.expected) * (spec.tolerancePercent / 100) * 2;
    const awarded = ok ? spec.max : near ? spec.max / 2 : 0;
    return criterion({
      id: `calc-${spec.id}`,
      label: spec.label,
      kind: 'calculation',
      max: spec.max,
      awarded,
      feedback: ok
        ? `Correct (${spec.expected.toPrecision(4)} ${spec.unit}).`
        : awarded > 0
          ? `Close — the expected value is ${spec.expected.toPrecision(4)} ${spec.unit}. Check your arithmetic.`
          : `Your value is far from ${spec.expected.toPrecision(4)} ${spec.unit}. Show every step: moles → mole ratio → concentration.`,
    });
  });
}

export interface ProcedureCriterion {
  id: string;
  label: string;
  max: number;
  flag?: string;
  check?: (attempt: AttemptData) => boolean;
  feedbackPass: string;
  feedbackFail: string;
}

export function scoreProcedure(
  attempt: AttemptData,
  criteria: ProcedureCriterion[],
): CriterionResult[] {
  return criteria.map((spec) => {
    const passed = spec.check ? spec.check(attempt) : Boolean(spec.flag && attempt.flags[spec.flag]);
    return criterion({
      id: `proc-${spec.id}`,
      label: spec.label,
      kind: 'procedure',
      max: spec.max,
      awarded: passed ? spec.max : 0,
      feedback: passed ? spec.feedbackPass : spec.feedbackFail,
    });
  });
}

/** Compare a free-text conclusion against required keywords. */
export function scoreConclusion(
  text: string,
  keywords: string[],
  max: number,
  expectedPhrase: string,
): CriterionResult {
  const lower = text.toLowerCase();
  const hits = keywords.filter((k) => lower.includes(k.toLowerCase())).length;
  const ratio = keywords.length === 0 ? 0 : hits / keywords.length;
  const awarded = ratio >= 0.8 ? max : ratio >= 0.4 ? max / 2 : 0;
  return criterion({
    id: 'conclusion',
    label: 'Conclusion / inference',
    kind: 'conclusion',
    max,
    awarded,
    feedback:
      awarded === max
        ? 'Clear conclusion supported by the evidence.'
        : awarded > 0
          ? `Partly correct. A complete conclusion should state: ${expectedPhrase}.`
          : `State a conclusion that names the quantity found and its value, e.g. "${expectedPhrase}".`,
  });
}

/** Titre marks: concordance and precision, shared by the titration family. */
export function scoreTitres(
  titres: (number | null)[],
  expectedTitre: number,
  marks = { concordance: 3, accuracy: 2, precision: 1 },
): CriterionResult[] {
  const valid = titres.filter((t): t is number => t !== null && Number.isFinite(t));
  const group = concordantMean(valid, 0.2);
  const spread = group ? Math.max(...group.titres) - Math.min(...group.titres) : null;
  const meanTitre = group?.mean ?? (valid.length > 0 ? valid.reduce((s, v) => s + v, 0) / valid.length : null);
  const accuracyOk =
    meanTitre !== null && Math.abs(meanTitre - expectedTitre) <= Math.max(0.15, expectedTitre * 0.005);
  const precisionOk = valid.length > 0 && valid.every((t) => Math.round(t * 100) % 5 === 0);

  return [
    criterion({
      id: 'titre-concordance',
      label: 'Concordant titres',
      kind: 'table',
      max: marks.concordance,
      awarded:
        group && group.titres.length >= 3
          ? marks.concordance
          : group
            ? marks.concordance * 0.6
            : valid.length > 0
              ? marks.concordance * 0.2
              : 0,
      feedback: group
        ? `${group.titres.length} concordant titres within ${spread?.toFixed(2)} cm³; mean ${group.mean.toFixed(2)} cm³.`
        : 'Repeat the titration until at least three titres agree within 0.20 cm³.',
    }),
    criterion({
      id: 'titre-accuracy',
      label: 'Titre agrees with the end-point',
      kind: 'table',
      max: marks.accuracy,
      awarded: accuracyOk ? marks.accuracy : meanTitre !== null ? marks.accuracy / 2 : 0,
      feedback: accuracyOk
        ? 'Your running mean is at the end-point volume.'
        : 'Your titres drift away from the true end-point — check the indicator and add dropwise near the end-point.',
    }),
    criterion({
      id: 'titre-precision',
      label: 'Burette readings recorded correctly',
      kind: 'table',
      max: marks.precision,
      awarded: precisionOk ? marks.precision : 0,
      feedback: precisionOk
        ? 'All readings to 2 d.p. with a final digit of 0 or 5.'
        : 'Burette readings must be written to 2 d.p. with the final digit 0 or 5.',
    }),
  ];
}
