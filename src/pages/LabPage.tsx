import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Calculator,
  Check,
  ChevronRight,
  Clock,
  FlaskConical,
  HelpCircle,
  LineChart,
  Loader2,
  NotebookPen,
  Play,
  RotateCcw,
  Send,
  Sparkles,
  Table2,
  Timer,
  Trophy,
} from 'lucide-react';
import { getExperiment } from '@/experiments';
import { PRIORITY_LABELS, SUBJECT_LABELS } from '@/experiments';
import type { GraphAnswer } from '@sim/scoring/types';
import { drawnLineGradient } from '@sim/math';
import { mergeGraph, useAppStore, type StoredAttempt } from '@/stores/app-store';
import { useCurrentUser, useOnlineStatus } from '@/hooks/use-app';
import { Badge, Modal, ScoreRing, Tabs } from '@/components/ui/primitives';
import { DataTable } from '@/components/lab/DataTable';
import { GraphTool } from '@/components/lab/GraphTool';
import { CalculationSheet } from '@/components/lab/CalculationSheet';
import { NotesPanel } from '@/components/lab/NotesPanel';
import { ProcedurePanel } from '@/components/lab/ProcedurePanel';
import { SubmitDialog } from '@/components/lab/SubmitDialog';
import { SceneRenderer } from '@/components/scenes/SceneRenderer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { cn, formatDate } from '@/lib/utils';

