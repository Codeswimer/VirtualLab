import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AttemptData, AttemptRow, GraphAnswer, ScoreResult } from '@sim/scoring/types';
import { gradeFor } from '@sim/scoring/types';
import { randomSeed } from '@sim/rng';
import { getExperimentByCode } from '@/experiments';
import { markAttempt } from '@/services/scoring-service';
import {
  clearReview as apiClearReview,
  clearToken,
  createMember as apiCreateMember,
  discardAttempt as apiDiscardAttempt,
  errorMessage,
  login as apiLogin,
  logout as apiLogout,
  bootstrap as apiBootstrap,
  readToken,
  register as apiRegister,
  registerSchool as apiRegisterSchool,
  reviewAttempt as apiReviewAttempt,
  saveAttempt as apiSaveAttempt,
  setMemberStatus as apiSetMemberStatus,
  setSchoolStatus as apiSetSchoolStatus,
  submitAttempt as apiSubmitAttempt,
  writeToken,
} from '@/services/api';

export type Role = 'STUDENT' | 'TEACHER' | 'SCHOOL_ADMIN' | 'ADMIN';
export type AccountStatus = 'PENDING' | 'ACTIVE' | 'REVOKED';
export type SchoolStatus = 'PENDING' | 'APPROVED' | 'REVOKED';
export type AttemptStatus = 'IN_PROGRESS' | 'SUBMITTED' | 'SCORED';
export type DeliveryStatus = 'not-submitted' | 'queued' | 'delivered';

export interface School {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  contactName: string;
  contactEmail: string;
  status: SchoolStatus;
  createdAt: string;
  approvedAt?: string;
}

export interface Account {
  id: string;
  name: string;
  email: string;
  role: Role;
  schoolId: string | null;
  school: string;
  classCode: string;
  gradeLevel: string;
  status: AccountStatus;
  createdAt: string;
}

export interface AttemptReview {
  reviewerId: string;
  reviewerName: string;
  marks: number;
  comment: string;
  reviewedAt: string;
}

export interface StoredAttempt extends AttemptData {
  id: string;
  studentId: string;
  status: AttemptStatus;
  delivery: DeliveryStatus;
  configVersion: number;
  idempotencyKey: string;
  score?: ScoreResult;
  review?: AttemptReview;
  scenarioSnapshot?: unknown;
}

/** Server-computed ranking row, sanitised for every signed-in role. */
export interface LeaderboardRow {
  studentId: string;
  name: string;
  schoolId: string | null;
  schoolName: string;
  classCode: string;
  gradeLevel: string;
  average: number;
  best: number;
  modules: number;
  submissions: number;
  reviewed: number;
  grade: string;
  classRank: number;
  schoolRank: number;
  globalRank: number;
}

export const CONFIG_VERSION = 1;

interface SignUpInput {
  name: string;
  email: string;
  password: string;
  role: 'STUDENT' | 'TEACHER';
  schoolCode: string;
  classCode: string;
  gradeLevel: string;
}

interface RegisterSchoolInput {
  name: string;
  code: string;
  city: string;
  state: string;
  contactName: string;
  contactEmail: string;
  password: string;
}

interface CreateMemberInput {
  schoolId: string;
  name: string;
  email: string;
  role: 'STUDENT' | 'TEACHER';
  classCode: string;
  gradeLevel: string;
}

export interface ActionResult {
  error?: string;
  ok?: boolean;
  credentials?: { email: string; password: string };
}

interface AppState {
  token: string | null;
  schools: School[];
  accounts: Account[];
  leaderboard: LeaderboardRow[];
  currentUserId: string | null;
  attempts: StoredAttempt[];
  lastSyncedAt: string | null;
  hydrated: boolean;
  syncing: boolean;
  refresh: () => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (input: SignUpInput) => Promise<ActionResult>;
  registerSchool: (input: RegisterSchoolInput) => Promise<ActionResult>;
  signInDemo: (role: Role) => Promise<string | null>;
  signOut: () => void;
  setSchoolStatus: (schoolId: string, status: SchoolStatus) => Promise<string | null>;
  createMember: (input: CreateMemberInput) => Promise<ActionResult>;
  setMemberStatus: (memberId: string, status: AccountStatus) => Promise<string | null>;
  reviewAttempt: (attemptId: string, marks: number, comment: string) => Promise<string | null>;
  clearReview: (attemptId: string) => Promise<string | null>;
  startAttempt: (experimentCode: string) => string | null;
  updateAttempt: (
    id: string,
    patch: Partial<Omit<StoredAttempt, 'id' | 'studentId' | 'experimentCode'>>,
  ) => void;
  addRow: (id: string) => void;
  removeRow: (id: string, index: number) => void;
  submitAttempt: (id: string) => Promise<ScoreResult | null>;
  flushQueue: () => Promise<void>;
  discardAttempt: (id: string) => void;
}

