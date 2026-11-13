import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  ClipboardList,
  Download,
  GraduationCap,
  Inbox,
  LineChart,
  Loader2,
  PencilLine,
  Trophy,
  Users,
} from 'lucide-react';
import { EXPERIMENTS, SUBJECT_LABELS } from '@/experiments';
import type { Subject } from '@/experiments/types';
import { useAppStore, attemptPercent, attemptGrade, type StoredAttempt } from '@/stores/app-store';
import { useCurrentUser } from '@/hooks/use-app';
import { studentMetrics } from '@/lib/leaderboard';
import { cn, formatDateTime } from '@/lib/utils';
import {
  Badge,
  EmptyState,
  Modal,
  ProgressBar,
  ScoreRing,
  SectionHeading,
  Tabs,
} from '@/components/ui/primitives';
import { GradePill, PageHeading, StatCard } from '@/components/dashboard/kit';
import { ChallengePanel } from '@/components/lab/ChallengePanel';
import { TeacherTestsPanel } from './TeacherTestsPanel';

export function TeacherDashboard() {
  const user = useCurrentUser();
  const accounts = useAppStore((state) => state.accounts);
  const attempts = useAppStore((state) => state.attempts);
  const reviewAttempt = useAppStore((state) => state.reviewAttempt);
  const clearReview = useAppStore((state) => state.clearReview);
  const [subject, setSubject] = useState<Subject | 'ALL'>('ALL');
  const [view, setView] = useState<'marking' | 'tests'>('marking');
  const assignments = useAppStore((state) => state.assignments);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [marks, setMarks] = useState('');
  const [comment, setComment] = useState('');
  const [markError, setMarkError] = useState<string | null>(null);
  const [savingMark, setSavingMark] = useState(false);

  const classCode = user?.classCode ?? '';
  const classStudents = accounts.filter(
    (account) =>
      account.role === 'STUDENT' &&
      account.classCode === classCode &&
      account.schoolId === user?.schoolId,
  );
  const students = classStudents.filter((account) => account.status === 'ACTIVE');
  // Revoked students keep their marked work visible to the teacher; pending ones
  // have no submissions yet.
  const studentIds = new Set(
    classStudents
      .filter((student) => student.status !== 'PENDING')
      .map((student) => student.id),
  );
  const classAttempts = attempts
    .filter((attempt) => studentIds.has(attempt.studentId) && attempt.status === 'SCORED')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

  const relevant = classAttempts.filter((attempt) => {
    if (subject === 'ALL') return true;
    return (
      EXPERIMENTS.find((item) => item.meta.code === attempt.experimentCode)?.meta.subject ===
      subject
    );
  });

  const average =
    relevant.length === 0
      ? 0
      : Math.round(
          relevant.reduce((sum, attempt) => sum + (attemptPercent(attempt) ?? 0), 0) /
            relevant.length,
        );
  const activeStudentIds = new Set(students.map((student) => student.id));
  const participating = new Set(
    relevant
      .filter((attempt) => activeStudentIds.has(attempt.studentId))
      .map((attempt) => attempt.studentId),
  ).size;
  const queue = classAttempts.filter((attempt) => !attempt.review);
  const marked = classAttempts.filter((attempt) => attempt.review);

  const perExperiment = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const attempt of relevant) {
      const entry = map.get(attempt.experimentCode) ?? { total: 0, count: 0 };
      entry.total += attemptPercent(attempt) ?? 0;
      entry.count += 1;
      map.set(attempt.experimentCode, entry);
    }
    return [...map.entries()]
      .map(([code, value]) => ({
        code,
        average: Math.round(value.total / value.count),
        count: value.count,
        title:
          EXPERIMENTS.find((experiment) => experiment.meta.code === code)?.meta.title ?? code,
      }))
      .sort((a, b) => a.average - b.average);
  }, [relevant]);

  const active = attempts.find((attempt) => attempt.id === markingId);
  const activeStudent = accounts.find((account) => account.id === active?.studentId);
  const activeExperiment = EXPERIMENTS.find(
    (experiment) => experiment.meta.code === active?.experimentCode,
  );
  const activeAssignment = assignments.find(
    (assignment) => assignment.id === active?.assignmentId,
  );

  const openMarking = (attempt: StoredAttempt) => {
    setMarkingId(attempt.id);
    setMarkError(null);
    const max = attempt.score?.max ?? 40;
    setMarks(
      String(
        attempt.review?.marks ??
          Math.round((((attemptPercent(attempt) ?? 0) / 100) * max) * 2) / 2,
      ),
    );
    setComment(attempt.review?.comment ?? '');
  };

  const saveMark = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!active) return;
    setSavingMark(true);
    const result = await reviewAttempt(active.id, Number(marks), comment);
    setSavingMark(false);
    if (result) {
      setMarkError(result);
      return;
    }
    setMarkingId(null);
  };

  const removeMark = async () => {
    if (!active) return;
    setSavingMark(true);
    const result = await clearReview(active.id);
    setSavingMark(false);
    if (result) {
      setMarkError(result);
      return;
    }
    setMarkingId(null);
  };

  const exportCsv = () => {
    const header = [
      'Student',
      'Class',
      'Experiment',
      'Code',
      'Auto percent',
      'Final percent',
      'Grade',
      'Teacher marks',
      'Teacher comment',
      'Submitted',
    ];
    const lines = relevant.map((attempt) => {
      const experiment = EXPERIMENTS.find((item) => item.meta.code === attempt.experimentCode);
      const student = accounts.find((account) => account.id === attempt.studentId);
      return [
        student?.name ?? attempt.studentId,
        student?.classCode ?? '',
        experiment?.meta.title ?? attempt.experimentCode,
        attempt.experimentCode,
        attempt.score?.percent ?? 0,
        attemptPercent(attempt) ?? 0,
        attemptGrade(attempt) ?? '',
        attempt.review?.marks ?? '',
        attempt.review?.comment ?? '',
        attempt.submittedAt ?? '',
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',');
    });
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vlab-${classCode || 'class'}-marked.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!user) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <PageHeading
        eyebrow="Teacher dashboard"
        title={`${classCode} · ${user.school}`}
        subtitle="Mark your students’ practicals, add examiner comments and follow class performance."
        tone="amber"
        actions={
          <>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={exportCsv}
              disabled={relevant.length === 0}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <Link to="/library" className="btn-primary btn-sm">
              <LineChart className="h-3.5 w-3.5" /> Open practicals
            </Link>
          </>
        }
      />

      <div className="mt-4">
        <Tabs
          tabs={[
            { id: 'marking', label: 'Marking & progress' },
            { id: 'tests', label: 'Tests & AI challenges' },
          ]}
          value={view}
          onChange={(id) => setView(id as 'marking' | 'tests')}
        />
      </div>

      {view === 'marking' ? (
        <>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Students" value={String(students.length)} hint="active in this class" icon={Users} />
        <StatCard label="Participating" value={`${participating}/${students.length}`} hint="with submissions" icon={GraduationCap} tone="amber" />
        <StatCard label="Submissions" value={String(relevant.length)} hint={`${queue.length} to mark`} icon={Inbox} tone="sky" />
        <StatCard label="Class average" value={`${average}%`} hint="teacher marks included" icon={ClipboardList} tone="ink" />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: 'ALL', label: 'All subjects' },
            { id: 'PHYSICS', label: 'Physics' },
            { id: 'CHEMISTRY', label: 'Chemistry' },
          ]}
          value={subject}
          onChange={(id) => setSubject(id as Subject | 'ALL')}
        />
        <Link to="/leaderboard" className="inline-flex items-center gap-1 text-xs font-semibold text-jade-800">
          <Trophy className="h-3.5 w-3.5" /> Class leaderboard
        </Link>
      </div>

      {relevant.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="No class submissions yet"
            body="When a student in this class submits a practical, it appears here with an itemised score you can review and adjust."
            action={
              <Link to="/library" className="btn-primary btn-sm">
                Try a practical
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <section className="card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-gradient-to-r from-amber-50/70 to-white px-5 py-3.5">
                <div>
                  <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                    <PencilLine className="h-4 w-4 text-amber-700" /> Marking queue
                  </h2>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    {queue.length === 0
                      ? 'Every submission has your mark.'
                      : `${queue.length} submission${queue.length === 1 ? '' : 's'} without a teacher mark.`}
                  </p>
                </div>
                <Badge tone={queue.length > 0 ? 'amber' : 'jade'}>
                  {queue.length > 0 ? `${queue.length} to mark` : 'Caught up'}
                </Badge>
              </div>
              {queue.length === 0 ? (
                <div className="flex items-center gap-2 px-5 py-4 text-xs text-ink-500">
                  <CheckCircle2 className="h-4 w-4 text-jade-700" />
                  All {marked.length} marked submission{marked.length === 1 ? '' : 's'} are up to date.
                </div>
              ) : (
                <div className="divide-y divide-ink-50">
                  {queue.slice(0, 5).map((attempt) => {
                    const student = accounts.find((account) => account.id === attempt.studentId);
                    const experiment = EXPERIMENTS.find(
                      (item) => item.meta.code === attempt.experimentCode,
                    );
                    const percent = attemptPercent(attempt) ?? 0;
                    return (
                      <div
                        key={attempt.id}
                        className="flex flex-wrap items-center gap-3 px-4 py-2.5"
                      >
                        <ScoreRing percent={percent} size={36} showGrade={false} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-ink-800">
                            {student?.name ?? 'Unknown'}
                          </p>
                          <p className="truncate text-[10px] text-ink-400">
                            {experiment?.meta.title ?? attempt.experimentCode} ·{' '}
                            {attempt.submittedAt ? formatDateTime(attempt.submittedAt) : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => openMarking(attempt)}
                        >
                          <PencilLine className="h-3.5 w-3.5" /> Mark
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="card p-5">
              <SectionHeading
                title="All submissions"
                subtitle="Auto score from the rubric, plus your final mark."
              />
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[620px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-ink-100">
                      <th className="py-2 pr-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Student</th>
                      <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Practical</th>
                      <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Auto</th>
                      <th className="px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">Final</th>
                      <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-ink-400">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {relevant.slice(0, 30).map((attempt) => {
                      const student = accounts.find((account) => account.id === attempt.studentId);
                      const experiment = EXPERIMENTS.find(
                        (item) => item.meta.code === attempt.experimentCode,
                      );
                      const finalPercent = attemptPercent(attempt) ?? 0;
                      return (
                        <tr key={attempt.id} className="border-b border-ink-50 last:border-0">
                          <td className="py-2 pr-2">
                            <p className="text-xs font-semibold text-ink-800">
                              {student?.name ?? 'Unknown'}
                            </p>
                            <p className="text-[10px] text-ink-400">{student?.classCode}</p>
                          </td>
                          <td className="px-2 py-2">
                            <Link
                              to={`/report/${attempt.id}`}
                              className="text-xs font-medium text-ink-700 hover:text-jade-800 hover:underline"
                            >
                              {experiment?.meta.title ?? attempt.experimentCode}
                            </Link>
                            <p className="font-mono text-[9px] text-ink-400">
                              {attempt.experimentCode}
                            </p>
                          </td>
                          <td className="px-2 py-2 font-mono text-[11px] text-ink-500">
                            {Math.round(attempt.score?.percent ?? 0)}%
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1.5">
                              <ProgressBar
                                className="w-12"
                                value={finalPercent}
                                tone={finalPercent >= 70 ? 'jade' : finalPercent >= 50 ? 'amber' : 'red'}
                              />
                              <span className="font-mono text-[11px] font-semibold text-ink-700">
                                {Math.round(finalPercent)}%
                              </span>
                              <GradePill grade={attemptGrade(attempt) ?? '—'} />
                              {attempt.review ? (
                                <span className="ml-1 hidden text-[9px] font-semibold text-sky-700 sm:inline">
                                  marked
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <button
                              type="button"
                              className={cn('btn-sm', attempt.review ? 'btn-ghost' : 'btn-secondary')}
                              onClick={() => openMarking(attempt)}
                            >
                              {attempt.review ? 'Edit mark' : 'Mark'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[10px] text-ink-400">
                Showing {Math.min(30, relevant.length)} of {relevant.length} submissions.
              </p>
            </section>
          </div>

          <div className="space-y-4">
            <section className="card p-5">
              <SectionHeading title="Weakest practicals" subtitle="Average class score per module." />
              <div className="mt-3 space-y-2.5">
                {perExperiment.slice(0, 6).map((entry) => (
                  <div key={entry.code}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[11.5px] font-medium text-ink-700">{entry.title}</p>
                      <span className="shrink-0 font-mono text-[10px] font-semibold text-ink-600">
                        {entry.average}%
                      </span>
                    </div>
                    <ProgressBar
                      className="mt-1"
                      value={entry.average}
                      tone={entry.average >= 70 ? 'jade' : entry.average >= 50 ? 'amber' : 'red'}
                    />
                    <p className="mt-0.5 text-[9.5px] text-ink-400">
                      {entry.count} submission{entry.count === 1 ? '' : 's'}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="card p-5">
              <SectionHeading title="Students" subtitle="Participation and final average." />
              <div className="mt-3 space-y-1.5">
                {students.length === 0 ? (
                  <p className="text-xs text-ink-500">No active students in this class code yet.</p>
                ) : (
                  students.map((student) => {
                    const metrics = studentMetrics(attempts, student.id);
                    return (
                      <div
                        key={student.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-ink-50 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-ink-800">
                            {student.name}
                          </p>
                          <p className="text-[9.5px] text-ink-400">
                            {metrics.submissions} submission{metrics.submissions === 1 ? '' : 's'}
                            {metrics.reviewed > 0 ? ` · ${metrics.reviewed} marked` : ''}
                          </p>
                        </div>
                        {metrics.submissions > 0 ? (
                          <div className="flex items-center gap-2">
                            <GradePill grade={metrics.grade} />
                            <ScoreRing percent={metrics.average} size={34} showGrade={false} />
                          </div>
                        ) : (
                          <Badge tone="neutral">No runs</Badge>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </section>

            <p className="px-1 text-[10px] leading-relaxed text-ink-400">
              {SUBJECT_LABELS.PHYSICS} and {SUBJECT_LABELS.CHEMISTRY} practicals align with WAEC and
              NECO conventions. Teacher marks replace the automatic rubric score everywhere —
              reports, grades and leaderboards.
            </p>
          </div>
        </div>
      )}
        </>
      ) : (
        <TeacherTestsPanel />
      )}

      <Modal
        open={Boolean(active)}
        onClose={() => setMarkingId(null)}
        title="Mark this practical"
        description={
          activeStudent && activeExperiment
            ? `${activeStudent.name} · ${activeExperiment.meta.title}`
            : undefined
        }
        size="md"
        footer={
          active ? (
            <>
              {active.review ? (
                <button
                  type="button"
                  className="btn-danger mr-auto"
                  disabled={savingMark}
                  onClick={() => void removeMark()}
                >
                  Remove teacher mark
                </button>
              ) : null}
              <button type="button" className="btn-secondary" onClick={() => setMarkingId(null)}>
                Cancel
              </button>
              <button type="submit" form="mark-form" className="btn-primary" disabled={savingMark}>
                {savingMark ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {savingMark ? 'Saving…' : 'Save mark'}
              </button>
            </>
          ) : null
        }
      >
        {active ? (
          <form id="mark-form" className="space-y-4" onSubmit={saveMark}>
            <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  Automatic rubric score
                </span>
                <span className="font-mono text-sm font-semibold text-ink-800">
                  {active.score?.total ?? 0}/{active.score?.max ?? 0} ·{' '}
                  {Math.round(active.score?.percent ?? 0)}%
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-500">
                The rubric marked readings, graph, calculations and conclusion. Award your own total
                below — it becomes the mark on the report and leaderboard.
              </p>
            </div>

            {activeAssignment && activeAssignment.questions.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                <ChallengePanel
                  questions={activeAssignment.questions}
                  answers={active.challenge}
                  readOnly
                  showGuides
                />
                {activeAssignment.markingGuide ? (
                  <p className="mt-2 rounded-lg border border-amber-200 bg-white/80 px-2.5 py-2 text-[11px] leading-relaxed text-amber-900">
                    <span className="font-semibold">General marking guide: </span>
                    {activeAssignment.markingGuide}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className="label" htmlFor="teacher-marks">
                Teacher marks (out of {active.score?.max ?? 0})
              </label>
              <input
                id="teacher-marks"
                type="number"
                min={0}
                max={active.score?.max ?? 0}
                step={0.5}
                className="input font-mono"
                value={marks}
                onChange={(event) => setMarks(event.target.value)}
                required
              />
              <p className="field-hint">
                {Number.isFinite(Number(marks)) && active.score
                  ? `${Math.round((Number(marks) / Math.max(1, active.score.max)) * 1000) / 10}% after your mark`
                  : 'Enter a mark to see the percentage.'}
              </p>
            </div>

            <div>
              <label className="label" htmlFor="teacher-comment">
                Examiner comment
              </label>
              <textarea
                id="teacher-comment"
                className="input min-h-[110px] resize-y"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="e.g. Accurate burette readings, but state the precaution against parallax."
              />
              <p className="field-hint">Visible to the student and on the printable report.</p>
            </div>

            {active.review ? (
              <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] text-sky-900">
                Last marked by {active.review.reviewerName} on{' '}
                {formatDateTime(active.review.reviewedAt)}: {active.review.marks}/
                {active.score?.max ?? 0}.
              </p>
            ) : null}

            {markError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {markError}
              </p>
            ) : null}
          </form>
        ) : null}
      </Modal>
    </div>
  );
}
