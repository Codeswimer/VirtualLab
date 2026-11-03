import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  Globe2,
  GraduationCap,
  School,
  ShieldCheck,
  ShieldX,
  Trophy,
  Users,
} from 'lucide-react';
import { useAppStore } from '@/stores/app-store';
import { useCurrentUser } from '@/hooks/use-app';
import { leaderboardForScope, schoolStandings, studentMetrics } from '@/lib/leaderboard';
import { formatDate, initials, relativeTime } from '@/lib/utils';
import { Badge, EmptyState, SectionHeading } from '@/components/ui/primitives';
import {
  GradePill,
  PageHeading,
  RankMedal,
  StatCard,
  StatusPill,
} from '@/components/dashboard/kit';
import { ROLE_LABELS } from '@/lib/roles';

export function AdminDashboard() {
  const user = useCurrentUser();
  const schools = useAppStore((state) => state.schools);
  const accounts = useAppStore((state) => state.accounts);
  const attempts = useAppStore((state) => state.attempts);
  const leaderboard = useAppStore((state) => state.leaderboard);
  const setSchoolStatus = useAppStore((state) => state.setSchoolStatus);
  const [actionError, setActionError] = useState<string | null>(null);

  const pendingSchools = schools
    .filter((school) => school.status === 'PENDING')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const approvedSchools = schools.filter((school) => school.status === 'APPROVED');
  const activeStudents = accounts.filter(
    (account) => account.role === 'STUDENT' && account.status === 'ACTIVE',
  );
  const activeTeachers = accounts.filter(
    (account) => account.role === 'TEACHER' && account.status === 'ACTIVE',
  );
  const submissions = attempts.filter((attempt) => attempt.status === 'SCORED');
  const reviewed = submissions.filter((attempt) => attempt.review);

  const standings = useMemo(
    () => schoolStandings(accounts, attempts, schools),
    [accounts, attempts, schools],
  );
  const platformAverage = useMemo(() => {
    const values = activeStudents
      .map((student) => studentMetrics(attempts, student.id))
      .filter((metrics) => metrics.submissions > 0)
      .map((metrics) => metrics.average);
    return values.length === 0
      ? 0
      : Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
  }, [activeStudents, attempts]);

  const globalBoard = leaderboardForScope(leaderboard, 'global');
  const recentAccounts = [...accounts]
    .filter((account) => account.role !== 'ADMIN')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const pendingMembers = accounts.filter(
    (account) => account.role !== 'ADMIN' && account.status === 'PENDING',
  ).length;

  const applyStatus = async (schoolId: string, status: 'APPROVED' | 'REVOKED') => {
    setActionError(await setSchoolStatus(schoolId, status));
  };

  const toggleSchool = (schoolId: string, name: string, revoke: boolean) => {
    if (revoke && !window.confirm(`Revoke ${name}'s access? Every member will be blocked from signing in.`)) {
      return;
    }
    void applyStatus(schoolId, revoke ? 'REVOKED' : 'APPROVED');
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeading
        eyebrow="Owner console"
        title="Platform administration"
        subtitle="Approve schools, control access and watch performance across the network."
        actions={
          <>
            <Badge tone="ink">
              <ShieldCheck className="h-3 w-3" /> {ROLE_LABELS.ADMIN}
            </Badge>
            <Link to="/leaderboard" className="btn-secondary btn-sm">
              <Trophy className="h-3.5 w-3.5" /> Leaderboards
            </Link>
          </>
        }
      />

      {actionError ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
          {actionError}
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Schools live" value={String(approvedSchools.length)} hint={`${schools.length} total`} icon={School} />
        <StatCard label="Applications" value={String(pendingSchools.length)} hint="awaiting review" icon={Clock} tone="amber" />
        <StatCard label="Students" value={String(activeStudents.length)} hint="active accounts" icon={GraduationCap} tone="sky" />
        <StatCard label="Teachers" value={String(activeTeachers.length)} hint="active accounts" icon={Users} tone="sky" />
        <StatCard label="Submissions" value={String(submissions.length)} hint={`${reviewed.length} teacher-marked`} icon={ClipboardList} tone="ink" />
        <StatCard label="Network average" value={`${platformAverage.toFixed(1)}%`} hint="across active students" icon={Globe2} tone="jade" />
      </div>

      <section className="mt-6">
        <SectionHeading
          title="School applications"
          subtitle="A school cannot onboard students until you approve it."
          action={
            <Badge tone={pendingSchools.length > 0 ? 'amber' : 'jade'}>
              {pendingSchools.length > 0
                ? `${pendingSchools.length} waiting`
                : 'All reviewed'}
            </Badge>
          }
        />
        {pendingSchools.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              icon={<CheckCircle2 className="h-6 w-6" />}
              title="No applications waiting"
              body="New school registrations appear here. Approve to activate the school admin account and open onboarding."
              action={
                <Link to="/leaderboard" className="btn-secondary btn-sm">
                  View national leaderboard
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {pendingSchools.map((school) => {
              const admin = accounts.find(
                (account) => account.schoolId === school.id && account.role === 'SCHOOL_ADMIN',
              );
              return (
                <div key={school.id} className="card overflow-hidden">
                  <div className="border-b border-amber-100 bg-amber-50/60 px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="amber">
                        <Clock className="h-3 w-3" /> Pending review
                      </Badge>
                      <span className="text-[10px] text-amber-700">
                        applied {relativeTime(school.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                        <Building2 className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-ink-900">{school.name}</h3>
                        <p className="text-[11px] text-ink-500">
                          {school.city}, {school.state} · code{' '}
                          <span className="font-mono font-semibold text-ink-700">{school.code}</span>
                        </p>
                        <p className="mt-1 text-[11px] text-ink-500">
                          {school.contactName} · {school.contactEmail}
                        </p>
                        {admin ? (
                          <p className="mt-1 text-[10px] text-ink-400">
                            School admin account created {formatDate(admin.createdAt)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        onClick={() => void applyStatus(school.id, 'APPROVED')}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve school
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => toggleSchool(school.id, school.name, true)}
                      >
                        <ShieldX className="h-3.5 w-3.5" /> Decline
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <section className="card p-5">
          <SectionHeading
            title="School network"
            subtitle="Approve, revoke or restore access for any school."
          />
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="border-b border-ink-100">
                  <th className="py-2 pr-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">School</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Members</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Average</th>
                  <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Status</th>
                  <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-ink-400">Access</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((standing) => {
                  const school = standing.school;
                  return (
                    <tr key={school.id} className="border-b border-ink-50 last:border-0">
                      <td className="py-2.5 pr-2">
                        <p className="text-xs font-semibold text-ink-800">{school.name}</p>
                        <p className="text-[10px] text-ink-400">
                          {school.city}, {school.state} · <span className="font-mono">{school.code}</span>
                        </p>
                      </td>
                      <td className="px-2 py-2.5">
                        <p className="font-mono text-[11px] text-ink-700">
                          {standing.students} <span className="text-ink-400">students</span>
                        </p>
                        <p className="font-mono text-[10px] text-ink-400">
                          {standing.teachers} teachers
                        </p>
                      </td>
                      <td className="px-2 py-2.5 font-mono text-xs text-ink-700">
                        {standing.submissions > 0 ? `${standing.average.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-2 py-2.5">
                        <StatusPill status={school.status} />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {school.status === 'APPROVED' ? (
                          <button
                            type="button"
                            className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                            onClick={() => toggleSchool(school.id, school.name, true)}
                          >
                            Revoke
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => void applyStatus(school.id, 'APPROVED')}
                          >
                            {school.status === 'PENDING' ? 'Approve' : 'Restore'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[10px] text-ink-400">
            Revoking a school blocks every member immediately. Restoring re-opens access without
            losing work.
          </p>
        </section>

        <div className="space-y-4">
          <section className="card p-5">
            <SectionHeading
              title="National leaderboard"
              subtitle="Top students across approved schools."
              action={
                <Link to="/leaderboard" className="inline-flex items-center gap-1 text-[11px] font-semibold text-jade-800">
                  All <ArrowRight className="h-3 w-3" />
                </Link>
              }
            />
            <div className="mt-3 space-y-1.5">
              {globalBoard.slice(0, 5).map((entry) => (
                <div
                  key={entry.studentId}
                  className="flex items-center gap-2 rounded-lg border border-ink-50 px-2.5 py-2"
                >
                  <RankMedal rank={entry.globalRank} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-semibold text-ink-800">
                      {entry.name}
                    </p>
                    <p className="truncate text-[9.5px] text-ink-400">
                      {entry.schoolName} · {entry.classCode}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-ink-600">
                    {entry.average.toFixed(0)}%
                  </span>
                  <GradePill grade={entry.grade} />
                </div>
              ))}
              {globalBoard.length === 0 ? (
                <p className="text-xs text-ink-500">No approved school has submitted work yet.</p>
              ) : null}
            </div>
          </section>

          <section className="card p-5">
            <SectionHeading title="Recent accounts" subtitle="Newest members across the network." />
            <div className="mt-3 space-y-1.5">
              {recentAccounts.map((account) => (
                <div key={account.id} className="flex items-center gap-2 rounded-lg border border-ink-50 px-2.5 py-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-100 font-mono text-[9px] font-bold text-ink-700">
                    {initials(account.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11.5px] font-semibold text-ink-800">{account.name}</p>
                    <p className="truncate text-[9.5px] text-ink-400">
                      {ROLE_LABELS[account.role]} · {account.school}
                    </p>
                  </div>
                  <StatusPill status={account.status} />
                </div>
              ))}
            </div>
            {pendingMembers > 0 ? (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50/70 px-2.5 py-2 text-[10px] leading-relaxed text-amber-800">
                {pendingMembers} member request{pendingMembers === 1 ? '' : 's'} across schools are
                waiting for their school admin to approve them.
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-ink-100 bg-white p-4">
        <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
          <ShieldCheck className="h-3 w-3" /> Access hierarchy
        </p>
        <div className="mt-2 grid gap-2 text-[11px] leading-relaxed text-ink-600 sm:grid-cols-3">
          <p>
            <span className="font-semibold text-ink-800">Owner</span> approves or revokes schools and
            sees the national picture.
          </p>
          <p>
            <span className="font-semibold text-ink-800">School admin</span> onboards students and
            teachers, approves requests and revokes access.
          </p>
          <p>
            <span className="font-semibold text-ink-800">Teachers</span> mark class work; students
            see their grades and leaderboards.
          </p>
        </div>
      </section>
    </div>
  );
}
