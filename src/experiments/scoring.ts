import type { AttemptData, CriterionResult, ScoreResult } from '@sim/scoring/types';
import {
  scoreCalculations,
  scoreConclusion,
  scoreGraph,
  scoreProcedure,
  scoreTable,
  summarise,
  type ProcedureCriterion,
} from '@sim/scoring/engine';
import type { ExperimentDefinition } from './types';

export interface QuantitativeConfig<S> {
  expectedKeys: (scenario: S) => string[];
  values?: (scenario: S) => Record<string, number[]>;
  compareColumns: string[];
  tolerancePercent?: number;
  decimals?: Record<string, number>;
  buretteColumns?: string[];
  tableMarks?: { recorded: number; accurate: number; precision: number };
  procedure?: ProcedureCriterion[];
  conclusion?: {
    keywords: string[];
    phrase: string;
    max: number;
  };
  /** Additional criteria computed by the module (e.g. indicator choice). */
  extra?: (attempt: AttemptData, scenario: S) => CriterionResult[];
}

export function scoreQuantitative<S>(
  def: ExperimentDefinition<S>,
  config: QuantitativeConfig<S>,
  attempt: AttemptData,
  scenario: S,
): ScoreResult {
  const tableMarks = config.tableMarks ?? { recorded: 2, accurate: 3, precision: 1 };
  const tableCriteria = scoreTable(
    attempt.rows,
    {
      keys: config.expectedKeys(scenario),
      ...(config.values ? { values: config.values(scenario) } : {}),
    },
    {
      keyColumn: def.table.keyColumn ?? def.table.columns[0]?.id ?? '',
      compareColumns: config.compareColumns,
      ...(config.tolerancePercent !== undefined
        ? { tolerancePercent: config.tolerancePercent }
        : {}),
      ...(config.decimals ? { decimals: config.decimals } : {}),
      ...(config.buretteColumns ? { buretteColumns: config.buretteColumns } : {}),
      marks: tableMarks,
    },
  );

  const calcCriteria = scoreCalculations(
    attempt.answers,
    def.calculations.map((spec) => ({
      id: spec.id,
      label: spec.label,
      unit: spec.unit,
      max: spec.max,
      tolerancePercent: spec.tolerancePercent,
      expected: spec.expected(scenario),
    })),
  );

  const graphCriteria =
    def.graph && attempt.graph
      ? scoreGraph(attempt.graph, {
          expectedGradient: def.graph.expectedGradient(scenario),
          gradientTolerancePercent: def.graph.tolerancePercent,
          xLabelHint: `${def.graph.xLabel} / ${def.graph.xUnit}`,
          yLabelHint: `${def.graph.yLabel} / ${def.graph.yUnit}`,
          ...(def.graph.minimumPoints !== undefined
            ? { minimumPoints: def.graph.minimumPoints }
            : {}),
        })
      : def.graph
        ? scoreGraph(null, {
            expectedGradient: def.graph.expectedGradient(scenario),
            gradientTolerancePercent: def.graph.tolerancePercent,
          })
        : [];

  const procedureCriteria = config.procedure ? scoreProcedure(attempt, config.procedure) : [];

  const conclusionCriteria = config.conclusion
    ? [
        scoreConclusion(
          attempt.notes,
          config.conclusion.keywords,
          config.conclusion.max,
          config.conclusion.phrase,
        ),
      ]
    : [];

  const extra = config.extra ? config.extra(attempt, scenario) : [];

  return summarise([
    ...tableCriteria,
    ...calcCriteria,
    ...graphCriteria,
    ...procedureCriteria,
    ...conclusionCriteria,
    ...extra,
  ]);
}
