import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Html, OrbitControls } from '@react-three/drei';
import {
  CuboidCollider,
  CylinderCollider,
  Physics,
  RigidBody,
  type RapierRigidBody,
} from '@react-three/rapier';
import { Check, ClipboardCheck, Flame, FlaskConical, Info, Plus, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import {
  family,
  speciesIn,
  testObservation,
  type Reagent,
  type SpeciesTest,
} from '@sim/chemistry/qualitative';
import {
  bottleMouthOffset,
  liquidFraction,
  pourRateCm3PerSecond,
  tiltForNeckOffset,
  transferVolumeCm3,
} from './physics/bench-physics';
import { LiquidColumn, PourStream } from './physics/visuals';
import { ControlBar, SceneButton, SceneHint } from './kit';
import { cn } from '@/lib/utils';
import type { SceneProps } from './types';

const TUBE_X = -0.62;
const TUBE_Z = 0.02;
const TUBE_MOUTH_Y = 1.02;
const TUBE_RADIUS = 0.055;
const TUBE_CAPACITY = 30;
const BOTTLE_HEIGHT = 0.4;
const MOUTH_HEIGHT = 0.46;
const GRIP_HEIGHT = 0.43;
const BOTTLE_RADIUS = 0.065;
const BOTTLE_CAPACITY = 40;
const PARK_BASE: [number, number, number] = [TUBE_X - 0.28, TUBE_MOUTH_Y + 0.2, TUBE_Z];
const Z_AXIS = new THREE.Vector3(0, 0, 1);

const TINTS = ['#dbeafe', '#fef3c7', '#e0f2fe', '#dcfce7', '#fae8ff', '#fee2e2', '#f1f5f9'];

export function TubesScene(props: SceneProps) {
  return <QualitativeLab {...props} />;
}

export function FoodScene(props: SceneProps) {
  return <QualitativeLab {...props} />;
}

type StreamState = {
  id: string;
  from: [number, number, number];
  to: [number, number, number];
  color: string;
} | null;

function QualitativeLab({ experiment, attempt, scenario, onUpdate, onRecord }: SceneProps) {
  const familyId = scenario.familyId as 'cations' | 'anions' | 'gases' | 'food';
  const unknownId = scenario.unknownId as string;
  const fam = family(familyId);
  const species = speciesIn(familyId, unknownId);
  const [reagentId, setReagentId] = useState<string | null>(null);
  const [observation, setObservation] = useState('');
  const [inference, setInference] = useState('');
  const [recordedMessage, setRecordedMessage] = useState<string | null>(null);
  const [poured, setPoured] = useState<Record<string, number>>({});
  const [tubeExtra, setTubeExtra] = useState(0);
  const [spilled, setSpilled] = useState(0);
  const [parkedId, setParkedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stream, setStream] = useState<StreamState>(null);
  const [resetKey, setResetKey] = useState(0);
  const activeReagent = useRef<string | null>(null);

  const addReagents = useMemo(
    () => fam.reagents.filter((item) => item.mode === 'add'),
    [fam],
  );
  const specialReagents = useMemo(
    () => fam.reagents.filter((item) => item.mode !== 'add'),
    [fam],
  );

  const tintFor = useCallback(
    (id: string) => {
      const index = addReagents.findIndex((item) => item.id === id);
      return TINTS[(index < 0 ? 0 : index) % TINTS.length] ?? '#dbeafe';
    },
    [addReagents],
  );

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
    activeReagent.current = id;
    setReagentId(id);
    setObservation('');
    setInference('');
    setRecordedMessage(null);
  };

  const activateReagent = useCallback((id: string) => {
    if (activeReagent.current === id) return;
    activeReagent.current = id;
    setReagentId(id);
    setObservation('');
    setInference('');
    setRecordedMessage(null);
  }, []);

  const handleFlow = useCallback(
    (id: string, volume: number, overTube: boolean, mouth: [number, number, number]) => {
      if (volume <= 0) return;
      setPoured((previous) => ({
        ...previous,
        [id]: Math.min(BOTTLE_CAPACITY, (previous[id] ?? 0) + volume),
      }));
      if (overTube) {
        setTubeExtra((value) => Math.min(TUBE_CAPACITY - 6, value + volume));
        activateReagent(id);
        setStream({
          id,
          from: mouth,
          to: [TUBE_X, TUBE_MOUTH_Y, TUBE_Z],
          color: tintFor(id),
        });
      } else {
        setSpilled((value) => value + volume);
        setStream({
          id,
          from: mouth,
          to: [mouth[0], 0.04, mouth[2]],
          color: tintFor(id),
        });
      }
    },
    [activateReagent, tintFor],
  );

  const handleFlowEnd = useCallback((id: string) => {
    setStream((previous) => (previous && previous.id === id ? null : previous));
  }, []);

  const handleHoldEnd = useCallback(
    (id: string, position: [number, number, number]): boolean => {
      const nearTube =
        Math.hypot(position[0] - TUBE_X, position[2] - TUBE_Z) < 0.55 &&
        position[1] > 0.35;
      if (nearTube) {
        setParkedId(id);
        return true;
      }
      setParkedId((previous) => (previous === id ? null : previous));
      return false;
    },
    [],
  );

  const handlePickUp = useCallback((id: string) => {
    setParkedId((previous) => (previous === id ? null : previous));
    setStream(null);
  }, []);

  const resetBench = () => {
    setResetKey((value) => value + 1);
    setPoured({});
    setTubeExtra(0);
    setSpilled(0);
    setParkedId(null);
    setStream(null);
    setReagentId(null);
    setObservation('');
    setInference('');
    setRecordedMessage(null);
    activeReagent.current = null;
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
      <div className="relative overflow-hidden rounded-xl bg-[#f1ede3]">
        <div className="h-[400px] w-full sm:h-[460px]">
          <Canvas
            dpr={[1, 1.75]}
            camera={{ position: [1.75, 1.5, 2.9], fov: 40 }}
            gl={{ antialias: true, alpha: true }}
          >
            <color attach="background" args={['#f1ede3']} />
            <fog attach="fog" args={['#f1ede3', 5, 10]} />
            <ambientLight intensity={0.72} />
            <directionalLight
              position={[3, 6, 4]}
              intensity={1.9}
              castShadow
              shadow-mapSize={[1024, 1024]}
            />
            <directionalLight position={[-4, 2, -2]} intensity={0.55} color="#dbeafe" />
            <Suspense fallback={null}>
              <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60}>
                <PouringRack
                  key={resetKey}
                  addReagents={addReagents}
                  poured={poured}
                  parkedId={parkedId}
                  tintFor={tintFor}
                  result={result}
                  tubeExtra={tubeExtra}
                  spilled={spilled}
                  onPickUp={handlePickUp}
                  onHoldEnd={handleHoldEnd}
                  onFlow={handleFlow}
                  onFlowEnd={handleFlowEnd}
                  onDraggingChange={setDragging}
                />
                {stream ? (
                  <PourStream
                    from={stream.from}
                    to={stream.to}
                    color={stream.color}
                    visible
                  />
                ) : null}
              </Physics>
            </Suspense>
            <ContactShadows position={[0, 0.01, 0]} opacity={0.34} scale={6} blur={2.2} far={4} />
            <OrbitControls
              enabled={!dragging}
              enablePan={false}
              minDistance={2.4}
              maxDistance={5.5}
              minPolarAngle={0.55}
              maxPolarAngle={1.45}
              target={[-0.1, 0.85, 0.1]}
            />
          </Canvas>
        </div>

        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/85 px-2.5 py-1.5 backdrop-blur-sm">
          <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">
            {isFood ? 'Food tests' : familyId === 'gases' ? 'Gas tests' : 'Qualitative analysis'}
          </p>
          <p className="font-mono text-[11px] font-semibold text-ink-800">
            reagent added: {Object.values(poured).reduce((sum, value) => sum + value, 0).toFixed(1)} cm³
          </p>
        </div>

        <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-[#0d2b24]/95 px-3 py-2 text-right">
          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-jade-300">Test tube</p>
          <p className="font-mono text-xl font-semibold tabular-nums text-jade-100">
            {(6 + tubeExtra).toFixed(1)}
            <span className="ml-1 text-[9px] text-jade-400">cm³</span>
          </p>
          <p className="text-[8px] text-jade-400">
            {result ? 'observation ready' : 'waiting for reagent'}
          </p>
        </div>

        <div className="pointer-events-none absolute bottom-2 left-3 text-[9px] font-medium text-ink-500">
          {parkedId
            ? 'Bottle parked · drag the amber ring at its neck to tilt and pour'
            : 'Drag a bottle over the tube · grab its neck ring and tilt to pour'}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {fam.reagents.map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2 py-1 text-[10px] font-medium text-ink-600"
          >
            <span
              className="h-2 w-2 rounded-full border border-black/10"
              style={{
                background:
                  item.mode === 'add' ? tintFor(item.id) : item.mode === 'flame' ? '#f59e0b' : '#e2e8f0',
              }}
            />
            {item.label.replace(' solution', '').replace('Concentrated ', 'conc. ')}
            <span className="text-[8px] uppercase tracking-wide text-ink-400">
              {item.mode === 'add' ? 'pour' : item.mode}
            </span>
          </span>
        ))}
      </div>

      {specialReagents.length > 0 ? (
        <ControlBar>
          {specialReagents.map((item) => (
            <SceneButton
              key={item.id}
              active={reagentId === item.id}
              onClick={() => performTest(item.id)}
            >
              {item.mode === 'flame' ? <Flame className="h-3 w-3" /> : null}
              {item.label}
            </SceneButton>
          ))}
          <span className="mx-1 h-4 w-px bg-ink-200" />
          <SceneButton onClick={resetBench} tone="ghost">
            <RotateCcw className="h-3 w-3" /> Reset bench
          </SceneButton>
        </ControlBar>
      ) : (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-[10px] text-ink-400">
            Pour a reagent into the tube to run a test. {spilled > 0.02 ? `${spilled.toFixed(1)} cm³ spilled — reset the bench.` : ''}
          </p>
          <button type="button" className="btn-ghost btn-sm" onClick={resetBench}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset bench
          </button>
        </div>
      )}

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
          <SceneHint tone="neutral">
            Pick up a reagent bottle, bring it over the test tube and release it. Then drag the
            neck ring sideways to tip the bottle; the size of the tilt sets the flow rate. Record at
            least two tests before identifying the {isFood ? 'constituent' : 'unknown'}.
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
              onClick={() => onUpdate({ answers: { ...attempt.answers, unknown: choice.id } })}
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

