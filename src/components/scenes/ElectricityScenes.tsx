import { useMemo, useState } from 'react';
import { Power, Zap } from 'lucide-react';
import { createRng, hashSeed } from '@sim/rng';
import { measure } from '@sim/measurement';
import { ControlBar, Readout, SceneButton, SceneHint, Slider, Stage } from './kit';
import type { SceneProps } from './types';

// ---------------------------------------------------------------------------
// Ohm's law circuit
// ---------------------------------------------------------------------------

export function CircuitScene({ attempt, scenario, onRecord, onFlag }: SceneProps) {
  const currents = scenario.currentsA as number[];
  const [index, setIndex] = useState(0);
  const [closed, setClosed] = useState(false);
  const [rheostat, setRheostat] = useState(60);

  const target = currents[index] ?? 0.1;
  const readings = useMemo(() => {
    const rng = createRng(hashSeed(attempt.seed, 'circuit', index));
    return {
      current: measure(closed ? target : 0, 'ammeter', { random: rng.next }),
      voltage: measure(closed ? target * scenario.resistanceOhm : 0, 'voltmeter', {
        random: rng.next,
      }),
    };
  }, [attempt.seed, index, target, closed, scenario.resistanceOhm]);

  return (
    <div>
      <Stage caption="Series circuit with rheostat, ammeter and voltmeter">
        <svg viewBox="0 0 560 320" className="w-full" role="img" aria-label="Electrical circuit with meters">
          <rect x="0" y="292" width="560" height="28" fill="#ded3b9" />
          <path
            d="M90 110 L170 110 M250 110 L320 110 M400 110 L470 110 L470 240 L90 240 L90 110"
            fill="none"
            stroke={closed ? '#0f766e' : '#94a3b8'}
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Cell */}
          <g>
            <line x1="170" y1="96" x2="170" y2="124" stroke="#334155" strokeWidth="3" />
            <line x1="182" y1="101" x2="182" y2="119" stroke="#334155" strokeWidth="5" />
            <line x1="194" y1="96" x2="194" y2="124" stroke="#334155" strokeWidth="3" />
            <line x1="206" y1="101" x2="206" y2="119" stroke="#334155" strokeWidth="5" />
            <text x="188" y="140" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 8 }}>3 V cell</text>
          </g>

          {/* Rheostat */}
          <g transform="translate(280 92)">
            <rect x="0" y="4" width="82" height="26" rx="3" fill="#e7e5e4" stroke="#78716c" />
            {Array.from({ length: 9 }, (_, i) => (
              <line key={i} x1={8 + i * 8} y1="4" x2={8 + i * 8} y2="16" stroke="#a8a29e" />
            ))}
            <line x1={8 + (rheostat / 100) * 66} y1="0" x2={8 + (rheostat / 100) * 66} y2="18" stroke="#b91c1c" strokeWidth="2.5" />
            <text x="41" y="44" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 7.5 }}>rheostat</text>
          </g>

          {/* Ammeter */}
          <g transform="translate(345 110)">
            <circle r="28" fill="#fafaf9" stroke="#334155" strokeWidth="2" />
            <text y="-6" textAnchor="middle" fill="#0f172a" style={{ fontSize: 12, fontWeight: 700 }}>A</text>
            <text y="12" textAnchor="middle" fill="#0f766e" style={{ fontSize: 8, fontFamily: 'JetBrains Mono Variable, monospace' }}>
              {readings.current.toFixed(2)} A
            </text>
          </g>

          {/* Resistor */}
          <g transform="translate(430 110)">
            <rect x="-30" y="-12" width="60" height="24" rx="3" fill="#fde68a" stroke="#b45309" />
            <text y="3" textAnchor="middle" fill="#7c2d12" style={{ fontSize: 7.5, fontWeight: 700 }}>R wire</text>
          </g>

          {/* Voltmeter */}
          <g transform="translate(430 240)">
            <circle r="30" fill="#fafaf9" stroke="#334155" strokeWidth="2" />
            <text y="-6" textAnchor="middle" fill="#0f172a" style={{ fontSize: 12, fontWeight: 700 }}>V</text>
            <text y="12" textAnchor="middle" fill="#0f766e" style={{ fontSize: 8, fontFamily: 'JetBrains Mono Variable, monospace' }}>
              {readings.voltage.toFixed(2)} V
            </text>
            <path d="M -30 0 L -30 -30 L 0 -30 M 0 -30 L 30 -30 L 30 0" fill="none" stroke="#94a3b8" strokeWidth="2" opacity="0.8" />
          </g>

          {/* Switch */}
          <g transform="translate(90 176)">
            <circle r="4" fill="#334155" />
            <line x1="0" y1="0" x2={closed ? 24 : 20} y2={closed ? 0 : -12} stroke="#334155" strokeWidth="3" strokeLinecap="round" />
            <text x="8" y="18" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 7.5 }}>
              {closed ? 'closed' : 'open'}
            </text>
          </g>

          {closed ? (
            <circle cx="255" cy="110" r="3" fill="#f59e0b">
              <animate attributeName="cx" values="250;400;250" dur="3s" repeatCount="indefinite" />
            </circle>
          ) : null}
        </svg>
      </Stage>

      <ControlBar>
        {currents.map((option: number, optionIndex: number) => (
          <SceneButton key={option} active={index === optionIndex} onClick={() => setIndex(optionIndex)}>
            I ≈ {option.toFixed(2)} A
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          active={closed}
          onClick={() => {
            setClosed((value) => !value);
            onFlag('ammeter-series');
            onFlag('voltmeter-parallel');
          }}
        >
          <Power className="h-3 w-3" /> {closed ? 'Open switch' : 'Close switch'}
        </SceneButton>
        <SceneButton
          tone="primary"
          disabled={!closed}
          onClick={() =>
            onRecord({
              current: readings.current.toFixed(2),
              voltage: readings.voltage.toFixed(2),
            })
          }
        >
          Record V and I
        </SceneButton>
      </ControlBar>

      <div className="mt-2 rounded-xl border border-ink-100 bg-white p-2.5">
        <Slider
          label="Rheostat setting"
          min={0}
          max={100}
          step={1}
          value={rheostat}
          unit="%"
          onChange={(value) => {
            setRheostat(value);
            onFlag('rheostat-used');
          }}
        />
      </div>
      <div className="mt-2">
        <SceneHint>
          Close the switch before reading. The ammeter is in series; the voltmeter is across the
          resistance wire only.
        </SceneHint>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metre bridge and potentiometer
// ---------------------------------------------------------------------------

export function BridgeScene(props: SceneProps) {
  if (props.experiment.meta.code === 'PHY-13') return <PotentiometerScene {...props} />;
  return <MetreBridgeScene {...props} />;
}

function WireBench({
  jockey,
  deflection,
  labels,
  targetLabel,
}: {
  jockey: number;
  deflection: number;
  labels: { left: string; right: string };
  targetLabel: string;
}) {
  return (
    <Stage caption={targetLabel}>
      <svg viewBox="0 0 560 320" className="w-full" role="img" aria-label="Metre bridge wire with jockey and galvanometer">
        <defs>
          <linearGradient id="wire" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fbbf24" />
            <stop offset="0.5" stopColor="#fde68a" />
            <stop offset="1" stopColor="#f59e0b" />
          </linearGradient>
        </defs>
        <rect x="0" y="292" width="560" height="28" fill="#ded3b9" />

        {/* Wire */}
        <rect x="70" y="206" width="420" height="8" rx="3" fill="url(#wire)" />
        {Array.from({ length: 21 }, (_, i) => (
          <g key={i}>
            <line x1={70 + i * 21} y1="216" x2={70 + i * 21} y2={i % 5 === 0 ? 228 : 222} stroke="#7c6a45" />
            {i % 5 === 0 ? (
              <text x={70 + i * 21} y="240" textAnchor="middle" fill="#7c6a45" style={{ fontSize: 7 }}>
                {i * 5}
              </text>
            ) : null}
          </g>
        ))}

        {/* Jockey */}
        <g transform={`translate(${70 + (jockey / 100) * 420} 0)`} style={{ transition: 'transform 80ms linear' }}>
          <path d="M 0 206 L -7 186 L 7 186 Z" fill="#334155" />
          <rect x="-11" y="168" width="22" height="18" rx="3" fill="#475569" />
          <line x1="0" y1="186" x2="0" y2="206" stroke="#b91c1c" strokeWidth="2" />
        </g>
        <text x={70 + (jockey / 100) * 420} y="164" textAnchor="middle" fill="#b91c1c" style={{ fontSize: 8.5, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 700 }}>
          {jockey.toFixed(1)} cm
        </text>

        {/* End posts and gaps */}
        <rect x="56" y="196" width="16" height="28" rx="2" fill="#64748b" />
        <rect x="490" y="196" width="16" height="28" rx="2" fill="#64748b" />
        <text x="52" y="188" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 7.5 }}>{labels.left}</text>
        <text x="500" y="188" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 7.5 }}>{labels.right}</text>

        {/* Galvanometer */}
        <g transform="translate(280 80)">
          <circle r="42" fill="#fafaf9" stroke="#334155" strokeWidth="2.5" />
          <path d="M -30 18 A 34 34 0 0 1 30 18" fill="none" stroke="#e7e5e4" strokeWidth="2" />
          <line
            x1="0"
            y1="16"
            x2={Math.sin((Math.max(-45, Math.min(45, deflection)) * Math.PI) / 180) * 32}
            y2={16 - Math.cos((Math.max(-45, Math.min(45, deflection)) * Math.PI) / 180) * 32}
            stroke="#b91c1c"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle r="4" fill="#334155" />
          <text y="30" textAnchor="middle" fill="#64748b" style={{ fontSize: 7 }}>galvanometer</text>
        </g>
        <text x="280" y="140" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 8 }}>
          {Math.abs(deflection) < 1 ? 'no deflection — balanced' : 'deflected'}
        </text>
      </svg>
    </Stage>
  );
}

