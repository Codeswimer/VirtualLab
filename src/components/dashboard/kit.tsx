import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Badge, IconTile } from '@/components/ui/primitives';
import type { AccountStatus, SchoolStatus } from '@/stores/app-store';
import { cn } from '@/lib/utils';

export function PageHeading({
  eyebrow,
  title,
  subtitle,
  actions,
  tone = 'jade',
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  tone?: 'jade' | 'amber' | 'sky';
}) {
  const eyebrowTone = {
    jade: 'text-jade-700',
    amber: 'text-amber-700',
    sky: 'text-sky-700',
  };
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <p className={cn('text-[11px] font-bold uppercase tracking-[0.16em]', eyebrowTone[tone])}>
          {eyebrow}
        </p>
        <h1 className="mt-1 text-balance text-2xl font-semibold tracking-tight text-ink-900">
          {title}
        </h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-ink-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'jade',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: 'jade' | 'amber' | 'sky' | 'ink' | 'rose';
}) {
  const tones: Record<string, string> = {
    jade: 'bg-jade-50 text-jade-700 border-jade-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    sky: 'bg-sky-50 text-sky-700 border-sky-100',
    ink: 'bg-ink-50 text-ink-700 border-ink-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
  };
  return (
    <div className="card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-ink-400">
            {label}
          </p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-ink-900">
            {value}
          </p>
          {hint ? <p className="mt-0.5 truncate text-[10px] text-ink-400">{hint}</p> : null}
        </div>
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
            tones[tone],
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

export function GradePill({ grade, className }: { grade: string; className?: string }) {
  const first = grade.charAt(0);
  const tone =
    first === 'A' || first === 'B'
      ? 'border-jade-200 bg-jade-50 text-jade-800'
      : first === 'C' || first === 'D'
        ? 'border-amber-200 bg-amber-50 text-amber-800'
        : 'border-red-200 bg-red-50 text-red-700';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-bold',
        tone,
        className,
      )}
    >
      {grade}
    </span>
  );
}

export function StatusPill({ status }: { status: AccountStatus | SchoolStatus }) {
  if (status === 'ACTIVE' || status === 'APPROVED') {
    return <Badge tone="jade">{status === 'ACTIVE' ? 'Active' : 'Approved'}</Badge>;
  }
  if (status === 'PENDING') return <Badge tone="amber">Pending</Badge>;
  return <Badge tone="red">Revoked</Badge>;
}

export function RankMedal({ rank }: { rank: number }) {
  const styles =
    rank === 1
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : rank === 2
        ? 'bg-ink-100 text-ink-700 border-ink-200'
        : rank === 3
          ? 'bg-orange-100 text-orange-800 border-orange-200'
          : 'bg-white text-ink-500 border-ink-100';
  return (
    <span
      className={cn(
        'inline-flex h-6 min-w-6 items-center justify-center rounded-md border px-1.5 font-mono text-[11px] font-bold',
        styles,
      )}
    >
      {rank}
    </span>
  );
}

export function PodiumCard({
  entry,
  highlight,
  onClick,
}: {
  entry: {
    rank: number;
    name: string;
    initials: string;
    average: number;
    grade: string;
    subtitle: string;
  };
  highlight?: boolean;
  onClick?: () => void;
}) {
  const height = entry.rank === 1 ? 'pt-4' : 'pt-5';
  const accent =
    entry.rank === 1
      ? 'from-amber-50 to-white border-amber-200'
      : entry.rank === 2
        ? 'from-ink-50 to-white border-ink-200'
        : 'from-orange-50/70 to-white border-orange-200';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex w-full flex-col items-center rounded-2xl border bg-gradient-to-b p-4 text-center shadow-card transition-all',
        accent,
        height,
        highlight && 'ring-2 ring-jade-400 ring-offset-2',
        onClick && 'hover:-translate-y-0.5 hover:shadow-float',
      )}
    >
      <span className="absolute left-3 top-3">
        <RankMedal rank={entry.rank} />
      </span>
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full font-mono text-sm font-bold',
          entry.rank === 1 ? 'bg-amber-500 text-white' : 'bg-ink-800 text-white',
        )}
      >
        {entry.initials}
      </span>
      <p className="mt-2 w-full truncate text-[13px] font-semibold text-ink-900">{entry.name}</p>
      <p className="w-full truncate text-[10px] text-ink-500">{entry.subtitle}</p>
      <p className="mt-2 font-mono text-xl font-bold text-ink-900">
        {Math.round(entry.average)}
        <span className="text-[11px] font-semibold text-ink-400">%</span>
      </p>
      <GradePill grade={entry.grade} className="mt-1" />
    </button>
  );
}

export { IconTile };
