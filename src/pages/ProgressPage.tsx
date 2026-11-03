import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpenCheck,
  CircleDashed,
  LineChart,
  Play,
  Target,
  TrendingUp,
} from 'lucide-react';
import { EXPERIMENTS, PRIORITY_LABELS, SUBJECT_LABELS } from '@/experiments';
import type { Subject } from '@/experiments/types';
import { bestScore, useAppStore } from '@/stores/app-store';
import { useCurrentUser } from '@/hooks/use-app';
import { Badge, ProgressBar, ScoreRing, SectionHeading, Tabs } from '@/components/ui/primitives';
import { cn, formatDateTime, relativeTime } from '@/lib/utils';

export function ProgressPage() {
  const user = useCurrentUser();
  const attempts = useAppStore((state) => state.attempts);
  const [subject, setSubject] = useState<Subject | 'ALL'>('ALL');

  const mine = attempts
    .filter((attempt) => attempt.studentId === user?.id && attempt.status === 'SCORED')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

  const stats = useMemo(() => {
    const percents = mine.map((attempt) => attempt.score?.percent ?? 0);
    const average = percents.length ? Math.round(percents.reduce((s, v) => s + v, 0) / percents.length) : 0;
    const covered = new Set(mine.map((attempt) => attempt.experimentCode)).size;
    const best = Math.max(0, ...percents);
    const skills = new Map<string, number[]>();
    for (const attempt of mine) {
      const experiment = EXPERIMENTS.find((item) => item.meta.code === attempt.experimentCode);
      if (!experiment) continue;
      for (const skill of experiment.meta.skills) {
        const list = skills.get(skill) ?? [];
        list.push(attempt.score?.percent ?? 0);
        skills.set(skill, list);
      }
    }
    return { average, covered, best, count: mine.length, skills };
  }, [mine]);

  const filteredExperiments = EXPERIMENTS.filter(
    (experiment) => subject === 'ALL' || experiment.meta.subject === subject,
  );

  const weakestSkills = [...stats.skills.entries()]
    .map(([skill, values]) => ({
      skill,
      average: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
      count: values.length,
    }))
    .sort((a, b) => a.average - b.average)
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-jade-700">Progress</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">
            {user?.name.split(' ')[0]}&apos;s practical record
          </h1>
          <p className="mt-1 text-sm text-ink-500">
            Every submitted practical, with the skills it exercises.
          </p>
        </div>
        <Link to="/library" className="btn-primary">
          <Play className="h-4 w-4" /> Practise something new
        </Link>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Submissions" value={String(stats.count)} icon={BookOpenCheck} />
        <Stat label="Modules covered" value={`${stats.covered}/${EXPERIMENTS.length}`} icon={Target} />
        <Stat label="Average score" value={`${stats.average}%`} icon={TrendingUp} />
        <Stat label="Best attempt" value={`${stats.best}%`} icon={Award} />
      </div>

      {weakestSkills.length > 0 ? (
        <section className="mt-6">
          <SectionHeading
            title="Skill focus"
            subtitle="Average score in each skill, weakest first. Target these before the exam."
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {weakestSkills.map((item) => (
              <div key={item.skill} className="card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-ink-800">{item.skill}</p>
                  <span
                    className={cn(
                      'font-mono text-[11px] font-bold',
                      item.average >= 70
                        ? 'text-jade-700'
                        : item.average >= 50
                          ? 'text-amber-700'
                          : 'text-red-600',
                    )}
                  >
                    {item.average}%
                  </span>
                </div>
                <ProgressBar
                  className="mt-2"
                  value={item.average}
                  tone={item.average >= 70 ? 'jade' : item.average >= 50 ? 'amber' : 'red'}
                />
                <p className="mt-1.5 text-[10px] text-ink-400">
                  from {item.count} submission{item.count === 1 ? '' : 's'}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionHeading title="Module record" subtitle="Best score per practical." />
          <Tabs
            tabs={[
              { id: 'ALL', label: 'All' },
              { id: 'PHYSICS', label: 'Physics' },
              { id: 'CHEMISTRY', label: 'Chemistry' },
            ]}
            value={subject}
            onChange={(id) => setSubject(id as Subject | 'ALL')}
          />
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
          {filteredExperiments.map((experiment, index) => {
            const best = bestScore(attempts, user?.id ?? '', experiment.meta.code);
            const count = mine.filter((attempt) => attempt.experimentCode === experiment.meta.code).length;
            return (
              <Link
                key={experiment.meta.code}
                to={`/lab/${experiment.meta.slug}`}
                className={cn(
                  'group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50/60',
                  index !== 0 && 'border-t border-ink-50',
                )}
              >
                <span className="hidden w-16 shrink-0 sm:block">
                  <span className="font-mono text-[10px] font-bold text-ink-400">
                    {experiment.meta.code}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-ink-800">
                    {experiment.meta.title}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[10px] text-ink-400">
                    <span>{SUBJECT_LABELS[experiment.meta.subject]}</span>
                    <span className="h-1 w-1 rounded-full bg-ink-300" />
                    <span>{PRIORITY_LABELS[experiment.meta.priority]}</span>
                    <span className="h-1 w-1 rounded-full bg-ink-300" />
                    <span>{count} attempt{count === 1 ? '' : 's'}</span>
                  </div>
                </div>
                {best ? (
                  <div className="flex items-center gap-3">
                    <div className="hidden w-24 sm:block">
                      <ProgressBar
                        value={best.percent}
                        tone={best.percent >= 70 ? 'jade' : best.percent >= 50 ? 'amber' : 'red'}
                      />
                    </div>
                    <ScoreRing percent={best.percent} size={38} showGrade={false} />
                  </div>
                ) : (
                  <span className="hidden items-center gap-1 text-[11px] text-ink-400 sm:flex">
                    <CircleDashed className="h-3.5 w-3.5" /> Not attempted
                  </span>
                )}
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-600" />
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mt-7">
        <SectionHeading title="Recent submissions" subtitle="Open any report to review the feedback." />
        {mine.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-12 text-center">
            <LineChart className="mx-auto h-6 w-6 text-ink-300" />
            <p className="mt-2 text-sm font-semibold text-ink-700">No submissions yet</p>
            <p className="mt-1 text-xs text-ink-500">
              Complete a practical and submit it to start building your record.
            </p>
            <Link to="/library" className="btn-primary btn-sm mt-3">
              Open the library
            </Link>
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
            {mine.slice(0, 8).map((attempt, index) => {
              const experiment = EXPERIMENTS.find(
                (item) => item.meta.code === attempt.experimentCode,
              );
              if (!experiment || !attempt.score) return null;
              return (
                <Link
                  key={attempt.id}
                  to={`/report/${attempt.id}`}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-ink-50/60',
                    index !== 0 && 'border-t border-ink-50',
                  )}
                >
                  <ScoreRing percent={attempt.score.percent} size={40} showGrade={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink-800">
                      {experiment.meta.title}
                    </p>
                    <p className="text-[10px] text-ink-400">
                      {attempt.submittedAt ? relativeTime(attempt.submittedAt) : ''} · grade{' '}
                      {attempt.score.grade}
                    </p>
                  </div>
                  <span className="hidden text-[10px] text-ink-400 sm:block">
                    {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : ''}
                  </span>
                  <Badge tone={attempt.score.percent >= 70 ? 'jade' : attempt.score.percent >= 50 ? 'amber' : 'red'}>
                    {Math.round(attempt.score.percent)}%
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-ink-300" />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Target;
}) {
  return (
    <div className="card p-3.5">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
        <Icon className="h-3 w-3" /> {label}
      </span>
      <p className="stat-value mt-1">{value}</p>
    </div>
  );
}