function PouringRack({
  addReagents,
  poured,
  parkedId,
  tintFor,
  result,
  tubeExtra,
  spilled,
  onPickUp,
  onHoldEnd,
  onFlow,
  onFlowEnd,
  onDraggingChange,
}: {
  addReagents: Reagent[];
  poured: Record<string, number>;
  parkedId: string | null;
  tintFor: (id: string) => string;
  result?: SpeciesTest;
  tubeExtra: number;
  spilled: number;
  onPickUp: (id: string) => void;
  onHoldEnd: (id: string, position: [number, number, number]) => boolean;
  onFlow: (id: string, volume: number, overTube: boolean, mouth: [number, number, number]) => void;
  onFlowEnd: (id: string) => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  return (
    <group>
      <mesh receiveShadow position={[0, -0.02, 0]}>
        <boxGeometry args={[5.4, 0.08, 3.1]} />
        <meshStandardMaterial color="#d8c9a5" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[5.4, 0.02, 3.1]} />
        <meshStandardMaterial color="#e9dec4" roughness={0.7} />
      </mesh>

      <RigidBody type="fixed" colliders={false} position={[0, -0.08, 0]}>
        <CuboidCollider args={[2.7, 0.1, 1.55]} />
      </RigidBody>

      <TestTube result={result} volume={6 + tubeExtra} />
      <RigidBody type="fixed" colliders={false} position={[TUBE_X, 0.62, TUBE_Z]}>
        <CylinderCollider args={[0.42, 0.08]} />
      </RigidBody>
      <BunsenBurner
        active={result?.reagentId === 'flame'}
        colour={result?.colour ?? '#f59e0b'}
      />

      {addReagents.map((reagent, index) => (
        <ReagentBottle
          key={reagent.id}
          reagent={reagent}
          home={[0.02 + index * 0.27, 0.02, 0.32]}
          parked={parkedId === reagent.id}
          poured={poured[reagent.id] ?? 0}
          tint={tintFor(reagent.id)}
          onPickUp={onPickUp}
          onHoldEnd={onHoldEnd}
          onFlow={onFlow}
          onFlowEnd={onFlowEnd}
          onDraggingChange={onDraggingChange}
        />
      ))}

      {spilled > 0.02 ? (
        <mesh position={[TUBE_X + 0.28, 0.035, TUBE_Z - 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[Math.min(0.28, 0.06 + spilled * 0.02), 24]} />
          <meshStandardMaterial color="#93c5fd" transparent opacity={0.4} />
        </mesh>
      ) : null}
    </group>
  );
}

function TestTube({ result, volume }: { result?: SpeciesTest; volume: number }) {
  const level = liquidFraction(volume, TUBE_CAPACITY);
  const colour = result?.colour ?? 'rgba(219,234,254,0.5)';

  return (
    <group position={[TUBE_X, 0, TUBE_Z]}>
      {/* Rack */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.24, 0.055, 0.2]} />
        <meshStandardMaterial color="#c8ae7a" roughness={0.75} />
      </mesh>
      <mesh position={[-0.09, 0.28, 0]}>
        <boxGeometry args={[0.03, 0.42, 0.15]} />
        <meshStandardMaterial color="#b99c69" roughness={0.8} />
      </mesh>
      <mesh position={[0.09, 0.28, 0]}>
        <boxGeometry args={[0.03, 0.42, 0.15]} />
        <meshStandardMaterial color="#b99c69" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.51, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.07, 0.01, 8, 24]} />
        <meshStandardMaterial color="#8f7a4f" roughness={0.7} />
      </mesh>

      {/* Glass tube */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[TUBE_RADIUS, TUBE_RADIUS, 0.82, 28, 1, true]} />
        <meshPhysicalMaterial
          color="#e2e8f0"
          transparent
          opacity={0.26}
          roughness={0.08}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.19, 0]}>
        <sphereGeometry args={[TUBE_RADIUS, 24, 16]} />
        <meshPhysicalMaterial color="#e2e8f0" transparent opacity={0.24} roughness={0.08} />
      </mesh>
      <LiquidColumn
        base={[0, 0.21, 0]}
        radiusBottom={0.05}
        radiusTop={0.05}
        height={0.72}
        level={level}
        color={colour}
        opacity={0.72}
      />

      {result?.precipitate ? (
        <group>
          {Array.from({ length: 14 }, (_, index) => (
            <mesh
              key={index}
              position={[
                -0.03 + (index % 5) * 0.015,
                0.223 + Math.floor(index / 5) * 0.012,
                -0.02 + ((index * 7) % 3) * 0.015,
              ]}
            >
              <sphereGeometry args={[0.007, 8, 8]} />
              <meshStandardMaterial color={result.colour ?? '#f8fafc'} roughness={0.6} />
            </mesh>
          ))}
        </group>
      ) : null}

      {result?.gas ? <Bubbles colour={result.colour ?? '#f8fafc'} /> : null}

      <Html
        position={[0, 1.12, 0]}
        center
        distanceFactor={5}
        style={{ pointerEvents: 'none' }}
      >
        <span className="whitespace-nowrap rounded-md border border-ink-200 bg-white/90 px-1.5 py-0.5 text-[9px] font-semibold text-ink-700 shadow-sm">
          unknown
        </span>
      </Html>
    </group>
  );
}

