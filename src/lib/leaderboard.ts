import type { Account, LeaderboardRow, School, StoredAttempt } from '@/stores/app-store';
import { attemptGrade, attemptPercent } from '@/stores/app-store';
import { gradeFor } from '@sim/scoring/types';

export { attemptGrade };

export type LeaderboardScope = 'class' | 'school' | 'global';

export interface StudentMetrics {
  submissions: number;
  modules: number;
  reviewed: number;
  best: number;
  average: number;
  grade: string;
}

export interface SchoolStanding {
  school: School;
  students: number;
  teachers: number;
  submissions: number;
  average: number;
}

export interface ClassOption {
  classCode: string;
  gradeLevel: string;
  schoolId: string;
  size: number;
}

export interface PerformanceBand {
  label: string;
  tone: 'jade' | 'amber' | 'red';
  note: string;
}

/** Short localized copy for missing-data states across the app. */
export const LEADERBOARD_EMPTY_STATE: Record<LeaderboardScope, { title: string; body: string }> = {
  class: {
    title: 'No ranked students in this class yet',
    body: 'Once students in this class submit practicals, their best scores are averaged and ranked here.',
  },
  school: {
    title: 'No ranked students in this school yet',
    body: 'Approved schools appear once their students submit practicals.',
  },
  global: {
    title: 'No ranked students yet',
    body: 'Approved schools appear once their students submit practicals.',
  },
};

export const RANK_SCOPE_LABELS: Record<LeaderboardScope, string> = {
  class: 'Class standing',
  school: 'School standing',
  global: 'National standing',
};

export function scopeDescription(scope: LeaderboardScope, schoolName?: string, classCode?: string): string {
  if (scope === 'class') return `${classCode || 'Class'} · ${schoolName || 'this school'}`;
  if (scope === 'school') return schoolName || 'this school';
  return 'All approved schools';
}

export function canEditOnScope(role: Account['role'], scope: LeaderboardScope): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'SCHOOL_ADMIN') return scope !== 'global';
  if (role === 'TEACHER') return scope === 'class';
  return false;
}

export function canViewOnScope(role: Account['role'], scope: LeaderboardScope, schoolId: string | null): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'SCHOOL_ADMIN' || role === 'TEACHER') return schoolId !== null;
  if (role === 'STUDENT') return scope === 'class';
  return false;
}

/** Roles shown in the class selector. */
export const LEADERBOARD_EDITABLE_SCOPES: LeaderboardScope[] = ['class', 'school'];

/** Help text shown under the ranking explanation for the current user + scope. */
export function scopeHelpText(scope: LeaderboardScope, role: Account['role'], _schoolId?: string | null): string {
  if (role === 'ADMIN') {
    return scope === 'global'
      ? 'Every approved school is visible here, and you can add or remove school records only in the admin console.'
      : 'You can view and manage every approved school.';
  }
  if (role === 'SCHOOL_ADMIN') {
    return scope === 'global'
      ? 'You can only see your own school here. Global rankings are for the platform owner.'
      : 'You can view and manage classes in your own school.';
  }
  if (role === 'TEACHER') {
    return scope === 'school' || scope === 'global'
      ? 'You can only see your own class here. School and global rankings are for your school admin and the platform owner.'
      : 'You can view and manage students in your own class.';
  }
  return 'You can only see your own class here.';
}

export function rankFor(entry: LeaderboardRow, scope: LeaderboardScope): number {
  if (scope === 'global') return entry.globalRank || 1;
  if (scope === 'school') return entry.schoolRank || 1;
  return entry.classRank || 1;
}

export function leaderboardForScope(
  leaderboard: LeaderboardRow[],
  scope: LeaderboardScope,
  schoolId?: string | null,
  classCode?: string | null,
): LeaderboardRow[] {
  let filtered = leaderboard;
  if (scope === 'school') {
    filtered = leaderboard.filter((row) => (schoolId ? row.schoolId === schoolId : true));
  } else if (scope === 'class') {
    filtered = leaderboard.filter((row) => {
      const matchSchool = schoolId ? row.schoolId === schoolId : true;
      const matchClass = classCode ? row.classCode.toLowerCase() === classCode.toLowerCase() : true;
      return matchSchool && matchClass;
    });
  }

  const sorted = [...filtered].sort(
    (a, b) => b.average - a.average || b.best - a.best || a.name.localeCompare(b.name),
  );

  let currentRank = 0;
  let prevAvg = -1;
  return sorted.map((row, index) => {
    if (row.average !== prevAvg) {
      currentRank = index + 1;
      prevAvg = row.average;
    }
    if (scope === 'class') return { ...row, classRank: currentRank };
    if (scope === 'school') return { ...row, schoolRank: currentRank };
    return { ...row, globalRank: currentRank };
  });
}

