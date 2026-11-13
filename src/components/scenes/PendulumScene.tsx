import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei';
import {
  BallCollider,
  Physics,
  RigidBody,
  useAfterPhysicsStep,
  useRevoluteJoint,
  type RapierRigidBody,
} from '@react-three/rapier';
import { Check, MoveVertical, RotateCcw, Timer } from 'lucide-react';
import * as THREE from 'three';
import { createRng, hashSeed } from '@sim/rng';
import { measure } from '@sim/measurement';
import { ControlBar, Readout, SceneButton, SceneHint } from './kit';
import type { Vec3 } from './apparatus/pendulum-geometry';
import { angleFromVertical, pendulumTensionN } from './physics/bench-physics';
import { TautCable } from './physics/visuals';
import { useBodyDrag } from './physics/use-body-drag';
import type { SceneProps } from './types';

/** Point of suspension: on the retort-stand beam, clear of the clamp. */
const PIVOT: Vec3 = [0, 2.42, 0];
const BOB_RADIUS = 0.085;

type RunPhase = 'idle' | 'swinging' | 'timed';

interface RunState {
  phase: RunPhase;
  /** Half-oscillations counted since the first centre crossing. */
  swings: number;
  time: number | null;
  /** Simulated seconds since the timing crossing, shown live on the watch. */
  elapsed: number;
  amplitude: number;
}

const IDLE: RunState = { phase: 'idle', swings: 0, time: null, elapsed: 0, amplitude: 0 };

