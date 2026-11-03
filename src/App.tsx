import { useEffect } from 'react';
import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom';
import { FlaskConical } from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { LabPage } from '@/pages/LabPage';
import { ReportPage } from '@/pages/ReportPage';
import { ProgressPage } from '@/pages/ProgressPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CurriculumPage } from '@/pages/CurriculumPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LeaderboardPage } from '@/pages/LeaderboardPage';

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="font-mono text-xs font-bold uppercase tracking-widest text-ink-400">404</p>
      <h1 className="mt-2 text-xl font-semibold text-ink-900">This bench is empty</h1>
      <p className="mt-2 text-sm text-ink-500">
        The page you asked for does not exist. Head back to your dashboard.
      </p>
      <Link to="/dashboard" className="btn-primary mt-5">
        Back to dashboard
      </Link>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-jade-700 text-white">
        <FlaskConical className="h-6 w-6" />
      </span>
      <p className="mt-4 text-sm font-semibold text-ink-800">Connecting to the lab…</p>
      <p className="mt-1 text-xs text-ink-500">Loading your school, classes and practical record.</p>
    </div>
  );
}

export default function App() {
  const hydrated = useAppStore((state) => state.hydrated);
  const refresh = useAppStore((state) => state.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!hydrated) return <LoadingScreen />;

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/lab/:slug" element={<LabPage />} />
          <Route path="/report/:attemptId" element={<ReportPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/curriculum" element={<CurriculumPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
