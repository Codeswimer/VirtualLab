import type {
  Account,
  AccountStatus,
  LeaderboardRow,
  School,
  SchoolStatus,
  StoredAttempt,
} from '@/stores/app-store';
import type { ScoreResult } from '@sim/scoring/types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const TOKEN_KEY = 'vlab-api-token-v1';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function writeToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Private-mode storage failures are non-fatal; the session stays in memory.
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = readToken();
  if (options.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(
      'Cannot reach the lab server. Check your connection and try again.',
      0,
    );
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : `The lab server returned ${response.status}.`;
    throw new ApiError(message, response.status);
  }
  return data as T;
}

export interface BootstrapPayload {
  user: Account;
  schools: School[];
  accounts: Account[];
  attempts: StoredAttempt[];
  leaderboard: LeaderboardRow[];
  serverTime: string;
}

export interface LoginResponse {
  token: string;
  user: Account;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
}

export function register(input: {
  name: string;
  email: string;
  password: string;
  role: 'STUDENT' | 'TEACHER';
  schoolCode: string;
  classCode: string;
  gradeLevel: string;
}): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/auth/register', {
    method: 'POST',
    body: input,
    auth: false,
  });
}

export function registerSchool(input: {
  name: string;
  code: string;
  city: string;
  state: string;
  contactName: string;
  contactEmail: string;
  password: string;
}): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/auth/register-school', {
    method: 'POST',
    body: input,
    auth: false,
  });
}

export function logout(): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' });
}

export function bootstrap(): Promise<BootstrapPayload> {
  return request<BootstrapPayload>('/api/bootstrap');
}

export function setSchoolStatus(
  schoolId: string,
  status: SchoolStatus,
): Promise<{ school: School }> {
  return request<{ school: School }>(`/api/schools/${encodeURIComponent(schoolId)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

export function createMember(
  schoolId: string,
  input: {
    name: string;
    email: string;
    role: 'STUDENT' | 'TEACHER';
    classCode: string;
    gradeLevel: string;
  },
): Promise<{ ok: boolean; credentials: { email: string; password: string }; member: Account }> {
  return request(`/api/schools/${encodeURIComponent(schoolId)}/members`, {
    method: 'POST',
    body: input,
  });
}

export function setMemberStatus(
  memberId: string,
  status: AccountStatus,
): Promise<{ member: Account }> {
  return request(`/api/members/${encodeURIComponent(memberId)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

function attemptBody(attempt: StoredAttempt) {
  return {
    experimentCode: attempt.experimentCode,
    seed: attempt.seed,
    configVersion: attempt.configVersion,
    idempotencyKey: attempt.idempotencyKey,
    startedAt: attempt.startedAt,
    rows: attempt.rows,
    answers: attempt.answers,
    graph: attempt.graph,
    flags: attempt.flags,
    notes: attempt.notes,
  };
}

export function saveAttempt(attempt: StoredAttempt): Promise<{ attempt: StoredAttempt }> {
  return request(`/api/attempts/${encodeURIComponent(attempt.id)}`, {
    method: 'PUT',
    body: attemptBody(attempt),
  });
}

export function submitAttempt(
  attempt: StoredAttempt,
  score: ScoreResult,
  scenarioSnapshot?: unknown,
): Promise<{ attempt: StoredAttempt }> {
  return request(`/api/attempts/${encodeURIComponent(attempt.id)}/submit`, {
    method: 'POST',
    body: {
      ...attemptBody(attempt),
      submittedAt: attempt.submittedAt,
      score,
      scenarioSnapshot,
    },
  });
}

export function discardAttempt(attemptId: string): Promise<{ ok: boolean }> {
  return request(`/api/attempts/${encodeURIComponent(attemptId)}`, { method: 'DELETE' });
}

export function reviewAttempt(
  attemptId: string,
  marks: number,
  comment: string,
): Promise<{ attempt: StoredAttempt }> {
  return request(`/api/attempts/${encodeURIComponent(attemptId)}/review`, {
    method: 'PATCH',
    body: { marks, comment },
  });
}

export function clearReview(attemptId: string): Promise<{ attempt: StoredAttempt }> {
  return request(`/api/attempts/${encodeURIComponent(attemptId)}/review`, {
    method: 'DELETE',
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Try again.';
}