export default function PendulumScene({ attempt, scenario, onRecord, onFlag }: SceneProps) {
  const lengths = scenario.lengthsM as number[];
  const [lengthIndex, setLengthIndex] = useState(0);
  const [resetKey, setResetKey] = useState(0);
  const [run, setRun] = useState<RunState>(IDLE);
  const [dragging, setDragging] = useState(false);
  const [tension, setTension] = useState(0);

  const length = lengths[lengthIndex] ?? 0.6;
  const amplitude = scenario.amplitudeDeg as number;
  const oscillations = scenario.oscillations as number;
  const g = scenario.g as number;

  const flagRef = useRef(onFlag);
  useEffect(() => {
    flagRef.current = onFlag;
  }, [onFlag]);
  useEffect(() => {
    if (run.phase === 'swinging') flagRef.current('multiple-swings');
  }, [run.phase]);

  const chooseLength = useCallback((index: number) => {
    setLengthIndex(index);
    setResetKey((value) => value + 1);
    setRun(IDLE);
  }, []);

  const handleRunState = useCallback((next: RunState) => setRun(next), []);

  const handleTimed = useCallback(
    (time: number, releaseAmplitude: number) => {
      setRun({
        phase: 'timed',
        swings: oscillations * 2,
        time,
        elapsed: time,
        amplitude: releaseAmplitude,
      });
    },
    [oscillations],
  );

  const period = run.time !== null ? run.time / oscillations : null;

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-[#eee9dc]">
        <div className="h-[360px] w-full sm:h-[420px]">
          <Canvas
            dpr={[1, 1.75]}
            camera={{ position: [2.4, 2.15, 3.9], fov: 38 }}
            gl={{ antialias: true, alpha: true }}
          >
            <color attach="background" args={['#eee9dc']} />
            <fog attach="fog" args={['#eee9dc', 7, 12]} />
            <ambientLight intensity={0.66} />
            <directionalLight
              position={[3, 6, 4]}
              intensity={2.1}
              castShadow
              shadow-mapSize={[1024, 1024]}
            />
            <directionalLight position={[-4, 3, -2]} intensity={0.5} color="#bae6fd" />
            <Suspense fallback={null}>
              <Physics gravity={[0, -g, 0]} timeStep={1 / 30}>
                <PendulumRig
                  key={`${length}-${resetKey}`}
                  length={length}
                  amplitudeDeg={amplitude}
                  g={g}
                  oscillations={oscillations}
                  stopwatchZeroS={scenario.stopwatchZeroS as number}
                  clockSeed={hashSeed(attempt.seed, 'pendulum-clock', length, resetKey)}
                  onDraggingChange={setDragging}
                  onRunState={handleRunState}
                  onTimed={handleTimed}
                  onTension={setTension}
                  onLengthChange={chooseLength}
                />
              </Physics>
            </Suspense>
            <ContactShadows position={[0, 0.01, 0]} opacity={0.33} scale={7} blur={2.4} far={4} />
            <OrbitControls
              enabled={!dragging}
              enablePan={false}
              minDistance={3}
              maxDistance={7}
              minPolarAngle={0.55}
              maxPolarAngle={1.42}
              target={[0, 1.55, 0]}
            />
          </Canvas>
        </div>

        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/80 px-2.5 py-1.5 backdrop-blur-sm">
          <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">Simple pendulum</p>
          <p className="font-mono text-[11px] font-semibold text-ink-800">
            L = {length.toFixed(2)} m · θ₀ = {(run.amplitude || amplitude).toFixed(0)}°
          </p>
        </div>

        <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-[#0d2b24]/95 px-3 py-2 text-right">
          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-jade-300">Stopwatch</p>
          <p className="font-mono text-xl font-semibold tabular-nums text-jade-100">
            {run.phase === 'timed' && run.time !== null
              ? run.time.toFixed(2)
              : run.phase === 'swinging'
                ? run.elapsed.toFixed(2)
                : '0.00'}
            <span className="ml-1 text-[9px] text-jade-400">s</span>
          </p>
          <p className="text-[8px] text-jade-400">
            {run.phase === 'timed'
              ? `${oscillations} oscillations`
              : run.phase === 'swinging'
                ? `swing ${Math.min(oscillations, Math.floor(run.swings / 2))} / ${oscillations}`
                : 'release to start'}
          </p>
        </div>

        <div className="pointer-events-none absolute bottom-2 left-3 flex items-center gap-1 text-[9px] font-medium text-ink-500">
          <MoveVertical className="h-3 w-3" />
          Drag the bob to swing · drag the thread grip on the stand to set L
        </div>
      </div>

      <ControlBar>
        {lengths.map((option, index) => (
          <SceneButton
            key={option}
            active={lengthIndex === index}
            onClick={() => chooseLength(index)}
          >
            L = {option.toFixed(2)} m
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          onClick={() => {
            setResetKey((value) => value + 1);
            setRun(IDLE);
          }}
        >
          <RotateCcw className="h-3 w-3" /> Reset swing
        </SceneButton>
        <SceneButton
          tone="primary"
          disabled={run.phase !== 'timed' || run.time === null}
          onClick={() => {
            if (run.time === null) return;
            const measuredPeriod = run.time / oscillations;
            onRecord({
              length: length.toFixed(2),
              time: run.time.toFixed(2),
              period: measuredPeriod.toFixed(2),
              t2: (measuredPeriod ** 2).toFixed(3),
            });
            setRun(IDLE);
            setResetKey((value) => value + 1);
            onFlag('repeated');
          }}
        >
          <Check className="h-3 w-3" /> Record row
        </SceneButton>
      </ControlBar>

      <div className="mt-2 grid gap-2 sm:grid-cols-4">
        <Readout
          label="Thread tension"
          value={tension.toFixed(2)}
          unit="N"
          size="sm"
          hint="live, from the swing"
        />
        <Readout
          label="Stopwatch"
          value={run.time !== null ? run.time.toFixed(2) : '—'}
          unit="s"
          size="sm"
          tone="ink"
        />
        <Readout
          label="Period T"
          value={period !== null ? period.toFixed(3) : '—'}
          unit="s"
          size="sm"
        />
        <Readout
          label="T²"
          value={period !== null ? (period ** 2).toFixed(3) : '—'}
          unit="s²"
          size="sm"
          tone="amber"
        />
      </div>

      <div className="mt-2">
        <SceneHint tone={run.phase === 'timed' ? 'jade' : 'neutral'}>
          {run.phase === 'timed'
            ? 'The stopwatch stopped after 20 complete swings. Record the row, then change the thread length.'
            : run.phase === 'swinging'
              ? 'The stopwatch starts as the bob passes the centre. Keep the swing in one plane and let it run for 20 complete oscillations.'
              : 'Grab the brass bob, pull it aside by about 5° and let go. The timer starts on the first centre crossing.'}
        </SceneHint>
      </div>

      <p className="mt-2 flex items-center gap-1 text-[10px] text-ink-400">
        <Timer className="h-3 w-3" /> The swing is solved by Rapier with real gravity, so the
        recorded time comes from the motion you actually released.
      </p>
    </div>
  );
}

function PendulumRig({
  length,
  amplitudeDeg,
  g,
  oscillations,
  stopwatchZeroS,
  clockSeed,
  onDraggingChange,
  onRunState,
  onTimed,
  onTension,
  onLengthChange,
}: {
  length: number;
  amplitudeDeg: number;
  g: number;
  oscillations: number;
  stopwatchZeroS: number;
  clockSeed: number;
  onDraggingChange: (dragging: boolean) => void;
  onRunState: (state: RunState) => void;
  onTimed: (time: number, releaseAmplitudeDeg: number) => void;
  onTension: (tension: number) => void;
  onLengthChange: (index: number) => void;
}) {
  const anchorRef = useRef<RapierRigidBody>(null);
  const rodRef = useRef<RapierRigidBody>(null);
  const [hovered, setHovered] = useState(false);

  const theta0 = (amplitudeDeg * Math.PI) / 180;
  const bobRadius = BOB_RADIUS;

  const phase = useRef<'idle' | 'armed' | 'timing' | 'timed'>('idle');
  const previousSide = useRef(0);
  const count = useRef(0);
  const startedAt = useRef(0);
  const simTime = useRef(0);
  const releaseAmplitude = useRef(amplitudeDeg);
  const lastTensionAt = useRef(0);
  const random = useMemo(() => createRng(clockSeed).next, [clockSeed]);

  const quaternion = useMemo(() => new THREE.Quaternion(), []);
  const bobWorld = useMemo(() => new THREE.Vector3(), []);
  const pivotWorld = useMemo(() => new THREE.Vector3(...PIVOT), []);

  const readBobWorld = useCallback(
    (body: RapierRigidBody, out: THREE.Vector3) => {
      const q = body.rotation();
      const t = body.translation();
      quaternion.set(q.x, q.y, q.z, q.w);
      out.set(0, -length, 0).applyQuaternion(quaternion);
      out.set(out.x + t.x, out.y + t.y, out.z + t.z);
      return true;
    },
    [length, quaternion],
  );

  const release = useCallback(() => {
    const body = rodRef.current;
    if (!body) return;
    const q = body.rotation();
    const angle = 2 * Math.atan2(q.z, q.w);
    const degrees = Math.abs((angle * 180) / Math.PI);
    if (degrees < 2) {
      phase.current = 'idle';
      onRunState(IDLE);
      return;
    }
    releaseAmplitude.current = degrees;
    phase.current = 'armed';
    previousSide.current = Math.sign(angle);
    count.current = 0;
    onRunState({ phase: 'swinging', swings: 0, time: null, elapsed: 0, amplitude: degrees });
  }, [onRunState]);

  const { bind } = useBodyDrag(rodRef, {
    getPoint: readBobWorld,
    follow: 18,
    maxSpeed: 3.2,
    onGrab: () => {
      phase.current = 'idle';
      onRunState(IDLE);
      onDraggingChange(true);
    },
    onRelease: () => {
      onDraggingChange(false);
      release();
    },
  });

  useAfterPhysicsStep((world) => {
    simTime.current += world.timestep;
    const body = rodRef.current;
    if (!body) return;

    readBobWorld(body, bobWorld);
    const angle = angleFromVertical(
      bobWorld.x,
      bobWorld.y,
      PIVOT[0],
      PIVOT[1],
    );
    const side = Math.sign(angle);

    if (phase.current === 'armed') {
      if (side !== 0 && side !== previousSide.current) {
        startedAt.current = simTime.current;
        count.current = 0;
        phase.current = 'timing';
        previousSide.current = side;
        onRunState({
          phase: 'swinging',
          swings: 0,
          time: null,
          elapsed: 0,
          amplitude: releaseAmplitude.current,
        });
      }
    } else if (phase.current === 'timing') {
      if (side !== 0 && side !== previousSide.current) {
        count.current += 1;
        previousSide.current = side;
        const totalCrossings = oscillations * 2;
        if (count.current >= totalCrossings) {
          const elapsed = simTime.current - startedAt.current;
          phase.current = 'timed';
          const reading = measure(elapsed, 'stopwatch', {
            zeroError: stopwatchZeroS,
            random,
          });
          onTimed(reading, releaseAmplitude.current);
        } else {
          onRunState({
            phase: 'swinging',
            swings: count.current,
            time: null,
            elapsed: simTime.current - startedAt.current,
            amplitude: releaseAmplitude.current,
          });
        }
      }
    }

    const now = performance.now();
    if (now - lastTensionAt.current > 140) {
      lastTensionAt.current = now;
      const velocity = body.linvel();
      const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
      onTension(
        pendulumTensionN({
          massKg: body.mass(),
          gravity: g,
          lengthM: length,
          angleRad: angle,
          speedMs: speed,
        }),
      );
    }
  });

  const readThreadTop = useCallback(() => pivotWorld, [pivotWorld]);
  const readBob = useCallback(() => {
    const body = rodRef.current;
    if (body) readBobWorld(body, bobWorld);
    return bobWorld;
  }, [bobWorld, readBobWorld]);

  return (
    <group>
      {/* Bench */}
      <mesh receiveShadow position={[0, -0.02, 0]}>
        <boxGeometry args={[7, 0.08, 3.4]} />
        <meshStandardMaterial color="#d8c9a5" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[7, 0.02, 3.4]} />
        <meshStandardMaterial color="#e9dec4" roughness={0.7} />
      </mesh>

      {/* Retort stand */}
      <mesh castShadow position={[-1.02, 1.24, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 2.48, 24]} />
        <meshStandardMaterial color="#59616c" metalness={0.55} roughness={0.35} />
      </mesh>
      <RoundedBox args={[1.25, 0.06, 0.06]} radius={0.025} position={[-0.42, 2.46, 0]} castShadow>
        <meshStandardMaterial color="#59616c" metalness={0.55} roughness={0.35} />
      </RoundedBox>
      <mesh castShadow position={[-1.02, 0.03, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.34]} />
        <meshStandardMaterial color="#3f4650" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Clamp at the suspension point */}
      <mesh position={[PIVOT[0], PIVOT[1] + 0.03, 0]}>
        <boxGeometry args={[0.12, 0.14, 0.12]} />
        <meshStandardMaterial color="#2f3540" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Length grip on the upright */}
      <LengthGrip length={length} onLengthChange={onLengthChange} />

      {/* Anchor body. No collider: it only carries the revolute joint. */}
      <RigidBody ref={anchorRef} type="fixed" colliders={false} position={PIVOT} />

      {/* Pendulum rod: the body origin is the pivot, the bob is a collider at -L. */}
      <RigidBody
        ref={rodRef}
        colliders={false}
        position={PIVOT}
        rotation={[0, 0, theta0]}
        canSleep={false}
        linearDamping={0}
        angularDamping={0}
      >
        <BallCollider args={[bobRadius]} position={[0, -length, 0]} density={30} />

        <group position={[0, -length, 0]}>
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
            <mesh castShadow>
              <sphereGeometry args={[bobRadius, 32, 32]} />
              <meshStandardMaterial
                color="#d4a017"
                metalness={0.9}
                roughness={0.18}
                emissive="#f59e0b"
                emissiveIntensity={hovered ? 0.38 : 0.06}
              />
            </mesh>
            <mesh>
              <sphereGeometry args={[bobRadius * 1.06, 32, 32]} />
              <meshStandardMaterial
                color="#facc15"
                metalness={0.4}
                roughness={0.5}
                transparent
                opacity={0.12}
              />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} visible={hovered}>
              <torusGeometry args={[bobRadius * 1.3, 0.008, 8, 32]} />
              <meshBasicMaterial color="#0f766e" transparent opacity={0.8} />
            </mesh>
          </group>
        </group>
      </RigidBody>

      <PivotJoint anchorRef={anchorRef} rodRef={rodRef} />
      <TautCable from={readThreadTop} to={readBob} radius={0.0045} color="#f5f5f4" />

      {/* Recommended small-angle release zone */}
      <mesh position={PIVOT} rotation={[0, 0, -Math.PI / 2 - (10 * Math.PI) / 180]}>
        <torusGeometry args={[length, 0.0022, 8, 90, (20 * Math.PI) / 180]} />
        <meshBasicMaterial color="#0f766e" transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

function PivotJoint({
  anchorRef,
  rodRef,
}: {
  anchorRef: React.RefObject<RapierRigidBody>;
  rodRef: React.RefObject<RapierRigidBody>;
}) {
  useRevoluteJoint(anchorRef, rodRef, [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 1],
  ]);
  return null;
}

/**
 * Thread grip: drag it up or down to reel the thread in or out. The length
 * snaps to the five prescribed values so recorded rows match the table keys.
 */
function LengthGrip({
  length,
  onLengthChange,
}: {
  length: number;
  onLengthChange: (index: number) => void;
}) {
  const { pointer } = useThree();
  const active = useRef(false);
  const nearest = useRef([0.3, 0.45, 0.6, 0.75, 0.9].indexOf(length));
  const [hovered, setHovered] = useState(false);

  const y = 1.18 + ((length - 0.3) / 0.6) * 0.42;

  useFrame(() => {
    if (!active.current) return;
    const t = Math.min(1, Math.max(0, (pointer.y + 1) / 2));
    const raw = 0.3 + t * 0.6;
    const options = [0.3, 0.45, 0.6, 0.75, 0.9];
    let best = 0;
    let bestDistance = Infinity;
    options.forEach((option, index) => {
      const distance = Math.abs(option - raw);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    if (best !== nearest.current) {
      nearest.current = best;
      onLengthChange(best);
    }
  });

  return (
    <group position={[-1.02, y, 0.13]}>
      <mesh position={[0, 0, -0.13]}>
        <boxGeometry args={[0.055, 0.5, 0.02]} />
        <meshStandardMaterial color="#a8b0ba" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh
        onPointerDown={(event) => {
          event.stopPropagation();
          active.current = true;
          (
            event.target as unknown as { setPointerCapture?: (id: number) => void }
          ).setPointerCapture?.(event.pointerId);
          document.body.style.cursor = 'ns-resize';
        }}
        onPointerUp={(event) => {
          active.current = false;
          (
            event.target as unknown as { releasePointerCapture?: (id: number) => void }
          ).releasePointerCapture?.(event.pointerId);
          document.body.style.cursor = '';
        }}
        onPointerCancel={() => {
          active.current = false;
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'ns-resize';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = '';
        }}
      >
        <sphereGeometry args={[0.065, 24, 24]} />
        <meshStandardMaterial
          color={hovered ? '#0f766e' : '#d4a017'}
          metalness={0.7}
          roughness={0.3}
          emissive={hovered ? '#0f766e' : '#000000'}
          emissiveIntensity={hovered ? 0.35 : 0}
        />
      </mesh>
      <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.045, 0.006, 8, 20]} />
        <meshBasicMaterial color="#0f766e" transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