function Bubbles({ colour }: { colour: string }) {
  const refs = useRef<Array<THREE.Mesh | null>>([]);
  useFrame((state) => {
    refs.current.forEach((mesh, index) => {
      if (!mesh) return;
      const phase = (state.clock.elapsedTime * 0.35 + index / 6) % 1;
      mesh.position.y = 0.24 + phase * 0.55;
      mesh.scale.setScalar(0.35 + phase * 0.9);
    });
  });
  return (
    <group>
      {Array.from({ length: 6 }, (_, index) => (
        <mesh
          key={index}
          ref={(mesh) => {
            refs.current[index] = mesh;
          }}
          position={[-0.02 + (index % 3) * 0.02, 0.3, -0.02 + ((index * 5) % 3) * 0.015]}
        >
          <sphereGeometry args={[0.008, 8, 8]} />
          <meshBasicMaterial color={colour} transparent opacity={0.55} />
        </mesh>
      ))}
    </group>
  );
}

function BunsenBurner({ active, colour }: { active: boolean; colour: string }) {
  return (
    <group position={[1.35, 0, -0.38]}>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.16, 0.05, 24]} />
        <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.035, 0.05, 0.34, 20]} />
        <meshStandardMaterial color="#475569" metalness={0.55} roughness={0.35} />
      </mesh>
      {active ? (
        <group position={[0, 0.45, 0]}>
          <mesh position={[0, 0.08, 0]}>
            <coneGeometry args={[0.06, 0.22, 16]} />
            <meshBasicMaterial color={colour} transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, 0.04, 0]}>
            <coneGeometry args={[0.035, 0.12, 16]} />
            <meshBasicMaterial color="#fef3c7" transparent opacity={0.85} />
          </mesh>
        </group>
      ) : null}
    </group>
  );
}