export function studentMetrics(attempts: StoredAttempt[], studentId: string): StudentMetrics {
  const studentAttempts = attempts.filter(
    (attempt) => attempt.studentId === studentId && attempt.status === 'SCORED',
  );

  const bestPerModule = new Map<string, number>();
  let reviewed = 0;

  for (const attempt of studentAttempts) {
    const percent = attemptPercent(attempt);
    if (percent === null) continue;
    const current = bestPerModule.get(attempt.experimentCode);
    if (current === undefined || percent > current) {
      bestPerModule.set(attempt.experimentCode, percent);
    }
    if (attempt.review) reviewed += 1;
  }

  const values = [...bestPerModule.values()];
  const average =
    values.length === 0
      ? 0
      : Math.round((values.reduce((sum, val) => sum + val, 0) / values.length) * 10) / 10;
  const best = values.length === 0 ? 0 : Math.max(...values);
  const grade = gradeFor(average);

  return {
    submissions: studentAttempts.length,
    modules: bestPerModule.size,
    reviewed,
    best,
    average,
    grade,
  };
}

export function performanceBand(average: number): PerformanceBand {
  if (average >= 75) {
    return {
      label: 'Distinction Track (A1)',
      tone: 'jade',
      note: 'Outstanding precision, adhering to WAEC/NECO decimal conventions and accurate deductions.',
    };
  }
  if (average >= 65) {
    return {
      label: 'Credit Band (B2–B3)',
      tone: 'jade',
      note: 'Strong grasp of experimental methodology; fine-tune graphing and precautions for top grade.',
    };
  }
  if (average >= 50) {
    return {
      label: 'Pass Track (C4–C6)',
      tone: 'amber',
      note: 'Working methodology established. Focus on error precautions, concordant readings and units.',
    };
  }
  return {
    label: 'Needs Intervention (D7–F9)',
    tone: 'red',
    note: 'Repeated practice recommended on scale calibrations, titration endpoints and slope evaluations.',
  };
}

export function schoolStandings(
  accounts: Account[],
  attempts: StoredAttempt[],
  schools: School[],
): SchoolStanding[] {
  return schools
    .map((school) => {
      const schoolAccounts = accounts.filter((acc) => acc.schoolId === school.id);
      const students = schoolAccounts.filter(
        (acc) => acc.role === 'STUDENT' && acc.status === 'ACTIVE',
      );
      const teachers = schoolAccounts.filter(
        (acc) => acc.role === 'TEACHER' && acc.status === 'ACTIVE',
      );
      const studentIds = new Set(students.map((s) => s.id));

      const schoolAttempts = attempts.filter(
        (attempt) => attempt.status === 'SCORED' && studentIds.has(attempt.studentId),
      );

      const studentAverages = students
        .map((student) => studentMetrics(attempts, student.id))
        .filter((m) => m.submissions > 0)
        .map((m) => m.average);

      const average =
        studentAverages.length === 0
          ? 0
          : Math.round(
              (studentAverages.reduce((sum, v) => sum + v, 0) / studentAverages.length) * 10,
            ) / 10;

      return {
        school,
        students: students.length,
        teachers: teachers.length,
        submissions: schoolAttempts.length,
        average,
      };
    })
    .sort((a, b) => b.average - a.average || a.school.name.localeCompare(b.school.name));
}

export function classOptionsFromLeaderboard(
  leaderboard: LeaderboardRow[],
  schoolId: string | null,
): ClassOption[] {
  const map = new Map<string, ClassOption>();
  for (const row of leaderboard) {
    if (schoolId && row.schoolId !== schoolId) continue;
    const key = `${row.schoolId ?? ''}:${row.classCode}`;
    const existing = map.get(key);
    if (existing) {
      existing.size += 1;
    } else {
      map.set(key, {
        classCode: row.classCode,
        gradeLevel: row.gradeLevel,
        schoolId: row.schoolId ?? '',
        size: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.classCode.localeCompare(b.classCode));
}
