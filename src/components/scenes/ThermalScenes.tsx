import { useMemo, useState } from 'react';
import { Check, Flame, Snowflake, Thermometer, Wind } from 'lucide-react';
import { createRng, hashSeed } from '@sim/rng';
import { measure, type InstrumentSpec } from '@sim/measurement';
import { coolingTemperature } from '@sim/physics/thermal';
import { ControlBar, Readout, SceneButton, SceneHint, Slider, Stage } from './kit';
import type { SceneProps } from './types';

const pressureGauge: InstrumentSpec = {
  id: 'voltmeter',
  name: 'Pressure gauge',
  unit: 'kPa',
  leastCount: 0.5,
  decimals: 1,
  noiseLeastCounts: 0.4,
  resolution: 0.5,
};

// ---------------------------------------------------------------------------
// Method of mixtures
// ---------------------------------------------------------------------------

export function ThermalScene({ attempt, scenario, onRecord, onFlag }: SceneProps) {
  const [phase, setPhase] = useState<'idle' | 'heated' | 'mixed'>('idle');
  const [stirred, setStirred] = useState(false);

  const waterReading = useMemo(() => {
    const rng = createRng(hashSeed(attempt.seed, 'heat-water'));
    return {
      mass: measure(scenario.massWaterG as number, 'balance', { random: rng.next }),
      temp: measure(scenario.waterInitialC as number, 'thermometer', { random: rng.next }),
    };
  }, [attempt.seed, scenario.massWaterG, scenario.waterInitialC]);

  const metalMass = useMemo(() => {
    const rng = createRng(hashSeed(attempt.seed, 'heat-metal'));
    return measure(scenario.massMetalG as number, 'balance', { random: rng.next });
  }, [attempt.seed, scenario.massMetalG]);

  const finalReading = useMemo(() => {
    const rng = createRng(hashSeed(attempt.seed, 'heat-final'));
    return measure(scenario.finalTempC as number, 'thermometer', { random: rng.next });
  }, [attempt.seed, scenario.finalTempC]);

  const displayTemp = phase === 'mixed' ? finalReading : phase === 'heated' ? waterReading.temp : waterReading.temp;

  return (
    <div>
      <Stage caption="Calorimeter, thermometer and metal heated in boiling water">
        <svg viewBox="0 0 560 320" className="w-full" role="img" aria-label="Calorimeter and boiling water bath">
          <defs>
            <linearGradient id="hot-water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fed7aa" stopOpacity="0.9" />
              <stop offset="1" stopColor="#fb923c" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="calo" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#e7e5e4" />
              <stop offset="0.5" stopColor="#fafaf9" />
              <stop offset="1" stopColor="#d6d3d1" />
            </linearGradient>
          </defs>
          <rect x="0" y="286" width="560" height="34" fill="#ded3b9" />

          {/* Boiling bath */}
          <g>
            <rect x="60" y="150" width="160" height="120" rx="6" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
            <rect x="66" y="170" width="148" height="94" rx="4" fill="url(#hot-water)" />
            {phase !== 'idle' ? (
              <g>
                {[0, 1, 2, 3].map((i) => (
                  <circle key={i} cx={100 + i * 30} cy={168} r={3 + (i % 2) * 2} fill="#fff7ed" opacity="0.8">
                    <animate attributeName="cy" values="176;150;176" dur={`${2 + i * 0.4}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.8;0.1;0.8" dur={`${2 + i * 0.4}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </g>
            ) : null}
            <text x="140" y="264" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 8 }}>
              boiling water bath
            </text>
            <g transform={`translate(${phase === 'idle' ? 140 : 280} ${phase === 'idle' ? 210 : 220})`} style={{ transition: 'transform 600ms ease' }}>
              <rect x="-26" y="-14" width="52" height="30" rx="4" fill="#94a3b8" stroke="#475569" />
              <text x="0" y="4" textAnchor="middle" fill="#1e293b" style={{ fontSize: 7.5, fontWeight: 700 }}>
                {scenario.metal as string}
              </text>
            </g>
            <path d="M 88 130 q 8 -18 0 -30 M 118 130 q 8 -18 0 -30 M 148 130 q 8 -18 0 -30" stroke="#fb923c" strokeWidth="2" fill="none" opacity="0.5" />
          </g>

          {/* Calorimeter */}
          <g transform="translate(300 118)">
            <rect x="0" y="40" width="190" height="130" rx="8" fill="url(#calo)" stroke="#78716c" strokeWidth="2" />
            <rect x="12" y="72" width="166" height="86" rx="4" fill={phase === 'mixed' ? '#bae6fd' : '#e0f2fe'} opacity="0.8" />
            <rect x="-8" y="32" width="206" height="14" rx="6" fill="#d6d3d1" stroke="#78716c" />
            <line x1="100" y1="24" x2="100" y2="150" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
            <rect x="88" y="20" width="24" height="26" rx="8" fill="#f5f5f4" stroke="#78716c" />
            <circle cx="100" cy="34" r="8" fill="#fef2f2" stroke="#b91c1c" />
            <rect x="96" y="34" width="8" height="60" fill="#fecaca" opacity="0.7" />
            <text x="100" y="112" textAnchor="middle" fill="#b91c1c" style={{ fontSize: 9, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 700 }}>
              {displayTemp.toFixed(1)} °C
            </text>
            <text x="100" y="182" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 8 }}>
              calorimeter
            </text>
          </g>

          <ReadoutInline x={52} y={48} label="Metal mass" value={metalMass.toFixed(1)} unit="g" />
          <ReadoutInline x={202} y={48} label="Water mass" value={waterReading.mass.toFixed(1)} unit="g" tone="#1f2937" />
        </svg>
      </Stage>

      <ControlBar>
        <SceneButton
          active={phase !== 'idle'}
          onClick={() => {
            setPhase('heated');
          }}
        >
          <Flame className="h-3 w-3" /> Heat metal to 100 °C
        </SceneButton>
        <SceneButton
          disabled={phase === 'idle' || phase === 'mixed'}
          onClick={() => {
            setPhase('mixed');
            onFlag('quick-transfer');
          }}
        >
          <Check className="h-3 w-3" /> Transfer quickly
        </SceneButton>
        <SceneButton
          active={stirred}
          disabled={phase !== 'mixed'}
          onClick={() => {
            setStirred(true);
            onFlag('stirred');
          }}
        >
          <Wind className="h-3 w-3" /> Stir mixture
        </SceneButton>
        <SceneButton
          tone="primary"
          disabled={phase !== 'mixed'}
          onClick={() =>
            onRecord({
              trial: '1',
              massWater: waterReading.mass.toFixed(1),
              waterTemp: waterReading.temp.toFixed(1),
              final: finalReading.toFixed(1),
              massMetal: metalMass.toFixed(1),
            })
          }
        >
          Record temperatures
        </SceneButton>
      </ControlBar>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <Readout label="Water (initial)" value={waterReading.temp.toFixed(1)} unit="°C" size="sm" />
        <Readout label="Metal (initial)" value="100.0" unit="°C" size="sm" tone="amber" />
        <Readout label="Mixture (final)" value={phase === 'mixed' ? finalReading.toFixed(1) : '—'} unit="°C" size="sm" tone={phase === 'mixed' ? 'jade' : 'ink'} />
      </div>
      <div className="mt-2">
        <SceneHint>
          Transfer the metal quickly and stir. The highest steady temperature is the final
          temperature; heat lost to the room makes your specific heat slightly low.
        </SceneHint>
      </div>
    </div>
  );
}

