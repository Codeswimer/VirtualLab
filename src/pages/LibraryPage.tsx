import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Atom,
  BookOpenCheck,
  ChevronRight,
  Clock,
  FlaskConical,
  Play,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trophy,
} from 'lucide-react';
import {
  filterExperiments,
  getExperimentByCode,
  PRIORITY_LABELS,
  SUBJECT_LABELS,
  type ExperimentDefinition,
} from '@/experiments';
import type { ExamBody, Priority, Subject } from '@/experiments/types';
import { bestScore, draftFor, useAppStore, type StoredAttempt } from '@/stores/app-store';
import { useCurrentUser } from '@/hooks/use-app';
import { Badge, IconTile, ProgressBar, SectionHeading, Tabs } from '@/components/ui/primitives';
import { plural } from '@/lib/utils';

const priorityTone = { P0: 'jade', P1: 'amber', P2: 'neutral' } as const;

export function LibraryPage() {
  const user = useCurrentUser();
  const attempts = useAppStore((state) => state.attempts);
  const navigate = useNavigate();

  const [subject, setSubject] = useState<Subject | 'ALL'>('ALL');
  const [priority, setPriority] = useState<Priority | 'ALL'>('ALL');
  const [examBody, setExamBody] = useState<ExamBody | 'ALL'>('ALL');
  const [query, setQuery] = useState('');

  const filtered = useMemo(
    () => filterExperiments({ subject, priority, examBody, query }),
    [subject, priority, examBody, query],
  );

  const myAttempts = attempts.filter((attempt) => attempt.studentId === user?.id);
  const scored = myAttempts.filter((attempt) => attempt.score);
  const average =
    scored.length === 0
      ? 0
      : Math.round(
          scored.reduce((sum, attempt) => sum + (attempt.score?.percent ?? 0), 0) / scored.length,
        );
  const covered = new Set(scored.map((attempt) => attempt.experimentCode)).size;
  const best = scored.reduce((value, attempt) => Math.max(value, attempt.score?.percent ?? 0), 0);

  const drafts = myAttempts.filter((attempt) => attempt.status === 'IN_PROGRESS');

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <section className="relative overflow-hidden rounded-3xl border border-ink-100 bg-white p-5 shadow-card sm:p-7">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-jade-700">
              {new Date().toLocaleDateString('en-NG', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
            <h1 className="mt-1.5 text-balance text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
              {greeting()}, {user?.name.split(' ')[0]}.
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-500">
              {drafts.length > 0
                ? `You have ${plural(drafts.length, 'practical')} in progress. Finish a run to get examiner-style feedback.`
                : 'Choose a practical, work through the procedure and submit your report for marking.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone="jade">
                <Target className="h-3 w-3" /> {covered} of 23 modules covered
              </Badge>
              <Badge tone="neutral">SS1–SS3 · NERDC aligned</Badge>
              <Badge tone="amber">WAEC · NECO ready</Badge>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <StatBox label="Completed" value={String(scored.length)} hint="submissions" Icon={BookOpenCheck} />
            <StatBox label="Average" value={`${average}%`} hint="across all runs" Icon={Sparkles} />
            <StatBox label="Best" value={`${best}%`} hint="single attempt" Icon={Trophy} />
          </div>
        </div>

        <div className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-jade-100/60 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-40 h-40 w-40 rounded-full bg-amber-100/50 blur-3xl" />
      </section>

      {drafts.length > 0 ? (
        <section className="mt-5">
          <div className="flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
            {drafts.slice(0, 3).map((attempt) => {
              const experiment = getExperimentByCode(attempt.experimentCode);
              if (!experiment) return null;
              const filled = attempt.rows.filter((row) =>
                Object.values(row).some((value) => value.trim() !== ''),
              ).length;
              return (
                <Link
                  key={attempt.id}
                  to={`/lab/${experiment.meta.slug}`}
                  className="group flex min-w-[280px] flex-1 items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 px-4 py-3 transition-colors hover:bg-amber-50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm">
                    <Play className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-900">
                      {experiment.meta.title}
                    </p>
                    <p className="text-[11px] text-ink-500">
                      In progress · {filled} reading{filled === 1 ? '' : 's'} recorded
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-amber-700 transition-transform group-hover:translate-x-0.5" />
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section className="mt-7">
        <SectionHeading
          title="Practical library"
          subtitle="Every module includes a guided procedure, realistic instruments, graph paper and marking."
          action={
            <span className="text-xs font-medium text-ink-500">
              Showing {filtered.length} of {23} modules
            </span>
          }
        />

        <div className="mt-4 rounded-2xl border border-ink-100 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search a practical, skill or apparatus…"
                className="input pl-9"
                aria-label="Search practicals"
              />
            </div>
            <Tabs
              tabs={[
                { id: 'ALL', label: 'All' },
                { id: 'PHYSICS', label: 'Physics' },
                { id: 'CHEMISTRY', label: 'Chemistry' },
              ]}
              value={subject}
              onChange={(id) => setSubject(id as Subject | 'ALL')}
            />
            <div className="flex items-center gap-2">
              <div className="relative">
                <SlidersHorizontal className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value as Priority | 'ALL')}
                  className="select py-2 pl-8 text-xs"
                  aria-label="Filter by priority"
                >
                  <option value="ALL">All priorities</option>
                  <option value="P0">Exam-critical</option>
                  <option value="P1">Core</option>
                  <option value="P2">Extension</option>
                </select>
              </div>
              <select
                value={examBody}
                onChange={(event) => setExamBody(event.target.value as ExamBody | 'ALL')}
                className="select py-2 text-xs"
                aria-label="Filter by examination body"
              >
                <option value="ALL">All exam bodies</option>
                <option value="WAEC">WAEC</option>
                <option value="NECO">NECO</option>
                <option value="JAMB">JAMB</option>
              </select>
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-14 text-center">
            <p className="text-sm font-semibold text-ink-800">No practicals match those filters.</p>
            <p className="mt-1 text-sm text-ink-500">
              Try a broader search or clear the subject and priority filters.
            </p>
            <button
              type="button"
              className="btn-secondary mt-4"
              onClick={() => {
                setQuery('');
                setSubject('ALL');
                setPriority('ALL');
                setExamBody('ALL');
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((experiment) => (
              <ExperimentCard
                key={experiment.meta.code}
                experiment={experiment}
                attempts={myAttempts}
                studentId={user?.id ?? ''}
                onOpen={() => navigate(`/lab/${experiment.meta.slug}`)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function StatBox({
  label,
  value,
  hint,
  Icon,
}: {
  label: string;
  value: string;
  hint: string;
  Icon: typeof Trophy;
}) {
  return (
    <div className="rounded-2xl border border-ink-100 bg-ink-50/50 px-3 py-3 sm:px-4">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <p className="stat-value mt-1 text-xl sm:text-2xl">{value}</p>
      <p className="mt-0.5 hidden text-[10px] text-ink-400 sm:block">{hint}</p>
    </div>
  );
}

function ExperimentCard({
  experiment,
  attempts,
  studentId,
  onOpen,
}: {
  experiment: ExperimentDefinition;
  attempts: StoredAttempt[];
  studentId: string;
  onOpen: () => void;
}) {
  const best = bestScore(attempts, studentId, experiment.meta.code);
  const draft = draftFor(attempts, studentId, experiment.meta.code);
  const isPhysics = experiment.meta.subject === 'PHYSICS';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-ink-200 hover:shadow-float"
    >
      <span
        className={`absolute inset-x-0 top-0 h-1 ${
          experiment.meta.priority === 'P0'
            ? 'bg-jade-600'
            : experiment.meta.priority === 'P1'
              ? 'bg-amber-500'
              : 'bg-ink-200'
        }`}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <IconTile tone={isPhysics ? 'jade' : 'amber'} size="sm">
            {isPhysics ? <Atom className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
          </IconTile>
          <div>
            <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-400">
              {experiment.meta.code}
            </p>
            <p className="text-[11px] font-medium text-ink-500">
              {SUBJECT_LABELS[experiment.meta.subject]}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={priorityTone[experiment.meta.priority]}>
            {PRIORITY_LABELS[experiment.meta.priority]}
          </Badge>
          {draft ? <Badge tone="amber">In progress</Badge> : null}
        </div>
      </div>

      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-ink-900 group-hover:text-jade-900">
        {experiment.meta.title}
      </h3>
      <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-ink-500">
        {experiment.meta.summary}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {experiment.meta.skills.slice(0, 2).map((skill) => (
          <span
            key={skill}
            className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-500"
          >
            {skill}
          </span>
        ))}
        <span className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">
          +{Math.max(0, experiment.meta.skills.length - 2)} more
        </span>
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] text-ink-400">
            <Clock className="h-3 w-3" />
            {experiment.meta.durationMin} min
            <span className="h-1 w-1 rounded-full bg-ink-300" />
            {experiment.meta.examBodies.join(' · ')}
          </div>
          {best ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="w-24">
                <ProgressBar
                  value={best.percent}
                  tone={best.percent >= 70 ? 'jade' : best.percent >= 50 ? 'amber' : 'red'}
                />
              </div>
              <span className="text-[11px] font-semibold text-ink-600">
                Best {Math.round(best.percent)}%
              </span>
            </div>
          ) : (
            <p className="mt-2 text-[11px] font-medium text-ink-400">Not attempted yet</p>
          )}
        </div>
        <span className="flex items-center gap-1 text-xs font-semibold text-jade-800">
          {draft ? 'Continue' : best ? 'Retry' : 'Start'}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}
