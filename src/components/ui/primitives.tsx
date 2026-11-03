import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Score ring
// ---------------------------------------------------------------------------

export function ScoreRing({
  percent,
  size = 68,
  stroke = 6,
  showGrade = true,
  className,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  showGrade?: boolean;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);
  const colour = clamped >= 70 ? '#138259' : clamped >= 50 ? '#d3861a' : '#b42318';
  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped)} percent`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(15,43,36,0.1)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-sm font-bold leading-none text-ink-900">
          {Math.round(clamped)}
          <span className="text-[9px] font-semibold text-ink-400">%</span>
        </span>
        {showGrade && size >= 60 ? (
          <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-ink-400">
            score
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badges and chips
// ---------------------------------------------------------------------------

type Tone = 'neutral' | 'jade' | 'amber' | 'red' | 'ink' | 'sky';

const toneStyles: Record<Tone, string> = {
  neutral: 'border-ink-200 bg-white text-ink-600',
  jade: 'border-jade-200 bg-jade-50 text-jade-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  red: 'border-red-200 bg-red-50 text-red-700',
  ink: 'border-ink-700 bg-ink-900 text-white',
  sky: 'border-sky-200 bg-sky-50 text-sky-800',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        toneStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function IconTile({
  children,
  tone = 'jade',
  size = 'md',
}: {
  children: ReactNode;
  tone?: 'jade' | 'amber' | 'sky' | 'ink' | 'rose';
  size?: 'sm' | 'md' | 'lg';
}) {
  const tones: Record<string, string> = {
    jade: 'bg-jade-50 text-jade-700 border-jade-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
    ink: 'bg-ink-50 text-ink-700 border-ink-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  };
  const sizes: Record<string, string> = {
    sm: 'h-8 w-8 rounded-lg',
    md: 'h-10 w-10 rounded-xl',
    lg: 'h-12 w-12 rounded-2xl',
  };
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center border',
        tones[tone],
        sizes[size],
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-ink-950/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-float sm:rounded-2xl',
          widths[size],
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-ink-900">
              {title}
            </h2>
            {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="btn-ghost -mr-1 -mt-1 h-8 w-8 rounded-full p-0"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

export function Tabs({
  tabs,
  value,
  onChange,
  variant = 'pill',
  className,
}: {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'underline';
  className?: string;
}) {
  if (variant === 'underline') {
    return (
      <div className={cn('flex gap-1 overflow-x-auto border-b border-ink-100', className)} role="tablist">
        {tabs.map((tab) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={cn(
                'relative flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-semibold transition-colors',
                active ? 'text-jade-800' : 'text-ink-500 hover:text-ink-800',
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined ? (
                <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-600">
                  {tab.badge}
                </span>
              ) : null}
              {active ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-jade-700" />
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <div
      className={cn(
        'inline-flex gap-1 overflow-x-auto rounded-xl bg-ink-100/70 p-1',
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
              active ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-800',
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge !== 0 ? (
              <span className="rounded-full bg-jade-100 px-1.5 text-[10px] text-jade-800">
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Meters and stats
// ---------------------------------------------------------------------------

export function ProgressBar({
  value,
  max = 100,
  tone = 'jade',
  className,
  label,
}: {
  value: number;
  max?: number;
  tone?: 'jade' | 'amber' | 'red';
  className?: string;
  label?: string;
}) {
  const percent = max === 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const colours = { jade: 'bg-jade-600', amber: 'bg-amber-500', red: 'bg-red-600' };
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-ink-100', className)}
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label ?? 'Progress'}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', colours[tone])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink-200 bg-white/60 px-6 py-12 text-center">
      <span className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-50 text-ink-400">
        {icon}
      </span>
      <h3 className="text-sm font-semibold text-ink-800">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-ink-500">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function SectionHeading({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function IconButton({
  label,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn('btn-ghost h-9 w-9 rounded-lg p-0', className)}
      {...props}
    />
  );
}