const DEMO_SIGN_INS: Record<Role, { email: string; password: string }> = {
  STUDENT: { email: 'ada@vlab.ng', password: 'student123' },
  TEACHER: { email: 'bello@vlab.ng', password: 'teacher123' },
  SCHOOL_ADMIN: { email: 'admin@kingscollege.edu.ng', password: 'school123' },
  ADMIN: { email: 'owner@vlab.ng', password: 'owner123' },
};

const now = (): string => new Date().toISOString();
const draftTimers = new Map<string, number>();

function makeId(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function mergeAttempts(
  serverAttempts: StoredAttempt[],
  localAttempts: StoredAttempt[],
  userId: string,
): StoredAttempt[] {
  const merged = new Map(serverAttempts.map((attempt) => [attempt.id, attempt]));
  for (const local of localAttempts) {
    if (local.studentId !== userId) continue;
    const server = merged.get(local.id);
    if (local.delivery === 'queued') {
      merged.set(local.id, local);
    } else if (local.status === 'IN_PROGRESS') {
      merged.set(local.id, server ? { ...server, ...local } : local);
    }
  }
  return [...merged.values()];
}

function scheduleDraftSave(id: string): void {
  const existing = draftTimers.get(id);
  if (existing) window.clearTimeout(existing);
  const timer = window.setTimeout(() => {
    draftTimers.delete(id);
    const attempt = useAppStore.getState().attempts.find((candidate) => candidate.id === id);
    if (!attempt || attempt.status !== 'IN_PROGRESS') return;
    void apiSaveAttempt(attempt).catch(() => {
      // Offline or revoked: the draft remains local and is retried on submit.
    });
  }, 800);
  draftTimers.set(id, timer);
}

export function initialRowsFor(experimentCode: string, seed: number): AttemptRow[] {
  const experiment = getExperimentByCode(experimentCode);
  if (!experiment) return [];
  const scenario = experiment.generate(seed);
  const presets = experiment.table.presets?.(scenario);
  if (presets && presets.length > 0) {
    return presets.map((row) => ({ ...row }));
  }
  return Array.from({ length: experiment.table.minRows }, () => ({}));
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      token: readToken(),
      schools: [],
      accounts: [],
      leaderboard: [],
      currentUserId: null,
      attempts: [],
      lastSyncedAt: null,
      hydrated: false,
      syncing: false,

      refresh: async () => {
        const token = get().token ?? readToken();
        if (!token) {
          set({ hydrated: true, syncing: false });
          return false;
        }
        set({ syncing: true });
        try {
          const data = await apiBootstrap();
          const localAttempts = get().attempts;
          set({
            token,
            schools: data.schools,
            accounts: data.accounts,
            leaderboard: data.leaderboard,
            currentUserId: data.user.id,
            attempts: mergeAttempts(data.attempts, localAttempts, data.user.id),
            lastSyncedAt: data.serverTime,
            hydrated: true,
            syncing: false,
          });
          return true;
        } catch (error) {
          if ((error as { status?: number }).status === 401) {
            clearToken();
            set({
              token: null,
              currentUserId: null,
              schools: [],
              accounts: [],
              attempts: [],
              leaderboard: [],
              hydrated: true,
              syncing: false,
            });
          } else {
            set({ hydrated: true, syncing: false });
          }
          return false;
        }
      },

      signIn: async (email, password) => {
        try {
          const result = await apiLogin(email, password);
          writeToken(result.token);
          set({
            token: result.token,
            currentUserId: result.user.id,
            accounts: [result.user],
          });
          await get().refresh();
          return null;
        } catch (error) {
          return errorMessage(error);
        }
      },

      signUp: async (input) => {
        try {
          await apiRegister(input);
          return { ok: true };
        } catch (error) {
          return { error: errorMessage(error) };
        }
      },

      registerSchool: async (input) => {
        try {
          await apiRegisterSchool(input);
          return { ok: true };
        } catch (error) {
          return { error: errorMessage(error) };
        }
      },

      signInDemo: (role) => {
        const credentials = DEMO_SIGN_INS[role];
        return get().signIn(credentials.email, credentials.password);
      },

      signOut: () => {
        void apiLogout().catch(() => {
          // A dead session still signs out locally.
        });
        clearToken();
        set({
          token: null,
          currentUserId: null,
          schools: [],
          accounts: [],
          attempts: [],
          leaderboard: [],
          lastSyncedAt: null,
          hydrated: true,
          syncing: false,
        });
      },

      setSchoolStatus: async (schoolId, status) => {
        try {
          await apiSetSchoolStatus(schoolId, status);
          await get().refresh();
          return null;
        } catch (error) {
          return errorMessage(error);
        }
      },

      createMember: async (input) => {
        try {
          const result = await apiCreateMember(input.schoolId, {
            name: input.name,
            email: input.email,
            role: input.role,
            classCode: input.classCode,
            gradeLevel: input.gradeLevel,
          });
          await get().refresh();
          return { ok: true, credentials: result.credentials };
        } catch (error) {
          return { error: errorMessage(error) };
        }
      },

      setMemberStatus: async (memberId, status) => {
        try {
          await apiSetMemberStatus(memberId, status);
          await get().refresh();
          return null;
        } catch (error) {
          return errorMessage(error);
        }
      },

      reviewAttempt: async (attemptId, marks, comment) => {
        const attempt = get().attempts.find((candidate) => candidate.id === attemptId);
        if (!attempt?.score) return 'This submission cannot be marked yet.';
        if (!Number.isFinite(marks) || marks < 0 || marks > attempt.score.max) {
          return `Enter marks between 0 and ${attempt.score.max}.`;
        }
        try {
          await apiReviewAttempt(attemptId, Math.round(marks * 2) / 2, comment);
          await get().refresh();
          return null;
        } catch (error) {
          return errorMessage(error);
        }
      },

      clearReview: async (attemptId) => {
        try {
          await apiClearReview(attemptId);
          await get().refresh();
          return null;
        } catch (error) {
          return errorMessage(error);
        }
      },

      startAttempt: (experimentCode) => {
        const experiment = getExperimentByCode(experimentCode);
        const studentId = get().currentUserId;
        const actor = get().accounts.find((account) => account.id === studentId);
        if (!experiment || !studentId || actor?.role !== 'STUDENT') return null;
        const seed = randomSeed();
        const attempt: StoredAttempt = {
          id: makeId('attempt'),
          studentId,
          experimentCode,
          seed,
          status: 'IN_PROGRESS',
          delivery: 'not-submitted',
          configVersion: CONFIG_VERSION,
          idempotencyKey: makeId('idem'),
          startedAt: now(),
          rows: initialRowsFor(experimentCode, seed),
          answers: {},
          notes: '',
          graph: null,
          flags: {},
        };
        set((state) => ({ attempts: [attempt, ...state.attempts] }));
        void apiSaveAttempt(attempt).catch(() => {
          // The full attempt is sent again on submit if this initial save fails.
        });
        return attempt.id;
      },

      updateAttempt: (id, patch) => {
        set((state) => ({
          attempts: state.attempts.map((attempt) =>
            attempt.id === id ? { ...attempt, ...patch } : attempt,
          ),
        }));
        const updated = get().attempts.find((attempt) => attempt.id === id);
        if (updated?.status === 'IN_PROGRESS') scheduleDraftSave(id);
      },

      addRow: (id) => {
        set((state) => ({
          attempts: state.attempts.map((attempt) =>
            attempt.id === id ? { ...attempt, rows: [...attempt.rows, {}] } : attempt,
          ),
        }));
        scheduleDraftSave(id);
      },

      removeRow: (id, index) => {
        set((state) => ({
          attempts: state.attempts.map((attempt) =>
            attempt.id === id && attempt.rows.length > 1
              ? { ...attempt, rows: attempt.rows.filter((_, i) => i !== index) }
              : attempt,
          ),
        }));
        scheduleDraftSave(id);
      },

      submitAttempt: async (id) => {
        const attempt = get().attempts.find((candidate) => candidate.id === id);
        if (!attempt) return null;
        if (attempt.score) return attempt.score;
        const timer = draftTimers.get(id);
        if (timer) {
          window.clearTimeout(timer);
          draftTimers.delete(id);
        }
        set((state) => ({
          attempts: state.attempts.map((candidate) =>
            candidate.id === id
              ? { ...candidate, status: 'SUBMITTED', submittedAt: now() }
              : candidate,
          ),
        }));
        const submitted = get().attempts.find((candidate) => candidate.id === id);
        if (!submitted) return null;
        const { score, scenario } = await markAttempt(submitted);
        set((state) => ({
          attempts: state.attempts.map((candidate) =>
            candidate.id === id
              ? {
                  ...candidate,
                  status: 'SCORED',
                  delivery: 'queued',
                  score,
                  scenarioSnapshot: scenario,
                }
              : candidate,
          ),
        }));
        const scored = get().attempts.find((candidate) => candidate.id === id);
        if (!scored) return score;
        try {
          await apiSubmitAttempt(scored, score, scenario);
          set((state) => ({
            attempts: state.attempts.map((candidate) =>
              candidate.id === id ? { ...candidate, delivery: 'delivered' } : candidate,
            ),
            lastSyncedAt: now(),
          }));
        } catch {
          // Keep the marked attempt queued; flushQueue retries when the API is back.
        }
        return score;
      },

      flushQueue: async () => {
        const queued = get().attempts.filter(
          (attempt) => attempt.delivery === 'queued' && attempt.score,
        );
        for (const attempt of queued) {
          try {
            await apiSubmitAttempt(attempt, attempt.score as ScoreResult, attempt.scenarioSnapshot);
            set((state) => ({
              attempts: state.attempts.map((candidate) =>
                candidate.id === attempt.id
                  ? { ...candidate, delivery: 'delivered' }
                  : candidate,
              ),
              lastSyncedAt: now(),
            }));
          } catch {
            break;
          }
        }
      },

      discardAttempt: (id) => {
        set((state) => ({
          attempts: state.attempts.filter(
            (attempt) => !(attempt.id === id && attempt.status === 'IN_PROGRESS'),
          ),
        }));
        void apiDiscardAttempt(id).catch(() => {
          // A draft that never reached the server needs no cleanup.
        });
      },
    }),
    {
      name: 'vlab-nigeria-v3',
      version: 3,
      partialize: (state) => ({
        token: state.token,
        schools: state.schools,
        accounts: state.accounts,
        leaderboard: state.leaderboard,
        currentUserId: state.currentUserId,
        attempts: state.attempts,
        lastSyncedAt: state.lastSyncedAt,
      }),
    },
  ),
);

