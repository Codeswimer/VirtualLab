import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  CloudOff,
  FileText,
  LineChart,
  Printer,
  RotateCcw,
  Table2,
  Target,
  Trophy,
  XCircle,
} from 'lucide-react';
import { getExperimentByCode } from '@/experiments';
import { drawnLineGradient } from '@sim/math';
import { parseNumberAnswer } from '@sim/math';
import type { CriterionKind } from '@sim/scoring/types';
import { attemptGrade, attemptPercent, useAppStore } from '@/stores/app-store';
import { useCurrentUser } from '@/hooks/use-app';
import { Badge, ProgressBar, ScoreRing } from '@/components/ui/primitives';
import { cn, formatDateTime } from '@/lib/utils';

const kindLabels: Record<CriterionKind, string> = {
  table: 'Readings',
  graph: 'Graph',
  calculation: 'Calculations',
  procedure: 'Technique',
  conclusion: 'Conclusion',
};

const kindIcons: Record<CriterionKind, typeof Table2> = {
  table: Table2,
  graph: LineChart,
  calculation: Calculator,
  procedure: Target,
  conclusion: FileText,
};

export function ReportPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const attempts = useAppStore((state) => state.attempts);
  const startAttempt = useAppStore((state) => state.startAttempt);
  const user = useCurrentUser();
  const attempt = attempts.find((candidate) => candidate.id === attemptId);

  if (!attempt || !attempt.score) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-ink-900">Report not ready</h1>
        <p className="mt-2 text-sm text-ink-500">
          This report is still being marked, or the attempt was not submitted.
        </p>
        <Link to="/library" className="btn-primary mt-5">
          Back to library
        </Link>
      </div>
    );
  }

  const experiment = getExperimentByCode(attempt.experimentCode);
  if (!experiment) return null;
  const score = attempt.score;
  const displayPercent = attemptPercent(attempt) ?? score.percent;
  const displayGrade = attemptGrade(attempt) ?? score.grade;
  const scenario = experiment.generate(attempt.seed);
  const kinds = Array.from(new Set(score.criteria.map((c) => c.kind)));
  const gradient = attempt.graph?.line ? drawnLineGradient(attempt.graph.line) : null;
  const ownAttempt = attempt.studentId === user?.id;

  const sectionTotals = kinds.map((kind) => {
    const items = score.criteria.filter((criterion) => criterion.kind === kind);
    return {
      kind,
      awarded: Math.round(items.reduce((sum, c) => sum + c.awarded, 0) * 10) / 10,
      max: items.reduce((sum, c) => sum + c.max, 0),
    };
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:py-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> Print report
          </button>
          {ownAttempt ? (
            <button
              type="button"
              className="btn-primary btn-sm"
              onClick={() => {
                const draft = attempts.find(
                  (candidate) =>
                    candidate.studentId === attempt.studentId &&
                    candidate.experimentCode === attempt.experimentCode &&
                    candidate.status === 'IN_PROGRESS',
                );
                if (!draft) startAttempt(attempt.experimentCode);
                navigate(`/lab/${experiment.meta.slug}`);
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Retake with new values
            </button>
          ) : null}
        </div>
      </div>

      <section className="card mt-3 overflow-hidden">
        <div className="relative border-b border-ink-100 bg-gradient-to-br from-white via-white to-jade-50/60 p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="relative">
                <ScoreRing percent={displayPercent} size={104} stroke={9} />
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-ink-100 bg-white px-2 py-0.5 font-mono text-[10px] font-bold text-ink-700 shadow-sm">
                  {displayGrade}
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  {experiment.meta.code} · attempt #{attempt.seed.toString(36).toUpperCase()}
                </p>
                <h1 className="mt-0.5 text-balance text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
                  {experiment.meta.title}
                </h1>
                <p className="mt-1 text-xs text-ink-500">
                  Submitted {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : '—'} ·{' '}
                  {score.total}/{score.max} marks
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Badge tone={displayPercent >= 70 ? 'jade' : displayPercent >= 50 ? 'amber' : 'red'}>
                    <Trophy className="h-3 w-3" /> {displayGrade} · {Math.round(displayPercent)}%
                  </Badge>
                  <Badge tone="neutral">
                    <CheckCircle2 className="h-3 w-3" /> Auto-marked from seed
                  </Badge>
                  {attempt.review ? <Badge tone="sky">Teacher-marked</Badge> : null}
                  {attempt.delivery === 'queued' ? (
                    <Badge tone="amber">
                      <CloudOff className="h-3 w-3" /> Queued for delivery
                    </Badge>
                  ) : (
                    <Badge tone="jade">Delivered to class</Badge>
                  )}
                </div>
              </div>
            </div>
            <div className="w-full max-w-xs rounded-xl border border-ink-100 bg-white/80 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                Examiner summary
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-ink-700">{score.summary}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
          {sectionTotals.map((section) => {
            const Icon = kindIcons[section.kind];
            const ratio = section.max === 0 ? 0 : section.awarded / section.max;
            return (
              <div key={section.kind} className="border-b border-ink-100 p-4 last:border-0 sm:border-r sm:last:border-r-0 lg:border-b-0">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                    <Icon className="h-3.5 w-3.5" /> {kindLabels[section.kind]}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-ink-700">
                    {section.awarded}/{section.max}
                  </span>
                </div>
                <ProgressBar
                  className="mt-2"
                  value={section.awarded}
                  max={section.max}
                  tone={ratio >= 0.7 ? 'jade' : ratio >= 0.4 ? 'amber' : 'red'}
                />
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="card p-5">
          <h2 className="text-sm font-semibold text-ink-900">Itemised feedback</h2>
          <p className="mt-0.5 text-xs text-ink-500">
            Every mark is tied to a criterion. Fix the lowest-scoring row first.
          </p>
          <div className="mt-3 space-y-2">
            {score.criteria.map((criterion) => {
              const ratio = criterion.max === 0 ? 0 : criterion.awarded / criterion.max;
              const Icon = kindIcons[criterion.kind];
              return (
                <div
                  key={criterion.id}
                  className={cn(
                    'rounded-xl border p-3',
                    ratio >= 0.99
                      ? 'border-jade-100 bg-jade-50/40'
                      : ratio > 0
                        ? 'border-amber-100 bg-amber-50/40'
                        : 'border-red-100 bg-red-50/30',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5">
                        {ratio >= 0.99 ? (
                          <CheckCircle2 className="h-4 w-4 text-jade-700" />
                        ) : (
                          <XCircle className="h-4 w-4 text-amber-600" />
                        )}
                      </span>
                      <div>
                        <p className="text-[12.5px] font-semibold text-ink-800">{criterion.label}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-ink-500">
                          {criterion.feedback}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="font-mono text-xs font-semibold text-ink-800">
                        {criterion.awarded}/{criterion.max}
                      </span>
                      <span className="ml-1 inline-flex text-ink-300">
                        <Icon className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="space-y-4">
          {attempt.review ? (
            <section className="card border-sky-200 bg-sky-50/40 p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-ink-900">Teacher review</h2>
                <Badge tone="sky">
                  {attempt.review.marks}/{score.max} marks
                </Badge>
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-ink-700">
                {attempt.review.comment || 'No comment was left with the mark.'}
              </p>
              <p className="mt-2 text-[10px] text-ink-400">
                Marked by {attempt.review.reviewerName} on{' '}
                {formatDateTime(attempt.review.reviewedAt)}. This mark replaces the automatic score
                on grades and leaderboards.
              </p>
            </section>
          ) : null}

          <section className="card p-5">
            <h2 className="text-sm font-semibold text-ink-900">Your answers vs expected</h2>
            {experiment.calculations.length === 0 ? (
              <p className="mt-2 text-xs text-ink-500">
                This practical is marked on observations and the identification you selected.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                {experiment.calculations.map((spec) => {
                  const given = parseNumberAnswer(attempt.answers[spec.id] ?? '');
                  const expected = spec.expected(scenario);
                  const ok =
                    given !== null &&
                    Math.abs(given - expected) <= Math.abs(expected) * (spec.tolerancePercent / 100);
                  return (
                    <div key={spec.id} className="rounded-lg border border-ink-100 px-2.5 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] font-medium leading-snug text-ink-700">
                          {spec.label}
                        </p>
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                            ok ? 'bg-jade-100 text-jade-800' : 'bg-red-100 text-red-700',
                          )}
                        >
                          {ok ? 'correct' : 'review'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[10px]">
                        <span className={given === null ? 'text-ink-400' : 'text-ink-700'}>
                          yours: {given === null ? '—' : `${given} ${spec.unit}`}
                        </span>
                        <span className="text-ink-500">
                          expected: {expected.toPrecision(4)} {spec.unit}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {attempt.answers.unknown ? (
              <div className="mt-3 rounded-lg border border-jade-100 bg-jade-50/50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-jade-800">
                  Identification submitted
                </p>
                <p className="text-xs font-semibold text-ink-800">
                  {experiment.choices?.find((choice) => choice.id === attempt.answers.unknown)?.label ??
                    attempt.answers.unknown}
                </p>
              </div>
            ) : null}
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <LineChart className="h-4 w-4 text-ink-400" /> Graph submitted
            </h2>
            {attempt.graph ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
                <div>
                  <dt className="text-ink-400">Points</dt>
                  <dd className="font-mono font-semibold text-ink-800">
                    {attempt.graph.points.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-400">Gradient</dt>
                  <dd className="font-mono font-semibold text-ink-800">
                    {gradient === null ? '—' : gradient.toPrecision(4)}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-ink-400">Axis titles</dt>
                  <dd className="text-ink-700">
                    {attempt.graph.xLabel || '(x unlabelled)'} · {attempt.graph.yLabel || '(y unlabelled)'}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-2 text-xs text-ink-500">No graph was submitted for this attempt.</p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <FileText className="h-4 w-4 text-ink-400" /> Your conclusion
            </h2>
            <p className="mt-2 whitespace-pre-wrap text-[11.5px] leading-relaxed text-ink-600">
              {attempt.notes.trim() || 'No conclusion was written.'}
            </p>
          </section>
        </div>
      </div>

      <section className="card mt-4 p-5">
        <h2 className="text-sm font-semibold text-ink-900">Readings submitted</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-left text-[11px]">
            <thead>
              <tr className="bg-ink-50">
                {experiment.table.columns.map((column) => (
                  <th key={column.id} className="border-b border-ink-100 px-2 py-1.5 font-semibold text-ink-600">
                    {column.label}
                    {column.unit ? <span className="font-normal text-ink-400"> /{column.unit}</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {attempt.rows.map((row, index) => (
                <tr key={index} className="border-b border-ink-50 last:border-0">
                  {experiment.table.columns.map((column) => (
                    <td key={column.id} className="px-2 py-1.5 font-mono text-ink-700">
                      {row[column.id] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mt-4 text-center text-[10px] leading-relaxed text-ink-400">
        Marks were computed by the marking service from attempt seed #{attempt.seed} and rubric
        version {attempt.configVersion}
        {attempt.review ? '; the teacher’s mark is shown as the final result' : ''}. This report is
        a rehearsal tool and is not an official WAEC or NECO result.
      </p>
    </div>
  );
}
