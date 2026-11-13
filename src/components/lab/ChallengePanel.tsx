import { ClipboardCheck } from 'lucide-react';
import type { AssignmentQuestion } from '@/stores/app-store';

/**
 * Written questions attached to a teacher's test. Answers are stored with the
 * attempt and shown to the teacher while marking; the marking guide is never
 * rendered for students.
 */
export function ChallengePanel({
  questions,
  answers,
  onChange,
  readOnly = false,
  showGuides = false,
}: {
  questions: AssignmentQuestion[];
  answers?: Record<string, string>;
  onChange?: (next: Record<string, string>) => void;
  readOnly?: boolean;
  showGuides?: boolean;
}) {
  if (questions.length === 0) return null;
  const total = questions.reduce((sum, question) => sum + question.marks, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
          <ClipboardCheck className="h-4 w-4 text-amber-700" /> Test questions
        </h3>
        <span className="font-mono text-[10px] font-semibold text-ink-500">
          {questions.length} question{questions.length === 1 ? '' : 's'} · {total} marks
        </span>
      </div>

      {questions.map((question, index) => (
        <div key={question.id} className="rounded-xl border border-ink-100 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[12px] font-semibold leading-relaxed text-ink-800">
              {index + 1}. {question.prompt}
            </p>
            <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              {question.marks} mark{question.marks === 1 ? '' : 's'}
            </span>
          </div>
          {onChange ? (
            <textarea
              className="input mt-2 min-h-[84px] resize-y text-[12px]"
              value={answers?.[question.id] ?? ''}
              onChange={(event) =>
                onChange({ ...(answers ?? {}), [question.id]: event.target.value })
              }
              placeholder="Write your answer, showing any working."
              disabled={readOnly}
              aria-label={`Answer to question ${index + 1}`}
            />
          ) : answers?.[question.id] ? (
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-ink-50/70 px-2.5 py-2 text-[12px] leading-relaxed text-ink-700">
              {answers[question.id]}
            </p>
          ) : (
            <p className="mt-2 text-[11px] italic text-ink-400">No answer submitted.</p>
          )}
          {showGuides && question.markingGuide ? (
            <p className="mt-2 rounded-lg border border-jade-100 bg-jade-50/60 px-2.5 py-2 text-[11px] leading-relaxed text-jade-900">
              <span className="font-semibold">Marking guide: </span>
              {question.markingGuide}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
