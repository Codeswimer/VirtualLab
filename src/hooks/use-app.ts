import { useEffect, useState } from 'react';
import { useAppStore, type Account, type StoredAttempt } from '@/stores/app-store';

export function useCurrentUser(): Account | null {
  return useAppStore((state) => {
    const account = state.accounts.find((candidate) => candidate.id === state.currentUserId);
    return account ?? null;
  });
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );
  const flushQueue = useAppStore((state) => state.flushQueue);
  const refresh = useAppStore((state) => state.refresh);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      void flushQueue();
      void refresh();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [flushQueue, refresh]);

  return online;
}

export function useStudentAttempts(): StoredAttempt[] {
  const userId = useAppStore((state) => state.currentUserId);
  const attempts = useAppStore((state) => state.attempts);
  if (!userId) return [];
  return attempts
    .filter((attempt) => attempt.studentId === userId)
    .sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
}

export function useClassAttempts(): StoredAttempt[] {
  const user = useCurrentUser();
  const attempts = useAppStore((state) => state.attempts);
  const accounts = useAppStore((state) => state.accounts);
  if (!user) return [];
  const classIds = new Set(
    accounts
      .filter((account) => account.classCode === user.classCode)
      .map((account) => account.id),
  );
  return attempts
    .filter((attempt) => classIds.has(attempt.studentId) && attempt.status === 'SCORED')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
}

export function useScoredAttemptsFor(experimentCode: string, studentId?: string): StoredAttempt[] {
  const attempts = useAppStore((state) => state.attempts);
  const userId = useAppStore((state) => state.currentUserId);
  const target = studentId ?? userId;
  return attempts.filter(
    (attempt) =>
      attempt.experimentCode === experimentCode &&
      attempt.studentId === target &&
      attempt.status === 'SCORED',
  );
}
