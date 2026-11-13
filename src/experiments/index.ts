import type { AttemptData } from '@sim/scoring/types';
import type { ExperimentDefinition, ExamBody, Priority, Subject } from './types';
import { mechanicsExperiments } from './physics-mechanics';
import { opticsExperiments } from './physics-optics';
import { electricityExperiments } from './physics-electricity';
import { thermalExperiments } from './physics-thermal';
import { chemistryExperiments } from './chemistry';
import { scenarioFor } from './parameters';

export * from './types';
export * from './parameters';

export const EXPERIMENTS: ExperimentDefinition<any>[] = [
  ...mechanicsExperiments,
  ...opticsExperiments,
  ...electricityExperiments,
  ...thermalExperiments,
  ...chemistryExperiments,
];

export const EXPERIMENT_MAP: Record<string, ExperimentDefinition<any>> = Object.fromEntries(
  EXPERIMENTS.map((experiment) => [experiment.meta.slug, experiment]),
);

export function getExperiment(slug: string): ExperimentDefinition<any> | undefined {
  return EXPERIMENT_MAP[slug];
}

export function getExperimentByCode(code: string): ExperimentDefinition<any> | undefined {
  return EXPERIMENTS.find((experiment) => experiment.meta.code === code);
}

export function experimentsBySubject(subject: Subject): ExperimentDefinition<any>[] {
  return EXPERIMENTS.filter((experiment) => experiment.meta.subject === subject);
}

export function searchExperiments(query: string): ExperimentDefinition<any>[] {
  const text = query.trim().toLowerCase();
  if (!text) return EXPERIMENTS;
  return EXPERIMENTS.filter((experiment) => {
    const haystack = [
      experiment.meta.title,
      experiment.meta.summary,
      experiment.meta.code,
      experiment.meta.curriculum,
      ...experiment.meta.skills,
      ...experiment.meta.apparatus,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(text);
  });
}

export interface LibraryFilter {
  subject?: Subject | 'ALL';
  priority?: Priority | 'ALL';
  examBody?: ExamBody | 'ALL';
  query?: string;
}

export function filterExperiments(filter: LibraryFilter): ExperimentDefinition<any>[] {
  return searchExperiments(filter.query ?? '').filter((experiment) => {
    if (filter.subject && filter.subject !== 'ALL' && experiment.meta.subject !== filter.subject) {
      return false;
    }
    if (filter.priority && filter.priority !== 'ALL' && experiment.meta.priority !== filter.priority) {
      return false;
    }
    if (
      filter.examBody &&
      filter.examBody !== 'ALL' &&
      !experiment.meta.examBodies.includes(filter.examBody)
    ) {
      return false;
    }
    return true;
  });
}

/** Authoritative marking entry point, used by the scoring service. */
export function gradeAttempt(
  experiment: ExperimentDefinition<any>,
  attempt: AttemptData,
): ReturnType<ExperimentDefinition['score']> {
  const scenario = scenarioFor(experiment, attempt.seed, attempt.params);
  return experiment.score(attempt, scenario);
}

export const SUBJECT_LABELS: Record<Subject, string> = {
  PHYSICS: 'Physics',
  CHEMISTRY: 'Chemistry',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  P0: 'Exam-critical',
  P1: 'Core',
  P2: 'Extension',
};
