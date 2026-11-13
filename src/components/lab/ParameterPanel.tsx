import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { ExperimentDefinition } from '@/experiments/types';
import { parametersFor, scenarioFor } from '@/experiments';

/**
 * Manual bench parameters. Sliders rebuild the hidden scenario through the same
 * adapter the marking service uses, so the apparatus and the rubric agree.
 */
export function ParameterPanel({
  experiment,
  seed,
  params,
  onChange,
  readOnly = false,
  lockedNote,
}: {
  experiment: ExperimentDefinition;
  seed: number;
  params?: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  readOnly?: boolean;
  lockedNote?: string;
}) {
  const specs = parametersFor(experiment);
  if (specs.length === 0) return null;
  const scenario = scenarioFor(experiment, seed, params);
  const hasOverrides = Boolean(params && Object.keys(params).length > 0);

  return (
    <section className="rounded-xl border border-ink-100 bg-white p-3 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-500">
          <SlidersHorizontal className="h-3.5 w-3.5" /> Bench parameters
        </h2>
        {!readOnly && hasOverrides ? (
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink-500 hover:text-ink-800"
            onClick={() => onChange({})}
          >
            <RotateCcw className="h-3 w-3" /> Reset to seed
          </button>
        ) : null}
      </div>

      {readOnly ? (
        <p className="mt-1 text-[10px] leading-relaxed text-ink-500">
          {lockedNote ?? 'Your teacher fixed these parameters for the test.'}
        </p>
      ) : null}

      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {specs.map((spec) => {
          const value = params?.[spec.id] ?? spec.read(scenario);
          return (
            <label key={spec.id} className={readOnly ? 'opacity-70' : undefined}>
              <span className="flex items-baseline justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                {spec.label}
                <span className="font-mono text-[11px] font-semibold normal-case tracking-normal text-ink-800">
                  {value}
                  {spec.unit ? <span className="ml-1 text-ink-400">{spec.unit}</span> : null}
                </span>
              </span>
              <input
                type="range"
                min={spec.min}
                max={spec.max}
                step={spec.step}
                value={value}
                disabled={readOnly}
                onChange={(event) =>
                  onChange({ ...(params ?? {}), [spec.id]: Number(event.target.value) })
                }
                className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-jade-700 disabled:cursor-not-allowed"
                aria-label={spec.label}
              />
              {spec.hint ? (
                <p className="mt-1 text-[9.5px] leading-relaxed text-ink-400">{spec.hint}</p>
              ) : null}
            </label>
          );
        })}
      </div>

      {!readOnly ? (
        <p className="mt-2 text-[9.5px] leading-relaxed text-ink-400">
          Changing a parameter changes the expected readings. Record fresh rows for the new setup.
        </p>
      ) : null}
    </section>
  );
}
