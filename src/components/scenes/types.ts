import type { AttemptData } from '@sim/scoring/types';
import type { ExperimentDefinition } from '@/experiments/types';
import type { StoredAttempt } from '@/stores/app-store';

export interface SceneProps {
  experiment: ExperimentDefinition;
  attempt: StoredAttempt;
  /** Seeded, hidden truth used to drive the apparatus. Never display directly. */
  scenario: any;
  onUpdate: (patch: Partial<AttemptData>) => void;
  /** Write a reading into the table, matching the key column when possible. */
  onRecord: (row: Record<string, string>) => void;
  onFlag: (flag: string, value?: boolean) => void;
}
