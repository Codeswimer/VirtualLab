import { useMemo, useState } from 'react';
import { Droplets, Scale } from 'lucide-react';
import { createRng, hashSeed } from '@sim/rng';
import { measure } from '@sim/measurement';
import {
  coefficientFromAngle,
  limitingAngleDeg,
  netMoment,
  resultant,
} from '@sim/physics/mechanics';
import { ControlBar, Readout, SceneButton, SceneHint, Slider, Stage } from './kit';
import type { SceneProps } from './types';


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
      <rect x={x} y={y} width="128" height="48" rx="8" fill={tone} opacity="0.95" />
      <text x={x + 10} y={y + 15} fill="#a7f3d0" style={{ fontSize: 7.5, fontWeight: 700, letterSpacing: 1 }}>
        {label.toUpperCase()}
      </text>
      <text
        x={x + 10}
        y={y + 34}
        fill="#ecfdf5"
        style={{ fontSize: 16, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 600 }}
      >
        {value}
        <tspan style={{ fontSize: 8 }} fill="#6ee7b7"> {unit}</tspan>
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Principle of moments
// ---------------------------------------------------------------------------

export function MomentsScene({ scenario, onRecord, onFlag }: SceneProps) {
  const pivots: number[] = scenario.pivotsCm;
  const [pivotIndex, setPivotIndex] = useState(0);
  const [position, setPosition] = useState(20);
  const [bareBalanced, setBareBalanced] = useState(false);

  const pivot = pivots[pivotIndex] ?? 30;
  const moment = netMoment({
    ruleMassG: scenario.ruleMassG,
    cgCm: scenario.cgCm,
    pivotCm: pivot,
    massG: scenario.massG,
    massPositionCm: position,
  });
  const balanced = Math.abs(moment) <= 0.6;
  const tilt = Math.max(-4, Math.min(4, moment / 220));

  const x = (cm: number): number => 46 + (cm / 100) * 468;

  return (
    <div>
      <Stage caption="Metre rule on a knife-edge with a 50 g mass">
        <svg viewBox="0 0 560 300" className="w-full" role="img" aria-label="Metre rule balanced on a pivot">
          <defs>
            <linearGradient id="rule-wood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f8efd8" />
              <stop offset="0.5" stopColor="#e7d4ab" />
              <stop offset="1" stopColor="#ceb787" />
            </linearGradient>
            <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fde68a" />
              <stop offset="1" stopColor="#b45309" />
            </linearGradient>
          </defs>
          <rect x="0" y="252" width="560" height="48" fill="#d7c9a7" />
          <rect x="0" y="248" width="560" height="6" fill="#eadfc4" />

          {/* Pivot stand */}
          <path d={`M ${x(pivot) - 22} 248 L ${x(pivot)} 168 L ${x(pivot) + 22} 248 Z`} fill="#4b5563" />
          <rect x={x(pivot) - 5} y="236" width="10" height="16" fill="#374151" />

          <g transform={`rotate(${tilt} ${x(pivot)} 150)`}>
            <rect x="42" y="136" width="476" height="18" rx="2" fill="url(#rule-wood)" stroke="#a98f5c" />
            {Array.from({ length: 21 }, (_, i) => {
              const cm = i * 5;
              return (
                <g key={cm}>
                  <line
                    x1={x(cm)}
                    y1="136"
                    x2={x(cm)}
                    y2={i % 2 === 0 ? 148 : 144}
                    stroke="#7c6a45"
                    strokeWidth="0.9"
                  />
                  {i % 2 === 0 ? (
                    <text
                      x={x(cm)}
                      y={132}
                      textAnchor="middle"
                      className="fill-ink-500"
                      style={{ fontSize: 7.5, fontFamily: 'JetBrains Mono Variable, monospace' }}
                    >
                      {cm}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {/* Hanging mass */}
            <g>
              <line x1={x(position)} y1="154" x2={x(position)} y2="180" stroke="#6b7280" strokeWidth="1.4" />
              <rect x={x(position) - 17} y="180" width="34" height="30" rx="4" fill="url(#brass)" stroke="#92400e" />
              <text x={x(position)} y="199" textAnchor="middle" fill="#3f2404" style={{ fontSize: 8.5, fontWeight: 700 }}>
                50 g
              </text>
            </g>
          </g>

          <g>
            <line x1={x(pivot)} y1="150" x2={x(pivot)} y2="118" stroke="#b91c1c" strokeWidth="1.5" strokeDasharray="3 2" />
            <text x={x(pivot)} y="112" textAnchor="middle" fill="#b91c1c" style={{ fontSize: 8.5, fontWeight: 700 }}>
              pivot {pivot.toFixed(1)} cm
            </text>
          </g>

          <ReadoutInline
            x={382}
            y={34}
            label="Balance"
            value={balanced ? 'LEVEL' : moment > 0 ? 'TIPS RIGHT' : 'TIPS LEFT'}
            unit=""
            tone={balanced ? '#0d2b24' : '#3b1d0b'}
          />
          {bareBalanced ? (
            <ReadoutInline x={382} y={92} label="Rule CG" value={scenario.cgCm.toFixed(1)} unit="cm" tone="#1f2937" />
          ) : null}
        </svg>
      </Stage>

      <ControlBar>
        {pivots.map((option, index) => (
          <SceneButton key={option} active={pivotIndex === index} onClick={() => setPivotIndex(index)}>
            Pivot {option.toFixed(1)} cm
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          active={bareBalanced}
          onClick={() => {
            setBareBalanced(true);
            onFlag('cg-found');
          }}
        >
          <Scale className="h-3 w-3" /> Balance bare rule
        </SceneButton>
      </ControlBar>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-ink-100 bg-white p-2.5">
          <Slider
            label="Position of 50 g mass"
            min={1}
            max={99}
            step={0.1}
            value={position}
            unit="cm"
            onChange={setPosition}
            format={(value) => value.toFixed(1)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Readout
            label="Net moment"
            value={(Math.abs(moment) / 1000).toFixed(2)}
            unit="N·m"
            tone={balanced ? 'jade' : 'amber'}
            size="sm"
          />
          <SceneButton
            tone="primary"
            disabled={!balanced}
            onClick={() => {
              onRecord({
                pivot: pivot.toFixed(1),
                position: position.toFixed(1),
                distance: (position - pivot).toFixed(1),
              });
              onFlag('balanced');
            }}
          >
            Record balance
          </SceneButton>
        </div>
      </div>
      <div className="mt-2">
        <SceneHint tone={balanced ? 'jade' : 'neutral'}>
          {balanced
            ? 'The rule is level. Record the pivot and mass positions.'
            : 'Slide the mass until the rule is level. Balance the bare rule first to locate its centre of gravity.'}
        </SceneHint>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Density / upthrust
// ---------------------------------------------------------------------------

export function DisplacementScene({ attempt, scenario, onRecord, onFlag }: SceneProps) {
  const samples = scenario.samples as { name: string; massG: number; densityGcm3: number; material: string }[];
  const [index, setIndex] = useState(0);
  const [submerged, setSubmerged] = useState(false);
  const sample = samples[index] ?? samples[0];

  const readings = useMemo(() => {
    if (!sample) return { air: 0, water: 0 };
    const rng = createRng(hashSeed(attempt.seed, 'density', sample.name));
    const air = measure(sample.massG, 'balance', { random: rng.next });
    const apparent = sample.massG * (1 - 1 / sample.densityGcm3);
    const water = measure(apparent, 'balance', { random: rng.next });
    return { air, water };
  }, [attempt.seed, sample]);

  if (!sample) return null;
  const displacedVolume = sample.massG / sample.densityGcm3;

  return (
    <div>
      <Stage caption="Spring balance, beaker of water and metal samples">
        <svg viewBox="0 0 560 320" className="w-full" role="img" aria-label="Metal sample weighed in air and in water">
          <defs>
            <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#7dd3fc" stopOpacity="0.85" />
              <stop offset="1" stopColor="#0284c7" stopOpacity="0.9" />
            </linearGradient>
            <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e2e8f0" />
              <stop offset="0.5" stopColor="#94a3b8" />
              <stop offset="1" stopColor="#475569" />
            </linearGradient>
          </defs>
          <rect x="0" y="286" width="560" height="34" fill="#d7c9a7" />

          {/* Balance */}
          <rect x="170" y="20" width="90" height="34" rx="6" fill="#1f2937" />
          <rect x="178" y="27" width="74" height="20" rx="3" fill="#0b1f19" />
          <text x="215" y="41" textAnchor="middle" fill="#6ee7b7" style={{ fontSize: 11, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 600 }}>
            {submerged ? readings.water.toFixed(1) : readings.air.toFixed(1)} g
          </text>
          <line x1="215" y1="54" x2="215" y2={submerged ? 170 : 130} stroke="#4b5563" strokeWidth="1.5" />

          {/* Beaker */}
          <g>
            <path d="M120 186 L400 186 L386 284 Q260 292 134 284 Z" fill="#e2e8f0" fillOpacity="0.35" stroke="#94a3b8" strokeWidth="2" />
            <path
              d={`M128 218 L392 218 L381 282 Q260 290 139 282 Z`}
              fill="url(#water)"
              opacity="0.85"
            />
            <ellipse cx="260" cy="218" rx="132" ry="9" fill="#7dd3fc" opacity="0.7" />
            {submerged ? (
              <text x="252" y="272" fill="#e0f2fe" style={{ fontSize: 8, fontWeight: 600 }}>
                water displaced: {displacedVolume.toFixed(1)} cm³
              </text>
            ) : null}
          </g>

          {/* Sample */}
          <g transform={submerged ? 'translate(0 52)' : 'translate(0 0)'} style={{ transition: 'transform 700ms ease' }}>
            <line x1="215" y1={submerged ? 118 : 130} x2="215" y2={submerged ? 158 : 150} stroke="#6b7280" strokeWidth="1.2" />
            <rect x="197" y={submerged ? 158 : 150} width="36" height="30" rx="4" fill="url(#metal)" stroke="#475569" />
            <text x="255" y={submerged ? 178 : 170} className="fill-ink-600" style={{ fontSize: 9, fontWeight: 700 }}>
              {sample.name}
            </text>
          </g>

          <text x="462" y="120" className="fill-ink-500" style={{ fontSize: 8.5 }}>Material</text>
          <text x="462" y="136" className="fill-ink-700" style={{ fontSize: 11, fontWeight: 700 }}>
            {submerged ? 'Unknown' : 'Unknown'}
          </text>
        </svg>
      </Stage>

      <ControlBar>
        {samples.map((option: { name: string }, optionIndex: number) => (
          <SceneButton key={option.name} active={index === optionIndex} onClick={() => setIndex(optionIndex)}>
            {option.name}
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          active={submerged}
          onClick={() => {
            setSubmerged((value) => !value);
            if (!submerged) onFlag('submerged');
          }}
        >
          <Droplets className="h-3 w-3" /> {submerged ? 'Lift out of water' : 'Lower into water'}
        </SceneButton>
        <SceneButton
          tone="primary"
          onClick={() =>
            onRecord({
              sample: sample.name,
              massAir: readings.air.toFixed(1),
              massWater: readings.water.toFixed(1),
              upthrust: (readings.air - readings.water).toFixed(1),
            })
          }
        >
          Record readings
        </SceneButton>
      </ControlBar>
      <div className="mt-2">
        <SceneHint>
          Weigh in air first, then fully immerse the sample without letting it touch the beaker. The
          loss in weight is the upthrust.
        </SceneHint>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Concurrent forces
// ---------------------------------------------------------------------------

export function ForcesScene({ scenario, onRecord, onFlag }: SceneProps) {
  const configurations = scenario.configurations as { f1: number; f2: number; angleDeg: number }[];
  const [index, setIndex] = useState(0);
  const [thirdMagnitude, setThirdMagnitude] = useState(6);
  const [thirdAngle, setThirdAngle] = useState(250);
  const config = configurations[index] ?? configurations[0];
  if (!config) return null;

  const trueResultant = resultant([
    { magnitudeN: config.f1, angleDeg: 0 },
    { magnitudeN: config.f2, angleDeg: config.angleDeg },
  ]);
  const equilibrantAngle = (trueResultant.angleDeg + 180) % 360;
  const magnitudeError = Math.abs(thirdMagnitude - trueResultant.magnitudeN);
  const angleError = Math.min(
    Math.abs(thirdAngle - equilibrantAngle),
    360 - Math.abs(thirdAngle - equilibrantAngle),
  );
  const balanced = magnitudeError < 0.4 && angleError < 6;
  const offset = Math.min(16, magnitudeError * 4 + angleError * 0.3);

  const cx = 280;
  const cy = 168;
  const arrowLength = (force: number): number => 34 + force * 9;
  const endpoint = (angle: number, length: number): { x: number; y: number } => ({
    x: cx + length * Math.cos((angle * Math.PI) / 180),
    y: cy - length * Math.sin((angle * Math.PI) / 180),
  });

  return (
    <div>
      <Stage caption="Force board with three spring balances and a ring">
        <svg viewBox="0 0 560 320" className="w-full" role="img" aria-label="Force board showing three concurrent forces">
          <rect x="58" y="20" width="444" height="266" rx="10" fill="#fbf8ef" stroke="#d6cbb2" />
          {[80, 130, 180, 230].map((radius) => (
            <circle key={radius} cx={cx} cy={cy} r={radius * 0.8} fill="none" stroke="#e7dfcd" strokeDasharray="3 4" />
          ))}
          <g transform={`translate(${offset} ${offset * 0.4})`}>
            <circle cx={cx} cy={cy} r="14" fill="#fef3c7" stroke="#b45309" strokeWidth="1.6" />
          </g>

          {[
            { force: config.f1, angle: 0, colour: '#0e7490' },
            { force: config.f2, angle: config.angleDeg, colour: '#7c3aed' },
            { force: thirdMagnitude, angle: thirdAngle, colour: '#b45309' },
          ].map((arrow, i) => {
            const end = endpoint(arrow.angle, arrowLength(arrow.force));
            return (
              <g key={i}>
                <line x1={cx} y1={cy} x2={end.x} y2={end.y} stroke={arrow.colour} strokeWidth="3" />
                <circle cx={end.x} cy={end.y} r="5" fill={arrow.colour} />
                <text
                  x={end.x + (end.x > cx ? 8 : -8)}
                  y={end.y + (end.y > cy ? 14 : -8)}
                  textAnchor={end.x > cx ? 'start' : 'end'}
                  fill={arrow.colour}
                  style={{ fontSize: 9, fontWeight: 700, fontFamily: 'JetBrains Mono Variable, monospace' }}
                >
                  {arrow.force.toFixed(1)} N
                </text>
              </g>
            );
          })}

          <text x={cx} y={cy - 22} textAnchor="middle" className="fill-ink-500" style={{ fontSize: 8 }}>
            {balanced ? 'RING CENTRED' : 'ring off-centre'}
          </text>
          <text x={cx} y={302} textAnchor="middle" className="fill-ink-400" style={{ fontSize: 8.5 }}>
            angle between F₁ and F₂ = {config.angleDeg}°
          </text>
        </svg>
      </Stage>

      <ControlBar>
        {configurations.map((option, optionIndex) => (
          <SceneButton key={option.angleDeg} active={index === optionIndex} onClick={() => setIndex(optionIndex)}>
            {option.angleDeg}°
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          tone="primary"
          onClick={() => {
            onRecord({
              angle: String(config.angleDeg),
              f1: config.f1.toFixed(1),
              f2: config.f2.toFixed(1),
              resultant: thirdMagnitude.toFixed(1),
            });
            onFlag('angles-measured');
            if (balanced) onFlag('equilibrant-found');
          }}
        >
          Record equilibrant
        </SceneButton>
      </ControlBar>

      <div className="mt-2 grid gap-2 rounded-xl border border-ink-100 bg-white p-2.5 sm:grid-cols-2">
        <Slider label="Third balance reading" min={1} max={12} step={0.1} value={thirdMagnitude} unit="N" onChange={setThirdMagnitude} format={(v) => v.toFixed(1)} />
        <Slider label="Direction of third force" min={0} max={359} step={1} value={thirdAngle} unit="°" onChange={setThirdAngle} />
      </div>
      <div className="mt-2">
        <SceneHint tone={balanced ? 'jade' : 'neutral'}>
          {balanced
            ? 'The ring is centred: the third force balances the resultant.'
            : 'Adjust the third balance until the ring sits at the centre mark, then record its reading and direction.'}
        </SceneHint>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inclined plane
// ---------------------------------------------------------------------------

export function InclineScene({ scenario, onRecord, onFlag }: SceneProps) {
  const surfaces = scenario.surfaces as { name: string; mu: number }[];
  const [index, setIndex] = useState(0);
  const [angle, setAngle] = useState(5);
  const surface = surfaces[index] ?? surfaces[0];
  if (!surface) return null;

  const limit = limitingAngleDeg(surface.mu);
  const sliding = angle >= limit - 0.35;
  const angleRad = (angle * Math.PI) / 180;
  const planeLength = 320;
  const baseX = 92;
  const baseY = 268;
  const topX = baseX + planeLength * Math.cos(angleRad);
  const topY = baseY - planeLength * Math.sin(angleRad);
  const blockT = sliding ? 0.72 : 0.34;
  const blockX = baseX + planeLength * blockT * Math.cos(angleRad);
  const blockY = baseY - planeLength * blockT * Math.sin(angleRad);

  return (
    <div>
      <Stage caption="Inclined plane with protractor and wooden block">
        <svg viewBox="0 0 560 320" className="w-full" role="img" aria-label="Block on an inclined plane">
          <rect x="0" y="288" width="560" height="32" fill="#d9cbaa" />
          <path d={`M ${baseX} ${baseY} L ${topX} ${topY} L ${baseX} ${topY + 6} Z`} fill="#e5d4ae" stroke="#a98f5c" />
          <line x1={baseX} y1={baseY} x2={baseX + planeLength} y2={baseY} stroke="#b8a67f" strokeWidth="2" />

          <g transform={`rotate(${-angle} ${blockX} ${blockY}) translate(${blockX - 22} ${blockY - 34})`} style={{ transition: 'transform 300ms ease' }}>
            <rect x="0" y="0" width="48" height="30" rx="3" fill="#c99a5b" stroke="#7c5a2b" />
            <rect x="6" y="8" width="36" height="4" rx="2" fill="#a97a3e" />
            <rect x="6" y="17" width="36" height="4" rx="2" fill="#a97a3e" />
          </g>

          <path
            d={`M ${baseX + 90} ${baseY} A 90 90 0 0 0 ${baseX + 90 * Math.cos(angleRad)} ${baseY - 90 * Math.sin(angleRad)}`}
            fill="none"
            stroke="#b45309"
            strokeWidth="1.4"
            strokeDasharray="3 3"
          />
          <text x={baseX + 104} y={baseY - 10} fill="#92400e" style={{ fontSize: 10, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 600 }}>
            θ = {angle.toFixed(0)}°
          </text>

          <text x={430} y={80} className="fill-ink-500" style={{ fontSize: 9 }}>Surface</text>
          <text x={430} y={98} className="fill-ink-800" style={{ fontSize: 12, fontWeight: 700 }}>{surface.name}</text>
          <rect x={430} y={116} width={96} height={44} rx="8" fill="#0d2b24" />
          <text x={442} y={131} fill="#6ee7b7" style={{ fontSize: 7, fontWeight: 700, letterSpacing: 1 }}>LIMITING ANGLE</text>
          <text x={442} y={150} fill="#ecfdf5" style={{ fontSize: 15, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 600 }}>
            {sliding ? `${limit.toFixed(0)}°` : '—'}
          </text>

          {sliding ? (
            <g>
              <path d={`M ${blockX - 30} ${blockY - 8} l 10 4 M ${blockX - 36} ${blockY - 18} l 10 4`} stroke="#b45309" strokeWidth="2" strokeLinecap="round" />
              <text x={blockX - 18} y={blockY - 44} fill="#b45309" style={{ fontSize: 9, fontWeight: 700 }}>
                sliding
              </text>
            </g>
          ) : null}
        </svg>
      </Stage>

      <ControlBar>
        {surfaces.map((option: { name: string }, optionIndex: number) => (
          <SceneButton
            key={option.name}
            active={index === optionIndex}
            onClick={() => {
              setIndex(optionIndex);
              setAngle(5);
            }}
          >
            {option.name}
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          tone="primary"
          disabled={!sliding}
          onClick={() => {
            onRecord({
              surface: surface.name,
              angle: angle.toFixed(0),
              coefficient: coefficientFromAngle(angle).toFixed(2),
            });
            onFlag('limiting-found');
          }}
        >
          Record critical angle
        </SceneButton>
      </ControlBar>

      <div className="mt-2 rounded-xl border border-ink-100 bg-white p-2.5">
        <Slider
          label="Incline angle"
          min={0}
          max={60}
          step={0.5}
          value={angle}
          unit="°"
          onChange={(value) => {
            setAngle(value);
            if (value >= limit - 0.35) onFlag('limiting-found');
          }}
        />
      </div>
      <div className="mt-2">
        <SceneHint tone={sliding ? 'jade' : 'neutral'}>
          {sliding
            ? 'The block just begins to slide. Record this angle before increasing it further.'
            : 'Raise the plane slowly. Stop at the angle where the block is just about to move.'}
        </SceneHint>
      </div>
    </div>
  );
}