function MetreBridgeScene({ attempt, scenario, onRecord, onFlag }: SceneProps) {
  const boxValues = scenario.boxValuesOhm as number[];
  const [boxIndex, setBoxIndex] = useState(0);
  const [jockey, setJockey] = useState(50);
  const box = boxValues[boxIndex] ?? 4;
  const balance = (100 * scenario.unknownOhm) / (scenario.unknownOhm + box);
  const deflection = Math.max(-45, Math.min(45, (jockey - balance) * 1.6));
  const nulled = Math.abs(jockey - balance) < 0.5;

  const measuredLength = useMemo(
    () =>
      measure(balance, 'metreRule', {
        random: createRng(hashSeed(attempt.seed, 'bridge', box)).next,
      }),
    [attempt.seed, box, balance],
  );

  return (
    <div>
      <WireBench
        jockey={jockey}
        deflection={deflection}
        labels={{ left: `R = ${scenario.unknownOhm.toFixed(1)} Ω`, right: `${box} Ω box` }}
        targetLabel="Metre bridge with unknown resistance and resistance box"
      />

      <ControlBar>
        {boxValues.map((value: number, index: number) => (
          <SceneButton
            key={value}
            active={boxIndex === index}
            onClick={() => {
              setBoxIndex(index);
              setJockey(50);
            }}
          >
            R box = {value} Ω
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          tone="primary"
          disabled={!nulled}
          onClick={() => {
            onRecord({ box: box.toFixed(1), balance: measuredLength.toFixed(1) });
            onFlag('null-found');
          }}
        >
          <Zap className="h-3 w-3" /> {nulled ? 'Record balance' : 'Find null point'}
        </SceneButton>
      </ControlBar>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_180px]">
        <div className="rounded-xl border border-ink-100 bg-white p-2.5">
          <Slider
            label="Jockey position ℓ"
            min={0}
            max={100}
            step={0.1}
            value={jockey}
            unit="cm"
            onChange={(value) => {
              setJockey(value);
              if (Math.abs(value - balance) < 0.5) {
                onFlag('null-found');
                onFlag('jockey-tapped');
              }
            }}
            format={(value) => value.toFixed(1)}
          />
        </div>
        <Readout
          label="Balance"
          value={nulled ? 'NULL' : deflection < 0 ? 'LEFT' : 'RIGHT'}
          tone={nulled ? 'jade' : 'amber'}
          size="sm"
          hint={nulled ? 'Galvanometer at zero' : 'Slide the jockey'}
        />
      </div>
      <div className="mt-2">
        <SceneHint tone={nulled ? 'jade' : 'neutral'}>
          {nulled
            ? 'The bridge is balanced. Record ℓ, then compute R = R_box ℓ/(100 − ℓ).'
            : 'Tap the jockey lightly while sliding. The balance point is where the galvanometer deflection is zero.'}
        </SceneHint>
      </div>
    </div>
  );
}

function PotentiometerScene({ attempt, scenario, onRecord, onFlag }: SceneProps) {
  const connections = [
    { label: 'Standard cell', length: scenario.standardLengthCm as number },
    { label: 'Unknown cell (open circuit)', length: ((scenario.unknownEmfV as number) / (scenario.standardEmfV as number)) * (scenario.standardLengthCm as number) },
    {
      label: 'Unknown cell with resistor',
      length:
        (((scenario.unknownEmfV as number) * ((scenario.externalOhm as number) / ((scenario.externalOhm as number) + (scenario.internalOhm as number)))) /
          (scenario.standardEmfV as number)) *
        (scenario.standardLengthCm as number),
    },
  ];
  const [index, setIndex] = useState(0);
  const [jockey, setJockey] = useState(50);
  const connection = connections[index] ?? connections[0];
  const balance = connection?.length ?? 50;
  const deflection = Math.max(-45, Math.min(45, (jockey - balance) * 1.6));
  const nulled = Math.abs(jockey - balance) < 0.5;

  const measuredLength = useMemo(
    () =>
      measure(balance, 'metreRule', {
        random: createRng(hashSeed(attempt.seed, 'potentiometer', index)).next,
      }),
    [attempt.seed, index, balance],
  );

  return (
    <div>
      <WireBench
        jockey={jockey}
        deflection={deflection}
        labels={{ left: 'driver cell', right: connection?.label ?? '' }}
        targetLabel="Potentiometer wire with standard and unknown cells"
      />

      <ControlBar>
        {connections.map((option, optionIndex) => (
          <SceneButton
            key={option.label}
            active={index === optionIndex}
            onClick={() => {
              setIndex(optionIndex);
              setJockey(50);
            }}
          >
            {option.label}
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          tone="primary"
          disabled={!nulled}
          onClick={() => {
            onRecord({ cell: connection?.label ?? '', length: measuredLength.toFixed(1) });
            onFlag('calibrated');
            onFlag('null-found');
          }}
        >
          Record balance
        </SceneButton>
      </ControlBar>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_180px]">
        <div className="rounded-xl border border-ink-100 bg-white p-2.5">
          <Slider
            label="Jockey position"
            min={0}
            max={100}
            step={0.1}
            value={jockey}
            unit="cm"
            onChange={(value) => {
              setJockey(value);
              if (Math.abs(value - balance) < 0.5) {
                onFlag('null-found');
                if (index === 0) onFlag('calibrated');
              }
            }}
            format={(value) => value.toFixed(1)}
          />
        </div>
        <Readout label="Detector" value={nulled ? 'NULL' : 'DEFLECTED'} tone={nulled ? 'jade' : 'amber'} size="sm" />
      </div>
      <div className="mt-2">
        <SceneHint tone={nulled ? 'jade' : 'neutral'}>
          {index === 0
            ? 'Set the standard cell first. Its balance length ℓ₀ is the reference for everything else.'
            : 'At the null point no current is drawn from the test cell, so the reading is its true e.m.f.'}
        </SceneHint>
      </div>
    </div>
  );
}