export function currentAccount(state: AppState): Account | null {
  return state.accounts.find((account) => account.id === state.currentUserId) ?? null;
}

/** Percentage after a teacher's manual review, falling back to the auto-mark. */
export function attemptPercent(attempt: StoredAttempt): number | null {
  if (!attempt.score) return null;
  if (attempt.review) {
    return Math.round((attempt.review.marks / Math.max(1, attempt.score.max)) * 1000) / 10;
  }
  return attempt.score.percent;
}

export function attemptGrade(attempt: StoredAttempt): string | null {
  const percent = attemptPercent(attempt);
  return percent === null ? null : gradeFor(percent);
}

export function attemptsForStudent(attempts: StoredAttempt[], studentId: string): StoredAttempt[] {
  return attempts
    .filter((attempt) => attempt.studentId === studentId && attempt.status === 'SCORED')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
}

export function draftFor(
  attempts: StoredAttempt[],
  studentId: string,
  experimentCode: string,
): StoredAttempt | undefined {
  return attempts.find(
    (attempt) =>
      attempt.studentId === studentId &&
      attempt.experimentCode === experimentCode &&
      attempt.status === 'IN_PROGRESS',
  );
}

export function bestScore(
  attempts: StoredAttempt[],
  studentId: string,
  experimentCode: string,
): ScoreResult | null {
  const scores = attempts
    .filter(
      (attempt) =>
        attempt.studentId === studentId &&
        attempt.experimentCode === experimentCode &&
        attempt.score,
    )
    .map((attempt) => {
      const score = attempt.score as ScoreResult;
      const percent = attemptPercent(attempt) ?? score.percent;
      return {
        ...score,
        total: attempt.review?.marks ?? score.total,
        percent,
        grade: gradeFor(percent),
      };
    });
  if (scores.length === 0) return null;
  return scores.reduce((best, next) => (next.percent > best.percent ? next : best));
}

export function mergeGraph(
  current: GraphAnswer | null,
  patch: Partial<GraphAnswer>,
): GraphAnswer {
  const base: GraphAnswer = current ?? {
    xColumn: '',
    yColumn: '',
    xLabel: '',
    yLabel: '',
    xMin: 0,
    xMax: 1,
    yMin: 0,
    yMax: 1,
    points: [],
    line: null,
    gradientEntry: '',
    triangle: false,
  };
  return { ...base, ...patch };
}
