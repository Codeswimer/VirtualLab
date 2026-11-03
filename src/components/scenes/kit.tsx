import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Stage({
  children,
  caption,
  className,
}: {
  children: ReactNode;
  caption?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-[#f3f0e7]', className)}>
      {children}
      {caption ? (
        <p className="absolute bottom-1.5 left-3 rounded-full bg-white/75 px-2 py-0.5 text-[9.5px] font-medium text-ink-500 backdrop-blur-sm">
          {caption}
        </p>
      ) : null}
    </div>
  );
}

export function Readout({
  label,
  value,
  unit,
  tone = 'jade',
  size = 'md',
  hint,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: 'jade' | 'amber' | 'ink' | 'red';
  size?: 'sm' | 'md';
  hint?: string;
}) {
  const tones = {
    jade: 'bg-[#0d2b24] text-jade-200 border-jade-900',
    amber: 'bg-[#2b2110] text-amber-200 border-amber-900',
    ink: 'bg-ink-900 text-ink-100 border-ink-800',
    red: 'bg-[#2b1414] text-red-200 border-red-900',
  };
  return (
    <div className={cn('rounded-lg border px-2.5 py-1.5 shadow-inner', tones[tone])}>
      <p className="text-[8.5px] font-bold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className={cn('font-mono font-semibold tabular-nums leading-tight', size === 'sm' ? 'text-sm' : 'text-lg')}>
        {value}
        {unit ? <span className="ml-1 text-[9px] font-medium opacity-70">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-0.5 text-[8.5px] opacity-60">{hint}</p> : null}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  disabled,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  format?: (value: number) => string;
}) {
  return (
    <label className={cn('block', disabled && 'opacity-50')}>
      <span className="flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-wider text-ink-500">
        {label}
        <span className="font-mono text-[11px] font-semibold normal-case tracking-normal text-ink-800">
          {format ? format(value) : value}
          {unit ? <span className="ml-1 text-ink-400">{unit}</span> : null}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-jade-700 disabled:cursor-not-allowed"
        aria-label={label}
      />
    </label>
  );
}

export function SceneButton({
  children,
  onClick,
  active,
  disabled,
  tone = 'secondary',
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  tone?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40',
        active
          ? 'bg-ink-900 text-white'
          : tone === 'primary'
            ? 'bg-jade-700 text-white hover:bg-jade-800'
            : tone === 'ghost'
              ? 'text-ink-600 hover:bg-ink-100'
              : 'border border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50',
        className,
      )}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

export function SceneHint({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'jade' | 'amber' }) {
  const tones = {
    neutral: 'border-ink-100 bg-white/70 text-ink-600',
    jade: 'border-jade-200 bg-jade-50/80 text-jade-900',
    amber: 'border-amber-200 bg-amber-50/80 text-amber-900',
  };
  return (
    <p className={cn('rounded-lg border px-2.5 py-1.5 text-[10.5px] leading-relaxed', tones[tone])}>
      {children}
    </p>
  );
}

export function ControlBar({ children }: { children: ReactNode }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-ink-100 bg-white/80 p-2">
      {children}
    </div>
  );
}