function useElapsed(startedAt: string | undefined): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);
  if (!startedAt) return '00:00';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins >= 60) {
    return `${Math.floor(mins / 60)}:${String(mins % 60).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function LabPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const online = useOnlineStatus();
  const experiment = slug ? getExperiment(slug) : undefined;

  const attempts = useAppStore((state) => state.attempts);
  const startAttempt = useAppStore((state) => state.startAttempt);
  const updateAttempt = useAppStore((state) => state.updateAttempt);
  const addRow = useAppStore((state) => state.addRow);
  const removeRow = useAppStore((state) => state.removeRow);
  const submitAttempt = useAppStore((state) => state.submitAttempt);
  const discardAttempt = useAppStore((state) => state.discardAttempt);

  const [tab, setTab] = useState('data');
  const [guideOpen, setGuideOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stepsDone, setStepsDone] = useState<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const studentAttempts = attempts.filter((attempt) => attempt.studentId === user?.id);
  const draft = studentAttempts.find(
    (attempt) => attempt.status === 'IN_PROGRESS' && attempt.experimentCode === experiment?.meta.code,
  );
  const scored = studentAttempts
    .filter((attempt) => attempt.status === 'SCORED' && attempt.experimentCode === experiment?.meta.code)
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  const best = scored.reduce<StoredAttempt | null>(
    (value, attempt) =>
      !value || (attempt.score?.percent ?? 0) > (value.score?.percent ?? 0) ? attempt : value,
    null,
  );

  const elapsed = useElapsed(draft?.startedAt);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const scenario = useMemo(
    () => (experiment && draft ? experiment.generate(draft.seed) : null),
    [experiment, draft?.seed],
  );

  const handleStart = useCallback(() => {
    if (!experiment) return;
    const existing = studentAttempts.find(
      (attempt) => attempt.status === 'IN_PROGRESS' && attempt.experimentCode === experiment.meta.code,
    );
    if (existing) return;
    const id = startAttempt(experiment.meta.code);
    if (id) setStepsDone(new Set());
  }, [experiment, startAttempt, studentAttempts]);

  const onGraphChange = useCallback(
    (patch: Partial<GraphAnswer>) => {
      if (!draft) return;
      updateAttempt(draft.id, { graph: mergeGraph(draft.graph, patch) });
    },
    [draft, updateAttempt],
  );

  const onUseGradient = useCallback(
    (gradient: number) => {
      if (!experiment || !draft) return;
      const target = experiment.calculations.find((spec) => spec.fromGradient);
      if (!target) return;
      updateAttempt(draft.id, {
        answers: { ...draft.answers, [target.id]: String(Number(gradient.toPrecision(5))) },
      });
      setToast(`Gradient copied into “${target.label}”.`);
    },
    [draft, experiment, updateAttempt],
  );

  const handleSubmit = async () => {
    if (!draft) return;
    setSubmitting(true);
    const score = await submitAttempt(draft.id);
    setSubmitting(false);
    setSubmitOpen(false);
    if (score) navigate(`/report/${draft.id}`);
  };

  if (!experiment) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <h1 className="text-xl font-semibold text-ink-900">Practical not found</h1>
        <p className="mt-2 text-sm text-ink-500">
          The module you followed may have been renamed. Return to the library to pick another.
        </p>
        <Link to="/library" className="btn-primary mt-5">
          Back to library
        </Link>
      </div>
    );
  }

  if (!draft) {
    return (
      <Briefing
        experiment={experiment}
        best={best}
        onStart={handleStart}
        onReport={() => best && navigate(`/report/${best.id}`)}
      />
    );
  }

  if (!scenario) return null;

  const recordReading = (row: Record<string, string>) => {
    const keyColumn = experiment.table.keyColumn;
    if (keyColumn && row[keyColumn]) {
      const index = draft.rows.findIndex(
        (existing) => (existing[keyColumn] ?? '').trim() === (row[keyColumn] ?? '').trim(),
      );
      if (index >= 0) {
        const next = draft.rows.map((existing, i) =>
          i === index ? { ...existing, ...row } : existing,
        );
        updateAttempt(draft.id, { rows: next });
        setToast('Reading updated in the table.');
        return;
      }
    }
    updateAttempt(draft.id, { rows: [...draft.rows, row] });
    setToast('Reading recorded in the table.');
  };

  const gradient = draft.graph?.line ? drawnLineGradient(draft.graph.line) : null;

  const tabItems = [
    { id: 'data', label: 'Data', icon: <Table2 className="h-3.5 w-3.5" />, badge: draft.rows.length },
    ...(experiment.graph
      ? [{ id: 'graph', label: 'Graph', icon: <LineChart className="h-3.5 w-3.5" /> }]
      : []),
    ...(experiment.calculations.length > 0
      ? [
          {
            id: 'calc',
            label: 'Calculations',
            icon: <Calculator className="h-3.5 w-3.5" />,
            badge: Object.values(draft.answers).filter((answer) => answer.trim() !== '').length,
          },
        ]
      : []),
    { id: 'notes', label: 'Conclusion', icon: <NotebookPen className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <header className="sticky top-14 z-20 border-b border-ink-100 bg-paper/90 backdrop-blur-md sm:top-16">
        <div className="mx-auto max-w-[1500px] px-3 py-2.5 sm:px-5">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/library"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900"
              aria-label="Back to library"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  {experiment.meta.code}
                </span>
                <Badge tone={experiment.meta.subject === 'PHYSICS' ? 'jade' : 'amber'}>
                  {SUBJECT_LABELS[experiment.meta.subject]}
                </Badge>
                <span className="hidden sm:inline-flex">
                  <Badge tone="neutral">{PRIORITY_LABELS[experiment.meta.priority]}</Badge>
                </span>
              </div>
              <h1 className="truncate text-sm font-semibold text-ink-900 sm:text-base">
                {experiment.meta.title}
              </h1>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2 py-1.5 font-mono text-[11px] font-semibold text-ink-600">
                <Timer className="h-3.5 w-3.5 text-ink-400" />
                {elapsed}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-jade-200 bg-jade-50 px-2 py-1.5 text-[11px] font-semibold text-jade-800">
                <Check className="h-3.5 w-3.5" /> Saved
              </span>
            </div>

            <button
              type="button"
              className="btn-secondary btn-sm xl:hidden"
              onClick={() => setGuideOpen(true)}
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Guide</span>
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={() => setSubmitOpen(true)}>
              <Send className="h-3.5 w-3.5" />
              Submit
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-3 py-3 sm:px-5 sm:py-4">
        <div className="grid gap-4 xl:grid-cols-[248px_minmax(0,1fr)_410px]">
          <aside className="hidden xl:block">
            <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto pr-1 thin-scrollbar">
              <ProcedurePanel
                experiment={experiment}
                stepsDone={stepsDone}
                onStepToggle={(index, done) =>
                  setStepsDone((prev) => {
                    const next = new Set(prev);
                    if (done) next.add(index);
                    else next.delete(index);
                    return next;
                  })
                }
              />
            </div>
          </aside>

          <section className="min-w-0">
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-ink-100 bg-white/80 px-3 py-2 sm:px-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink-900 text-white">
                    <FlaskConical className="h-3.5 w-3.5" />
                  </span>
                  <p className="text-xs font-semibold text-ink-700">Practical apparatus</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="hidden font-mono text-[10px] text-ink-400 sm:inline">
                    attempt seed #{draft.seed.toString(36).toUpperCase()}
                  </span>
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    title="Discard this attempt"
                    onClick={() => {
                      if (window.confirm('Discard this attempt and start again?')) {
                        discardAttempt(draft.id);
                        setStepsDone(new Set());
                      }
                    }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="bench p-2 sm:p-3">
                <ErrorBoundary key={draft.id} title={`${experiment.meta.code} apparatus stopped`}>
                  <SceneRenderer
                    experiment={experiment}
                    attempt={draft}
                    scenario={scenario}
                    onUpdate={(patch) => updateAttempt(draft.id, patch)}
                    onRecord={recordReading}
                    onFlag={(flag, value = true) =>
                      updateAttempt(draft.id, { flags: { ...draft.flags, [flag]: value } })
                    }
                  />
                </ErrorBoundary>
              </div>
            </div>

            <div className="mt-3 xl:hidden">
              <Tabs tabs={tabItems} value={tab} onChange={setTab} variant="underline" />
              <div className="card mt-2 p-4">
                {tab === 'data' ? (
                  <DataTable
                    experiment={experiment}
                    rows={draft.rows}
                    onChangeRow={(index, columnId, value) =>
                      updateAttempt(draft.id, {
                        rows: draft.rows.map((row, i) =>
                          i === index ? { ...row, [columnId]: value } : row,
                        ),
                      })
                    }
                    onAddRow={() => addRow(draft.id)}
                    onRemoveRow={(index) => removeRow(draft.id, index)}
                  />
                ) : tab === 'graph' ? (
                  <GraphTool
                    experiment={experiment}
                    rows={draft.rows}
                    graph={draft.graph}
                    onChange={onGraphChange}
                    onUseGradient={onUseGradient}
                  />
                ) : tab === 'calc' ? (
                  <CalculationSheet
                    experiment={experiment}
                    answers={draft.answers}
                    gradient={gradient}
                    onChange={(id, value) =>
                      updateAttempt(draft.id, { answers: { ...draft.answers, [id]: value } })
                    }
                  />
                ) : (
                  <NotesPanel
                    notes={draft.notes}
                    onChange={(value) => updateAttempt(draft.id, { notes: value })}
                    prompts={[
                      'Name the quantity you determined and its value.',
                      'Compare with the accepted value (percentage difference).',
                      'Give one source of error and how it affected your result.',
                    ]}
                  />
                )}
              </div>
            </div>
          </section>

          <aside className="hidden xl:block">
            <div className="sticky top-32 max-h-[calc(100vh-9rem)] overflow-y-auto rounded-2xl border border-ink-100 bg-white p-4 shadow-card thin-scrollbar">
              <Tabs tabs={tabItems} value={tab} onChange={setTab} />
              <div className="mt-4">
                {tab === 'data' ? (
                  <DataTable
                    experiment={experiment}
                    rows={draft.rows}
                    onChangeRow={(index, columnId, value) =>
                      updateAttempt(draft.id, {
                        rows: draft.rows.map((row, i) =>
                          i === index ? { ...row, [columnId]: value } : row,
                        ),
                      })
                    }
                    onAddRow={() => addRow(draft.id)}
                    onRemoveRow={(index) => removeRow(draft.id, index)}
                  />
                ) : tab === 'graph' ? (
                  <GraphTool
                    experiment={experiment}
                    rows={draft.rows}
                    graph={draft.graph}
                    onChange={onGraphChange}
                    onUseGradient={onUseGradient}
                  />
                ) : tab === 'calc' ? (
                  <CalculationSheet
                    experiment={experiment}
                    answers={draft.answers}
                    gradient={gradient}
                    onChange={(id, value) =>
                      updateAttempt(draft.id, { answers: { ...draft.answers, [id]: value } })
                    }
                  />
                ) : (
                  <NotesPanel
                    notes={draft.notes}
                    onChange={(value) => updateAttempt(draft.id, { notes: value })}
                    prompts={[
                      'Name the quantity you determined and its value.',
                      'Compare with the accepted value (percentage difference).',
                      'Give one source of error and how it affected your result.',
                    ]}
                  />
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Modal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="Procedure & theory"
        size="lg"
      >
        <ProcedurePanel
          experiment={experiment}
          stepsDone={stepsDone}
          onStepToggle={(index, done) =>
            setStepsDone((prev) => {
              const next = new Set(prev);
              if (done) next.add(index);
              else next.delete(index);
              return next;
            })
          }
        />
      </Modal>

      <SubmitDialog
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        onSubmit={handleSubmit}
        experiment={experiment}
        attempt={draft}
        busy={submitting}
        online={online}
      />

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink-900 px-4 py-2 text-xs font-medium text-white shadow-float lg:bottom-6">
          {toast}
        </div>
      ) : null}

      {submitting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/40 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-float">
            <Loader2 className="h-6 w-6 animate-spin text-jade-700" />
            <p className="text-sm font-semibold text-ink-900">Marking your practical…</p>
            <p className="text-[11px] text-ink-500">Regenerating the scenario from your seed</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Briefing({
  experiment,
  best,
  onStart,
  onReport,
}: {
  experiment: ReturnType<typeof getExperiment> & object;
  best: StoredAttempt | null;
  onStart: () => void;
  onReport: () => void;
}) {
  const isPhysics = experiment.meta.subject === 'PHYSICS';
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <Link
        to="/library"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 transition-colors hover:text-ink-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to library
      </Link>

      <div className="mt-4 overflow-hidden rounded-3xl border border-ink-100 bg-white shadow-card">
        <div className={cn('relative px-5 py-6 sm:px-8 sm:py-8', isPhysics ? 'bench' : 'bg-amber-50/50')}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={isPhysics ? 'jade' : 'amber'}>{SUBJECT_LABELS[experiment.meta.subject]}</Badge>
            <Badge tone="ink">{experiment.meta.code}</Badge>
            <Badge
              tone={
                experiment.meta.priority === 'P0'
                  ? 'jade'
                  : experiment.meta.priority === 'P1'
                    ? 'amber'
                    : 'neutral'
              }
            >
              {PRIORITY_LABELS[experiment.meta.priority]}
            </Badge>
            <span className="text-[11px] font-medium text-ink-500">
              {experiment.meta.examBodies.join(' · ')} aligned
            </span>
          </div>
          <h1 className="mt-3 max-w-2xl text-balance text-2xl font-semibold tracking-tight text-ink-900 sm:text-3xl">
            {experiment.meta.title}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-600">
            {experiment.meta.summary}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" onClick={onStart}>
              <Play className="h-4 w-4" /> Start practical
            </button>
            {best?.score ? (
              <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white/80 px-3 py-1.5">
                <ScoreRing percent={best.score.percent} size={38} showGrade={false} />
                <div className="leading-tight">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
                    Previous best
                  </p>
                  <p className="text-xs font-semibold text-ink-800">
                    {Math.round(best.score.percent)}% · {best.score.grade}
                  </p>
                </div>
                <button type="button" className="btn-ghost btn-sm" onClick={onReport}>
                  Report <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
              <Clock className="h-3.5 w-3.5" /> about {experiment.meta.durationMin} minutes
            </span>
          </div>
        </div>

        <div className="grid gap-0 border-t border-ink-100 md:grid-cols-2">
          <div className="border-b border-ink-100 p-5 md:border-b-0 md:border-r sm:p-6">
            <h2 className="section-title">Your objective</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-700">{experiment.meta.objective}</p>

            <h2 className="section-title mt-5">Skills you will practise</h2>
            <ul className="mt-2 grid gap-1.5">
              {experiment.meta.skills.map((skill) => (
                <li key={skill} className="flex items-start gap-2 text-[13px] text-ink-600">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-jade-700" />
                  {skill}
                </li>
              ))}
            </ul>

            <h2 className="section-title mt-5">Apparatus</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {experiment.meta.apparatus.map((item) => (
                <span key={item} className="chip">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <h2 className="section-title">What gets marked</h2>
            <ul className="mt-2 space-y-2">
              <li className="flex items-start gap-2 rounded-lg bg-ink-50/60 px-2.5 py-2">
                <Table2 className="mt-0.5 h-3.5 w-3.5 text-ink-400" />
                <div>
                  <p className="text-xs font-semibold text-ink-800">Readings</p>
                  <p className="text-[11px] text-ink-500">
                    Accuracy, units and examination decimal places
                  </p>
                </div>
              </li>
              {experiment.graph ? (
                <li className="flex items-start gap-2 rounded-lg bg-ink-50/60 px-2.5 py-2">
                  <LineChart className="mt-0.5 h-3.5 w-3.5 text-ink-400" />
                  <div>
                    <p className="text-xs font-semibold text-ink-800">Graph</p>
                    <p className="text-[11px] text-ink-500">
                      Points, labelled axes, scale and fitted gradient
                    </p>
                  </div>
                </li>
              ) : null}
              {experiment.calculations.length > 0 ? (
                <li className="flex items-start gap-2 rounded-lg bg-ink-50/60 px-2.5 py-2">
                  <Calculator className="mt-0.5 h-3.5 w-3.5 text-ink-400" />
                  <div>
                    <p className="text-xs font-semibold text-ink-800">
                      {experiment.calculations.length} calculation
                      {experiment.calculations.length === 1 ? '' : 's'}
                    </p>
                    <p className="text-[11px] text-ink-500">
                      {experiment.calculations.reduce((sum, spec) => sum + spec.max, 0)} marks for
                      numerical answers
                    </p>
                  </div>
                </li>
              ) : null}
              <li className="flex items-start gap-2 rounded-lg bg-ink-50/60 px-2.5 py-2">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 text-ink-400" />
                <div>
                  <p className="text-xs font-semibold text-ink-800">Conclusion</p>
                  <p className="text-[11px] text-ink-500">
                    A clear, evidence-based statement of what you found
                  </p>
                </div>
              </li>
            </ul>

            <div className="mt-4 rounded-xl border border-ink-100 p-3">
              <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">
                <BookOpen className="h-3.5 w-3.5" /> Curriculum link
              </h3>
              <p className="mt-1 text-[11.5px] leading-relaxed text-ink-600">
                {experiment.meta.curriculum}
              </p>
            </div>

            {experiment.meta.priority === 'P0' ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />
                <p className="text-[11px] leading-relaxed text-amber-900">
                  Exam-critical practical. Expect a question on this in the WAEC or NECO practical
                  paper.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {experiment.theory.slice(0, 2).map((block) => (
          <div key={block.heading} className="card p-4">
            <h3 className="text-sm font-semibold text-ink-800">{block.heading}</h3>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-500">{block.body}</p>
            {block.formula ? (
              <p className="mt-2 rounded-lg bg-ink-900 px-2.5 py-2 font-mono text-[11px] text-jade-200">
                {block.formula}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      <p className="mt-5 text-center text-[11px] text-ink-400">
        Values are generated from an attempt seed, so every student gets a different unknown. ·
        Last prepared {formatDate(new Date().toISOString())}
      </p>
    </div>
  );
}
