import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import {
  CuboidCollider,
  Physics,
  RigidBody,
  useSpringJoint,
  type RapierRigidBody,
} from '@react-three/rapier';
import { Check, MoveVertical, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import { createRng, hashSeed } from '@sim/rng';
import { measure } from '@sim/measurement';
import { ControlBar, Readout, SceneButton, SceneHint } from './kit';
import { springForceN } from './physics/bench-physics';
import { Graduations, SpringCoil } from './physics/visuals';
import { useBodyDrag } from './physics/use-body-drag';
import type { SceneProps } from './types';

const SPRING_TOP: [number, number, number] = [0, 2.25, 0];
const REST_LENGTH_M = 0.2;
const HANGER_MASS_KG = 0.0001;
const GRAVITY = 9.81;

export function SpringScene({ attempt, scenario, onRecord, onFlag }: SceneProps) {
  const masses: number[] = scenario.massesG;
  const [loadG, setLoadG] = useState<number>(0);
  const [zeroChecked, setZeroChecked] = useState(false);
  const [settled, setSettled] = useState(false);
  const [extensionCm, setExtensionCm] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  const stiffness = scenario.springConstantNm as number;
  const extensionM = extensionCm / 100;
  const tension = springForceN(stiffness, extensionM);

  const reading = useMemo(() => {
    if (!settled || loadG === 0) return null;
    const rng = createRng(hashSeed(attempt.seed, 'spring', loadG, resetKey));
    return measure(extensionCm, 'metreRule', {
      random: rng.next,
      zeroError: scenario.zeroErrorCm as number,
    });
  }, [attempt.seed, extensionCm, loadG, resetKey, scenario.zeroErrorCm, settled]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-[#f1ede3]">
        <div className="h-[360px] w-full sm:h-[420px]">
          <Canvas
            dpr={[1, 1.75]}
            camera={{ position: [2.25, 1.95, 3.3], fov: 38 }}
            gl={{ antialias: true, alpha: true }}
          >
            <color attach="background" args={['#f1ede3']} />
            <fog attach="fog" args={['#f1ede3', 7, 12]} />
            <ambientLight intensity={0.68} />
            <directionalLight
              position={[3, 6, 4]}
              intensity={2}
              castShadow
              shadow-mapSize={[1024, 1024]}
            />
            <directionalLight position={[-4, 2, -2]} intensity={0.45} color="#bae6fd" />
            <Suspense fallback={null}>
              <Physics gravity={[0, -GRAVITY, 0]} timeStep={1 / 60}>
                <SpringRig
                  key={resetKey}
                  loadG={loadG}
                  stiffness={stiffness}
                  onExtension={(value) => setExtensionCm(value)}
                  onSettled={setSettled}
                  onDraggingChange={setDragging}
                />
              </Physics>
            </Suspense>
            <ContactShadows position={[0, 0.01, 0]} opacity={0.32} scale={7} blur={2.3} far={4} />
            <OrbitControls
              enabled={!dragging}
              enablePan={false}
              minDistance={2.8}
              maxDistance={6}
              minPolarAngle={0.6}
              maxPolarAngle={1.4}
              target={[0, 1.55, 0]}
            />
          </Canvas>
        </div>

        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/80 px-2.5 py-1.5 backdrop-blur-sm">
          <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">Hooke's law</p>
          <p className="font-mono text-[11px] font-semibold text-ink-800">
            k = {stiffness.toFixed(1)} N/m · load = {loadG} g
          </p>
        </div>

        <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-[#0d2b24]/95 px-3 py-2 text-right">
          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-jade-300">Tension</p>
          <p className="font-mono text-xl font-semibold tabular-nums text-jade-100">
            {tension.toFixed(2)}
            <span className="ml-1 text-[9px] text-jade-400">N</span>
          </p>
          <p className="text-[8px] text-jade-400">
            {dragging ? 'you are pulling' : settled ? 'at rest' : 'settling…'}
          </p>
        </div>

        <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-1 text-[9px] font-medium text-ink-500">
          <MoveVertical className="h-3 w-3" /> Grab the hanger and pull it down, then let go
        </div>
      </div>

      <ControlBar>
        <SceneButton
          active={loadG === 0}
          onClick={() => {
            setLoadG(0);
            setSettled(false);
            setZeroChecked(true);
            onFlag('zero-checked');
            onFlag('recorded-zero');
          }}
        >
          <Check className="h-3 w-3" /> Zero: hanger only
        </SceneButton>
        <span className="mx-1 h-4 w-px bg-ink-200" />
        {masses.map((option) => (
          <SceneButton
            key={option}
            active={loadG === option}
            onClick={() => {
              setLoadG(option);
              setSettled(false);
            }}
          >
            {option} g
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          onClick={() => {
            setResetKey((value) => value + 1);
            setSettled(false);
          }}
        >
          <RotateCcw className="h-3 w-3" /> Still the spring
        </SceneButton>
        <SceneButton
          tone="primary"
          disabled={!settled || loadG === 0}
          onClick={() => {
            if (reading === null) return;
            onRecord({
              mass: String(loadG),
              force: ((loadG / 1000) * GRAVITY).toFixed(2),
              extension: reading.toFixed(1),
            });
            onFlag('within-elastic-limit', true);
          }}
        >
          <Check className="h-3 w-3" /> Record extension
        </SceneButton>
      </ControlBar>

      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        <Readout
          label="Extension e"
          value={extensionCm.toFixed(1)}
          unit="cm"
          size="sm"
          hint={settled ? 'steady' : 'wait for it to settle'}
        />
        <Readout
          label="Pointer reading"
          value={(2 + extensionCm).toFixed(1)}
          unit="cm"
          size="sm"
          tone="ink"
        />
        <Readout
          label="Load F = mg"
          value={((loadG / 1000) * GRAVITY).toFixed(2)}
          unit="N"
          size="sm"
          tone="amber"
        />
        <Readout
          label="Recorded e"
          value={reading !== null ? reading.toFixed(1) : '—'}
          unit="cm"
          size="sm"
          hint={zeroChecked ? 'zero checked' : 'check the zero first'}
        />
      </div>

      <div className="mt-2">
        <SceneHint tone={settled && loadG > 0 ? 'jade' : 'neutral'}>
          {loadG === 0
            ? 'With only the hanger on the spring, record the zero position. Then add a slotted mass.'
            : !settled
              ? 'The spring is still moving. Let it come to rest before taking the pointer reading.'
              : 'The spring is steady. Subtract the unloaded reading to get the extension, then record the row.'}
        </SceneHint>
      </div>
    </div>
  );
}

function SpringRig({
  loadG,
  stiffness,
  onExtension,
  onSettled,
  onDraggingChange,
}: {
  loadG: number;
  stiffness: number;
  onExtension: (cm: number) => void;
  onSettled: (settled: boolean) => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  const anchorRef = useRef<RapierRigidBody>(null);
  const hangerRef = useRef<RapierRigidBody>(null);
  const [hovered, setHovered] = useState(false);
  const loadKg = loadG / 1000;
  const totalMass = loadKg + HANGER_MASS_KG;
  const damping = Math.max(0.8, 2 * Math.sqrt(Math.max(1, stiffness * Math.max(0.05, totalMass))) * 0.75);
  const lastEmit = useRef(0);
  const settledRef = useRef(false);

  useEffect(() => {
    const body = hangerRef.current;
    if (!body) return;
    body.setAdditionalMass(loadKg, true);
  }, [loadKg]);

  const { bind } = useBodyDrag(hangerRef, {
    axis: 'y',
    follow: 14,
    maxSpeed: 1.6,
    onGrab: () => {
      onDraggingChange(true);
      settledRef.current = false;
      onSettled(false);
    },
    onRelease: () => onDraggingChange(false),
  });

  useFrame(() => {
    const body = hangerRef.current;
    if (!body) return;
    const t = body.translation();
    const distance = SPRING_TOP[1] - t.y;
    const extension = Math.max(0, distance - REST_LENGTH_M) * 100;
    const velocity = body.linvel();
    const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
    const isSettled = speed < 0.015 && Math.abs(velocity.y) < 0.015;

    const now = performance.now();
    if (now - lastEmit.current > 110) {
      lastEmit.current = now;
      onExtension(extension);
      if (isSettled !== settledRef.current) {
        settledRef.current = isSettled;
        onSettled(isSettled);
      }
    }

    // Spring top and hanger top are both at the body origins.
  });

  const springTop = useCallback(() => {
    const vector = new THREE.Vector3(SPRING_TOP[0], SPRING_TOP[1], SPRING_TOP[2]);
    return vector;
  }, []);

  const springBottom = useCallback(() => {
    const body = hangerRef.current;
    if (!body) return new THREE.Vector3(SPRING_TOP[0], SPRING_TOP[1] - REST_LENGTH_M, 0);
    const t = body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }, []);

  const massCount = Math.max(0, Math.round(loadG / 50));

  return (
    <group>
      <mesh receiveShadow position={[0, -0.02, 0]}>
        <boxGeometry args={[6.5, 0.08, 3.2]} />
        <meshStandardMaterial color="#d8c9a5" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[6.5, 0.02, 3.2]} />
        <meshStandardMaterial color="#e9dec4" roughness={0.7} />
      </mesh>

      {/* Retort stand */}
      <mesh castShadow position={[-0.82, 1.25, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 2.5, 24]} />
        <meshStandardMaterial color="#59616c" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh castShadow position={[-0.82, 0.03, 0]}>
        <boxGeometry args={[0.46, 0.06, 0.32]} />
        <meshStandardMaterial color="#3f4650" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-0.44, 2.27, 0]} castShadow>
        <boxGeometry args={[0.82, 0.055, 0.06]} />
        <meshStandardMaterial color="#59616c" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 2.27, 0]}>
        <boxGeometry args={[0.12, 0.11, 0.11]} />
        <meshStandardMaterial color="#2f3540" metalness={0.6} roughness={0.3} />
      </mesh>

      <RigidBody ref={anchorRef} type="fixed" colliders={false} position={SPRING_TOP} />

      <RigidBody
        ref={hangerRef}
        colliders={false}
        position={[0, SPRING_TOP[1] - REST_LENGTH_M, 0]}
        canSleep={false}
        linearDamping={0.02}
        enabledRotations={[false, false, false]}
      >
        <CuboidCollider args={[0.14, 0.025, 0.09]} position={[0, -0.025, 0]} mass={0.0001} />
        <group
          onPointerOver={(event) => {
            event.stopPropagation();
            setHovered(true);
            document.body.style.cursor = 'grab';
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = '';
          }}
          {...bind}
        >
          {/* Hanger plate */}
          <mesh castShadow position={[0, -0.025, 0]}>
            <boxGeometry args={[0.28, 0.05, 0.18]} />
            <meshStandardMaterial
              color={hovered ? '#94a3b8' : '#7c8794'}
              metalness={0.65}
              roughness={0.35}
            />
          </mesh>
          <mesh position={[0, -0.06, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.08, 12]} />
            <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.4} />
          </mesh>

          {/* Slotted masses */}
          {Array.from({ length: massCount }, (_, index) => (
            <mesh
              key={index}
              castShadow
              position={[0, -0.075 - index * 0.026, 0]}
            >
              <cylinderGeometry args={[0.105, 0.105, 0.022, 28]} />
              <meshStandardMaterial color="#8b98a7" metalness={0.6} roughness={0.38} />
            </mesh>
          ))}

          {hovered ? (
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
              <torusGeometry args={[0.16, 0.006, 8, 28]} />
              <meshBasicMaterial color="#0f766e" transparent opacity={0.8} />
            </mesh>
          ) : null}
        </group>
      </RigidBody>

      <SpringLink
        key={`${loadG}-${stiffness}`}
        anchorRef={anchorRef}
        hangerRef={hangerRef}
        stiffness={stiffness}
        damping={damping}
      />
      <SpringCoil from={springTop} to={springBottom} radius={0.045} turns={10} />

      {/* Pointer to the metre rule */}
      <PointerLine hangerRef={hangerRef} />

      {/* Metre rule */}
      <group position={[0.56, 0.48, 0]}>
        <mesh>
          <boxGeometry args={[0.16, 1.72, 0.018]} />
          <meshStandardMaterial color="#f3e6c8" roughness={0.75} />
        </mesh>
        <Graduations position={[0, 0.1, 0.012]} height={1.52} count={16} width={0.13} />
      </group>
    </group>
  );
}

function SpringLink({
  anchorRef,
  hangerRef,
  stiffness,
  damping,
}: {
  anchorRef: React.RefObject<RapierRigidBody>;
  hangerRef: React.RefObject<RapierRigidBody>;
  stiffness: number;
  damping: number;
}) {
  useSpringJoint(anchorRef, hangerRef, [
    [0, 0, 0],
    [0, 0, 0],
    REST_LENGTH_M,
    stiffness,
    damping,
  ]);
  return null;
}

function PointerLine({ hangerRef }: { hangerRef: React.RefObject<RapierRigidBody> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const body = hangerRef.current;
    const mesh = ref.current;
    if (!body || !mesh) return;
    const t = body.translation();
    mesh.position.y = t.y;
  });
  return (
    <group position={[0.25, 0, 0]}>
      <mesh ref={ref} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.0035, 0.0035, 0.7, 8]} />
        <meshStandardMaterial color="#b91c1c" />
      </mesh>
    </group>
  );
}
