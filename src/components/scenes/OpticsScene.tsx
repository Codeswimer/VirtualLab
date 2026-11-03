import { useMemo, useState } from 'react';
import { Crosshair, Eye, Sun } from 'lucide-react';
import {
  angleOfRefraction,
  imageDistance,
  lateralDisplacementCm,
  minimumDeviation,
  prismDeviation,
} from '@sim/physics/optics';
import { measure } from '@sim/measurement';
import { createRng, hashSeed } from '@sim/rng';
import { ControlBar, Readout, SceneButton, SceneHint, Slider, Stage } from './kit';
import type { SceneProps } from './types';

export function OpticsScene(props: SceneProps) {
  const { experiment } = props;
  if (experiment.meta.code === 'PHY-08') return <RefractionScene {...props} />;
  if (experiment.meta.code === 'PHY-09') return <PrismScene {...props} />;
  return <LensScene {...props} />;
}

// ---------------------------------------------------------------------------
// Refraction block
// ---------------------------------------------------------------------------

function RefractionScene({ attempt, scenario, onRecord, onFlag }: SceneProps) {
  const incidences = scenario.incidences as number[];
  const [index, setIndex] = useState(0);
  const incidence = incidences[index] ?? 40;
  const refraction = angleOfRefraction(incidence, scenario.refractiveIndex);
  const measuredRefraction = useMemo(
    () =>
      measure(refraction, 'protractor', {
        random: createRng(hashSeed(attempt.seed, 'refraction', incidence)).next,
      }),
    [attempt.seed, incidence, refraction],
  );

  const entry = { x: 300, y: 158 };
  const rad = (value: number): number => (value * Math.PI) / 180;
  const incidentStart = {
    x: entry.x - 150 * Math.sin(rad(incidence)),
    y: entry.y - 150 * Math.cos(rad(incidence)),
  };
  const insideEnd = {
    x: entry.x + 128 * Math.sin(rad(refraction)),
    y: entry.y + 128 * Math.cos(rad(refraction)),
  };
  const exit = { x: insideEnd.x, y: 272 };
  const emergentEnd = {
    x: exit.x + 130 * Math.sin(rad(incidence)),
    y: exit.y + 130 * Math.cos(rad(incidence)),
  };
  const displacement = lateralDisplacementCm(incidence, 5, scenario.refractiveIndex);

  return (
    <div>
      <Stage caption="Glass block, ray box and protractor">
        <svg viewBox="0 0 560 330" className="w-full" role="img" aria-label="Ray of light refracted through a glass block">
          <defs>
            <linearGradient id="glass-block" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#bae6fd" stopOpacity="0.45" />
              <stop offset="1" stopColor="#38bdf8" stopOpacity="0.3" />
            </linearGradient>
            <radialGradient id="ray-glow">
              <stop offset="0" stopColor="#fef08a" stopOpacity="0.9" />
              <stop offset="1" stopColor="#fef08a" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect x="0" y="300" width="560" height="30" fill="#ded3b9" />
          <rect x="150" y="158" width="240" height="114" rx="3" fill="url(#glass-block)" stroke="#0284c7" strokeOpacity="0.5" strokeWidth="1.5" />
          <text x="270" y="152" textAnchor="middle" className="fill-sky-700" style={{ fontSize: 8, fontWeight: 700 }}>
            glass block (n unknown)
          </text>

          <rect x={entry.x - 72} y={entry.y - 132} width="144" height="132" fill="url(#ray-glow)" opacity="0.3" />
          <line x1={incidentStart.x} y1={incidentStart.y} x2={entry.x} y2={entry.y} stroke="#ef4444" strokeWidth="2.4" />
          <line x1={entry.x} y1={entry.y} x2={insideEnd.x} y2={insideEnd.y} stroke="#f59e0b" strokeWidth="2.4" strokeDasharray="6 3" />
          <line x1={insideEnd.x} y1={insideEnd.y} x2={exit.x} y2={exit.y} stroke="#f59e0b" strokeWidth="2.4" strokeDasharray="6 3" />
          <line x1={exit.x} y1={exit.y} x2={emergentEnd.x} y2={emergentEnd.y} stroke="#ef4444" strokeWidth="2.4" />
          <circle cx={entry.x} cy={entry.y} r="3.5" fill="#b91c1c" />

          <line x1={entry.x} y1={entry.y - 62} x2={entry.x} y2={entry.y + 68} stroke="#64748b" strokeDasharray="4 3" strokeWidth="1" />
          <text x={entry.x + 6} y={entry.y - 52} fill="#475569" style={{ fontSize: 7.5 }}>normal</text>
          <path d={`M ${entry.x} ${entry.y - 46} A 46 46 0 0 0 ${entry.x - 46 * Math.sin(rad(incidence))} ${entry.y - 46 * Math.cos(rad(incidence))}`} fill="none" stroke="#b91c1c" strokeWidth="1.2" />
          <text x={entry.x - 38} y={entry.y - 22} fill="#b91c1c" style={{ fontSize: 9, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 600 }}>
            i = {incidence}°
          </text>
          <path d={`M ${entry.x} ${entry.y + 44} A 44 44 0 0 1 ${entry.x + 44 * Math.sin(rad(refraction))} ${entry.y + 44 * Math.cos(rad(refraction))}`} fill="none" stroke="#b45309" strokeWidth="1.2" />
          <text x={entry.x + 30} y={entry.y + 70} fill="#92400e" style={{ fontSize: 9, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 600 }}>
            r
          </text>

          <line x1="440" y1={entry.y} x2="440" y2={exit.y} stroke="#94a3b8" strokeDasharray="3 3" />
          <text x="450" y={(entry.y + exit.y) / 2} fill="#475569" style={{ fontSize: 7.5 }}>
            t = 5.0 cm
          </text>
          <text x="20" y="318" className="fill-ink-400" style={{ fontSize: 8 }}>
            lateral displacement ≈ {displacement.toFixed(2)} cm
          </text>
        </svg>
      </Stage>

      <ControlBar>
        {incidences.map((option: number, optionIndex: number) => (
          <SceneButton key={option} active={index === optionIndex} onClick={() => setIndex(optionIndex)}>
            i = {option}°
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          tone="primary"
          onClick={() => {
            onRecord({
              incidence: String(incidence),
              refraction: measuredRefraction.toFixed(0),
              sinI: Math.sin(rad(incidence)).toFixed(3),
              sinR: Math.sin(rad(measuredRefraction)).toFixed(3),
            });
            onFlag('angles-from-normal');
            onFlag('pins-aligned');
          }}
        >
          <Crosshair className="h-3 w-3" /> Record angles
        </SceneButton>
      </ControlBar>
      <div className="mt-2 flex items-center gap-2">
        <Readout label="Protractor" value={measuredRefraction.toFixed(0)} unit="°" tone="ink" size="sm" />
        <SceneHint>
          Read r from the protractor arc (measured from the normal), then compute sin i and sin r.
          Plot sin i against sin r.
        </SceneHint>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Prism
// ---------------------------------------------------------------------------

function PrismScene({ attempt, scenario, onRecord, onFlag }: SceneProps) {
  const incidences = scenario.incidences as number[];
  const [index, setIndex] = useState(0);
  const incidence = incidences[index] ?? 45;
  const apex = scenario.apexAngleDeg as number;
  const deviation = prismDeviation(incidence, apex, scenario.refractiveIndex);
  const measuredDeviation = measure(deviation, 'protractor', {
    random: createRng(hashSeed(attempt.seed, 'prism', incidence)).next,
  });
  const bestPossible = minimumDeviation(apex, scenario.refractiveIndex);
  const nearMinimum = Math.abs(deviation - bestPossible) < 0.8;

  const rad = (value: number): number => (value * Math.PI) / 180;
  const apexPoint = { x: 280, y: 92 };
  const leftBase = { x: 170, y: 262 };
  const rightBase = { x: 390, y: 262 };
  const entry = { x: 220, y: 185 };
  const inAngle = rad(incidence);
  const rayStart = { x: entry.x - 140 * Math.cos(inAngle), y: entry.y + 140 * Math.sin(inAngle) };
  const insideEnd = { x: entry.x + 96, y: entry.y + 44 };
  const exit = { x: 336, y: 214 };
  const outAngle = rad(incidence + deviation - 40);
  const rayEnd = { x: exit.x + 120 * Math.cos(outAngle), y: exit.y + 120 * Math.sin(outAngle) };

  return (
    <div>
      <Stage caption="Glass prism on paper with a ray box">
        <svg viewBox="0 0 560 330" className="w-full" role="img" aria-label="Ray deviated through a triangular prism">
          <defs>
            <linearGradient id="prism-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#e0f2fe" stopOpacity="0.75" />
              <stop offset="1" stopColor="#7dd3fc" stopOpacity="0.45" />
            </linearGradient>
          </defs>
          <rect x="0" y="300" width="560" height="30" fill="#ded3b9" />
          <path d={`M ${apexPoint.x} ${apexPoint.y} L ${rightBase.x} ${rightBase.y} L ${leftBase.x} ${leftBase.y} Z`} fill="url(#prism-glass)" stroke="#0284c7" strokeOpacity="0.6" strokeWidth="1.5" />
          <text x="280" y="282" textAnchor="middle" className="fill-sky-700" style={{ fontSize: 8.5, fontWeight: 700 }}>
            60° prism
          </text>

          <line x1={rayStart.x} y1={rayStart.y} x2={entry.x} y2={entry.y} stroke="#ef4444" strokeWidth="2.4" />
          <line x1={entry.x} y1={entry.y} x2={insideEnd.x} y2={insideEnd.y} stroke="#f59e0b" strokeWidth="2.2" strokeDasharray="5 3" />
          <line x1={insideEnd.x} y1={insideEnd.y} x2={exit.x} y2={exit.y} stroke="#f59e0b" strokeWidth="2.2" strokeDasharray="5 3" />
          <line x1={exit.x} y1={exit.y} x2={rayEnd.x} y2={rayEnd.y} stroke="#ef4444" strokeWidth="2.4" />
          <circle cx={entry.x} cy={entry.y} r="3" fill="#b91c1c" />

          <line x1={rayStart.x} y1={rayStart.y} x2={rayStart.x + 300} y2={rayStart.y} stroke="#94a3b8" strokeDasharray="5 3" opacity="0.7" />
          <path d={`M ${rayStart.x + 90} ${rayStart.y} A 90 90 0 0 1 ${rayStart.x + 90 * Math.cos(rad(20))} ${rayStart.y + 90 * Math.sin(rad(20))}`} fill="none" stroke="#92400e" strokeWidth="1.3" />
          <text x={rayStart.x + 96} y={rayStart.y + 44} fill="#92400e" style={{ fontSize: 9, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 600 }}>
            D
          </text>

          <ReadoutInline x={396} y={78} label="Deviation D" value={`${measuredDeviation.toFixed(1)}°`} unit="" />
          <ReadoutInline x={396} y={140} label="Incidence i" value={`${incidence}°`} unit="" tone="#1f2937" />
        </svg>
      </Stage>

      <ControlBar>
        {incidences.map((option: number, optionIndex: number) => (
          <SceneButton key={option} active={index === optionIndex} onClick={() => setIndex(optionIndex)}>
            i = {option}°
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          tone="primary"
          onClick={() => {
            onRecord({ incidence: String(incidence), deviation: measuredDeviation.toFixed(1) });
            if (nearMinimum) onFlag('min-deviation-found');
          }}
        >
          <Sun className="h-3 w-3" /> Record deviation
        </SceneButton>
      </ControlBar>

      <div className="mt-2">
        <SceneHint tone={nearMinimum ? 'jade' : 'neutral'}>
          {nearMinimum
            ? 'This is close to minimum deviation — record it and use it in n = sin[(A + Dm)/2]/sin(A/2).'
            : 'Rotate the prism through the incidence angles. The smallest deviation in your table is Dm.'}
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
      <rect x={x} y={y} width="120" height="46" rx="8" fill={tone} opacity="0.95" />
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
// Converging lens
// ---------------------------------------------------------------------------

function LensScene({ attempt, scenario, onRecord, onFlag }: SceneProps) {
  const distances = scenario.objectDistancesCm as number[];
  const [index, setIndex] = useState(0);
  const [screen, setScreen] = useState(30);
  const u = distances[index] ?? 30;
  const v = imageDistance(u, scenario.focalLengthCm);
  const focused = Math.abs(screen - v) <= 0.8;
  const measuredV = measure(v, 'metreRule', {
    random: createRng(hashSeed(attempt.seed, 'lens', u)).next,
  });

  const lensX = 300;
  const scale = 3.4;
  const objectX = lensX - u * scale * 0.85;
  const screenX = Math.max(lensX + 30, lensX + screen * scale * 0.55);
  const imageHeight = Math.min(90, (v / u) * 44);

  return (
    <div>
      <Stage caption="Optical bench: object, converging lens and screen">
        <svg viewBox="0 0 560 330" className="w-full" role="img" aria-label="Converging lens forming an image on a screen">
          <defs>
            <linearGradient id="lens-glass" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#bae6fd" stopOpacity="0.5" />
              <stop offset="0.5" stopColor="#e0f2fe" stopOpacity="0.85" />
              <stop offset="1" stopColor="#7dd3fc" stopOpacity="0.5" />
            </linearGradient>
          </defs>
          <rect x="0" y="246" width="560" height="84" fill="#ded3b9" />
          {/* Bench rule */}
          <rect x="24" y="240" width="512" height="12" rx="2" fill="#fdf6e3" stroke="#cbb88a" />
          {Array.from({ length: 26 }, (_, i) => (
            <g key={i}>
              <line x1={30 + i * 19.6} y1="240" x2={30 + i * 19.6} y2={i % 5 === 0 ? 250 : 246} stroke="#7c6a45" />
              {i % 5 === 0 ? (
                <text x={30 + i * 19.6} y="236" textAnchor="middle" fill="#7c6a45" style={{ fontSize: 6.5 }}>
                  {i * 5}
                </text>
              ) : null}
            </g>
          ))}

          {/* Object */}
          <g>
            <rect x={objectX - 12} y="170" width="24" height="70" rx="2" fill="#334155" />
            <line x1={objectX} y1="240" x2={objectX} y2="196" stroke="#f59e0b" strokeWidth="3" />
            <path d={`M ${objectX} 196 l -5 9 l 10 0 Z`} fill="#f59e0b" />
            <text x={objectX} y="160" textAnchor="middle" fill="#475569" style={{ fontSize: 8, fontWeight: 700 }}>
              object
            </text>
          </g>

          {/* Lens */}
          <g>
            <path d={`M ${lensX} 118 Q ${lensX + 32} 180 ${lensX} 242 Q ${lensX - 32} 180 ${lensX} 118 Z`} fill="url(#lens-glass)" stroke="#0284c7" strokeOpacity="0.7" strokeWidth="1.6" />
            <line x1={lensX} y1="106" x2={lensX} y2="252" stroke="#0369a1" strokeDasharray="3 3" opacity="0.5" />
            <text x={lensX} y="98" textAnchor="middle" fill="#0369a1" style={{ fontSize: 8, fontWeight: 700 }}>
              lens
            </text>
          </g>

          {/* Rays */}
          <g opacity="0.9">
            <line x1={objectX} y1="196" x2={lensX} y2="150" stroke="#ef4444" strokeWidth="1.5" />
            <line x1={lensX} y1="150" x2={Math.min(screenX, 545)} y2={150 + ((Math.min(screenX, 545) - lensX) / Math.max(1, v * scale * 0.55)) * (imageHeight - 40)} stroke="#ef4444" strokeWidth="1.5" />
            <line x1={objectX} y1="196" x2={lensX} y2="196" stroke="#ef4444" strokeWidth="1.5" opacity="0.55" />
          </g>

          {/* Screen */}
          <g transform={`translate(${screenX} 0)`}>
            <rect x="-4" y="148" width="8" height="96" fill="#d6d3d1" stroke="#78716c" />
            <rect x="-30" y="150" width="60" height="90" rx="2" fill="#f5f5f4" stroke="#a8a29e" />
            {focused ? (
              <g>
                <line x1="0" y1="196" x2="0" y2={196 + imageHeight} stroke="#f59e0b" strokeWidth="2" />
                <path d={`M 0 ${196 + imageHeight} l -4 -8 l 8 0 Z`} fill="#f59e0b" transform={`rotate(180 0 ${196 + imageHeight / 2})`} />
              </g>
            ) : (
              <g opacity="0.45">
                <line x1="0" y1="196" x2="0" y2={196 + imageHeight * 0.6} stroke="#a8a29e" strokeWidth="6" strokeLinecap="round" />
              </g>
            )}
            <text x="0" y="142" textAnchor="middle" fill="#57534e" style={{ fontSize: 8, fontWeight: 700 }}>
              screen
            </text>
          </g>

          <ReadoutInline x={24} y={26} label="Object distance u" value={`${u.toFixed(0)} cm`} unit="" tone="#1f2937" />
          <ReadoutInline x={410} y={26} label="Screen position" value={`${screen.toFixed(1)} cm`} unit="" />
        </svg>
      </Stage>

      <ControlBar>
        {distances.map((option: number, optionIndex: number) => (
          <SceneButton
            key={option}
            active={index === optionIndex}
            onClick={() => {
              setIndex(optionIndex);
              setScreen(30);
            }}
          >
            u = {option} cm
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          tone="primary"
          disabled={!focused}
          onClick={() => {
            onRecord({
              object: u.toFixed(0),
              image: measuredV.toFixed(1),
              invU: (1 / u).toFixed(4),
              invV: (1 / measuredV).toFixed(4),
            });
            onFlag('image-focused');
            onFlag('measured-from-centre');
          }}
        >
          <Eye className="h-3 w-3" /> {focused ? 'Record sharp image' : 'Focus first'}
        </SceneButton>
      </ControlBar>

      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_190px]">
        <div className="rounded-xl border border-ink-100 bg-white p-2.5">
          <Slider
            label="Screen position from lens"
            min={5}
            max={90}
            step={0.1}
            value={screen}
            unit="cm"
            onChange={setScreen}
            format={(value) => value.toFixed(1)}
          />
        </div>
        <Readout
          label="Image"
          value={focused ? 'SHARP' : 'BLURRED'}
          tone={focused ? 'jade' : 'amber'}
          size="sm"
          hint={focused ? 'Record v from the bench scale' : 'Slide the screen'}
        />
      </div>
      <div className="mt-2">
        <SceneHint tone={focused ? 'jade' : 'neutral'}>
          {focused
            ? 'The image is sharp. Read the screen position as v, then record the row.'
            : 'Move the screen until the image is sharpest, not merely visible.'}
        </SceneHint>
      </div>
    </div>
  );
}
