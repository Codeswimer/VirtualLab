/**
 * Types for an attempt and its rubric result. Shared by the lab UI and the
 * scoring service; the UI never writes marks (ADR-003).
 */

export interface GraphPoint {
  x: number;
  y: number;
}

export interface DrawnLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface GraphAnswer {
  /** Column ids selected for the axes. */
  xColumn: string;
  yColumn: string;
  xLabel: string;
  yLabel: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  points: GraphPoint[];
  line: DrawnLine | null;
  /** The student's own gradient value, as typed. */
  gradientEntry: string;
  triangle: boolean;
}

export type AttemptRow = Record<string, string>;

export interface AttemptData {
  experimentCode: string;
  seed: number;
  rows: AttemptRow[];
  answers: Record<string, string>;
  graph: GraphAnswer | null;
  /** Milestones the scene reached, e.g. `zeroErrorCorrected`. */
  flags: Record<string, boolean>;
  /** Free-text conclusion or observation notes. */
  notes: string;
  /** Manual bench parameters chosen before taking readings. */
  params?: Record<string, number>;
  startedAt?: string;
  submittedAt?: string;
}

export type CriterionKind = 'table' | 'graph' | 'calculation' | 'procedure' | 'conclusion';

export interface CriterionResult {
  id: string;
  label: string;
  kind: CriterionKind;
  awarded: number;
  max: number;
  feedback: string;
}

export interface ScoreResult {
  total: number;
  max: number;
  percent: number;
  grade: string;
  criteria: CriterionResult[];
  /** One-line summary shown at the top of the report. */
  summary: string;
}

export function gradeFor(percent: number): string {
  if (percent >= 75) return 'A1';
  if (percent >= 70) return 'B2';
  if (percent >= 65) return 'B3';
  if (percent >= 60) return 'C4';
  if (percent >= 55) return 'C5';
  if (percent >= 50) return 'C6';
  if (percent >= 45) return 'D7';
  if (percent >= 40) return 'E8';
  return 'F9';
}
