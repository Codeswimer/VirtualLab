import { useMemo, useState } from 'react';
import { Check, ClipboardCheck, Flame, FlaskConical, Info, Plus } from 'lucide-react';
import {
  family,
  speciesIn,
  testObservation,
  type SpeciesTest,
} from '@sim/chemistry/qualitative';
import type { SceneProps } from './types';
import { ControlBar, SceneButton, SceneHint, Stage } from './kit';
import { cn } from '@/lib/utils';

export function TubesScene(props: SceneProps) {
  return <QualitativeLab {...props} />;
}

export function FoodScene(props: SceneProps) {
  return <QualitativeLab {...props} />;
}

function QualitativeLab({ experiment, attempt, scenario, onUpdate, onRecord }: SceneProps) {
  const familyId = scenario.familyId as 'cations' | 'anions' | 'gases' | 'food';
  const unknownId = scenario.unknownId as string;
  const fam = family(familyId);
  const species = speciesIn(familyId, unknownId);
  const [reagentId, setReagentId] = useState<string | null>(null);
  const [observation, setObservation] = useState('');
  const [inference, setInference] = useState('');
  const [recordedMessage, setRecordedMessage] = useState<string | null>(null);

  const reagent = fam.reagents.find((item) => item.id === reagentId);
  const result: SpeciesTest | undefined = reagentId
    ? testObservation(familyId, unknownId, reagentId)
    : undefined;

  const tested = useMemo(
    () => new Set(attempt.rows.map((row) => (row.reagent ?? '').trim()).filter(Boolean)),
    [attempt.rows],
  );

  const selectedUnknown = attempt.answers.unknown ?? '';
  const isFood = familyId === 'food';

  const performTest = (id: string) => {
    setReagentId(id);
    setObservation('');
    setInference('');
    setRecordedMessage(null);
  };

  const observationText = result
    ? result.observation
    : reagent
      ? reagent.mode === 'flame'
        ? 'No characteristic flame colour is seen.'
        : 'No visible change.'
      : '';

  return (
    <div>
      <Stage
        caption={
          isFood
            ? 'Food samples and test reagents'
            : familyId === 'gases'
              ? 'Gas jar and test reagents'
              : 'Test-tube rack with the unknown and reagents'
        }
      >
        <svg viewBox="0 0 560 320" className="w-full" role="img" aria-label="Test tubes and reagents">
          <defs>
            <linearGradient id="tube-glass" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="0.5" stopColor="#f1f5f9" stopOpacity="0.5" />
              <stop offset="1" stopColor="#cbd5e1" stopOpacity="0.65" />
            </linearGradient>
            <linearGradient id="rack-wood" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e7d4ab" />
              <stop offset="1" stopColor="#c8ae7a" />
            </linearGradient>
          </defs>
          <rect x="0" y="288" width="560" height="32" fill="#ded3b9" />

          {/* Rack */}
          <rect x="52" y="230" width="300" height="18" rx="4" fill="url(#rack-wood)" stroke="#a98f5c" />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <ellipse cx={92 + i * 72} cy="230" rx="20" ry="5" fill="#b99c69" />
            </g>
          ))}

          {/* Unknown tube */}
          <g transform="translate(92 78)">
            <path d="M -18 0 L -18 132 Q -18 150 0 150 Q 18 150 18 132 L 18 0 Z" fill="url(#tube-glass)" stroke="#94a3b8" strokeWidth="1.5" />
            <path d="M -15 62 L -15 130 Q -15 146 0 146 Q 15 146 15 130 L 15 62 Z" fill={result?.colour ?? '#dbeafe'} opacity="0.8" />
            {result?.precipitate ? (
              <g>
                {Array.from({ length: 10 }, (_, i) => (
                  <circle key={i} cx={-10 + (i % 5) * 5} cy={118 + Math.floor(i / 5) * 9} r="2.6" fill={result.colour ?? '#fff'} opacity="0.9" />
                ))}
              </g>
            ) : null}
            {result?.gas ? (
              <g>
                {[0, 1, 2].map((i) => (
                  <circle key={i} cx={-4 + i * 5} cy={120} r="2" fill="#fff" opacity="0.9">
                    <animate attributeName="cy" values="126;70;126" dur={`${1.6 + i * 0.4}s`} repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.9;0;0.9" dur={`${1.6 + i * 0.4}s`} repeatCount="indefinite" />
                  </circle>
                ))}
              </g>
            ) : null}
            <text x="0" y="172" textAnchor="middle" className="fill-ink-600" style={{ fontSize: 8, fontWeight: 700 }}>
              unknown
            </text>
            <text x="0" y="184" textAnchor="middle" className="fill-ink-400" style={{ fontSize: 7 }}>
              {familyId === 'food' ? 'food sample' : familyId === 'gases' ? 'gas jar' : 'solution'}
            </text>
          </g>

          {/* Reagent bottles */}
          {fam.reagents.map((item, index) => {
            const x = 210 + (index % 3) * 72;
            const y = 120 + Math.floor(index / 3) * 74;
            const active = item.id === reagentId;
            return (
              <g key={item.id} transform={`translate(${x} ${y})`} opacity={active ? 1 : 0.85}>
                <rect x="-18" y="0" width="36" height="44" rx="5" fill={active ? '#ecfdf5' : '#f8fafc'} stroke={active ? '#106849' : '#cbd5e1'} strokeWidth={active ? 2 : 1.2} />
                <rect x="-6" y="-8" width="12" height="10" rx="2" fill="#94a3b8" />
                <rect x="-14" y="20" width="28" height="18" rx="2" fill={active ? '#a7f3d0' : '#e2e8f0'} />
                <text x="0" y="58" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 6.5 }}>
                  {item.label.replace(' solution', '').replace('Concentrated ', 'conc. ')}
                </text>
              </g>
            );
          })}

          {reagent?.mode === 'flame' ? (
            <g transform="translate(470 130)">
              <path d="M0 60 Q -18 30 0 0 Q 18 30 0 60Z" fill="#f59e0b" opacity="0.9">
                <animate attributeName="opacity" values="0.9;0.55;0.9" dur="1.2s" repeatCount="indefinite" />
              </path>
              <path d="M0 50 Q -9 30 0 12 Q 9 30 0 50Z" fill="#fef3c7" />
              <text x="0" y="76" textAnchor="middle" className="fill-ink-500" style={{ fontSize: 7 }}>flame test</text>
            </g>
          ) : null}

          {isFood && reagentId === 'benedicts' ? (
            <g transform="translate(470 180)">
              <rect x="-24" y="0" width="48" height="34" rx="4" fill="#e0f2fe" stroke="#94a3b8" />
              <text x="0" y="20" textAnchor="middle" className="fill-sky-700" style={{ fontSize: 7 }}>water bath</text>
              <text x="0" y="46" textAnchor="middle" className="fill-ink-400" style={{ fontSize: 6.5 }}>80 °C</text>
            </g>
          ) : null}
        </svg>
      </Stage>

      <ControlBar>
        {fam.reagents.map((item) => (
          <SceneButton
            key={item.id}
            active={reagentId === item.id}
            onClick={() => performTest(item.id)}
          >
            {item.mode === 'flame' ? <Flame className="h-3 w-3" /> : null}
            {item.label}
          </SceneButton>
        ))}
      </ControlBar>

      {reagent ? (
        <div className="mt-2 rounded-xl border border-ink-100 bg-white p-3">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">
                Observation on the bench
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-700">{observationText}</p>
              <p className="mt-1 text-[10px] text-ink-400">
                Now write the observation in your own words, with the inference it supports.
              </p>
            </div>
          </div>

          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Your observation
              <textarea
                value={observation}
                onChange={(event) => setObservation(event.target.value)}
                rows={2}
                className="input mt-1 resize-none text-xs normal-case tracking-normal"
                placeholder="e.g. white precipitate, soluble in excess"
              />
            </label>
            <label className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">
              Your inference
              <textarea
                value={inference}
                onChange={(event) => setInference(event.target.value)}
                rows={2}
                className="input mt-1 resize-none text-xs normal-case tracking-normal"
                placeholder="e.g. Zn²⁺, Al³⁺ or Pb²⁺ present"
              />
            </label>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setObservation(observationText)}
            >
              Use model wording
            </button>
            <button
              type="button"
              className="btn-primary btn-sm"
              disabled={!observation.trim()}
              onClick={() => {
                onRecord({
                  reagent: reagent.label,
                  observation: observation.trim(),
                  inference: inference.trim(),
                });
                setRecordedMessage(`Recorded ${reagent.label} in the table.`);
                setObservation('');
                setInference('');
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add to readings
            </button>
            {recordedMessage ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-jade-800">
                <Check className="h-3 w-3" /> {recordedMessage}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-2">
          <SceneHint>
            Choose a reagent to test the unknown. Record what you observe and what it suggests.
            You need at least two tests before identifying the {familyId === 'food' ? 'constituent' : 'unknown'}.
          </SceneHint>
        </div>
      )}

      <div className="mt-3 rounded-xl border border-ink-100 bg-white p-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-ink-800">
            <ClipboardCheck className="h-3.5 w-3.5 text-ink-400" /> Identify the unknown
          </h3>
          <span className="text-[10px] text-ink-400">
            {tested.size} test{tested.size === 1 ? '' : 's'} recorded
          </span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {(experiment.choices ?? []).map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() =>
                onUpdate({ answers: { ...attempt.answers, unknown: choice.id } })
              }
              className={cn(
                'rounded-lg border px-2 py-1.5 text-left text-[11px] font-medium transition-colors',
                selectedUnknown === choice.id
                  ? 'border-jade-600 bg-jade-50 text-jade-900'
                  : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
              )}
            >
              {choice.label}
            </button>
          ))}
        </div>
        {selectedUnknown ? (
          <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold text-jade-800">
            <Check className="h-3 w-3" />
            Selected: {speciesIn(familyId, selectedUnknown)?.name ?? selectedUnknown}
          </p>
        ) : (
          <p className="mt-2 flex items-center gap-1 text-[10px] text-amber-700">
            <Info className="h-3 w-3" /> Choose one after your tests; unsupported guesses score zero.
          </p>
        )}
      </div>

      {species ? (
        <p className="mt-2 flex items-center gap-1 text-[10px] text-ink-300">
          <FlaskConical className="h-3 w-3" /> Simulation: {fam.title.toLowerCase()} (idealised
          observations at 25 °C).
        </p>
      ) : null}
    </div>
  );
}
