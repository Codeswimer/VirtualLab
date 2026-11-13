import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import { CuboidCollider, CylinderCollider, Physics, RigidBody } from '@react-three/rapier';
import type { RapierRigidBody } from '@react-three/rapier';
import { Check, Droplet, Info, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import {
  indicatorColourName,
  indicatorColor,
  indicatorSpec,
  mixturePH,
  TITRATION_SYSTEMS,
  type TitrationSystem,
} from '@sim/chemistry/titration';
import {
  buretteFlowRateCm3PerSecond,
  isDropwise,
  liquidFraction,
  transferVolumeCm3,
} from './physics/bench-physics';
import { Graduations, LiquidColumn, PourStream } from './physics/visuals';
import { useBodyDrag } from './physics/use-body-drag';
import { ControlBar, Readout, SceneButton, SceneHint } from './kit';
import type { SceneProps } from './types';

const BURETTE_X = 0.52;
const BURETTE_Z = 0.12;
const TIP: [number, number, number] = [BURETTE_X, 1.1, BURETTE_Z];
const FLASK_HOME: [number, number, number] = [BURETTE_X, 0.03, BURETTE_Z];
const FLASK_MOUTH_Y = 0.63;

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
  const [delivered, setDelivered] = useState(0);
  const [spilled, setSpilled] = useState(0);
  const [opening, setOpening] = useState(0);
  const [pouring, setPouring] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [tapActive, setTapActive] = useState(false);
  const [rinsed, setRinsed] = useState(false);
  const [recorded, setRecorded] = useState(0);
  const addedRef = useRef(0);
  const lastRate = useRef(0);

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
      ? 'rgba(244,114,182,0.62)'
      : added > 0
        ? 'rgba(168,85,247,0.6)'
        : 'rgba(226,232,240,0.5)'
    : activeIndicator
      ? indicatorColor(spec, pH)
      : 'rgba(226,232,240,0.5)';
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
  const flaskLevel = liquidFraction(25 + added, 130);

  const handleDeliver = useCallback(
    (delta: number, rate: number, overFlask: boolean) => {
      if (delta <= 0) return;
      lastRate.current = rate;
      setDelivered((value) => Math.min(50, value + delta));
      if (!overFlask) {
        setSpilled((value) => value + delta);
        return;
      }
      addedRef.current = Math.min(48, addedRef.current + delta);
      setAdded(addedRef.current);
      if (isDropwise(rate) && Math.abs(addedRef.current - equivalentVolume) < 2.5) {
        onFlag('dropwise');
      }
      if (isRedox && addedRef.current >= equivalentVolume - 0.05) {
        onFlag('self-indicating');
      }
    },
    [equivalentVolume, isRedox, onFlag],
  );

  const recordTitre = useCallback(() => {
    const final = Math.round(addedRef.current / 0.05) * 0.05;
    if (final < 0.05) return;
    onRecord({ initial: '0.00', final: final.toFixed(2), titre: final.toFixed(2) });
    setRecorded((value) => value + 1);
    if (isDropwise(lastRate.current)) onFlag('dropwise');
    if (isRedox) onFlag('self-indicating');
    addedRef.current = 0;
    setAdded(0);
    setDelivered(0);
    setSpilled(0);
    setPouring(false);
  }, [isRedox, onFlag, onRecord]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-[#f1ede3]">
        <div className="h-[400px] w-full sm:h-[460px]">
          <Canvas
            dpr={[1, 1.75]}
            camera={{ position: [1.9, 1.85, 3.0], fov: 38 }}
            gl={{ antialias: true, alpha: true }}
          >
            <color attach="background" args={['#f1ede3']} />
            <fog attach="fog" args={['#f1ede3', 6, 11]} />
            <ambientLight intensity={0.7} />
            <directionalLight
              position={[3, 6, 4]}
              intensity={2}
              castShadow
              shadow-mapSize={[1024, 1024]}
            />
            <directionalLight position={[-4, 2, -2]} intensity={0.5} color="#dbeafe" />
            <Suspense fallback={null}>
              <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60}>
                <TitrationRig
                  colour={colour}
                  flaskLevel={flaskLevel}
                  delivered={delivered}
                  onDeliver={handleDeliver}
                  onOpening={(value) => setOpening(value)}
                  onPouring={(value) => setPouring(value)}
                  onDraggingChange={(value) => setDragging(value)}
                  onTapActive={(value) => setTapActive(value)}
                />
              </Physics>
            </Suspense>
            <ContactShadows position={[0, 0.01, 0]} opacity={0.32} scale={6} blur={2.3} far={4} />
            <OrbitControls
              enabled={!dragging && !tapActive}
              enablePan={false}
              minDistance={2.5}
              maxDistance={6}
              minPolarAngle={0.55}
              maxPolarAngle={1.45}
              target={[0.3, 1.25, 0]}
            />
          </Canvas>
        </div>

        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/85 px-2.5 py-1.5 backdrop-blur-sm">
          <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">Titration bench</p>
          <p className="font-mono text-[11px] font-semibold text-ink-800">
            {buretteReading.toFixed(2)} cm³ delivered
          </p>
        </div>

        <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-[#0d2b24]/95 px-3 py-2 text-right">
          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-jade-300">Burette</p>
          <p className="font-mono text-xl font-semibold tabular-nums text-jade-100">
            {buretteReading.toFixed(2)}
            <span className="ml-1 text-[9px] text-jade-400">cm³</span>
          </p>
          <p className="text-[8px] text-jade-400">
            tap {opening > 0.01 ? `${Math.round(opening * 100)}% open` : 'closed'}
          </p>
        </div>

        <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-1 text-[9px] font-medium text-ink-500">
          <Droplet className="h-3 w-3" /> Drag the stopcock down to open · drag the flask to swirl
        </div>
      </div>

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
                addedRef.current = 0;
                setAdded(0);
                setDelivered(0);
                if (scenario.indicatorId === 'methylOrange') onFlag('indicator-correct');
              }}
            >
              Methyl orange
            </SceneButton>
            <SceneButton
              active={indicatorId === 'phenolphthalein'}
              onClick={() => {
                setIndicatorId('phenolphthalein');
                addedRef.current = 0;
                setAdded(0);
                setDelivered(0);
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
          disabled={(!activeIndicator && !isRedox) || added < 0.05 || pouring}
          onClick={recordTitre}
        >
          <Check className="h-3 w-3" /> Record titre
        </SceneButton>
      </ControlBar>

      <div className="mt-2 grid gap-2 sm:grid-cols-4">
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
        <Readout
          label="Spilled"
          value={spilled.toFixed(2)}
          unit="cm³"
          size="sm"
          tone={spilled > 0 ? 'red' : 'ink'}
          hint={spilled > 0 ? 'keep the flask under the jet' : 'no spillage'}
        />
      </div>

      <div className="mt-2">
        <SceneHint tone={activeIndicator || isRedox ? (endpointReached ? 'jade' : 'neutral') : 'amber'}>
          {isRedox
            ? endpointReached
              ? 'The first permanent pink is the end-point. Close the tap and record the titre.'
              : 'No indicator: permanganate is self-indicating. Open the tap a little and close it as the pink appears.'
            : !activeIndicator
              ? 'Choose the indicator for this titration. Check the theory card if you are unsure.'
              : endpointReached
                ? 'The colour has changed permanently. Close the tap, then record the titre and repeat.'
                : pouring
                  ? nearEndpoint
                    ? 'You are close to the end-point. Almost close the tap so the acid goes in dropwise.'
                    : 'Watch the flask. The colour will change sharply near the end-point.'
                  : 'Drag the stopcock down to open it. Drag the flask in small circles to mix without moving it off the jet.'}
        </SceneHint>
      </div>

      <p className="mt-2 flex items-center gap-1 text-[10px] text-ink-400">
        <Info className="h-3 w-3" /> {systemLabel} · acid in the burette,{' '}
        {String(scenario.analyteName ?? 'iron(II) solution')} in the flask. The burette reads to
        0.05 cm³ and the flask liquid is drawn from the volume you actually deliver.
      </p>
    </div>
  );
}

function TitrationRig({
  colour,
  flaskLevel,
  delivered,
  onDeliver,
  onOpening,
  onPouring,
  onDraggingChange,
  onTapActive,
}: {
  colour: string;
  flaskLevel: number;
  delivered: number;
  onDeliver: (delta: number, rate: number, overFlask: boolean) => void;
  onOpening: (opening: number) => void;
  onPouring: (pouring: boolean) => void;
  onDraggingChange: (dragging: boolean) => void;
  onTapActive: (active: boolean) => void;
}) {
  const { pointer } = useThree();
  const flaskRef = useRef<RapierRigidBody>(null);
  const leverRef = useRef<THREE.Group>(null);
  const tapActive = useRef(false);
  const tapStartY = useRef(0);
  const opening = useRef(0);
  const sourceUsed = useRef(0);
  const accumulator = useRef(0);
  const minRate = useRef(0);
  const lastEmit = useRef(0);
  const lastOpening = useRef(0);
  const pouringRef = useRef(false);
  const [flaskPosition, setFlaskPosition] = useState<[number, number, number]>(FLASK_HOME);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (delivered === 0) sourceUsed.current = 0;
  }, [delivered]);

  const { bind } = useBodyDrag(flaskRef, {
    follow: 14,
    maxSpeed: 1.4,
    getPoint: (body, out) => {
      const t = body.translation();
      out.set(t.x, t.y + 0.28, t.z);
      return true;
    },
    onGrab: () => onDraggingChange(true),
    onRelease: () => onDraggingChange(false),
  });

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05);

    if (tapActive.current) {
      opening.current = Math.min(
        1,
        Math.max(0, (tapStartY.current - state.pointer.y) * 2.6),
      );
    } else {
      opening.current = 0;
    }

    if (leverRef.current) {
      leverRef.current.rotation.z = -opening.current * 1.15;
    }

    const now = performance.now();
    if (Math.abs(opening.current - lastOpening.current) > 0.01 && now - lastEmit.current > 80) {
      lastOpening.current = opening.current;
      onOpening(opening.current);
    }

    const flask = flaskRef.current;
    if (!flask) return;
    const t = flask.translation();
    const overFlask =
      Math.hypot(t.x - TIP[0], t.z - TIP[2]) < 0.24 &&
      t.y < 0.35;
    const rate = buretteFlowRateCm3PerSecond(opening.current);

    if (rate > 0 && sourceUsed.current < 50) {
      const volume = transferVolumeCm3(rate, delta, 50 - sourceUsed.current);
      sourceUsed.current += volume;
      accumulator.current += volume;
      if (minRate.current === 0 || rate < minRate.current) minRate.current = rate;

      if (!pouringRef.current) {
        pouringRef.current = true;
        onPouring(true);
      }

      if (accumulator.current >= 0.02 && now - lastEmit.current > 70) {
        lastEmit.current = now;
        onDeliver(accumulator.current, minRate.current, overFlask);
        accumulator.current = 0;
        minRate.current = rate;
      }

      setFlaskPosition((previous) =>
        Math.abs(previous[0] - t.x) + Math.abs(previous[2] - t.z) > 0.01
          ? [t.x, t.y, t.z]
          : previous,
      );
    } else if (pouringRef.current) {
      pouringRef.current = false;
      onPouring(false);
      lastEmit.current = 0;
      minRate.current = 0;
    }
  });

  return (
    <group>
      <mesh receiveShadow position={[0, -0.02, 0]}>
        <boxGeometry args={[5.5, 0.08, 3.2]} />
        <meshStandardMaterial color="#d8c9a5" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[5.5, 0.02, 3.2]} />
        <meshStandardMaterial color="#e9dec4" roughness={0.7} />
      </mesh>

      {/* White tile under the flask */}
      <mesh receiveShadow position={[BURETTE_X, 0.026, BURETTE_Z]}>
        <boxGeometry args={[0.75, 0.012, 0.55]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.5} />
      </mesh>

      <RigidBody type="fixed" colliders={false} position={[0, -0.08, 0]}>
        <CuboidCollider args={[2.75, 0.1, 1.6]} />
      </RigidBody>

      {/* Retort stand */}
      <mesh castShadow position={[BURETTE_X - 0.38, 1.25, BURETTE_Z - 0.2]}>
        <cylinderGeometry args={[0.032, 0.042, 2.5, 24]} />
        <meshStandardMaterial color="#59616c" metalness={0.55} roughness={0.35} />
      </mesh>
      <CuboidColliderProxy position={[BURETTE_X - 0.38, 1.25, BURETTE_Z - 0.2]} />
      <mesh position={[BURETTE_X - 0.2, 2.44, BURETTE_Z - 0.2]} castShadow>
        <boxGeometry args={[0.42, 0.05, 0.05]} />
        <meshStandardMaterial color="#59616c" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[BURETTE_X - 0.02, 2.44, BURETTE_Z - 0.2]}>
        <boxGeometry args={[0.1, 0.12, 0.1]} />
        <meshStandardMaterial color="#2f3540" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Burette tube */}
      <mesh position={[BURETTE_X, 1.86, BURETTE_Z]}>
        <cylinderGeometry args={[0.048, 0.048, 1.22, 28, 1, true]} />
        <meshPhysicalMaterial
          color="#e0f2fe"
          transparent
          opacity={0.28}
          roughness={0.08}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </mesh>
      <LiquidColumn
        base={[BURETTE_X, 1.27, BURETTE_Z]}
        radiusBottom={0.04}
        radiusTop={0.04}
        height={1.14}
        level={liquidFraction(50 - delivered, 50)}
        color="#fde68a"
        opacity={0.78}
      />
      <Graduations
        position={[BURETTE_X + 0.055, 1.3, BURETTE_Z]}
        height={1.08}
        count={12}
        width={0.075}
        color="#334155"
      />

      {/* Stopcock and lever */}
      <mesh position={[BURETTE_X, 1.22, BURETTE_Z]}>
        <sphereGeometry args={[0.055, 20, 20]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.35} metalness={0.4} />
      </mesh>
      <group ref={leverRef} position={[BURETTE_X, 1.22, BURETTE_Z + 0.05]}>
        <mesh position={[0.075, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.15, 12]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh
          position={[0.16, 0, 0]}
          onPointerDown={(event) => {
            event.stopPropagation();
            tapActive.current = true;
            tapStartY.current = pointer.y;
            (
              event.target as unknown as { setPointerCapture?: (id: number) => void }
            ).setPointerCapture?.(event.pointerId);
            document.body.style.cursor = 'grabbing';
            onTapActive(true);
          }}
          onPointerUp={(event) => {
            tapActive.current = false;
            (
              event.target as unknown as { releasePointerCapture?: (id: number) => void }
            ).releasePointerCapture?.(event.pointerId);
            document.body.style.cursor = '';
            onTapActive(false);
          }}
          onPointerCancel={() => {
            tapActive.current = false;
            onTapActive(false);
          }}
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
          <sphereGeometry args={[0.07, 20, 20]} />
          <meshStandardMaterial
            color={hovered ? '#0f766e' : '#1f2937'}
            metalness={0.4}
            roughness={0.4}
            emissive={hovered ? '#0f766e' : '#000000'}
            emissiveIntensity={hovered ? 0.4 : 0}
          />
        </mesh>
      </group>

      {/* Burette tip */}
      <mesh position={[BURETTE_X, 1.13, BURETTE_Z]}>
        <coneGeometry args={[0.03, 0.12, 16]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.3} metalness={0.4} />
      </mesh>

      {/* Conical flask */}
      <RigidBody
        ref={flaskRef}
        colliders={false}
        position={FLASK_HOME}
        canSleep={false}
        lockRotations
        linearDamping={0.4}
      >
        <CylinderCollider args={[0.16, 0.19]} position={[0, 0.16, 0]} />
        <group
          onPointerOver={(event) => {
            event.stopPropagation();
            document.body.style.cursor = 'grab';
          }}
          onPointerOut={() => {
            document.body.style.cursor = '';
          }}
          {...bind}
        >
          <mesh position={[0, 0.3, 0]}>
            <cylinderGeometry args={[0.055, 0.2, 0.5, 32, 1, true]} />
            <meshPhysicalMaterial
              color="#e2e8f0"
              transparent
              opacity={0.28}
              roughness={0.08}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.062, 0.062, 0.16, 28, 1, true]} />
            <meshPhysicalMaterial
              color="#e2e8f0"
              transparent
              opacity={0.24}
              roughness={0.08}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.2, 32]} />
            <meshPhysicalMaterial color="#e2e8f0" transparent opacity={0.3} />
          </mesh>
          <LiquidColumn
            base={[0, 0.06, 0]}
            radiusBottom={0.185}
            radiusTop={0.075}
            height={0.48}
            level={flaskLevel}
            color={colour}
            opacity={0.72}
          />
        </group>
      </RigidBody>

      {/* Pour stream */}
      <PourStream
        from={[TIP[0], TIP[1] - 0.02, TIP[2]]}
        to={
          pouringRef.current
            ? [flaskPosition[0], FLASK_MOUTH_Y, flaskPosition[2]]
            : [TIP[0], 0.06, TIP[2]]
        }
        color={colour}
        visible={pouringRef.current}
      />
    </group>
  );
}

/**
 * The retort stand is visual; the collider keeps the flask from passing through
 * it when the student drags the flask around the bench.
 */
function CuboidColliderProxy({ position }: { position: [number, number, number] }) {
  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <CuboidCollider args={[0.05, 1.25, 0.05]} />
    </RigidBody>
  );
}

