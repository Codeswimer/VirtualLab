import { Link } from 'react-router-dom';
import {
  BookOpen,
  CloudOff,
  Database,
  Download,
  GraduationCap,
  Info,
  LayoutDashboard,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
  Wifi,
} from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { useCurrentUser, useOnlineStatus } from '@/hooks/use-app';
import { Badge, SectionHeading } from '@/components/ui/primitives';
import { initials } from '@/lib/utils';
import { roleLabel, roleTone } from '@/lib/roles';
import { studentMetrics } from '@/lib/leaderboard';

export function SettingsPage() {
  const user = useCurrentUser();
  const online = useOnlineStatus();
  const attempts = useAppStore((state) => state.attempts);
  const schools = useAppStore((state) => state.schools);
  const signOut = useAppStore((state) => state.signOut);
  const queued = attempts.filter((attempt) => attempt.delivery === 'queued');
  const drafts = attempts.filter(
    (attempt) => attempt.studentId === user?.id && attempt.status === 'IN_PROGRESS',
  );
  const school = schools.find((candidate) => candidate.id === user?.schoolId);
  const metrics = user?.role === 'STUDENT' ? studentMetrics(attempts, user.id) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-jade-700">Settings</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">Your lab profile</h1>

      <section className="card mt-5 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-900 font-mono text-sm font-bold text-white">
            {initials(user?.name ?? 'Guest')}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink-900">{user?.name}</p>
            <p className="truncate text-xs text-ink-500">{user?.email}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {user ? <Badge tone={roleTone(user.role)}>{roleLabel(user.role)}</Badge> : null}
            {user ? (
              <Badge tone={user.status === 'ACTIVE' ? 'jade' : user.status === 'PENDING' ? 'amber' : 'red'}>
                {user.status === 'ACTIVE' ? 'Active' : user.status === 'PENDING' ? 'Pending' : 'Revoked'}
              </Badge>
            ) : null}
          </div>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
              {user?.role === 'ADMIN' ? 'Organisation' : 'School'}
            </dt>
            <dd className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-700">
              <GraduationCap className="h-3.5 w-3.5 text-ink-400" /> {user?.school}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
              {user?.role === 'ADMIN'
                ? 'Role'
                : user?.role === 'SCHOOL_ADMIN'
                  ? 'School join code'
                  : 'Class code'}
            </dt>
            <dd className="mt-0.5 font-mono text-sm text-ink-700">
              {user?.role === 'ADMIN'
                ? 'Platform owner'
                : user?.role === 'SCHOOL_ADMIN'
                  ? school?.code ?? '—'
                  : user?.classCode}
            </dd>
          </div>
          {user?.role === 'STUDENT' ? (
            <>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  Year group
                </dt>
                <dd className="mt-0.5 text-sm text-ink-700">{user.gradeLevel}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  Term grade
                </dt>
                <dd className="mt-0.5 flex items-center gap-2 text-sm text-ink-700">
                  <span className="font-mono font-semibold">{metrics?.grade ?? '—'}</span>
                  <span className="text-xs text-ink-400">
                    {metrics && metrics.submissions > 0 ? `${metrics.average.toFixed(1)}% average` : 'no submissions yet'}
                  </span>
                </dd>
              </div>
            </>
          ) : null}
          {user?.role !== 'ADMIN' ? (
            <div>
              <dt className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                School status
              </dt>
              <dd className="mt-0.5">
                <Badge tone={school?.status === 'APPROVED' ? 'jade' : school?.status === 'PENDING' ? 'amber' : 'red'}>
                  {school?.status === 'APPROVED'
                    ? 'Approved by platform owner'
                    : school?.status === 'PENDING'
                      ? 'Awaiting approval'
                      : 'Access revoked'}
                </Badge>
              </dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link to="/dashboard" className="btn-secondary btn-sm">
            <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
          </Link>
          {user?.role === 'STUDENT' ? (
            <Link to="/progress" className="btn-secondary btn-sm">
              <BookOpen className="h-3.5 w-3.5" /> My progress
            </Link>
          ) : null}
          {user?.role === 'SCHOOL_ADMIN' ? (
            <Link to="/dashboard" className="btn-secondary btn-sm">
              <Users className="h-3.5 w-3.5" /> Manage members
            </Link>
          ) : null}
          <button type="button" className="btn-secondary btn-sm" onClick={signOut}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </section>

      <section className="card mt-4 p-5">
        <SectionHeading
          title="Offline and submissions"
          subtitle="The lab is installable and keeps working without a network."
        />
        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2.5 rounded-xl border border-ink-100 px-3 py-2.5">
            {online ? (
              <Wifi className="h-4 w-4 text-jade-700" />
            ) : (
              <CloudOff className="h-4 w-4 text-amber-700" />
            )}
            <div className="flex-1">
              <p className="text-xs font-semibold text-ink-800">
                {online ? 'Connected' : 'Working offline'}
              </p>
              <p className="text-[10.5px] text-ink-500">
                {online
                  ? 'Submissions sync to the lab server immediately and are visible to your teacher.'
                  : 'Readings and drafts are saved on this device. Submissions queue and sync once online.'}
              </p>
            </div>
            <Badge tone={online ? 'jade' : 'amber'}>{online ? 'Online' : 'Queued'}</Badge>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-ink-100 px-3 py-2.5">
            <Database className="h-4 w-4 text-ink-400" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-ink-800">Saved work</p>
              <p className="text-[10.5px] text-ink-500">
                {drafts.length} local draft{drafts.length === 1 ? '' : 's'} · {queued.length} queued
                submission{queued.length === 1 ? '' : 's'} waiting to sync
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 rounded-xl border border-ink-100 px-3 py-2.5">
            <Smartphone className="h-4 w-4 shrink-0 text-ink-400" />
            <div>
              <p className="text-xs font-semibold text-ink-800">Install for school use</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-500">
                Open your browser menu and choose “Install app” or “Add to home screen”. The shell
                and visited practicals then load without internet.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="card mt-4 p-5">
        <SectionHeading
          title="Demo accounts & server data"
          subtitle="Accounts, approvals, attempts and teacher marks live on the lab server."
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => {
              if (
                window.confirm(
                  'Clear this browser’s session and cached lab data? Server data is not affected.',
                )
              ) {
                window.localStorage.removeItem('vlab-nigeria-v3');
                window.localStorage.removeItem('vlab-api-token-v1');
                window.location.hash = '#/login';
                window.location.reload();
              }
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Clear local session
          </button>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => window.location.reload()}
          >
            <Download className="h-3.5 w-3.5" /> Reload app
          </button>
        </div>
        <div className="mt-3 rounded-xl bg-ink-50/70 p-3 text-[11px] leading-relaxed text-ink-600">
          <p className="font-semibold text-ink-800">Demo sign-in details</p>
          <p className="mt-1 font-mono text-[10.5px]">Student: ada@vlab.ng / student123</p>
          <p className="font-mono text-[10.5px]">Teacher: bello@vlab.ng / teacher123</p>
          <p className="font-mono text-[10.5px]">School admin: admin@kingscollege.edu.ng / school123</p>
          <p className="font-mono text-[10.5px]">Owner: owner@vlab.ng / owner123</p>
          <p className="mt-2 text-[10px] text-ink-400">
            A pending school (Greenfield Academy) is included so the owner can demonstrate approval,
            and a pending student (Ngozi Umeh) is waiting in King’s College for the school admin.
          </p>
          <p className="mt-2 text-[10px] text-ink-400">
            Passwords are hashed with scrypt on the lab server and sessions use bearer tokens.
            Deploy the API over HTTPS. To reseed the demo network, run{' '}
            <span className="font-mono text-[9.5px]">pnpm seed:reset</span> and restart the server.
          </p>
        </div>
      </section>

      <section className="card mt-4 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <ShieldCheck className="h-4 w-4 text-jade-700" /> Privacy &amp; safety
        </h2>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-600">
          Personal data is limited to name, email, school and class code. It is stored on your
          school’s lab server, not in a third-party analytics service. Use a nickname and a class
          code rather than a full home address.
        </p>
        <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-ink-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Chemistry simulations are idealised and must not be used as instructions for handling real
          reagents. Follow your teacher and laboratory safety rules.
        </p>
      </section>

      <p className="mt-5 text-center text-[10px] text-ink-400">
        Virtual Lab Nigeria · build 0.3.0 · server-backed school management
      </p>
    </div>
  );
}
