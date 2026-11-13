import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { periodFiniteAmplitude } from '@sim/physics/pendulum';
import { pendulumBobPosition, type Vec3 } from './pendulum-geometry';

const UP = new THREE.Vector3(0, 1, 0);
const DEG_TO_RAD = Math.PI / 180;

export interface PendulumApparatusProps {
  /** World position of the point of suspension. */
  pivot: Vec3;
  /** Pivot → centre of bob, in metres. */
  lengthM: number;
  /** Release angle from the vertical, in degrees. Keep below 10° for SHM. */
  amplitudeDeg: number;
  /** Free-fall acceleration used to derive the period, m/s². */
  g: number;
  /** Changing this releases the bob again. */
  releaseKey?: number;
}

/**
 * Simple pendulum (PHY-01).
 *
 * The swing is animated from θ(t) = θ₀ cos(2πt / T), using the same
 * finite-amplitude period the stopwatch readout is built on (ADR-002), so the
 * scene stays in step with the recorded times and never depends on frame rate.
 */
export function PendulumApparatus({
  pivot,
  lengthM,
  amplitudeDeg,
  g,
  releaseKey = 0,
}: PendulumApparatusProps) {
  const threadRef = useRef<THREE.Mesh>(null);
  const bobRef = useRef<THREE.Group>(null);
  const startedAt = useRef(0);

  const theta0 = amplitudeDeg * DEG_TO_RAD;
  const period = periodFiniteAmplitude(lengthM, amplitudeDeg, g);
  const bobRadius = Math.max(0.055, Math.min(0.11, lengthM * 0.09));

  // Release the bob from the start angle again on mount, length change or re-release.
  useEffect(() => {
    startedAt.current = performance.now();
  }, [releaseKey, lengthM, amplitudeDeg]);

  const scratch = useMemo(() => ({ direction: new THREE.Vector3() }), []);

  useFrame(() => {
    const bob = bobRef.current;
    const thread = threadRef.current;
    if (!bob || !thread) return;
    if (!startedAt.current) startedAt.current = performance.now();
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const theta = theta0 * Math.cos((2 * Math.PI * elapsed) / period);
    const [bobX, bobY, bobZ] = pendulumBobPosition(pivot, lengthM, theta);
    bob.position.set(bobX, bobY, bobZ);

    const [pivotX, pivotY, pivotZ] = pivot;
    const { direction } = scratch;
    direction.set(bobX - pivotX, bobY - pivotY, bobZ - pivotZ);
    thread.position.set(
      pivotX + direction.x / 2,
      pivotY + direction.y / 2,
      pivotZ + direction.z / 2,
    );
    thread.quaternion.setFromUnitVectors(UP, direction.normalize());
    thread.scale.y = lengthM;
  });

  return (
    <>
      {/* Fixed suspension point */}
      <mesh position={pivot}>
        <sphereGeometry args={[0.022, 24, 24]} />
        <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Thread: runs pivot → bob every frame */}
      <mesh ref={threadRef} castShadow>
        <cylinderGeometry args={[0.0035, 0.0035, 1, 8]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.8} />
      </mesh>

      {/* Bob, held one length from the pivot */}
      <group ref={bobRef}>
        <mesh castShadow>
          <sphereGeometry args={[bobRadius, 32, 32]} />
          <meshStandardMaterial color="#d4a017" metalness={0.9} roughness={0.18} />
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
      </group>
    </>
  );
}
