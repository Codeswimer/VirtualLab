import { useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Crosshair,
  LineChart,
  Maximize2,
  RotateCcw,
} from 'lucide-react';
import { parseNumberAnswer } from '@sim/math';
import { drawnLineGradient } from '@sim/math';
import type { GraphAnswer } from '@sim/scoring/types';
import type { ExperimentDefinition } from '@/experiments/types';
import { cn } from '@/lib/utils';

const W = 620;
const H = 430;
const M = { left: 62, right: 22, top: 20, bottom: 54 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

function defaultGraph(spec: NonNullable<ExperimentDefinition['graph']>): GraphAnswer {
  return {
    xColumn: spec.xColumn,
    yColumn: spec.yColumn,
    xLabel: '',
    yLabel: '',
    xMin: 0,
    xMax: 1,
    yMin: 0,
    yMax: 1,
    points: [],
    line: null,
    gradientEntry: '',
    triangle: false,
  };
}

function niceStep(range: number): number {
  if (!Number.isFinite(range) || range <= 0) return 1;
  const rough = range / 5;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatTick(value: number, step: number): string {
  const decimals = Math.max(0, Math.min(5, -Math.floor(Math.log10(step)) + (step < 1 ? 0 : 0)));
  if (Math.abs(value) >= 10000) return value.toExponential(1);
  return value.toFixed(Number.isFinite(decimals) ? decimals : 2);
}

function boundsFor(values: number[]): { min: number; max: number } {
  if (values.length === 0) return { min: 0, max: 1 };
  const dataMin = Math.min(...values);
  const dataMax = Math.max(...values);
  const includeZero = dataMin >= 0;
  let min = includeZero ? 0 : dataMin;
  let max = dataMax;
  if (max === min) max = min + 1;
  const pad = (max - min) * 0.08;
  max += pad;
  if (!includeZero) min -= pad;
  min = Math.floor(min / niceStep(max - min)) * niceStep(max - min);
  max = Math.ceil(max / niceStep(max - min)) * niceStep(max - min);
  return { min, max };
}

export function GraphTool({
  experiment,
  rows,
  graph,
  onChange,
  onUseGradient,
}: {
  experiment: ExperimentDefinition;
  rows: Record<string, string>[];
  graph: GraphAnswer | null;
  onChange: (patch: Partial<GraphAnswer>) => void;
  onUseGradient: (gradient: number) => void;
}) {
  const spec = experiment.graph;
  const svgRef = useRef<SVGSVGElement>(null);
  const uid = useId().replace(/:/g, '');
  const [dragging, setDragging] = useState<'p1' | 'p2' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!graph && spec) onChange(defaultGraph(spec));
  }, [graph, spec, onChange]);

  const activeGraph = graph ?? (spec ? defaultGraph(spec) : null);

  if (!spec) {
    return (
      <div className="rounded-xl border border-dashed border-ink-200 p-6 text-center text-sm text-ink-500">
        This practical does not require a graph. Complete the readings and calculations instead.
      </div>
    );
  }
  if (!activeGraph) return null;

  const xMin = activeGraph.xMin;
  const xMax = activeGraph.xMax > activeGraph.xMin ? activeGraph.xMax : activeGraph.xMin + 1;
  const yMin = activeGraph.yMin;
  const yMax = activeGraph.yMax > activeGraph.yMin ? activeGraph.yMax : activeGraph.yMin + 1;
  const xStep = niceStep(xMax - xMin);
  const yStep = niceStep(yMax - yMin);

  const sx = (x: number): number => M.left + ((x - xMin) / (xMax - xMin)) * PLOT_W;
  const sy = (y: number): number => M.top + PLOT_H - ((y - yMin) / (yMax - yMin)) * PLOT_H;
  const ix = (px: number): number => xMin + ((px - M.left) / PLOT_W) * (xMax - xMin);
  const iy = (py: number): number => yMin + ((M.top + PLOT_H - py) / PLOT_H) * (yMax - yMin);

  const xTicks: number[] = [];
  for (let v = Math.ceil(xMin / xStep) * xStep; v <= xMax + xStep * 1e-6; v += xStep) {
    xTicks.push(Number(v.toFixed(10)));
  }
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax + yStep * 1e-6; v += yStep) {
    yTicks.push(Number(v.toFixed(10)));
  }

  const plotPoints = (): void => {
    const collected: { x: number; y: number }[] = [];
    for (const row of rows) {
      const x = parseNumberAnswer(row[activeGraph.xColumn] ?? '');
      const y = parseNumberAnswer(row[activeGraph.yColumn] ?? '');
      if (x !== null && y !== null) collected.push({ x, y });
    }
    if (collected.length === 0) {
      setMessage('No numeric pairs found. Complete the table columns for both axes first.');
      return;
    }
    const xb = boundsFor(collected.map((p) => p.x));
    const yb = boundsFor(collected.map((p) => p.y));
    onChange({
      points: collected,
      xMin: xb.min,
      xMax: xb.max,
      yMin: yb.min,
      yMax: yb.max,
    });
    setMessage(`${collected.length} point(s) plotted from your table.`);
  };

  const addLine = (): void => {
    const midX = (xMin + xMax) / 2;
    const span = (xMax - xMin) * 0.36;
    const slope = (yMax - yMin) / (xMax - xMin);
    const y0 = (yMin + yMax) / 2 - slope * span;
    onChange({
      line: {
        x1: midX - span,
        y1: y0,
        x2: midX + span,
        y2: y0 + slope * span * 2,
      },
      triangle: true,
    });
    setMessage('Drag either end of the line to fit your points.');
  };

  const gradient = activeGraph.line ? drawnLineGradient(activeGraph.line) : null;

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>): void => {
    if (!dragging || !activeGraph.line || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / rect.width) * W;
    const py = ((event.clientY - rect.top) / rect.height) * H;
    const x = Math.min(xMax, Math.max(xMin, ix(px)));
    const y = Math.min(yMax, Math.max(yMin, iy(py)));
    const line =
      dragging === 'p1'
        ? { ...activeGraph.line, x1: x, y1: y }
        : { ...activeGraph.line, x2: x, y2: y };
    onChange({ line });
  };

  const pointCount = activeGraph.points.length;
  const plottedEnough = pointCount >= (spec.minimumPoints ?? 4);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
            <LineChart className="h-4 w-4 text-ink-400" />
            Graph paper
          </h3>
          <p className="mt-0.5 max-w-md text-xs leading-relaxed text-ink-500">{spec.prompt}</p>
        </div>
        <button type="button" onClick={plotPoints} className="btn-primary btn-sm">
          <Crosshair className="h-3.5 w-3.5" /> Plot from table
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label className="label" htmlFor={`graph-x-${uid}`}>
            Horizontal axis
          </label>
          <select
            id={`graph-x-${uid}`}
            className="select py-1.5 text-xs"
            value={activeGraph.xColumn}
            onChange={(event) => onChange({ xColumn: event.target.value })}
          >
            {experiment.table.columns
              .filter((column) => column.kind === 'number')
              .map((column) => (
                <option key={column.id} value={column.id}>
                  {column.label} {column.unit ? `(${column.unit})` : ''}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`graph-y-${uid}`}>
            Vertical axis
          </label>
          <select
            id={`graph-y-${uid}`}
            className="select py-1.5 text-xs"
            value={activeGraph.yColumn}
            onChange={(event) => onChange({ yColumn: event.target.value })}
          >
            {experiment.table.columns
              .filter((column) => column.kind === 'number')
              .map((column) => (
                <option key={column.id} value={column.id}>
                  {column.label} {column.unit ? `(${column.unit})` : ''}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor={`graph-xlabel-${uid}`}>
            Axis title (x)
          </label>
          <input
            id={`graph-xlabel-${uid}`}
            className="input py-1.5 text-xs"
            value={activeGraph.xLabel}
            placeholder={`e.g. ${spec.xLabel} / ${spec.xUnit || 'unit'}`}
            onChange={(event) => onChange({ xLabel: event.target.value })}
          />
        </div>
        <div>
          <label className="label" htmlFor={`graph-ylabel-${uid}`}>
            Axis title (y)
          </label>
          <input
            id={`graph-ylabel-${uid}`}
            className="input py-1.5 text-xs"
            value={activeGraph.yLabel}
            placeholder={`e.g. ${spec.yLabel} / ${spec.yUnit || 'unit'}`}
            onChange={(event) => onChange({ yLabel: event.target.value })}
          />
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-xl border border-ink-200 bg-[#fcfcfa]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full touch-none select-none"
          role="img"
          aria-label="Graph plotting area. Use the plot button, then drag the best-fit line endpoints."
          onPointerMove={handlePointerMove}
          onPointerUp={() => setDragging(null)}
          onPointerLeave={() => setDragging(null)}
        >
          <defs>
            <pattern id="grid" width={(PLOT_W / (xMax - xMin)) * xStep} height={(PLOT_H / (yMax - yMin)) * yStep} patternUnits="userSpaceOnUse" x={M.left} y={M.top}>
              <path
                d={`M ${(PLOT_W / (xMax - xMin)) * xStep} 0 L 0 0 0 ${(PLOT_H / (yMax - yMin)) * yStep}`}
                fill="none"
                stroke="rgba(15,43,36,0.09)"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          <rect x={M.left} y={M.top} width={PLOT_W} height={PLOT_H} fill="url(#grid)" />
          {xTicks.map((tick) => (
            <g key={`x-${tick}`}>
              <line
                x1={sx(tick)}
                x2={sx(tick)}
                y1={M.top}
                y2={M.top + PLOT_H}
                stroke="rgba(15,43,36,0.16)"
                strokeWidth="1"
              />
              <line
                x1={sx(tick)}
                x2={sx(tick)}
                y1={M.top + PLOT_H}
                y2={M.top + PLOT_H + 4}
                stroke="rgba(15,43,36,0.5)"
              />
              <text
                x={sx(tick)}
                y={M.top + PLOT_H + 18}
                textAnchor="middle"
                className="fill-ink-500"
                style={{ fontSize: 10, fontFamily: 'JetBrains Mono Variable, monospace' }}
              >
                {formatTick(tick, xStep)}
              </text>
            </g>
          ))}
          {yTicks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={M.left}
                x2={M.left + PLOT_W}
                y1={sy(tick)}
                y2={sy(tick)}
                stroke="rgba(15,43,36,0.16)"
                strokeWidth="1"
              />
              <line
                x1={M.left - 4}
                x2={M.left}
                y1={sy(tick)}
                y2={sy(tick)}
                stroke="rgba(15,43,36,0.5)"
              />
              <text
                x={M.left - 8}
                y={sy(tick) + 3}
                textAnchor="end"
                className="fill-ink-500"
                style={{ fontSize: 10, fontFamily: 'JetBrains Mono Variable, monospace' }}
              >
                {formatTick(tick, yStep)}
              </text>
            </g>
          ))}

          <line
            x1={M.left}
            y1={M.top + PLOT_H}
            x2={M.left + PLOT_W}
            y2={M.top + PLOT_H}
            stroke="#0f2b24"
            strokeWidth="1.4"
            markerEnd="url(#arrow)"
          />
          <line x1={M.left} y1={M.top + PLOT_H} x2={M.left} y2={M.top} stroke="#0f2b24" strokeWidth="1.4" />
          <defs>
            <marker id="arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
              <path d="M0,0 L6,3.5 L0,7 Z" fill="#0f2b24" />
            </marker>
          </defs>

          <text x={M.left + PLOT_W / 2} y={H - 14} textAnchor="middle" className="fill-ink-700" style={{ fontSize: 11.5, fontWeight: 600 }}>
            {activeGraph.xLabel || `${spec.xLabel}${spec.xUnit ? ` / ${spec.xUnit}` : ''}`}
          </text>
          <text
            x={16}
            y={M.top + PLOT_H / 2}
            textAnchor="middle"
            transform={`rotate(-90 16 ${M.top + PLOT_H / 2})`}
            className="fill-ink-700"
            style={{ fontSize: 11.5, fontWeight: 600 }}
          >
            {activeGraph.yLabel || `${spec.yLabel}${spec.yUnit ? ` / ${spec.yUnit}` : ''}`}
          </text>

          {activeGraph.points.map((point, index) => {
            const px = sx(point.x);
            const py = sy(point.y);
            if (px < M.left - 2 || px > M.left + PLOT_W + 2 || py < M.top - 2 || py > M.top + PLOT_H + 2) {
              return null;
            }
            return (
              <g key={`${point.x}-${point.y}-${index}`}>
                <circle cx={px} cy={py} r="5.5" fill="rgba(33,162,110,0.16)" />
                <circle cx={px} cy={py} r="3" fill="#106849" />
              </g>
            );
          })}

          {activeGraph.line ? (
            <g>
              {activeGraph.triangle ? (
                <g>
                  <line
                    x1={sx(activeGraph.line.x1)}
                    y1={sy(activeGraph.line.y1)}
                    x2={sx(activeGraph.line.x2)}
                    y2={sy(activeGraph.line.y1)}
                    stroke="#b96513"
                    strokeDasharray="4 3"
                    strokeWidth="1.2"
                  />
                  <line
                    x1={sx(activeGraph.line.x2)}
                    y1={sy(activeGraph.line.y1)}
                    x2={sx(activeGraph.line.x2)}
                    y2={sy(activeGraph.line.y2)}
                    stroke="#b96513"
                    strokeDasharray="4 3"
                    strokeWidth="1.2"
                  />
                  <text
                    x={(sx(activeGraph.line.x1) + sx(activeGraph.line.x2)) / 2}
                    y={sy(activeGraph.line.y1) + 14}
                    textAnchor="middle"
                    fill="#934913"
                    style={{ fontSize: 9.5, fontFamily: 'JetBrains Mono Variable, monospace' }}
                  >
                    Δx = {Math.abs(activeGraph.line.x2 - activeGraph.line.x1).toPrecision(3)}
                  </text>
                  <text
                    x={sx(activeGraph.line.x2) + 6}
                    y={(sy(activeGraph.line.y1) + sy(activeGraph.line.y2)) / 2}
                    fill="#934913"
                    style={{ fontSize: 9.5, fontFamily: 'JetBrains Mono Variable, monospace' }}
                  >
                    Δy = {Math.abs(activeGraph.line.y2 - activeGraph.line.y1).toPrecision(3)}
                  </text>
                </g>
              ) : null}
              <line
                x1={sx(activeGraph.line.x1)}
                y1={sy(activeGraph.line.y1)}
                x2={sx(activeGraph.line.x2)}
                y2={sy(activeGraph.line.y2)}
                stroke="#b96513"
                strokeWidth="2"
              />
              {(['p1', 'p2'] as const).map((handle) => {
                const x = handle === 'p1' ? activeGraph.line!.x1 : activeGraph.line!.x2;
                const y = handle === 'p1' ? activeGraph.line!.y1 : activeGraph.line!.y2;
                return (
                  <circle
                    key={handle}
                    cx={sx(x)}
                    cy={sy(y)}
                    r="7"
                    fill="#fff7ed"
                    stroke="#b96513"
                    strokeWidth="2"
                    className="cursor-grab active:cursor-grabbing"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      setDragging(handle);
                      svgRef.current?.setPointerCapture(event.pointerId);
                    }}
                  />
                );
              })}
            </g>
          ) : null}
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={addLine} className="btn-secondary btn-sm">
          <ArrowUpRight className="h-3.5 w-3.5" />
          {activeGraph.line ? 'Reset best-fit line' : 'Draw best-fit line'}
        </button>
        <label className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-[11px] font-medium text-ink-600">
          <input
            type="checkbox"
            checked={activeGraph.triangle}
            onChange={(event) => onChange({ triangle: event.target.checked })}
            className="h-3.5 w-3.5 rounded border-ink-300 text-jade-700 focus:ring-jade-500"
          />
          Gradient triangle
        </label>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold',
            plottedEnough ? 'bg-jade-50 text-jade-800' : 'bg-amber-50 text-amber-800',
          )}
        >
          {plottedEnough ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {pointCount} point{pointCount === 1 ? '' : 's'} plotted
        </span>
        <button
          type="button"
          className="btn-ghost btn-sm ml-auto"
          onClick={() => {
            const xb = boundsFor(activeGraph.points.map((p) => p.x));
            const yb = boundsFor(activeGraph.points.map((p) => p.y));
            onChange({ xMin: xb.min, xMax: xb.max, yMin: yb.min, yMax: yb.max });
          }}
        >
          <Maximize2 className="h-3.5 w-3.5" /> Auto scale
        </button>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => {
            if (!spec) return;
            onChange({ ...defaultGraph(spec), xColumn: activeGraph.xColumn, yColumn: activeGraph.yColumn });
            setMessage('Graph cleared.');
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Clear
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(
          [
            ['xMin', 'x minimum', xMin],
            ['xMax', 'x maximum', xMax],
            ['yMin', 'y minimum', yMin],
            ['yMax', 'y maximum', yMax],
          ] as const
        ).map(([key, label, value]) => (
          <label key={key} className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">
            {label}
            <input
              type="number"
              value={Number(value.toPrecision(6))}
              onChange={(event) =>
                onChange({ [key]: Number(event.target.value) } as Partial<GraphAnswer>)
              }
              className="input mt-1 py-1.5 font-mono text-xs"
              step="any"
            />
          </label>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Gradient of your line
            </p>
            <p className="reading mt-0.5 text-xl font-semibold text-ink-900">
              {gradient === null ? '—' : gradient.toPrecision(4)}
            </p>
            <p className="mt-0.5 text-[10px] text-amber-800/80">
              gradient = Δy ÷ Δx {spec.xUnit || spec.yUnit ? `(${spec.yUnit || 'y'} per ${spec.xUnit || 'x'})` : ''}
            </p>
          </div>
          {gradient !== null ? (
            <button type="button" className="btn-secondary btn-sm" onClick={() => onUseGradient(gradient)}>
              Use as calculated answer
            </button>
          ) : null}
        </div>
      </div>

      {message ? <p className="mt-2 text-[11px] text-ink-500">{message}</p> : null}
    </div>
  );
}
