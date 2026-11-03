import { useMemo, useState } from 'react';
import { CheckCircle2, Eye, Info, Ruler, XCircle } from 'lucide-react';
import { ControlBar, SceneButton, SceneHint, Stage } from './kit';
import type { SceneProps } from './types';

interface MeasureItemView {
  id: string;
  label: string;
  instrument: 'vernier' | 'micrometer';
  trueValue: number;
  unit: 'cm' | 'mm';
  zeroError: number;
}

export function MeasureScene({ scenario, attempt, onFlag }: SceneProps) {
  const items = scenario.items as MeasureItemView[];
  const [index, setIndex] = useState(0);
  const [closed, setClosed] = useState(false);
  const [check, setCheck] = useState<'idle' | 'right' | 'wrong'>('idle');
  const [visited, setVisited] = useState<Set<string>>(new Set());
  const item = items[index] ?? items[0];

  const geometry = useMemo(() => {
    if (!item) return null;
    const observed = Number((item.trueValue + item.zeroError).toFixed(2));
    if (item.instrument === 'vernier') {
      const mainCm = Math.floor(observed * 10 + 1e-9) / 10;
      const vernierIndex = Math.min(9, Math.max(0, Math.round((observed - mainCm) * 100)));
      return { observed, mainCm, vernierIndex, sleeveMm: 0, thimbleIndex: 0 };
    }
    const sleeveMm = Math.floor(observed * 2 + 1e-9) / 2;
    const thimbleIndex = Math.min(49, Math.max(0, Math.round((observed - sleeveMm) * 100)));
    return { observed, mainCm: 0, vernierIndex: 0, sleeveMm, thimbleIndex };
  }, [item]);

  if (!item || !geometry) return null;

  const row = attempt.rows.find((candidate) => (candidate.object ?? '').trim() === item.label);
  const observedRounded = (item.trueValue + item.zeroError).toFixed(2);

  const handleCheck = () => {
    const reading = Number(row?.reading ?? NaN);
    if (!Number.isFinite(reading)) {
      setCheck('wrong');
      return;
    }
    const tolerance = item.instrument === 'micrometer' ? 0.005 : 0.005;
    setCheck(Math.abs(reading - Number(observedRounded)) <= tolerance ? 'right' : 'wrong');
  };

  return (
    <div>
      <Stage
        caption={`${item.instrument === 'vernier' ? 'Vernier callipers' : 'Micrometer screw gauge'} — ${closed ? 'jaws closed (zero check)' : item.label}`}
        className="bg-[#eee9dc]"
      >
        {closed ? (
          <ZeroCheck item={item} />
        ) : item.instrument === 'vernier' ? (
          <VernierView geometry={geometry} />
        ) : (
          <MicrometerView geometry={geometry} />
        )}
      </Stage>

      <ControlBar>
        {items.map((option, optionIndex) => (
          <SceneButton
            key={option.id}
            active={index === optionIndex}
            onClick={() => {
              setIndex(optionIndex);
              setClosed(false);
              setCheck('idle');
              setVisited((previous) => {
                const next = new Set(previous);
                next.add(option.instrument);
                if (next.size >= 2) onFlag('instrument-matched');
                return next;
              });
            }}
          >
            {option.instrument === 'vernier' ? 'Vernier' : 'Micrometer'} · {option.label.split(' (')[0]}
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          active={closed}
          onClick={() => {
            setClosed((value) => !value);
            onFlag('zero-checked');
          }}
        >
          <Ruler className="h-3 w-3" /> {closed ? 'Open jaws' : 'Close jaws'}
        </SceneButton>
        <SceneButton onClick={handleCheck}>
          <Eye className="h-3 w-3" /> Check my reading
        </SceneButton>
      </ControlBar>

      <div className="mt-2 space-y-2">
        <SceneHint tone={check === 'right' ? 'jade' : check === 'wrong' ? 'amber' : 'neutral'}>
          {check === 'right' ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Your observed reading matches the scale. Now
              subtract the zero error in the table.
            </span>
          ) : check === 'wrong' ? (
            <span className="inline-flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> Not quite. Read the main scale first, then find the
              vernier/thimble division that lines up.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Read the scale in the apparatus, enter your observed reading in the table, then apply
              the zero error. “Check my reading” gives feedback without changing your score.
            </span>
          )}
        </SceneHint>
        {visited.size > 0 ? (
          <p className="px-1 text-[10px] text-ink-400">
            Instruments inspected: {Array.from(visited).join(', ')} · zero error is fixed for this
            attempt.
          </p>
        ) : null}
      </div>
    </div>
  );
}

interface Geometry {
  observed: number;
  mainCm: number;
  vernierIndex: number;
  sleeveMm: number;
  thimbleIndex: number;
}

function VernierView({ geometry }: { geometry: Geometry }) {
  const windowStart = Math.max(0, geometry.mainCm - 0.6);
  const pxPerCm = 150;
  const x0 = 74;
  const scaleY = 150;
  const jawOpening = geometry.observed;

  return (
    <svg viewBox="0 0 560 300" className="w-full" role="img" aria-label="Vernier calliper scale">
      <defs>
        <linearGradient id="vernier-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="0.4" stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
      </defs>
      <rect x="0" y="262" width="560" height="38" fill="#ded3b9" />
      {/* Calliper body */}
      <rect x="52" y="118" width="454" height="26" rx="4" fill="url(#vernier-metal)" stroke="#64748b" />
      <rect x="52" y="196" width={160 + jawOpening * pxPerCm} height="20" rx="3" fill="url(#vernier-metal)" stroke="#64748b" />
      <rect x={52 + jawOpening * pxPerCm + 120} y="196" width="290" height="20" rx="3" fill="url(#vernier-metal)" stroke="#64748b" />
      <rect x="52" y="196" width="56" height="66" rx="3" fill="#94a3b8" stroke="#64748b" />
      <rect x={52 + jawOpening * pxPerCm} y="196" width="22" height="66" rx="3" fill="#94a3b8" stroke="#64748b" />

      {/* Object */}
      <rect
        x={52 + 56}
        y={214}
        width={Math.max(4, jawOpening * pxPerCm - 34)}
        height="30"
        rx="4"
        fill="#9a6b3f"
        stroke="#6b4423"
        opacity="0.9"
      />
      <text x={52 + 56 + (jawOpening * pxPerCm - 34) / 2} y="263" textAnchor="middle" fill="#4b2e12" style={{ fontSize: 8.5, fontWeight: 700 }}>
        object
      </text>

      {/* Main scale */}
      <rect x={x0} y={scaleY - 18} width={410} height="40" rx="2" fill="#fefce8" stroke="#cbb88a" />
      {Array.from({ length: 41 }, (_, i) => {
        const cm = windowStart + i * 0.1;
        const x = x0 + i * (pxPerCm / 10);
        return (
          <g key={i}>
            <line x1={x} y1={scaleY - 18} x2={x} y2={i % 5 === 0 ? scaleY + 5 : scaleY - 4} stroke="#3f3a2a" strokeWidth={i % 5 === 0 ? 1.2 : 0.7} />
            {i % 5 === 0 ? (
              <text x={x} y={scaleY - 23} textAnchor="middle" fill="#3f3a2a" style={{ fontSize: 8.5, fontFamily: 'JetBrains Mono Variable, monospace' }}>
                {cm.toFixed(1)}
              </text>
            ) : null}
          </g>
        );
      })}
      <text x={x0 + 200} y={scaleY + 24} textAnchor="middle" fill="#6b5b3e" style={{ fontSize: 8 }}>
        main scale / cm
      </text>

      {/* Vernier plate */}
      <g transform={`translate(${x0 + (geometry.mainCm - windowStart) * pxPerCm} ${scaleY + 12})`}>
        <rect x="-4" y="0" width={pxPerCm * 0.94} height="56" rx="3" fill="#f5f5f4" stroke="#78716c" />
        {Array.from({ length: 11 }, (_, i) => (
          <g key={i}>
            <line
              x1={i * (pxPerCm * 0.9) / 10}
              y1="0"
              x2={i * (pxPerCm * 0.9) / 10}
              y2={i === 0 || i === 10 ? 22 : 15}
              stroke="#292524"
              strokeWidth={i === 0 || i === 10 ? 1.3 : 0.8}
            />
            {i % 5 === 0 ? (
              <text
                x={i * (pxPerCm * 0.9) / 10}
                y="34"
                textAnchor="middle"
                fill="#292524"
                style={{ fontSize: 8, fontFamily: 'JetBrains Mono Variable, monospace' }}
              >
                {i}
              </text>
            ) : null}
          </g>
        ))}
        <text x={54} y="50" textAnchor="middle" fill="#7c6f5d" style={{ fontSize: 6.5 }}>
          vernier
        </text>
      </g>

      <text x="470" y="96" className="fill-ink-600" style={{ fontSize: 8.5, fontWeight: 700 }}>
        LEAST COUNT
      </text>
      <text x="470" y="110" fill="#106849" style={{ fontSize: 10, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 700 }}>
        0.01 cm
      </text>
    </svg>
  );
}

function MicrometerView({ geometry }: { geometry: Geometry }) {
  const pxPerMm = 190;
  const windowStart = Math.max(0, geometry.sleeveMm - 1);
  const sleeveX = 66;
  const datumX = 300;

  return (
    <svg viewBox="0 0 560 300" className="w-full" role="img" aria-label="Micrometer screw gauge scale">
      <defs>
        <linearGradient id="micro-metal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f8fafc" />
          <stop offset="0.45" stopColor="#cbd5e1" />
          <stop offset="1" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="thimble" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#78716c" />
          <stop offset="0.35" stopColor="#e7e5e4" />
          <stop offset="1" stopColor="#a8a29e" />
        </linearGradient>
      </defs>
      <rect x="0" y="262" width="560" height="38" fill="#ded3b9" />

      {/* Frame */}
      <path d="M60 92 Q60 52 108 52 L264 52 Q286 52 286 74 L286 104 L60 104 Z" fill="url(#micro-metal)" stroke="#64748b" />
      <rect x="240" y="96" width="120" height="28" rx="4" fill="url(#micro-metal)" stroke="#64748b" />
      <rect x="96" y="104" width="30" height="70" rx="4" fill="#94a3b8" stroke="#64748b" />
      <rect x="200" y="104" width="42" height="70" rx="4" fill="#94a3b8" stroke="#64748b" />
      <rect x="200" y="128" width="44" height="26" rx="3" fill="#8b6b43" stroke="#5c4325" />
      <text x="222" y="170" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 8 }}>
        wire
      </text>

      {/* Sleeve */}
      <rect x={sleeveX} y="192" width="290" height="34" rx="3" fill="#fefce8" stroke="#cbb88a" />
      {Array.from({ length: 13 }, (_, i) => {
        const mm = windowStart + i * 0.5;
        const x = sleeveX + 20 + i * (pxPerMm / 2);
        return (
          <g key={i}>
            <line x1={x} y1="192" x2={x} y2={i % 2 === 0 ? 214 : 206} stroke="#3f3a2a" strokeWidth={i % 2 === 0 ? 1.2 : 0.8} />
            {i % 2 === 0 ? (
              <text x={x} y="226" textAnchor="middle" fill="#3f3a2a" style={{ fontSize: 8, fontFamily: 'JetBrains Mono Variable, monospace' }}>
                {mm.toFixed(1)}
              </text>
            ) : null}
          </g>
        );
      })}
      <line x1={datumX} y1="192" x2={datumX} y2="232" stroke="#b91c1c" strokeWidth="1.2" />
      <text x={sleeveX + 140} y="246" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 8 }}>
        sleeve / mm
      </text>

      {/* Thimble */}
      <g transform="translate(360 210)">
        <circle r="76" fill="url(#thimble)" stroke="#57534e" strokeWidth="2" />
        <circle r="58" fill="#e7e5e4" stroke="#a8a29e" />
        {Array.from({ length: 50 }, (_, i) => {
          const angle = (i / 50) * Math.PI * 2 - Math.PI / 2;
          const outer = 62;
          const inner = i % 5 === 0 ? 50 : 54;
          return (
            <g key={i}>
              <line
                x1={Math.cos(angle) * inner}
                y1={Math.sin(angle) * inner}
                x2={Math.cos(angle) * outer}
                y2={Math.sin(angle) * outer}
                stroke="#44403c"
                strokeWidth={i % 5 === 0 ? 1.2 : 0.7}
              />
              {i % 5 === 0 ? (
                <text
                  x={Math.cos(angle) * 43}
                  y={Math.sin(angle) * 43 + 3}
                  textAnchor="middle"
                  fill="#292524"
                  transform={`rotate(${(i / 50) * 360} ${Math.cos(angle) * 43} ${Math.sin(angle) * 43})`}
                  style={{ fontSize: 6.5, fontFamily: 'JetBrains Mono Variable, monospace' }}
                >
                  {i}
                </text>
              ) : null}
            </g>
          );
        })}
        <line x1="0" y1="-84" x2="0" y2="-58" stroke="#b91c1c" strokeWidth="2" />
        <text x="0" y="-90" textAnchor="middle" fill="#b91c1c" style={{ fontSize: 7.5, fontWeight: 700 }}>
          datum
        </text>
      </g>
      <text x="360" y="292" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 8 }}>
        thimble: 0.01 mm per division
      </text>
    </svg>
  );
}

