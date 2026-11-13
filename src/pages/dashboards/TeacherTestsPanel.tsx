import { useState } from 'react';
import {
  Bot,
  CalendarClock,
  ClipboardCheck,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import { EXPERIMENTS, SUBJECT_LABELS } from '@/experiments';
import type { Subject } from '@/experiments/types';
import { useAppStore, type AssignmentQuestion, type CreateAssignmentInput } from '@/stores/app-store';
import { useCurrentUser } from '@/hooks/use-app';
import { errorMessage, generateChallenge, type AiChallenge } from '@/services/api';
import { Badge, EmptyState, SectionHeading } from '@/components/ui/primitives';
import { ParameterPanel } from '@/components/lab/ParameterPanel';
import { ChallengePanel } from '@/components/lab/ChallengePanel';
import { formatDateTime } from '@/lib/utils';

const PREVIEW_SEED = 20260101;
const AI_DIFFICULTIES = ['foundation', 'standard', 'extension'] as const;
type Difficulty = (typeof AI_DIFFICULTIES)[number];

function isoOrNull(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function TeacherTestsPanel() {
  const user = useCurrentUser();
  const accounts = useAppStore((state) => state.accounts);
  const attempts = useAppStore((state) => state.attempts);
  const assignments = useAppStore((state) => state.assignments);
  const createAssignment = useAppStore((state) => state.createAssignment);
  const deleteAssignment = useAppStore((state) => state.deleteAssignment);

  const [title, setTitle] = useState('');
  const [experimentCode, setExperimentCode] = useState(EXPERIMENTS[0]?.meta.code ?? 'PHY-01');
  const [due, setDue] = useState('');
  const [instructions, setInstructions] = useState('');
  const [params, setParams] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [aiSubject, setAiSubject] = useState<Subject>('PHYSICS');
  const [aiCode, setAiCode] = useState('PHY-01');
  const [aiGrade, setAiGrade] = useState('SS2');
  const [aiDifficulty, setAiDifficulty] = useState<Difficulty>('standard');
  const [aiFocus, setAiFocus] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiChallenge, setAiChallenge] = useState<(AiChallenge & { model: string }) | null>(null);

  if (!user) return null;
  const classCode = user.classCode;
  const experiment = EXPERIMENTS.find((entry) => entry.meta.code === experimentCode) ?? EXPERIMENTS[0];
  const aiExperiment = EXPERIMENTS.find((entry) => entry.meta.code === aiCode) ?? EXPERIMENTS[0];
  const students = accounts.filter(
    (account) =>
      account.role === 'STUDENT' &&
      account.classCode === classCode &&
      account.schoolId === user.schoolId &&
      account.status === 'ACTIVE',
  );

  const publish = async (input: CreateAssignmentInput, successNotice: string) => {
    setSaving(true);
    setError(null);
    setNotice(null);
    const result = await createAssignment(input);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return false;
    }
    setNotice(successNotice);
    return true;
  };

  const submitManual = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError('Give the test a title so students know what to open.');
      return;
    }
    const ok = await publish(
      {
        title: title.trim(),
        experimentCode,
        instructions: instructions.trim(),
        dueAt: isoOrNull(due),
        params,
        source: 'TEACHER',
      },
      `“${title.trim()}” published to ${classCode}.`,
    );
    if (ok) {
      setTitle('');
      setInstructions('');
      setDue('');
      setParams({});
    }
  };

  const generate = async () => {
    setAiBusy(true);
    setAiError(null);
    setAiChallenge(null);
    try {
      const result = await generateChallenge({
        subject: aiSubject,
        gradeLevel: aiGrade,
        difficulty: aiDifficulty,
        experimentCode: aiExperiment?.meta.code,
        experimentTitle: aiExperiment?.meta.title,
        curriculum: aiExperiment?.meta.curriculum,
        skills: aiExperiment?.meta.skills,
        count: 4,
        focus: aiFocus.trim(),
      });
      setAiChallenge({ ...result.challenge, model: result.model });
    } catch (caught) {
      setAiError(errorMessage(caught));
    } finally {
      setAiBusy(false);
    }
  };

  const publishAi = async () => {
    if (!aiChallenge || !aiExperiment) return;
    const questions: AssignmentQuestion[] = aiChallenge.questions.map((question, index) => ({
      id: `q${index + 1}`,
      prompt: question.prompt,
      marks: question.marks,
      markingGuide: question.markingGuide,
    }));
    const ok = await publish(
      {
        title: aiChallenge.title,
        experimentCode: aiExperiment.meta.code,
        instructions: aiChallenge.instructions,
        dueAt: isoOrNull(due),
        params,
        questions,
        markingGuide: aiChallenge.markingGuide,
        source: 'AI',
      },
      `AI challenge “${aiChallenge.title}” published to ${classCode}.`,
    );
    if (ok) {
      setAiChallenge(null);
      setTitle('');
      setInstructions('');
      setDue('');
      setParams({});
    }
  };

  const remove = async (assignmentId: string, assignmentTitle: string) => {
    if (!window.confirm(`Remove “${assignmentTitle}” from ${classCode}?`)) return;
    const message = await deleteAssignment(assignmentId);
    if (message) setError(message);
  };

  return (
    <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-gradient-to-r from-amber-50/70 to-white px-5 py-3.5">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                <ClipboardCheck className="h-4 w-4 text-amber-700" /> Set a manual test
              </h2>
              <p className="mt-0.5 text-[11px] text-ink-500">
                Publish a practical to {classCode}. You can fix bench parameters and add written
                questions; students submit through the lab.
              </p>
            </div>
            <Badge tone="amber">{classCode}</Badge>
          </div>

          <form className="space-y-3 p-5" onSubmit={submitManual}>
            <div>
              <label className="label" htmlFor="test-title">
                Test title
              </label>
              <input
                id="test-title"
                className="input"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="e.g. WAEC practice: pendulum and g"
                maxLength={160}
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="test-experiment">
                  Practical
                </label>
                <select
                  id="test-experiment"
                  className="input"
                  value={experimentCode}
                  onChange={(event) => {
                    setExperimentCode(event.target.value);
                    setParams({});
                  }}
                >
                  {EXPERIMENTS.map((entry) => (
                    <option key={entry.meta.code} value={entry.meta.code}>
                      {entry.meta.code} · {entry.meta.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="test-due">
                  Due date (optional)
                </label>
                <input
                  id="test-due"
                  type="datetime-local"
                  className="input"
                  value={due}
                  onChange={(event) => setDue(event.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="test-instructions">
                Instructions to students
              </label>
              <textarea
                id="test-instructions"
                className="input min-h-[88px] resize-y"
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="State what to measure, how to present the report and any precautions you expect."
                maxLength={2000}
              />
            </div>

            {experiment ? (
              <ParameterPanel
                experiment={experiment}
                seed={PREVIEW_SEED}
                params={params}
                onChange={setParams}
              />
            ) : null}
            <p className="text-[10px] leading-relaxed text-ink-400">
              Parameters left untouched keep the student’s seeded value, so each student still gets
              a different unknown. A parameter you override is fixed for the whole class.
            </p>

            <button type="submit" className="btn-primary btn-sm" disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              {saving ? 'Publishing…' : 'Publish test'}
            </button>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="rounded-lg border border-jade-200 bg-jade-50 px-3 py-2 text-[11px] font-medium text-jade-800">
                {notice}
              </p>
            ) : null}
          </form>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-gradient-to-r from-jade-50/70 to-white px-5 py-3.5">
            <div>
              <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-900">
                <Sparkles className="h-4 w-4 text-jade-700" /> Generate with Gemini
              </h2>
              <p className="mt-0.5 text-[11px] text-ink-500">
                New WAEC-style challenge from the curriculum, grounded in a practical students can
                actually run here.
              </p>
            </div>
            <Badge tone="jade">
              <Bot className="h-3 w-3" /> AI
            </Badge>
          </div>

          <div className="space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="ai-subject">
                  Subject
                </label>
                <select
                  id="ai-subject"
                  className="input"
                  value={aiSubject}
                  onChange={(event) => {
                    const subject = event.target.value as Subject;
                    setAiSubject(subject);
                    const first = EXPERIMENTS.find((entry) => entry.meta.subject === subject);
                    if (first) setAiCode(first.meta.code);
                  }}
                >
                  {(['PHYSICS', 'CHEMISTRY'] as const).map((subject) => (
                    <option key={subject} value={subject}>
                      {SUBJECT_LABELS[subject]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ai-grade">
                  Class
                </label>
                <select
                  id="ai-grade"
                  className="input"
                  value={aiGrade}
                  onChange={(event) => setAiGrade(event.target.value)}
                >
                  {['SS1', 'SS2', 'SS3'].map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ai-difficulty">
                  Challenge level
                </label>
                <select
                  id="ai-difficulty"
                  className="input"
                  value={aiDifficulty}
                  onChange={(event) => setAiDifficulty(event.target.value as Difficulty)}
                >
                  {AI_DIFFICULTIES.map((level) => (
                    <option key={level} value={level}>
                      {level[0]?.toUpperCase()}
                      {level.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="ai-experiment">
                Practical to build on
              </label>
              <select
                id="ai-experiment"
                className="input"
                value={aiCode}
                onChange={(event) => setAiCode(event.target.value)}
              >
                {EXPERIMENTS.filter((entry) => entry.meta.subject === aiSubject).map((entry) => (
                  <option key={entry.meta.code} value={entry.meta.code}>
                    {entry.meta.code} · {entry.meta.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="ai-focus">
                Teacher focus (optional)
              </label>
              <input
                id="ai-focus"
                className="input"
                value={aiFocus}
                onChange={(event) => setAiFocus(event.target.value)}
                placeholder="e.g. focus on sources of error and significant figures"
                maxLength={300}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="btn-primary btn-sm" onClick={() => void generate()} disabled={aiBusy}>
                {aiBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                {aiBusy ? 'Writing challenge…' : 'Generate challenge'}
              </button>
              <span className="text-[10px] text-ink-400">
                Uses the WAEC practical syllabus and this simulation’s apparatus.
              </span>
            </div>

            {aiError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
                {aiError}
              </p>
            ) : null}

            {aiChallenge ? (
              <div className="space-y-3 rounded-xl border border-jade-200 bg-jade-50/40 p-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="jade">AI draft</Badge>
                    <span className="font-mono text-[9.5px] text-ink-400">{aiChallenge.model}</span>
                  </div>
                  <h3 className="mt-1.5 text-sm font-semibold text-ink-900">{aiChallenge.title}</h3>
                  <p className="mt-0.5 text-[10.5px] font-medium text-jade-800">
                    {aiChallenge.waecReference}
                  </p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-ink-600">
                    {aiChallenge.objective}
                  </p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-700">
                    {aiChallenge.instructions}
                  </p>
                </div>

                <ChallengePanel
                  questions={aiChallenge.questions.map((question, index) => ({
                    id: `q${index + 1}`,
                    prompt: question.prompt,
                    marks: question.marks,
                    markingGuide: question.markingGuide,
                  }))}
                  showGuides
                />

                {aiChallenge.markingGuide ? (
                  <p className="rounded-lg border border-jade-200 bg-white/80 px-2.5 py-2 text-[11px] leading-relaxed text-jade-900">
                    <span className="font-semibold">General marking guide: </span>
                    {aiChallenge.markingGuide}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="btn-primary btn-sm" onClick={() => void publishAi()} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Publish to {classCode}
                  </button>
                  <span className="text-[10px] text-ink-500">
                    Published with {Object.keys(params).length > 0 ? 'your fixed parameters' : 'each student’s own seed'}.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <section className="card h-fit p-5">
        <SectionHeading
          title="Published tests"
          subtitle={`${assignments.length} in ${classCode}. Students see these on their dashboard.`}
        />
        <div className="mt-3 space-y-2">
          {assignments.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="h-6 w-6" />}
              title="No tests yet"
              body="Publish a manual test or generate one with AI. It appears on every student’s dashboard instantly."
            />
          ) : (
            assignments.map((assignment) => {
              const done = new Set(
                attempts
                  .filter(
                    (attempt) =>
                      attempt.assignmentId === assignment.id && attempt.status === 'SCORED',
                  )
                  .map((attempt) => attempt.studentId),
              ).size;
              return (
                <div key={assignment.id} className="rounded-xl border border-ink-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-semibold text-ink-800">
                        {assignment.title}
                      </p>
                      <p className="mt-0.5 font-mono text-[9.5px] text-ink-400">
                        {assignment.experimentCode}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      onClick={() => void remove(assignment.id, assignment.title)}
                      title="Remove test"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge tone={assignment.source === 'AI' ? 'jade' : 'neutral'}>
                      {assignment.source === 'AI' ? 'AI challenge' : 'Manual test'}
                    </Badge>
                    <Badge tone={done >= students.length && students.length > 0 ? 'jade' : 'amber'}>
                      {done}/{students.length} submitted
                    </Badge>
                    {assignment.questions.length > 0 ? (
                      <Badge tone="sky">{assignment.questions.length} questions</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[10px] text-ink-400">
                    {assignment.dueAt
                      ? `Due ${formatDateTime(assignment.dueAt)}`
                      : 'No due date'}
                    {assignment.params && Object.keys(assignment.params).length > 0
                      ? ` · ${Object.keys(assignment.params).length} fixed parameter${
                          Object.keys(assignment.params).length === 1 ? '' : 's'
                        }`
                      : ''}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
