import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CalendarClock,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Medal,
  Play,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Globe2,
} from 'lucide-react';
import { gradeFor } from '@sim/scoring/types';
import { EXPERIMENTS, getExperimentByCode } from '@/experiments';
import { useCurrentUser } from '@/hooks/use-app';
import {
  attemptsForStudent,
  attemptPercent,
  useAppStore,
} from '@/stores/app-store';
import {
  leaderboardForScope,
  performanceBand,
  rankFor,
  studentMetrics,
  type LeaderboardScope,
} from '@/lib/leaderboard';
import { cn, relativeTime } from '@/lib/utils';
import { Badge, ProgressBar, ScoreRing, SectionHeading } from '@/components/ui/primitives';
import {
  GradePill,
  PageHeading,
  RankMedal,
  StatCard,
} from '@/components/dashboard/kit';

function bestPercentFor(
  attempts: ReturnType<typeof useAppStore.getState>['attempts'],
  studentId: string,
  experimentCode: string,
): number | null {
  const values = attempts
    .filter(
      (attempt) =>
        attempt.studentId === studentId &&
        attempt.experimentCode === experimentCode &&
        attempt.status === 'SCORED',
    )
    .map(attemptPercent)
    .filter((value): value is number => value !== null);
  return values.length === 0 ? null : Math.max(...values);
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Deadlines are in the future, so relativeTime() would read "just now". */
function dueLabel(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return `was due ${relativeTime(iso)}`;
  const minutes = Math.ceil(diff / 60000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `in ${hours} hr`;
  const days = Math.ceil(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

export function StudentDashboard() {
  const user = useCurrentUser();
  const attempts = useAppStore((state) => state.attempts);
  const leaderboard = useAppStore((state) => state.leaderboard);
  const schools = useAppStore((state) => state.schools);
  const assignments = useAppStore((state) => state.assignments);
  const classCode = user?.classCode ?? '';

  if (!user) return null;

  const metrics = studentMetrics(attempts, user.id);
  const band = performanceBand(metrics.average);
  const school = schools.find((candidate) => candidate.id === user.schoolId);

  const classBoard = leaderboardForScope(leaderboard, 'class', user.schoolId, classCode);
  const ownRow = leaderboard.find((row) => row.studentId === user.id);
  const rankIn = (scope: LeaderboardScope) => (ownRow ? rankFor(ownRow, scope) : null);

  const recent = attemptsForStudent(attempts, user.id).slice(0, 5);
  const drafts = attempts.filter(
    (attempt) => attempt.studentId === user.id && attempt.status === 'IN_PROGRESS',
  );
  const classTests = assignments.filter(
    (assignment) =>
      assignment.classCode === classCode && assignment.schoolId === user.schoolId,
  );
  const testAttempts = attempts.filter(
    (attempt) => attempt.studentId === user.id && attempt.assignmentId,
  );

  const focus = EXPERIMENTS.map((experiment) => ({
    experiment,
    best: bestPercentFor(attempts, user.id, experiment.meta.code),
  }))
    .filter((entry) => entry.best !== null || entry.experiment.meta.priority === 'P0')
    .sort((a, b) => (a.best ?? -1) - (b.best ?? -1))
    .slice(0, 3);

  const subjectAverage = (subject: 'PHYSICS' | 'CHEMISTRY') => {
    const values = EXPERIMENTS.filter((experiment) => experiment.meta.subject === subject)
      .map((experiment) => bestPercentFor(attempts, user.id, experiment.meta.code))
      .filter((value): value is number => value !== null);
    return values.length === 0
      ? 0
      : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeading
        eyebrow="Student overview"
        title={`${greeting()}, ${user.name.split(' ')[0]}.`}
        subtitle={`${user.gradeLevel} · ${classCode} · ${user.school}`}
        actions={
          <>
            <Link to="/leaderboard" className="btn-secondary btn-sm">
              <Trophy className="h-3.5 w-3.5" /> Leaderboard
            </Link>
            <Link to="/library" className="btn-primary btn-sm">
              <Play className="h-3.5 w-3.5" /> Practise
            </Link>
          </>
        }
      />

      <section className="bench-dark mt-5 overflow-hidden rounded-3xl p-5 text-white sm:p-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <div className="relative flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07]">
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-jade-300">
                Term grade
              </span>
              <span className="font-mono text-4xl font-bold leading-tight">{metrics.grade}</span>
              <span className="font-mono text-[11px] text-ink-200">
                {metrics.average.toFixed(1)}%
              </span>
            </div>
            <div>
              <Badge tone={band.tone === 'jade' ? 'jade' : band.tone === 'amber' ? 'amber' : 'red'}>
                <Sparkles className="h-3 w-3" /> {band.label}
              </Badge>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                {metrics.submissions === 0
                  ? 'Your practical record starts here.'
                  : rankIn('class')
                    ? `You are ranked #${rankIn('class')} in ${classCode}.`
                    : 'Your practical record starts here.'}
              </h2>
              <p className="mt-1 max-w-md text-sm text-ink-200/80">{band.note}</p>
              <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-ink-200/80">
                <span className="inline-flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-amber-300" /> {classCode}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <BookOpenCheck className="h-3.5 w-3.5 text-jade-300" /> {metrics.submissions}{' '}
                  submissions
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-jade-300" /> Best {Math.round(metrics.best)}%
                </span>
              </div>
            </div>
          </div>

          <div className="grid w-full max-w-xs grid-cols-3 gap-2">
            {[
              { label: 'Class', value: rankIn('class'), icon: Users },
              { label: 'School', value: rankIn('school'), icon: GraduationCap },
              { label: 'Global', value: rankIn('global'), icon: Globe2 },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/10 bg-white/[0.06] p-2.5 text-center"
              >
                <p className="text-[9px] font-bold uppercase tracking-wider text-ink-300">
                  {item.label}
                </p>
                <p className="mt-0.5 font-mono text-lg font-bold text-white">
                  {item.value ? `#${item.value}` : '—'}
                </p>
                <p className="text-[9px] text-ink-400">
                  {item.value ? 'rank' : 'no data'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Modules covered"
          value={`${metrics.modules}/23`}
          hint="in your record"
          icon={Target}
        />
        <StatCard
          label="Class position"
          value={rankIn('class') ? `#${rankIn('class')}` : '—'}
          hint={`of ${classBoard.length} ranked`}
          icon={Medal}
          tone="amber"
        />
        <StatCard
          label="Average"
          value={`${metrics.average.toFixed(1)}%`}
          hint="best per module"
          icon={TrendingUp}
          tone="sky"
        />
        <StatCard
          label="Teacher-marked"
          value={String(metrics.reviewed)}
          hint="reviewed by your teacher"
          icon={BookOpenCheck}
          tone="ink"
        />
      </div>

      {classTests.length > 0 ? (
        <section className="mt-6">
          <SectionHeading
            title="Assigned tests"
            subtitle={
              classTests.filter(
                (assignment) =>
                  !testAttempts.some(
                    (attempt) =>
                      attempt.assignmentId === assignment.id && attempt.status === 'SCORED',
                  ),
              ).length > 0
                ? 'Your teacher has set work for this class. Open a test to run the practical and answer the written questions.'
                : 'Every test set for this class has been submitted.'
            }
          />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {classTests.map((assignment) => {
              const experiment = getExperimentByCode(assignment.experimentCode);
              if (!experiment) return null;
              const attempt = testAttempts.find(
                (candidate) => candidate.assignmentId === assignment.id,
              );
              const overdue =
                assignment.dueAt &&
                new Date(assignment.dueAt).getTime() < Date.now() &&
                attempt?.status !== 'SCORED';
              return (
                <div key={assignment.id} className="card flex flex-col p-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={assignment.source === 'AI' ? 'jade' : 'amber'}>
                      {assignment.source === 'AI' ? (
                        <>
                          <Sparkles className="h-3 w-3" /> AI challenge
                        </>
                      ) : (
                        <>
                          <ClipboardCheck className="h-3 w-3" /> Class test
                        </>
                      )}
                    </Badge>
                    {attempt?.status === 'SCORED' ? (
                      <Badge tone="jade">Submitted</Badge>
                    ) : attempt?.status === 'IN_PROGRESS' || attempt?.status === 'SUBMITTED' ? (
                      <Badge tone="amber">In progress</Badge>
                    ) : overdue ? (
                      <Badge tone="red">Overdue</Badge>
                    ) : (
                      <Badge tone="neutral">To do</Badge>
                    )}
                    {assignment.questions.length > 0 ? (
                      <Badge tone="sky">{assignment.questions.length} questions</Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-[13px] font-semibold leading-snug text-ink-800">
                    {assignment.title}
                  </p>
                  <p className="mt-0.5 text-[10.5px] text-ink-400">
                    {experiment.meta.title} · set by {assignment.teacherName}
                  </p>
                  {assignment.instructions ? (
                    <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-ink-500">
                      {assignment.instructions}
                    </p>
                  ) : null}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <span className="inline-flex items-center gap-1 text-[10px] text-ink-400">
                      <CalendarClock className="h-3 w-3" />
                      {assignment.dueAt ? dueLabel(assignment.dueAt) : 'No due date'}
                    </span>
                    <Link
                      to={
                        attempt?.status === 'SCORED'
                          ? `/report/${attempt.id}`
                          : `/lab/${experiment.meta.slug}?assignment=${assignment.id}`
                      }
                      className="btn-primary btn-sm"
                    >
                      {attempt?.status === 'SCORED'
                        ? 'Review work'
                        : attempt?.status === 'IN_PROGRESS'
                          ? 'Continue'
                          : 'Open test'}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {drafts.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {drafts.slice(0, 3).map((attempt) => {
            const experiment = getExperimentByCode(attempt.experimentCode);
            if (!experiment) return null;
            return (
              <Link
                key={attempt.id}
                to={`/lab/${experiment.meta.slug}`}
                className="group flex flex-1 items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-amber-700">
                  <Play className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-ink-900">
                    {experiment.meta.title}
                  </span>
                  <span className="block text-[10px] text-ink-500">Continue your draft</span>
                </span>
                <ChevronRight className="h-4 w-4 text-amber-700" />
              </Link>
            );
          })}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="card p-5">
          <SectionHeading
            title="Recent results"
            subtitle="Open a report to see every mark and your teacher’s comment."
            action={
              <Link
                to="/progress"
                className="inline-flex items-center gap-1 text-xs font-semibold text-jade-800 hover:text-jade-900"
              >
                Full record <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            }
          />
          <div className="mt-3 space-y-1.5">
            {recent.length === 0 ? (
              <div className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center">
                <p className="text-sm font-semibold text-ink-700">No submissions yet</p>
                <p className="mt-1 text-xs text-ink-500">
                  Start with a WAEC exam-critical practical to build your term grade.
                </p>
                <Link to="/library" className="btn-primary btn-sm mt-3">
                  Open the library
                </Link>
              </div>
            ) : (
              recent.map((attempt) => {
                const experiment = getExperimentByCode(attempt.experimentCode);
                const percent = attemptPercent(attempt) ?? 0;
                if (!experiment) return null;
                return (
                  <Link
                    key={attempt.id}
                    to={`/report/${attempt.id}`}
                    className="flex items-center gap-3 rounded-xl border border-ink-50 px-3 py-2.5 transition-colors hover:border-ink-200 hover:bg-ink-50/50"
                  >
                    <ScoreRing percent={percent} size={38} showGrade={false} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-ink-800">
                          {experiment.meta.title}
                        </p>
                        {attempt.review ? (
                          <Badge tone="sky" className="shrink-0">
                            Teacher-marked
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-ink-400">
                        {attempt.submittedAt ? relativeTime(attempt.submittedAt) : ''} ·{' '}
                        {experiment.meta.code}
                      </p>
                    </div>
                    <GradePill grade={attempt.review ? gradeFor(percent) : (attempt.score?.grade ?? '—')} />
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <div className="space-y-4">
          <section className="card p-5">
            <SectionHeading title="Class leaderboard" subtitle={`Top of ${classCode}.`} />
            <div className="mt-3 space-y-1.5">
              {classBoard.slice(0, 5).map((entry) => (
                <div
                  key={entry.studentId}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border px-2.5 py-2',
                    entry.studentId === user.id
                      ? 'border-jade-200 bg-jade-50/60'
                      : 'border-ink-50',
                  )}
                >
                  <RankMedal rank={entry.classRank} />
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-800">
                    {entry.name}
                    {entry.studentId === user.id ? (
                      <span className="ml-1 text-[10px] font-medium text-jade-700">you</span>
                    ) : null}
                  </p>
                  <span className="font-mono text-[11px] font-semibold text-ink-600">
                    {entry.average.toFixed(0)}%
                  </span>
                  <GradePill grade={entry.grade} />
                </div>
              ))}
              {classBoard.length === 0 ? (
                <p className="text-xs text-ink-500">
                  No marks in {classCode} yet. Your first submission puts you on the board.
                </p>
              ) : null}
            </div>
            <Link to="/leaderboard" className="btn-secondary btn-sm mt-3 w-full">
              <Trophy className="h-3.5 w-3.5" /> Full leaderboard
            </Link>
          </section>

          <section className="card p-5">
            <SectionHeading title="Subject standing" subtitle="Best score per subject." />
            <div className="mt-3 space-y-3">
              {(['PHYSICS', 'CHEMISTRY'] as const).map((subject) => {
                const value = subjectAverage(subject);
                return (
                  <div key={subject}>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-ink-700">
                        {subject === 'PHYSICS' ? 'Physics' : 'Chemistry'}
                      </span>
                      <span className="font-mono font-semibold text-ink-600">{value}%</span>
                    </div>
                    <ProgressBar
                      className="mt-1"
                      value={value}
                      tone={value >= 70 ? 'jade' : value >= 50 ? 'amber' : 'red'}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <section className="mt-6">
        <SectionHeading
          title="Focus next"
          subtitle="Weakest modules and exam-critical practicals you have not tried."
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {focus.map(({ experiment, best }) => (
            <Link
              key={experiment.meta.code}
              to={`/lab/${experiment.meta.slug}`}
              className="group card flex flex-col p-4 transition-all hover:-translate-y-0.5 hover:shadow-float"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  {experiment.meta.code}
                </span>
                {best === null ? (
                  <Badge tone="amber">Not started</Badge>
                ) : (
                  <Badge tone={best >= 70 ? 'jade' : best >= 50 ? 'amber' : 'red'}>
                    {Math.round(best)}%
                  </Badge>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-ink-800 group-hover:text-jade-900">
                {experiment.meta.title}
              </p>
              <div className="mt-auto flex items-center justify-between pt-3">
                <span className="text-[10px] text-ink-400">
                  {experiment.meta.subject === 'PHYSICS' ? 'Physics' : 'Chemistry'}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-jade-800">
                  {best === null ? 'Start' : 'Improve'}
                  <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <p className="mt-5 text-center text-[10px] text-ink-400">
        {school?.name ?? user.school} · grades use your best attempt in each practical. Teacher
        marks override the automatic score.
      </p>
    </div>
  );
}


