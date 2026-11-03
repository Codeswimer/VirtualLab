import { AlertTriangle, CheckCircle2, CloudOff, Loader2, Send } from 'lucide-react';
import type { StoredAttempt } from '@/stores/app-store';
import type { ExperimentDefinition } from '@/experiments/types';
import { Modal } from '@/components/ui/primitives';
import { cn } from '@/lib/utils';

export function SubmitDialog({
  open,
  onClose,
  onSubmit,
  experiment,
  attempt,
  busy,
  online,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  experiment: ExperimentDefinition;
  attempt: StoredAttempt;
  busy: boolean;
  online: boolean;
}) {
  const rowsWithData = attempt.rows.filter((row) =>
    Object.values(row).some((value) => value.trim() !== ''),
  ).length;
  const answeredCalcs = experiment.calculations.filter(
    (spec) => (attempt.answers[spec.id] ?? '').trim() !== '',
  ).length;
  const graphPoints = attempt.graph?.points.length ?? 0;

  const checks = [
    {
      label: 'Readings recorded',
      detail: `${rowsWithData} row(s) with data (minimum ${experiment.table.minRows})`,
      ok: rowsWithData >= experiment.table.minRows,
    },
    ...(experiment.graph
      ? [
          {
            label: 'Graph plotted',
            detail: `${graphPoints} point(s) plotted (minimum ${experiment.graph.minimumPoints ?? 4})`,
            ok: graphPoints >= (experiment.graph.minimumPoints ?? 4),
          },
        ]
      : []),
    ...(experiment.calculations.length > 0
      ? [
          {
            label: 'Calculations answered',
            detail: `${answeredCalcs} of ${experiment.calculations.length} answers given`,
            ok: answeredCalcs === experiment.calculations.length,
          },
        ]
      : []),
    {
      label: 'Conclusion written',
      detail: attempt.notes.trim() ? `${attempt.notes.trim().split(/\s+/).length} words` : 'Not written yet',
      ok: attempt.notes.trim().length > 20,
    },
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Submit this practical?"
      description="Your report is marked against the examination rubric. You can retake it with new values afterwards."
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>
            Keep working
          </button>
          <button type="button" className="btn-primary" onClick={onSubmit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {busy ? 'Marking…' : 'Submit for marking'}
          </button>
        </>
      }
    >
      <ul className="space-y-2">
        {checks.map((check) => (
          <li
            key={check.label}
            className={cn(
              'flex items-start gap-2.5 rounded-xl border px-3 py-2.5',
              check.ok ? 'border-jade-100 bg-jade-50/50' : 'border-amber-200 bg-amber-50/60',
            )}
          >
            {check.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-jade-700" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            )}
            <div>
              <p className="text-xs font-semibold text-ink-800">{check.label}</p>
              <p className="text-[11px] text-ink-500">{check.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      {!online ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-ink-200 bg-ink-50 p-3">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-ink-500" />
          <p className="text-[11px] leading-relaxed text-ink-600">
            You are offline. This submission will be saved in the outbox and delivered exactly once
            when the connection returns. Nothing is lost.
          </p>
        </div>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
        Missing items simply score zero — there is no penalty for submitting. Marks are computed on
        the marking service from the attempt seed, not on this device.
      </p>
    </Modal>
  );
}