function ZeroCheck({ item }: { item: MeasureItemView }) {
  const nose =
    item.zeroError === 0
      ? 'The zero marks line up exactly — no zero error.'
      : item.zeroError > 0
        ? 'The vernier/thimble zero lies beyond the main zero. This is a positive zero error: subtract it.'
        : 'The vernier/thimble zero lies before the main zero. This is a negative zero error: add it.';
  return (
    <div className="p-5">
      <div className="mx-auto max-w-md rounded-2xl border border-ink-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Zero check</p>
        <p className="mt-1 text-sm font-semibold text-ink-900">{item.label}</p>
        <div className="mt-3 flex items-center justify-center rounded-xl bg-ink-50 py-8">
          <svg viewBox="0 0 320 90" className="w-full max-w-xs" role="img" aria-label="Closed instrument zero position">
            <rect x="20" y="24" width="280" height="16" rx="2" fill="#fefce8" stroke="#cbb88a" />
            {Array.from({ length: 21 }, (_, i) => (
              <line key={i} x1={36 + i * 12.5} y1="24" x2={36 + i * 12.5} y2={i % 5 === 0 ? 34 : 30} stroke="#3f3a2a" strokeWidth={i % 5 === 0 ? 1.1 : 0.6} />
            ))}
            <g transform={`translate(${36 + (item.zeroError >= 0 ? 1 : -1) * Math.min(36, Math.abs(item.zeroError) * 500) + 2} 44)`}>
              <rect x="-2" y="0" width="56" height="26" rx="2" fill="#f5f5f4" stroke="#78716c" />
              {Array.from({ length: 6 }, (_, i) => (
                <line key={i} x1={i * 10} y1="0" x2={i * 10} y2={i === 0 ? 12 : 8} stroke="#292524" strokeWidth={i === 0 ? 1.2 : 0.7} />
              ))}
              <text x="0" y="22" textAnchor="middle" fill="#292524" style={{ fontSize: 6.5 }}>vernier 0</text>
            </g>
            <line x1="36" y1="14" x2="36" y2="24" stroke="#b91c1c" strokeWidth="1.2" />
            <text x="36" y="10" textAnchor="middle" fill="#b91c1c" style={{ fontSize: 7 }}>main 0</text>
          </svg>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-600">{nose}</p>
        <p className="mt-2 rounded-lg bg-ink-50 px-2.5 py-2 text-[10.5px] text-ink-500">
          Zero error is fixed for this attempt. When you are ready, open the jaws and take the
          measurement.
        </p>
      </div>
      <div className="mx-auto mt-3 max-w-md rounded-lg border border-jade-200 bg-jade-50 px-3 py-2 text-center text-[11px] text-jade-900">
        The instrument is reading {Math.abs(item.zeroError).toFixed(2)} {item.unit}{' '}
        {item.zeroError >= 0 ? 'too high' : 'too low'} when closed.
      </div>
      <p className="mx-auto mt-2 max-w-md text-center text-[10px] text-ink-400">
        Closed scale shown for the {item.instrument}. Units: {item.unit}. Observed value is not
        displayed — read it from the scale.
      </p>
    </div>
  );
}
