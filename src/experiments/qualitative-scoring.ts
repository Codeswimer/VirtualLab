import type { AttemptData, CriterionResult, ScoreResult } from '@sim/scoring/types';
import { criterion, summarise } from '@sim/scoring/engine';
import {
  family,
  observationMatches,
  observationScore,
  speciesIn,
  type QualitativeFamilyId,
} from '@sim/chemistry/qualitative';

/**
 * Marks a qualitative-analysis report: tests done, observations, inferences and
 * the identification. Observations are matched on required key phrases so a
 * student is not penalised for wording.
 */
export function scoreQualitative(
  attempt: AttemptData,
  familyId: QualitativeFamilyId,
  unknownId: string,
): ScoreResult {
  const fam = family(familyId);
  const unknown = speciesIn(familyId, unknownId);
  const expectedTests = unknown?.tests ?? [];

  const rows = attempt.rows.filter((row) => (row.reagent ?? '').trim() !== '');
  const testedReagents = new Set(rows.map((r) => (r.reagent ?? '').trim()));
  const requiredTests = Math.min(expectedTests.length, familyId === 'food' ? 1 : 2);
  const testsDone = expectedTests.filter((t) =>
    testedReagents.has(fam.reagents.find((r) => r.id === t.reagentId)?.label ?? t.reagentId),
  ).length;

  let observationAward = 0;
  let inferenceAward = 0;
  let observationDetail = '';
  for (const test of expectedTests) {
    const reagentLabel =
      fam.reagents.find((r) => r.id === test.reagentId)?.label ?? test.reagentId;
    const row = rows.find((r) => (r.reagent ?? '').trim() === reagentLabel);
    if (!row) continue;
    const factor = observationScore(row.observation ?? '', test);
    observationAward += 4 * factor;
    if (observationMatches(row.observation ?? '', test)) observationDetail = 'Each recorded observation includes the expected key features.';
    const inferenceHit =
      (row.inference ?? '').toLowerCase().includes(unknown?.label.split('+')[0]?.toLowerCase() ?? '') ||
      (row.inference ?? '').toLowerCase().includes((unknown?.name ?? '').toLowerCase());
    if (inferenceHit) inferenceAward += 1.5;
  }
  const maxObservation = Math.min(expectedTests.length || 1, 2) * 4;
  const maxInference = Math.min(expectedTests.length || 1, 2) * 1.5;

  const identified = (attempt.answers.unknown ?? '').trim() === unknownId;
  const conclusionText = attempt.notes.toLowerCase();
  const conclusionKeywords = [unknown?.label ?? '', unknown?.name ?? ''].filter(Boolean);
  const conclusionHit = conclusionKeywords.some((keyword) =>
    conclusionText.includes(keyword.toLowerCase()),
  );

  const criteria: CriterionResult[] = [
    criterion({
      id: 'qual-tests',
      label: 'Tests carried out',
      kind: 'procedure',
      max: 3,
      awarded: (3 * Math.min(testsDone, requiredTests)) / Math.max(1, requiredTests),
      feedback:
        testsDone >= requiredTests
          ? 'You carried out the necessary tests.'
          : `Run ${requiredTests - testsDone} more test(s) to gather enough evidence.`,
    }),
    criterion({
      id: 'qual-observation',
      label: 'Observations recorded',
      kind: 'table',
      max: 6,
      awarded: (6 * Math.min(observationAward, maxObservation)) / Math.max(1, maxObservation),
      feedback:
        observationAward >= maxObservation
          ? observationDetail || 'Your observations record the key visible changes.'
          : 'Describe colour, precipitate, solubility in excess and any gas evolved.',
    }),
    criterion({
      id: 'qual-inference',
      label: 'Inferences drawn from each test',
      kind: 'table',
      max: 3,
      awarded: (3 * Math.min(inferenceAward, maxInference)) / Math.max(1, maxInference),
      feedback:
        inferenceAward >= maxInference
          ? 'Each observation is linked to a sound inference.'
          : 'Write what each observation suggests about the ion or group present.',
    }),
    criterion({
      id: 'qual-identify',
      label: 'Unknown identified',
      kind: 'conclusion',
      max: 6,
      awarded: identified ? 6 : 0,
      feedback: identified
        ? `Correct — the unknown is ${unknown?.name ?? unknownId}.`
        : 'The identification is not supported by the observations. Re-check the results table.',
    }),
    criterion({
      id: 'qual-conclusion',
      label: 'Conclusion written',
      kind: 'conclusion',
      max: 2,
      awarded: conclusionHit ? 2 : 0,
      feedback: conclusionHit
        ? 'Conclusion names the species present.'
        : `State the identity in your conclusion, e.g. "${unknown?.name ?? unknownId}".`,
    }),
  ];

  return summarise(criteria);
}
