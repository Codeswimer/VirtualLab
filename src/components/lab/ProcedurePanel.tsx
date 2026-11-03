import { useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  CircleDot,
  FlaskConical,
  Lightbulb,
  ShieldCheck,
} from 'lucide-react';
import type { ExperimentDefinition } from '@/experiments/types';
import { cn } from '@/lib/utils';

export function ProcedurePanel({
  experiment,
  onStepToggle,
  stepsDone,
}: {
  experiment: ExperimentDefinition;
  onStepToggle?: (index: number, done: boolean) => void;
  stepsDone: Set<number>;
}) {
  const [theoryOpen, setTheoryOpen] = useState(false);
  const progress = Math.round((stepsDone.size / experiment.procedure.length) * 100);

  return (
    <div className="space-y-3">
      <section className="card overflow-hidden">
        <div className="border-b border-ink-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <CircleDot className="h-4 w-4 text-jade-700" />
              Procedure
            </h2>
            <span className="font-mono text-[10px] font-semibold text-ink-400">
              {stepsDone.size}/{experiment.procedure.length}
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-jade-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <ol className="divide-y divide-ink-50">
          {experiment.procedure.map((step, index) => {
            const done = stepsDone.has(index);
            return (
              <li key={step.title}>
                <button
                  type="button"
                  onClick={() => onStepToggle?.(index, !done)}
                  className="flex w-full items-start gap-2.5 px-4 py-3 text-left transition-colors hover:bg-ink-50/50"
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors',
                      done
                        ? 'border-jade-600 bg-jade-600 text-white'
                        : 'border-ink-200 bg-white text-ink-500',
                    )}
                  >
                    {done ? <Check className="h-3 w-3" /> : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        'block text-[12.5px] font-semibold leading-snug',
                        done ? 'text-ink-400 line-through' : 'text-ink-800',
                      )}
                    >
                      {step.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-500">
                      {step.detail}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {experiment.coachTip ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
            <Lightbulb className="h-3.5 w-3.5" /> Examiner tip
          </p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-amber-950/80">
            {experiment.coachTip}
          </p>
        </div>
      ) : null}

      <section className="card overflow-hidden">
        <button
          type="button"
          onClick={() => setTheoryOpen((open) => !open)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          aria-expanded={theoryOpen}
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <BookOpen className="h-4 w-4 text-ink-400" />
            Theory refresher
          </span>
          <ChevronDown
            className={cn('h-4 w-4 text-ink-400 transition-transform', theoryOpen && 'rotate-180')}
          />
        </button>
        {theoryOpen ? (
          <div className="space-y-3 border-t border-ink-100 px-4 py-3">
            {experiment.theory.map((block) => (
              <div key={block.heading}>
                <p className="text-[12px] font-semibold text-ink-800">{block.heading}</p>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-500">{block.body}</p>
                {block.formula ? (
                  <p className="mt-1.5 rounded-md bg-ink-900 px-2 py-1.5 font-mono text-[11px] text-jade-200">
                    {block.formula}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <section className="card p-4">
        <h3 className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-500">
          <FlaskConical className="h-3.5 w-3.5" /> Apparatus
        </h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {experiment.meta.apparatus.map((item) => (
            <span
              key={item}
              className="rounded-md border border-ink-100 bg-ink-50/60 px-1.5 py-0.5 text-[10.5px] text-ink-600"
            >
              {item}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2 border-t border-ink-50 pt-3">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-jade-700" />
          <p className="text-[10.5px] leading-relaxed text-ink-500">
            Simulations are idealised at 25 °C unless stated. Never taste or smell a chemical
            directly; in a real laboratory wear goggles and follow your teacher’s instructions.
          </p>
        </div>
      </section>
    </div>
  );
}