function ReadoutInline({
  x,
  y,
  label,
  value,
  unit,
  tone = '#0d2b24',
}: {
  x: number;
  y: number;
  label: string;
  value: string;
  unit: string;
  tone?: string;
}) {
  return (
    <g>
      <rect x={x} y={y} width="126" height="46" rx="8" fill={tone} opacity="0.95" />
      <text x={x + 9} y={y + 14} fill="#a7f3d0" style={{ fontSize: 7, fontWeight: 700, letterSpacing: 0.8 }}>
        {label.toUpperCase()}
      </text>
      <text x={x + 9} y={y + 33} fill="#ecfdf5" style={{ fontSize: 14, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 600 }}>
        {value}
        <tspan style={{ fontSize: 8 }} fill="#6ee7b7"> {unit}</tspan>
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Cooling curve
// ---------------------------------------------------------------------------

export function CoolingScene({ attempt, scenario, onRecord, onFlag }: SceneProps) {
  const times = scenario.timesMin as number[];
  const [time, setTime] = useState(0);
  const [roomRecorded, setRoomRecorded] = useState(false);

  const temp = coolingTemperature(
    scenario.initialTempC as number,
    scenario.roomTempC as number,
    scenario.kPerMinute as number,
    time,
  );
  const measuredTemp = useMemo(
    () =>
      measure(temp, 'thermometer', {
        random: createRng(hashSeed(attempt.seed, 'cooling', time)).next,
      }),
    [attempt.seed, temp, time],
  );

  return (
    <div>
      <Stage caption="Hot water cooling in a calorimeter with a thermometer">
        <svg viewBox="0 0 560 320" className="w-full" role="img" aria-label="Cooling calorimeter with thermometer">
          <rect x="0" y="286" width="560" height="34" fill="#ded3b9" />
          <g transform="translate(150 90)">
            <rect x="0" y="60" width="190" height="128" rx="10" fill="#e7e5e4" stroke="#78716c" strokeWidth="2" />
            <rect x="12" y="92" width="166" height="86" rx="5" fill="#fca5a5" opacity="0.55" />
            <rect x="-8" y="50" width="206" height="14" rx="6" fill="#d6d3d1" stroke="#78716c" />
            <line x1="95" y1="20" x2="95" y2="150" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
            <rect x="83" y="12" width="24" height="26" rx="8" fill="#f5f5f4" stroke="#78716c" />
            <rect x="91" y="32" width="8" height="62" fill="#ef4444" opacity="0.75" />
            <text x="95" y="112" textAnchor="middle" fill="#7f1d1d" style={{ fontSize: 9, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 700 }}>
              {measuredTemp.toFixed(1)} °C
            </text>
          </g>

          <g transform="translate(400 90)">
            <circle r="52" fill="#fafaf9" stroke="#78716c" strokeWidth="3" />
            {Array.from({ length: 12 }, (_, i) => {
              const angle = (i / 12) * Math.PI * 2;
              return (
                <line
                  key={i}
                  x1={Math.cos(angle) * 42}
                  y1={Math.sin(angle) * 42}
                  x2={Math.cos(angle) * 48}
                  y2={Math.sin(angle) * 48}
                  stroke="#a8a29e"
                  strokeWidth="1.4"
                />
              );
            })}
            <line x1="0" y1="0" x2={Math.cos((time / 12) * Math.PI * 2 - Math.PI / 2) * 34} y2={Math.sin((time / 12) * Math.PI * 2 - Math.PI / 2) * 34} stroke="#b91c1c" strokeWidth="2.5" strokeLinecap="round" />
            <circle r="4" fill="#57534e" />
            <text y="66" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 8 }}>
              t = {time.toFixed(0)} min
            </text>
          </g>

          <text x="344" y="232" className="fill-ink-500" style={{ fontSize: 8 }}>
            room = {roomRecorded ? `${(scenario.roomTempC as number).toFixed(0)} °C` : '—'} 
          </text>
        </svg>
      </Stage>

      <ControlBar>
        <SceneButton
          active={roomRecorded}
          onClick={() => {
            setRoomRecorded(true);
            onFlag('room-recorded');
          }}
        >
          <Snowflake className="h-3 w-3" /> Record room temp
        </SceneButton>
        <SceneButton
          tone="primary"
          onClick={() => {
            onRecord({ time: time.toFixed(0), temp: measuredTemp.toFixed(1) });
            if (times.filter((t) => t <= time).length >= 5) onFlag('regular-intervals');
          }}
        >
          <Thermometer className="h-3 w-3" /> Record at t = {time.toFixed(0)} min
        </SceneButton>
        <span className="ml-auto font-mono text-[10px] font-semibold text-ink-500">
          {roomRecorded ? `θ = ${(measuredTemp - (scenario.roomTempC as number)).toFixed(1)} °C` : 'record room temperature first'}
        </span>
      </ControlBar>

      <div className="mt-2 rounded-xl border border-ink-100 bg-white p-2.5">
        <Slider label="Elapsed time" min={0} max={12} step={2} value={time} unit="min" onChange={setTime} format={(value) => value.toFixed(0)} />
      </div>
      <div className="mt-2">
        <SceneHint>
          Read the temperature at each prescribed time. Subtract the room temperature, take the
          natural log, then plot ln θ against t.
        </SceneHint>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boyle's law
// ---------------------------------------------------------------------------

export function GasScene({ attempt, scenario, onRecord, onFlag }: SceneProps) {
  const volumes = scenario.volumesCm3 as number[];
  const [index, setIndex] = useState(2);
  const [settled, setSettled] = useState(false);
  const volume = volumes[index] ?? 30;
  const pressure = ((scenario.initialPressureKPa as number) * (scenario.initialVolumeCm3 as number)) / volume;

  const measuredPressure = useMemo(
    () =>
      measure(pressure, pressureGauge, {
        random: createRng(hashSeed(attempt.seed, 'gas', volume)).next,
      }),
    [attempt.seed, pressure, volume],
  );

  const pistonY = 90 + (volume / 60) * 120;

  return (
    <div>
      <Stage caption="Sealed syringe with pressure gauge">
        <svg viewBox="0 0 560 320" className="w-full" role="img" aria-label="Gas syringe and pressure gauge">
          <rect x="0" y="286" width="560" height="34" fill="#ded3b9" />
          <g transform="translate(120 30)">
            <rect x="40" y="40" width="120" height="220" rx="10" fill="#e0f2fe" fillOpacity="0.35" stroke="#94a3b8" strokeWidth="2" />
            <rect x="46" y={pistonY} width="108" height="12" rx="3" fill="#64748b" style={{ transition: 'y 400ms ease' }} />
            <rect x="88" y={pistonY + 8} width="24" height={260 - pistonY} rx="4" fill="#94a3b8" style={{ transition: 'all 400ms ease' }} />
            <rect x="76" y={pistonY + 26} width="48" height="14" rx="6" fill="#475569" />
            <text x="100" y="284" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 8 }}>
              trapped gas
            </text>
            {Array.from({ length: 7 }, (_, i) => (
              <g key={i}>
                <line x1="160" y1={60 + i * 32} x2="174" y2={60 + i * 32} stroke="#64748b" />
                <text x="180" y={64 + i * 32} className="fill-ink-400" style={{ fontSize: 7 }}>
                  {(10 + i * 10)} cm³
                </text>
              </g>
            ))}
          </g>

          <g transform="translate(400 100)">
            <circle r="60" fill="#fafaf9" stroke="#334155" strokeWidth="3" />
            {Array.from({ length: 11 }, (_, i) => {
              const angle = Math.PI + (i / 10) * Math.PI;
              return (
                <line key={i} x1={Math.cos(angle) * 48} y1={Math.sin(angle) * 48} x2={Math.cos(angle) * 56} y2={Math.sin(angle) * 56} stroke="#78716c" />
              );
            })}
            <line
              x1="0"
              y1="0"
              x2={Math.cos(Math.PI + Math.min(0.95, pressure / 260) * Math.PI) * 42}
              y2={Math.sin(Math.PI + Math.min(0.95, pressure / 260) * Math.PI) * 42}
              stroke="#b91c1c"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle r="5" fill="#57534e" />
            <text y="82" textAnchor="middle" fill="#1f2937" style={{ fontSize: 12, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 700 }}>
              {pressure.toFixed(1)} kPa
            </text>
            <text y="95" textAnchor="middle" className="fill-ink-400" style={{ fontSize: 7 }}>
              pressure gauge
            </text>
          </g>

          <text x="262" y="270" className="fill-ink-500" style={{ fontSize: 8.5 }}>
            V = {volume} cm³
          </text>
        </svg>
      </Stage>

      <ControlBar>
        {volumes.map((option: number, optionIndex: number) => (
          <SceneButton
            key={option}
            active={index === optionIndex}
            onClick={() => {
              setIndex(optionIndex);
              setSettled(false);
              onFlag('sealed');
            }}
          >
            {option} cm³
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          active={settled}
          onClick={() => {
            setSettled(true);
            onFlag('compressed-slowly');
          }}
        >
          <Check className="h-3 w-3" /> Let it settle
        </SceneButton>
        <SceneButton
          tone="primary"
          disabled={!settled}
          onClick={() =>
            onRecord({
              volume: String(volume),
              pressure: measuredPressure.toFixed(1),
            })
          }
        >
          Record V and P
        </SceneButton>
      </ControlBar>

      <div className="mt-2 flex items-center gap-2">
        <Readout label="Gauge reading" value={measuredPressure.toFixed(1)} unit="kPa" tone="ink" size="sm" />
        <SceneHint>
          Compress in steps and let the temperature settle before reading the gauge. Then plot P
          against 1/V.
        </SceneHint>
      </div>
    </div>
  );
}
