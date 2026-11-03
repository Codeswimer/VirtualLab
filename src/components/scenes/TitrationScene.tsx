import { useMemo, useState } from 'react';
import { Check, Droplet, RotateCcw, Waves } from 'lucide-react';
import {
  indicatorColourName,
  indicatorColor,
  indicatorSpec,
  mixturePH,
  TITRATION_SYSTEMS,
  type TitrationSystem,
} from '@sim/chemistry/titration';
import { ControlBar, Readout, SceneButton, SceneHint, Stage } from './kit';
import type { SceneProps } from './types';

export function TitrationScene({ experiment, scenario, onRecord, onFlag }: SceneProps) {
  const isRedox = experiment.meta.code === 'CHM-03';
  const isHydrate = experiment.meta.code === 'CHM-02';
  const system = (scenario.system as TitrationSystem | undefined) ?? 'hcl-na2co3';
  const acidMolarity = (scenario.acidMolarity ?? scenario.titrantMolarity) as number;
  const analyteMolarity = scenario.analyteMolarity as number;
  const analyteVolume = scenario.analyteVolumeCm3 as number;

  const [indicatorId, setIndicatorId] = useState<'methylOrange' | 'phenolphthalein' | null>(
    isHydrate ? 'methylOrange' : null,
  );
  const [added, setAdded] = useState(0);
  const [lastStep, setLastStep] = useState(0);
  const [swirling, setSwirling] = useState(false);
  const [rinsed, setRinsed] = useState(false);
  const [recorded, setRecorded] = useState(0);

  const activeIndicator = isHydrate ? 'methylOrange' : indicatorId;
  const spec = indicatorSpec(activeIndicator ?? 'methylOrange');
  const pH = isRedox
    ? 7
    : mixturePH(system, acidMolarity, analyteMolarity, analyteVolume, added);
  const equivalentVolume = (scenario.trueTitreCm3 as number) ?? 0;
  const nearEndpoint = Math.abs(added - equivalentVolume) < 2.5;

  const endpointReached = isRedox
    ? added >= equivalentVolume - 0.05
    : activeIndicator === 'methylOrange'
      ? pH < 4.4
      : activeIndicator === 'phenolphthalein'
        ? pH < 8.2
        : false;

  const colour = isRedox
    ? endpointReached
      ? 'rgba(244,114,182,0.55)'
      : added > 0
        ? 'rgba(168,85,247,0.55)'
        : 'rgba(226,232,240,0.55)'
    : activeIndicator
      ? indicatorColor(spec, pH)
      : 'rgba(226,232,240,0.55)';
  const colourName = isRedox
    ? endpointReached
      ? 'pale pink (permanent)'
      : added > 0
        ? 'faint purple'
        : 'colourless'
    : activeIndicator
      ? indicatorColourName(spec, pH)
      : 'no indicator';
  const systemLabel = isRedox
    ? 'KMnO₄ against iron(II)'
    : TITRATION_SYSTEMS[system].label;

  const buretteReading = useMemo(() => Math.round(added / 0.05) * 0.05, [added]);
  const liquidTop = 56 + (added / 50) * 190;

  const addVolume = (amount: number) => {
    const next = Math.min(48, Number((added + amount).toFixed(2)));
    setAdded(next);
    setLastStep(amount);
    if (amount <= 0.1 && nearEndpoint) onFlag('dropwise');
    if (amount <= 0.1) setSwirling(true);
    if (isRedox && next >= equivalentVolume - 0.05) onFlag('self-indicating');
    if (!isRedox && activeIndicator && activeIndicator === scenario.indicatorId) {
      onFlag('indicator-correct');
    }
    if (isHydrate && activeIndicator === 'methylOrange') onFlag('indicator-correct');
  };

  return (
    <div>
      <Stage caption="Burette of acid above a conical flask of base and indicator">
        <svg viewBox="0 0 560 340" className="w-full" role="img" aria-label="Burette and conical flask during a titration">
          <defs>
            <linearGradient id="glass-tube" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
              <stop offset="0.4" stopColor="#e0f2fe" stopOpacity="0.4" />
              <stop offset="1" stopColor="#bae6fd" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id="acid" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fef9c3" stopOpacity="0.9" />
              <stop offset="1" stopColor="#fde68a" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="flask-glass" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f8fafc" stopOpacity="0.75" />
              <stop offset="1" stopColor="#cbd5e1" stopOpacity="0.45" />
            </linearGradient>
          </defs>
          <rect x="0" y="312" width="560" height="28" fill="#ded3b9" />

          {/* Stand */}
          <rect x="72" y="22" width="12" height="290" rx="4" fill="#64748b" />
          <rect x="46" y="306" width="80" height="10" rx="4" fill="#475569" />
          <rect x="84" y="54" width="74" height="8" rx="3" fill="#475569" />
          <rect x="84" y="210" width="54" height="8" rx="3" fill="#475569" />

          {/* Burette */}
          <g>
            <rect x="142" y="34" width="26" height="210" rx="4" fill="url(#glass-tube)" stroke="#94a3b8" />
            <rect x={146} y={liquidTop} width="18" height={234 - liquidTop} rx="3" fill="url(#acid)" style={{ transition: 'all 220ms ease' }} />
            {Array.from({ length: 11 }, (_, i) => (
              <g key={i}>
                <line x1="142" y1={56 + i * 19} x2={i % 5 === 0 ? 132 : 137} y2={56 + i * 19} stroke="#475569" strokeWidth="0.9" />
                <text x="128" y={59 + i * 19} textAnchor="end" className="fill-ink-400" style={{ fontSize: 6.5, fontFamily: 'JetBrains Mono Variable, monospace' }}>
                  {i * 5}
                </text>
              </g>
            ))}
            <text x="155" y="24" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 7.5 }}>burette / cm³</text>

            {/* Tap */}
            <rect x="150" y="244" width="10" height="16" fill="#94a3b8" />
            <ellipse cx="155" cy="262" rx="12" ry="5" fill="#64748b" />
            <circle cx="155" cy="262" r="3" fill="#334155" />
            <path d="M 155 268 L 155 288" stroke="#e2e8f0" strokeWidth="2.5" />
          </g>

          {/* Flask */}
          <g transform="translate(300 214)">
            <path d="M -18 0 L -70 92 Q -74 100 -64 100 L 64 100 Q 74 100 70 92 L 18 0 Z" fill="url(#flask-glass)" stroke="#94a3b8" strokeWidth="2" />
            <path d="M -58 64 Q -60 96 -52 96 L 52 96 Q 60 96 58 64 Z" fill={colour} style={{ transition: 'fill 500ms ease' }} />
            <ellipse cx="0" cy="64" rx="58" ry="7" fill={colour} opacity="0.9" style={{ transition: 'fill 500ms ease' }} />
            {swirling ? (
              <ellipse cx="0" cy="66" rx="46" ry="4" fill="none" stroke="#ffffff" strokeOpacity="0.6" strokeWidth="1.5">
                <animate attributeName="rx" values="20;50;20" dur="1.2s" repeatCount="indefinite" />
              </ellipse>
            ) : null}
            <text x="0" y="118" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 7.5 }}>
              {scenario.analyteName as string} + indicator
            </text>
            <text x="0" y="80" textAnchor="middle" fill="rgba(15,23,42,0.6)" style={{ fontSize: 7 }}>
              25.0 cm³ pipetted
            </text>
          </g>

          {/* White tile */}
          <rect x="212" y="314" width="180" height="8" rx="2" fill="#f8fafc" stroke="#cbd5e1" />

          <g transform="translate(444 46)">
            <rect width="96" height="92" rx="10" fill="#ffffff" stroke="#e2e8f0" />
            <text x="10" y="16" fill="#94a3b8" style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: 0.8 }}>BURETTE</text>
            <text x="10" y="38" fill="#0f2b24" style={{ fontSize: 17, fontFamily: 'JetBrains Mono Variable, monospace', fontWeight: 600 }}>
              {buretteReading.toFixed(2)}
            </text>
            <text x="10" y="50" fill="#94a3b8" style={{ fontSize: 6.5 }}>cm³ delivered</text>
            <text x="10" y="66" fill="#94a3b8" style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: 0.8 }}>INDICATOR</text>
            <text x="10" y="82" fill="#0f2b24" style={{ fontSize: 7.5, fontWeight: 600 }}>
              {indicatorId ? (indicatorId === 'methylOrange' ? 'methyl orange' : 'phenolphthalein') : 'none'}
            </text>
          </g>

          <g transform="translate(444 152)">
            <rect width="96" height="70" rx="10" fill="#ffffff" stroke="#e2e8f0" />
            <text x="10" y="16" fill="#94a3b8" style={{ fontSize: 6.5, fontWeight: 700, letterSpacing: 0.8 }}>COLOUR</text>
            <circle cx="20" cy="36" r="8" fill={colour} stroke="#cbd5e1" />
            <text x="34" y="40" fill="#0f2b24" style={{ fontSize: 7.5, fontWeight: 600 }}>{colourName}</text>
            <text x="10" y="60" fill={endpointReached ? '#106849' : '#94a3b8'} style={{ fontSize: 7, fontWeight: 600 }}>
              {endpointReached ? 'end-point reached' : 'not at end-point'}
            </text>
          </g>
        </svg>
      </Stage>

      <ControlBar>
        {isRedox ? (
          <SceneButton active onClick={() => onFlag('self-indicating')}>
            Self-indicating · KMnO₄
          </SceneButton>
        ) : isHydrate ? (
          <SceneButton active onClick={() => onFlag('indicator-correct')}>
            Methyl orange (required)
          </SceneButton>
        ) : (
          <>
            <SceneButton
              active={indicatorId === 'methylOrange'}
              onClick={() => {
                setIndicatorId('methylOrange');
                setAdded(0);
                if (scenario.indicatorId === 'methylOrange') onFlag('indicator-correct');
              }}
            >
              Methyl orange
            </SceneButton>
            <SceneButton
              active={indicatorId === 'phenolphthalein'}
              onClick={() => {
                setIndicatorId('phenolphthalein');
                setAdded(0);
                if (scenario.indicatorId === 'phenolphthalein') onFlag('indicator-correct');
              }}
            >
              Phenolphthalein
            </SceneButton>
          </>
        )}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          active={rinsed}
          onClick={() => {
            setRinsed(true);
            onFlag('rinsed-burette');
          }}
        >
          <RotateCcw className="h-3 w-3" /> Rinse burette
        </SceneButton>
        <SceneButton
          tone="primary"
          disabled={(!activeIndicator && !isRedox) || added <= 0}
          onClick={() => {
            const final = Number((Math.round(added / 0.05) * 0.05).toFixed(2));
            onRecord({
              initial: '0.00',
              final: final.toFixed(2),
              titre: final.toFixed(2),
            });
            setRecorded((value) => value + 1);
            setAdded(0);
            setLastStep(0);
            if (lastStep <= 0.1) onFlag('dropwise');
            if (isRedox) onFlag('self-indicating');
          }}
        >
          <Check className="h-3 w-3" /> Record titre
        </SceneButton>
      </ControlBar>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <Readout label="Acid added" value={added.toFixed(2)} unit="cm³" size="sm" />
        <Readout
          label={isRedox ? 'Solution colour' : 'Indicator colour'}
          value={colourName}
          tone={activeIndicator || isRedox ? 'ink' : 'amber'}
          size="sm"
        />
        <Readout
          label="Titrations"
          value={String(recorded)}
          size="sm"
          hint="aim for 3 concordant"
        />
      </div>

      {activeIndicator || isRedox ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <SceneButton onClick={() => addVolume(5)}>+ 5.00</SceneButton>
          <SceneButton onClick={() => addVolume(1)}>+ 1.00</SceneButton>
          <SceneButton onClick={() => addVolume(0.5)}>+ 0.50</SceneButton>
          <SceneButton onClick={() => addVolume(0.1)} active={lastStep === 0.1}>
            <Droplet className="h-3 w-3" /> + 0.10
          </SceneButton>
          <SceneButton onClick={() => addVolume(0.05)}>+ 0.05</SceneButton>
          <SceneButton
            active={swirling}
            onClick={() => setSwirling((value) => !value)}
            tone="ghost"
          >
            <Waves className="h-3 w-3" /> Swirl
          </SceneButton>
        </div>
      ) : null}

      <div className="mt-2">
        <SceneHint tone={activeIndicator || isRedox ? (endpointReached ? 'jade' : 'neutral') : 'amber'}>
          {isRedox
            ? endpointReached
              ? 'The first permanent pink is the end-point. Record the titre and repeat for concordant values.'
              : 'No indicator: permanganate is self-indicating. Add drops near the end and stop at the first permanent pink.'
            : !activeIndicator
              ? 'Choose the indicator for this titration. Check the theory card if you are unsure.'
              : endpointReached
                ? 'The colour has changed permanently. Record the titre, then refill and repeat.'
                : lastStep > 0.5
                  ? 'Running in too fast near the end-point risks overshooting. Switch to drops.'
                  : 'Swirl the flask continuously. Stop at the first permanent colour change.'}
        </SceneHint>
      </div>

      <p className="mt-2 text-[10px] text-ink-400">
        {systemLabel} · acid in the burette, {String(scenario.analyteName ?? 'iron(II) solution')} in
        the flask.
      </p>
    </div>
  );
}
