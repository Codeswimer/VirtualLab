import type { AttemptData, ScoreResult } from '@sim/scoring/types';

export type Subject = 'PHYSICS' | 'CHEMISTRY';
export type Priority = 'P0' | 'P1' | 'P2';
export type ExamBody = 'WAEC' | 'NECO' | 'JAMB';

export type SceneKind =
  | 'pendulum'
  | 'spring'
  | 'moments'
  | 'displacement'
  | 'forces'
  | 'incline'
  | 'measure'
  | 'optics'
  | 'circuit'
  | 'bridge'
  | 'thermal'
  | 'cooling'
  | 'gas'
  | 'titration'
  | 'tubes'
  | 'food';

export interface ExperimentMeta {
  code: string;
  slug: string;
  title: string;
  subject: Subject;
  priority: Priority;
  examBodies: ExamBody[];
  summary: string;
  durationMin: number;
  apparatus: string[];
  skills: string[];
  /** What the student should be able to do afterwards. */
  objective: string;
  /** Curriculum reference note (Appendix A mapping). */
  curriculum: string;
}

export interface ProcedureStep {
  title: string;
  detail: string;
}

export interface TheoryBlock {
  heading: string;
  body: string;
  formula?: string;
}

export interface ColumnSpec {
  id: string;
  label: string;
  unit?: string;
  decimals?: number;
  kind: 'number' | 'text';
  /** Enforce burette convention (0–50 cm³, 2 d.p., last digit 0/5). */
  burette?: boolean;
  placeholder?: string;
  width?: 'sm' | 'md' | 'lg';
}

export interface TableSpec<S = any> {
  columns: ColumnSpec[];
  minRows: number;
  addRows: boolean;
  /** Column used to key readings (length, mass, volume…). */
  keyColumn?: string;
  instructions: string;
  /** Rows pre-filled on the bench (prescribed lengths, labelled samples…). */
  presets?: (scenario: S) => Record<string, string>[];
}

export interface GraphSpec<S> {
  xColumn: string;
  yColumn: string;
  xLabel: string;
  yLabel: string;
  xUnit: string;
  yUnit: string;
  prompt: string;
  expectedGradient: (scenario: S) => number;
  tolerancePercent: number;
  minimumPoints?: number;
}

export interface CalculationSpec<S> {
  id: string;
  label: string;
  unit: string;
  max: number;
  tolerancePercent: number;
  expected: (scenario: S) => number;
  help: string;
  /** Optional formula shown in the report. */
  formula?: string;
  /** True when the answer is the gradient of the student's graph. */
  fromGradient?: boolean;
}

export interface ParameterSpec<S = any> {
  id: string;
  label: string;
  unit?: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  /** Current value of this parameter in a generated scenario. */
  read: (scenario: S) => number;
  /** Returns a new scenario with this parameter changed, keeping derived values consistent. */
  apply: (scenario: S, value: number) => S;
}

export interface ExperimentDefinition<S = any> {
  meta: ExperimentMeta;
  scene: SceneKind;
  theory: TheoryBlock[];
  procedure: ProcedureStep[];
  table: TableSpec<S>;
  graph?: GraphSpec<S>;
  calculations: CalculationSpec<S>[];
  /** Scenario parameters, generated from the attempt seed. */
  generate: (seed: number) => S;
  /** Controls a student (or teacher) can use to vary the experiment by hand. */
  parameters?: ParameterSpec<S>[];
  /** Authoritative marking. Runs in the scoring service only. */
  score: (attempt: AttemptData, scenario: S) => ScoreResult;
  /** Coach tip shown beside the apparatus. */
  coachTip?: string;
  /** Optional qualitative identification choices. */
  choices?: { id: string; label: string; help?: string }[];
}

export function experimentTimeLabel(minutes: number): string {
  return minutes >= 60 ? `${Math.round((minutes / 60) * 10) / 10} hr` : `${minutes} min`;
}
