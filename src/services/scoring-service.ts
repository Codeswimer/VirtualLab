import type { AttemptData, ScoreResult } from '@sim/scoring/types';
import { getExperimentByCode, scenarioFor } from '@/experiments';
import type { StoredAttempt } from '@/stores/app-store';

/**
 * Marking service (ADR-003).
 *
 * The lab UI never computes marks. It hands the raw attempt to this service,
 * which regenerates the scenario from the stored seed with the same sim-core
 * used to drive the apparatus, then applies the experiment rubric. In the
 * production architecture this function runs on the NestJS API; here it is the
 * same code path, isolated from the React tree, so the boundary is preserved.
 *
 * The artificial latency keeps the UI honest about the asynchronous boundary and
 * exercises the offline queue.
 */
export async function markAttempt(
  attempt: StoredAttempt,
): Promise<{ score: ScoreResult; scenario: unknown }> {
  const experiment = getExperimentByCode(attempt.experimentCode);
  if (!experiment) {
    throw new Error(`Unknown experiment ${attempt.experimentCode}`);
  }
  const scenario = scenarioFor(experiment, attempt.seed, attempt.params);
  const payload: AttemptData = {
    experimentCode: attempt.experimentCode,
    seed: attempt.seed,
    rows: attempt.rows,
    answers: attempt.answers,
    graph: attempt.graph,
    flags: attempt.flags,
    notes: attempt.notes,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
  };
  await new Promise((resolve) => setTimeout(resolve, 650));
  const score = experiment.score(payload, scenario);
  return { score, scenario };
}
