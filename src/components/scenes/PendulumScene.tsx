import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei';
import { Play, RotateCcw, Square, Timer } from 'lucide-react';
import { createRng, hashSeed } from '@sim/rng';
import { measure } from '@sim/measurement';
import { periodFiniteAmplitude } from '@sim/physics/pendulum';
import { ControlBar, Readout, SceneButton, SceneHint } from './kit';
import { PendulumApparatus } from './apparatus/Pendulum';
import type { Vec3 } from './apparatus/pendulum-geometry';
import type { SceneProps } from './types';

/** Point of suspension: on the retort-stand beam, clear of the clamp. */
const PIVOT: Vec3 = [0, 2.62, 0];

export default function PendulumScene({ attempt, scenario, onRecord, onFlag }: SceneProps) {
  const lengths = scenario.lengthsM as number[];
  const [lengthIndex, setLengthIndex] = useState(0);
  const [timing, setTiming] = useState(false);
  const [done, setDone] = useState(false);
  const [releaseKey, setReleaseKey] = useState(0);
  const length = lengths[lengthIndex] ?? 0.6;
  const amplitude = scenario.amplitudeDeg as number;
  const oscillations = scenario.oscillations as number;

  const period = periodFiniteAmplitude(length, amplitude, scenario.g as number);

  const measuredTime = useMemo(() => {
    const rng = createRng(hashSeed(attempt.seed, 'pendulum', length));
    return measure(
      period * oscillations + (scenario.stopwatchZeroS as number),
      'stopwatch',
      { random: rng.next },
    );
  }, [attempt.seed, length, period, oscillations, scenario.stopwatchZeroS]);

  useEffect(() => {
    if (!timing) return;
    const timer = window.setTimeout(() => {
      setTiming(false);
      setDone(true);
    }, 5200);
    return () => window.clearTimeout(timer);
  }, [timing]);

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl bg-[#eee9dc]">
        <div className="h-[340px] w-full sm:h-[400px]">
          <Canvas
            dpr={[1, 1.75]}
            camera={{ position: [2.2, 2.1, 4.1], fov: 38 }}
            gl={{ antialias: true, alpha: true }}
          >
            <color attach="background" args={['#eee9dc']} />
            <fog attach="fog" args={['#eee9dc', 7, 12]} />
            <ambientLight intensity={0.65} />
            <directionalLight position={[3, 6, 4]} intensity={2.1} castShadow shadow-mapSize={[1024, 1024]} />
            <directionalLight position={[-4, 3, -2]} intensity={0.5} color="#bae6fd" />
            <Suspense fallback={null}>
              <PendulumRig
                length={length}
                amplitudeDeg={amplitude}
                g={scenario.g as number}
                releaseKey={releaseKey}
              />
            </Suspense>
            <ContactShadows position={[0, 0.01, 0]} opacity={0.35} scale={7} blur={2.4} far={4} />
            <OrbitControls
              enablePan={false}
              minDistance={3}
              maxDistance={7}
              minPolarAngle={0.55}
              maxPolarAngle={1.42}
              target={[0, 1.6, 0]}
            />
          </Canvas>
        </div>
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/80 px-2.5 py-1.5 backdrop-blur-sm">
          <p className="text-[9px] font-bold uppercase tracking-wider text-ink-400">Simple pendulum</p>
          <p className="font-mono text-[11px] font-semibold text-ink-800">
            L = {length.toFixed(2)} m · θ₀ = {amplitude.toFixed(0)}°
          </p>
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-[#0d2b24]/95 px-3 py-2 text-right">
          <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-jade-300">Stopwatch</p>
          <p className="font-mono text-xl font-semibold tabular-nums text-jade-100">
            {timing ? `${(oscillations / 2).toFixed(0)}…` : done ? measuredTime.toFixed(2) : '0.00'}
            <span className="ml-1 text-[9px] text-jade-400">s</span>
          </p>
          <p className="text-[8px] text-jade-400">
            {timing ? 'timing 20 swings' : done ? '20 oscillations' : 'ready'}
          </p>
        </div>
        <p className="absolute bottom-2 right-3 text-[9px] font-medium text-ink-400">
          Drag to orbit
        </p>
      </div>

      <ControlBar>
        {lengths.map((option, index) => (
          <SceneButton
            key={option}
            active={lengthIndex === index}
            onClick={() => {
              setLengthIndex(index);
              setDone(false);
              setTiming(false);
            }}
          >
            L = {option.toFixed(2)} m
          </SceneButton>
        ))}
        <span className="mx-1 h-4 w-px bg-ink-200" />
        <SceneButton
          tone="primary"
          active={timing}
          onClick={() => {
            setDone(false);
            setReleaseKey((value) => value + 1);
            setTiming(true);
            onFlag('multiple-swings');
          }}
        >
          {timing ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
          {timing ? 'Timing…' : 'Time 20 swings'}
        </SceneButton>
        <SceneButton
          disabled={!done}
          onClick={() => {
            onRecord({
              length: length.toFixed(2),
              time: measuredTime.toFixed(2),
              period: (measuredTime / oscillations).toFixed(2),
              t2: ((measuredTime / oscillations) ** 2).toFixed(3),
            });
            setDone(false);
            onFlag('repeated');
          }}
        >
          <RotateCcw className="h-3 w-3" /> Record row
        </SceneButton>
      </ControlBar>

      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <Readout label="Period T" value={period.toFixed(3)} unit="s" size="sm" hint="analytic, small-angle corrected" />
        <Readout
          label="Stopwatch"
          value={done || timing ? (timing ? '—' : measuredTime.toFixed(2)) : '0.00'}
          unit="s"
          size="sm"
          tone="ink"
        />
        <Readout
          label="T²"
          value={done ? ((measuredTime / oscillations) ** 2).toFixed(3) : '—'}
          unit="s²"
          size="sm"
          tone="amber"
        />
      </div>

      <div className="mt-2">
        <SceneHint tone={done ? 'jade' : 'neutral'}>
          {done
            ? 'Stopwatch stopped after 20 swings. Divide by 20 for T, then click Record row.'
            : 'Keep the amplitude below about 10°. Start the stopwatch as the bob passes the centre and count 20 complete swings.'}
        </SceneHint>
      </div>
      <p className="mt-2 flex items-center gap-1 text-[10px] text-ink-400">
        <Timer className="h-3 w-3" /> The bob is a Rapier rigid body. Recorded times come from the
        analytic period with the stopwatch’s least count and zero error, so they never depend on
        frame rate.
      </p>
    </div>
  );
}

function PendulumRig({
  length,
  amplitudeDeg,
  g,
  releaseKey,
}: {
  length: number;
  amplitudeDeg: number;
  g: number;
  releaseKey: number;
}) {
  const pivotY = PIVOT[1];
  const theta0 = (amplitudeDeg * Math.PI) / 180;

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

      {/* Stand */}
      <mesh castShadow position={[-1.05, 1.34, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 2.7, 24]} />
        <meshStandardMaterial color="#59616c" metalness={0.55} roughness={0.35} />
      </mesh>
      <RoundedBox args={[1.3, 0.055, 0.055]} radius={0.025} position={[-0.45, pivotY, 0]} castShadow>
        <meshStandardMaterial color="#59616c" metalness={0.55} roughness={0.35} />
      </RoundedBox>
      <mesh castShadow position={[-1.05, 0.03, 0]}>
        <boxGeometry args={[0.5, 0.06, 0.34]} />
        <meshStandardMaterial color="#3f4650" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* Clamp */}
      <mesh position={[-0.86, pivotY, 0]}>
        <boxGeometry args={[0.12, 0.14, 0.12]} />
        <meshStandardMaterial color="#2f3540" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Rigid-body pendulum: pivot, thread and bob */}
      <PendulumApparatus
        pivot={PIVOT}
        lengthM={length}
        amplitudeDeg={amplitudeDeg}
        g={g}
        releaseKey={releaseKey}
      />

      {/* Ghost arc: the release limits, ±θ₀ about the vertical */}
      <mesh position={PIVOT} rotation={[0, 0, -Math.PI / 2 - theta0]}>
        <torusGeometry args={[length, 0.002, 8, 90, theta0 * 2]} />
        <meshBasicMaterial color="#0f766e" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}
