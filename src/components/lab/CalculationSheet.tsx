import { ArrowDownToLine, Calculator, Sigma } from 'lucide-react';
import type { ExperimentDefinition } from '@/experiments/types';
import { cn } from '@/lib/utils';

export function CalculationSheet({
  experiment,
  answers,
  onChange,
  gradient,
}: {
  experiment: ExperimentDefinition;
  answers: Record<string, string>;
  onChange: (id: string, value: string) => void;
  gradient: number | null;
}) {
  if (experiment.calculations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
        This practical is assessed on your observations and identification, not on a numerical
        calculation.
      </div>
    );
  }

  const answered = experiment.calculations.filter(
    (spec) => (answers[spec.id] ?? '').trim() !== '',
  ).length;

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Calculator className="h-4 w-4 text-ink-400" />
            Calculations
          </h3>
          <p className="mt-0.5 text-xs text-ink-500">
            {answered} of {experiment.calculations.length} answered · show your working in your
            notebook first
          </p>
        </div>
        <span className="chip chip-jade">
          <Sigma className="h-3 w-3" /> {experiment.calculations.reduce((s, c) => s + c.max, 0)} marks
        </span>
      </div>

      <div className="mt-3 space-y-3">
        {experiment.calculations.map((spec, index) => {
          const value = answers[spec.id] ?? '';
          const canUseGradient = spec.fromGradient && gradient !== null;
          return (
            <div
              key={spec.id}
              className={cn(
                'rounded-xl border p-3 transition-colors',
                value.trim() ? 'border-jade-100 bg-jade-50/30' : 'border-ink-100 bg-white',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-900 font-mono text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold leading-snug text-ink-800">
                      {spec.label}
                    </p>
                    {spec.formula ? (
                      <p className="mt-1 inline-block rounded bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] text-ink-600">
                        {spec.formula}
                      </p>
                    ) : null}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-semibold text-ink-400">
                  {spec.max} mark{spec.max === 1 ? '' : 's'}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    value={value}
                    onChange={(event) => onChange(spec.id, event.target.value)}
                    inputMode="decimal"
                    aria-label={spec.label}
                    placeholder="Your answer"
                    className="input pr-16 font-mono text-sm"
                  />
                  {spec.unit ? (
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-ink-500">
                      {spec.unit}
                    </span>
                  ) : null}
                </div>
                {canUseGradient ? (
                  <button
                    type="button"
                    className="btn-secondary btn-sm shrink-0"
                    onClick={() => onChange(spec.id, String(Number(gradient.toPrecision(5))))}
                    title="Copy the gradient of your graph into this answer"
                  >
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                    Use gradient
                  </button>
                ) : null}
              </div>

              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-500">{spec.help}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-lg border border-ink-100 bg-ink-50/60 p-3 text-[11px] leading-relaxed text-ink-600">
        <strong className="font-semibold text-ink-800">Exam tip:</strong> write the formula, the
        substitution and the unit for every step. Marks are awarded for the final value within
        tolerance, but examiners give method marks for clear working.
      </div>
    </div>
  );
}