function ReagentBottle({
  reagent,
  home,
  parked,
  poured,
  tint,
  onPickUp,
  onHoldEnd,
  onFlow,
  onFlowEnd,
  onDraggingChange,
}: {
  reagent: Reagent;
  home: [number, number, number];
  parked: boolean;
  poured: number;
  tint: string;
  onPickUp: (id: string) => void;
  onHoldEnd: (id: string, position: [number, number, number]) => boolean;
  onFlow: (id: string, volume: number, overTube: boolean, mouth: [number, number, number]) => void;
  onFlowEnd: (id: string) => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const { camera } = useThree();
  const held = useRef(false);
  const tilting = useRef(false);
  const tilt = useRef(0);
  const delivered = useRef(poured);
  const accumulator = useRef(0);
  const lastFlow = useRef(0);
  const flowing = useRef(false);
  const [hovered, setHovered] = useState(false);
  const [parkedHovered, setParkedHovered] = useState(false);

  const plane = useMemo(() => new THREE.Plane(), []);
  const tiltPlane = useMemo(() => new THREE.Plane(), []);
  const cameraDir = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouth = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    delivered.current = Math.max(delivered.current, poured);
  }, [poured]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    if (parked) {
      body.setBodyType(2, true);
      body.setTranslation(
        { x: PARK_BASE[0], y: PARK_BASE[1], z: PARK_BASE[2] },
        true,
      );
      body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      body.setNextKinematicTranslation({
        x: PARK_BASE[0],
        y: PARK_BASE[1],
        z: PARK_BASE[2],
      });
      tilt.current = 0;
    } else if (!held.current) {
      body.setBodyType(0, true);
    }
  }, [parked]);

  const beginHold = (event: ThreeEvent<PointerEvent>) => {
    const body = bodyRef.current;
    if (!body) return;
    event.stopPropagation();
    const targetElement = event.target as unknown as {
      setPointerCapture?: (id: number) => void;
    };
    targetElement.setPointerCapture?.(event.pointerId);
    if (flowing.current) {
      flowing.current = false;
      onFlowEnd(reagent.id);
    }
    tilting.current = false;
    tilt.current = 0;
    onPickUp(reagent.id);
    body.setBodyType(2, true);
    held.current = true;
    onDraggingChange(true);
    document.body.style.cursor = 'grabbing';

    const t = body.translation();
    camera.getWorldDirection(cameraDir);
    plane.setFromNormalAndCoplanarPoint(
      cameraDir,
      new THREE.Vector3(t.x, t.y, t.z),
    );
    const hit = event.ray.intersectPlane(plane, target);
    offset.set(
      hit ? t.x - target.x : 0,
      hit ? t.y - target.y : 0,
      hit ? t.z - target.z : 0,
    );
  };

  const endHold = () => {
    if (!held.current) return;
    held.current = false;
    document.body.style.cursor = '';
    onDraggingChange(false);
    const body = bodyRef.current;
    if (!body) return;
    const parkedNow = onHoldEnd(reagent.id, [target.x, target.y, target.z]);
    if (parkedNow) {
      body.setBodyType(2, true);
    } else {
      body.setBodyType(0, true);
      body.setLinvel({ x: 0, y: -0.15, z: 0 }, true);
    }
  };

  const beginTilt = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const targetElement = event.target as unknown as {
      setPointerCapture?: (id: number) => void;
    };
    targetElement.setPointerCapture?.(event.pointerId);
    tilting.current = true;
    onDraggingChange(true);
    camera.getWorldDirection(cameraDir);
    tiltPlane.setFromNormalAndCoplanarPoint(
      cameraDir,
      new THREE.Vector3(PARK_BASE[0], PARK_BASE[1] + GRIP_HEIGHT, PARK_BASE[2]),
    );
    document.body.style.cursor = 'grabbing';
  };

  const endTilt = () => {
    if (!tilting.current) return;
    tilting.current = false;
    onDraggingChange(false);
    document.body.style.cursor = '';
  };

  useFrame((state, rawDelta) => {
    const body = bodyRef.current;
    if (!body) return;
    const delta = Math.min(rawDelta, 0.05);

    if (held.current) {
      raycaster.setFromCamera(state.pointer, camera);
      if (raycaster.ray.intersectPlane(plane, target)) {
        target.add(offset);
        target.x = Math.min(1.85, Math.max(-1.5, target.x));
        target.z = Math.min(1.15, Math.max(-1.0, target.z));
        target.y = Math.max(0.04, target.y);
        body.setNextKinematicTranslation({ x: target.x, y: target.y, z: target.z });
        body.setNextKinematicRotation({ x: 0, y: 0, z: 0, w: 1 });
      }
      return;
    }

    if (!parked) return;

    body.setNextKinematicTranslation({
      x: PARK_BASE[0],
      y: PARK_BASE[1],
      z: PARK_BASE[2],
    });

    if (tilting.current) {
      raycaster.setFromCamera(state.pointer, camera);
      if (raycaster.ray.intersectPlane(tiltPlane, target)) {
        tilt.current = THREE.MathUtils.clamp(
          tiltForNeckOffset(target.x - PARK_BASE[0], MOUTH_HEIGHT),
          -1.3,
          0.55,
        );
      }
    } else {
      tilt.current += (0 - tilt.current) * Math.min(1, delta * 7);
    }

    quaternion.setFromAxisAngle(Z_AXIS, tilt.current);
    body.setNextKinematicRotation({
      x: quaternion.x,
      y: quaternion.y,
      z: quaternion.z,
      w: quaternion.w,
    });

    const tiltDeg = Math.abs((tilt.current * 180) / Math.PI);
    const rate = pourRateCm3PerSecond(tiltDeg);
    const remaining = BOTTLE_CAPACITY - delivered.current;

    if (rate > 0 && remaining > 0) {
      const volume = transferVolumeCm3(rate, delta, remaining);
      delivered.current += volume;
      accumulator.current += volume;

      const local = bottleMouthOffset(tilt.current, MOUTH_HEIGHT);
      mouth.set(PARK_BASE[0] + local.x, PARK_BASE[1] + local.y, PARK_BASE[2]);
      const overTube =
        Math.hypot(mouth.x - TUBE_X, mouth.z - TUBE_Z) < TUBE_RADIUS + 0.04 &&
        mouth.y > TUBE_MOUTH_Y - 0.06;

      const now = performance.now();
      if (accumulator.current >= 0.02 && now - lastFlow.current > 70) {
        lastFlow.current = now;
        onFlow(
          reagent.id,
          accumulator.current,
          overTube,
          [mouth.x, mouth.y, mouth.z],
        );
        accumulator.current = 0;
      }
      flowing.current = true;
    } else if (flowing.current) {
      flowing.current = false;
      onFlowEnd(reagent.id);
    }
  });

  const remainingLevel = liquidFraction(
    Math.max(0, BOTTLE_CAPACITY - poured),
    BOTTLE_CAPACITY,
  );

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      position={home}
      canSleep={false}
      linearDamping={0.35}
      angularDamping={0.9}
    >
      <CylinderCollider
        args={[BOTTLE_HEIGHT / 2, BOTTLE_RADIUS]}
        position={[0, BOTTLE_HEIGHT / 2, 0]}
        mass={0.08}
      />
      <group
        onPointerDown={beginHold}
        onPointerUp={endHold}
        onPointerCancel={endHold}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'grab';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
      >
        {/* Glass body */}
        <mesh position={[0, BOTTLE_HEIGHT / 2, 0]}>
          <cylinderGeometry
            args={[BOTTLE_RADIUS, BOTTLE_RADIUS, BOTTLE_HEIGHT, 24, 1, true]}
          />
          <meshPhysicalMaterial
            color="#e2e8f0"
            transparent
            opacity={hovered ? 0.42 : 0.3}
            roughness={0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, BOTTLE_HEIGHT - 0.02, 0]}>
          <coneGeometry args={[0.045, 0.07, 18]} />
          <meshPhysicalMaterial color="#e2e8f0" transparent opacity={0.34} />
        </mesh>
        <mesh position={[0, BOTTLE_HEIGHT + 0.03, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.06, 18]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.45} metalness={0.2} />
        </mesh>

        <LiquidColumn
          base={[0, 0.02, 0]}
          radiusBottom={0.058}
          radiusTop={0.058}
          height={0.3}
          level={remainingLevel}
          color={tint}
          opacity={0.62}
        />

        <mesh position={[0, 0.16, 0.062]}>
          <boxGeometry args={[0.09, 0.09, 0.004]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.7} />
        </mesh>

        <Html
          position={[0, BOTTLE_HEIGHT + 0.16, 0]}
          center
          distanceFactor={5}
          style={{ pointerEvents: 'none' }}
        >
          <span className="whitespace-nowrap rounded-md border border-ink-200 bg-white/90 px-1.5 py-0.5 text-[8px] font-semibold text-ink-700 shadow-sm">
            {reagent.label.replace(' solution', '').replace('Concentrated ', 'conc. ')}
          </span>
        </Html>

        {hovered && !parked ? (
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
            <torusGeometry args={[0.085, 0.005, 8, 24]} />
            <meshBasicMaterial color="#0f766e" transparent opacity={0.8} />
          </mesh>
        ) : null}
      </group>

      {parked ? (
        <group position={[0, GRIP_HEIGHT, 0]}>
          <mesh
            onPointerDown={beginTilt}
            onPointerUp={endTilt}
            onPointerCancel={endTilt}
            onPointerOver={(event) => {
              event.stopPropagation();
              setParkedHovered(true);
              document.body.style.cursor = 'grab';
            }}
            onPointerOut={() => {
              setParkedHovered(false);
              document.body.style.cursor = '';
            }}
          >
            <torusGeometry args={[0.075, 0.014, 10, 28]} />
            <meshStandardMaterial
              color={parkedHovered ? '#0f766e' : '#f59e0b'}
              emissive={parkedHovered ? '#0f766e' : '#f59e0b'}
              emissiveIntensity={0.55}
            />
          </mesh>
          {/* Generous invisible grab volume: a thin ring is hard to hit on a phone. */}
          <mesh
            onPointerDown={beginTilt}
            onPointerUp={endTilt}
            onPointerCancel={endTilt}
          >
            <sphereGeometry args={[0.115, 16, 16]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ) : null}
    </RigidBody>
  );
}
