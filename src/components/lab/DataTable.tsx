import { useState } from 'react';
import { AlertCircle, Check, Plus, Table2, Trash2 } from 'lucide-react';
import { buretteInputIssue } from '@sim/measurement';
import type { AttemptRow } from '@sim/scoring/types';
import type { ColumnSpec, ExperimentDefinition } from '@/experiments/types';
import { cn } from '@/lib/utils';

function decimalsIn(value: string): number {
  const trimmed = value.trim();
  if (!trimmed.includes('.')) return 0;
  return (trimmed.split('.')[1] ?? '').length;
}

function issueFor(column: ColumnSpec, value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (column.kind === 'text') return null;
  if (column.burette) return buretteInputIssue(trimmed);
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return 'Enter a number, e.g. 12.35';
  if (column.decimals !== undefined && decimalsIn(trimmed) !== column.decimals) {
    return `Use ${column.decimals} decimal place${column.decimals === 1 ? '' : 's'}`;
  }
  return null;
}

export function DataTable({
  experiment,
  rows,
  onChangeRow,
  onAddRow,
  onRemoveRow,
}: {
  experiment: ExperimentDefinition;
  rows: AttemptRow[];
  onChangeRow: (index: number, columnId: string, value: string) => void;
  onAddRow: () => void;
  onRemoveRow: (index: number) => void;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { table } = experiment;

  const completeRows = rows.filter((row) =>
    table.columns.some((column) => (row[column.id] ?? '').trim() !== ''),
  ).length;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <Table2 className="h-4 w-4 text-ink-400" />
            Readings table
          </h3>
          <p className="mt-0.5 text-xs text-ink-500">
            {completeRows} of {Math.max(table.minRows, completeRows)} rows started · saved
            automatically
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold',
            completeRows >= table.minRows
              ? 'bg-jade-50 text-jade-800'
              : 'bg-amber-50 text-amber-800',
          )}
        >
          {completeRows >= table.minRows ? (
            <>
              <Check className="h-3 w-3" /> Minimum rows reached
            </>
          ) : (
            <>
              <AlertCircle className="h-3 w-3" /> {table.minRows - completeRows} more row(s)
              needed
            </>
          )}
        </span>
      </div>

      <p className="mt-3 rounded-lg border border-ink-100 bg-ink-50/60 px-3 py-2 text-[11px] leading-relaxed text-ink-600">
        {table.instructions}
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-ink-100">
        <table className="w-full min-w-[420px] border-collapse text-left">
          <thead>
            <tr className="bg-ink-50/80">
              <th className="w-8 border-b border-ink-100 px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                #
              </th>
              {table.columns.map((column) => (
                <th
                  key={column.id}
                  className="border-b border-ink-100 px-2 py-2 text-[10px] font-bold uppercase tracking-wider text-ink-600"
                >
                  <span className="block whitespace-nowrap">{column.label}</span>
                  {column.unit ? (
                    <span className="block font-mono text-[10px] font-medium normal-case text-ink-400">
                      /{column.unit}
                    </span>
                  ) : null}
                </th>
              ))}
              <th className="w-8 border-b border-ink-100" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="group border-b border-ink-50 last:border-0">
                <td className="px-2 py-1.5 font-mono text-[10px] text-ink-400">{index + 1}</td>
                {table.columns.map((column) => {
                  const key = `${index}-${column.id}`;
                  const error = errors[key] ?? null;
                  return (
                    <td key={column.id} className="relative px-1.5 py-1.5">
                      <input
                        value={row[column.id] ?? ''}
                        onChange={(event) => {
                          onChangeRow(index, column.id, event.target.value);
                          if (errors[key]) {
                            setErrors((prev) => {
                              const next = { ...prev };
                              delete next[key];
                              return next;
                            });
                          }
                        }}
                        onBlur={(event) => {
                          const message = issueFor(column, event.target.value);
                          setErrors((prev) => {
                            const next = { ...prev };
                            if (message) next[key] = message;
                            else delete next[key];
                            return next;
                          });
                        }}
                        inputMode={column.kind === 'number' ? 'decimal' : 'text'}
                        aria-label={`${column.label}${column.unit ? ` (${column.unit})` : ''}, row ${index + 1}`}
                        aria-invalid={Boolean(error)}
                        placeholder={column.placeholder ?? (column.kind === 'number' ? '0.00' : '—')}
                        className={cn(
                          'w-full rounded-md border bg-white px-2 py-1.5 font-mono text-xs tabular-nums text-ink-900 transition-colors placeholder:font-sans placeholder:text-ink-300',
                          error
                            ? 'border-red-300 bg-red-50/40 focus:border-red-400'
                            : 'border-ink-100 focus:border-jade-500',
                          column.width === 'lg' ? 'min-w-[140px]' : column.width === 'md' ? 'min-w-[100px]' : 'min-w-[68px]',
                          column.kind === 'text' && 'font-sans',
                        )}
                      />
                      {error ? (
                        <span className="pointer-events-none absolute -bottom-1 left-1.5 z-10 hidden rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-medium text-white group-focus-within:block">
                          {error}
                        </span>
                      ) : null}
                    </td>
                  );
                })}
                <td className="px-1 py-1.5">
                  {table.addRows && rows.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => onRemoveRow(index)}
                      className="rounded p-1 text-ink-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
                      aria-label={`Delete row ${index + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.addRows ? (
        <button type="button" onClick={onAddRow} className="btn-secondary btn-sm mt-2">
          <Plus className="h-3.5 w-3.5" /> Add row
        </button>
      ) : null}

      <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
        Precision is checked against the examination convention. For example a burette reading must
        be written to 2 d.p. with a final digit of 0 or 5 (12.35 cm³).
      </p>
    </div>
  );
}
