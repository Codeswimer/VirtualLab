import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Physics,
  RigidBody,
  useSphericalJoint,
  type RapierRigidBody,
} from '@react-three/rapier';
import * as THREE from 'three';
import { pendulumReleaseGeometry, type Vec3 } from './pendulum-geometry';

const UP = new THREE.Vector3(0, 1, 0);

export interface PendulumApparatusProps {
  /** World position of the point of suspension. */
  pivot: Vec3;
  /** Pivot → centre of bob, in metres. */
  lengthM: number;
  /** Release angle from the vertical, in degrees. Keep below 10° for SHM. */
  amplitudeDeg: number;
  /** Free-fall acceleration used by the rigid-body world, m/s². */
  g: number;
  /** Changing this remounts the world, releasing the bob again. */
  releaseKey?: number;
}

/**
 * Rigid-body simple pendulum (PHY-01).
 *
 * Rapier drives what the student sees; the timings recorded in the table come
 * from the analytic solver (ADR-002), so the table never depends on frame rate
 * or on how long the scene has been open.
 */
export function PendulumApparatus({
  pivot,
  lengthM,
  amplitudeDeg,
  g,
  releaseKey = 0,
}: PendulumApparatusProps) {
  return (
    <Physics
      key={`${lengthM}-${amplitudeDeg}-${releaseKey}`}
      gravity={[0, -g, 0]}
      timeStep={1 / 120}
    >
      <PendulumBodies pivot={pivot} lengthM={lengthM} amplitudeDeg={amplitudeDeg} />
    </Physics>
  );
}

function PendulumBodies({
  pivot,
  lengthM,
  amplitudeDeg,
}: Pick<PendulumApparatusProps, 'pivot' | 'lengthM' | 'amplitudeDeg'>) {
  const anchorRef = useRef<RapierRigidBody>(null);
  const bobRef = useRef<RapierRigidBody>(null);
  const threadRef = useRef<THREE.Mesh>(null);

  const { bobPosition, pivotInBobFrame } = useMemo(
    () => pendulumReleaseGeometry(pivot, lengthM, amplitudeDeg),
    [pivot, lengthM, amplitudeDeg],
  );

  useSphericalJoint(anchorRef, bobRef, [[0, 0, 0], pivotInBobFrame]);

  const scratch = useMemo(
    () => ({ direction: new THREE.Vector3(), mid: new THREE.Vector3() }),
    [],
  );

  useFrame(() => {
    const body = bobRef.current;
    const thread = threadRef.current;
    if (!body || !thread) return;
    const { x, y, z } = body.translation();
    const { direction, mid } = scratch;
    direction.set(x - pivot[0], y - pivot[1], z - pivot[2]);
    const span = direction.length() || lengthM;
    mid.set(pivot[0], pivot[1], pivot[2]).addScaledVector(direction, 0.5);
    thread.position.copy(mid);
    thread.quaternion.setFromUnitVectors(UP, direction.normalize());
    thread.scale.y = span;
  });

  const bobRadius = Math.max(0.055, Math.min(0.11, lengthM * 0.09));

  return (
    <>
      {/* Fixed suspension point */}
      <RigidBody ref={anchorRef} type="fixed" position={pivot}>
        <mesh>
          <sphereGeometry args={[0.022, 24, 24]} />
          <meshStandardMaterial color="#1f2937" metalness={0.7} roughness={0.3} />
        </mesh>
      </RigidBody>

      {/* Thread: drawn from the live bob translation so it always runs pivot → bob */}
      <mesh ref={threadRef} castShadow>
        <cylinderGeometry args={[0.0035, 0.0035, 1, 8]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.8} />
      </mesh>

      {/* Swinging bob, joined to the pivot at distance L */}
      <RigidBody
        ref={bobRef}
        position={bobPosition}
        colliders="ball"
        mass={0.05}
        linearDamping={0}
        angularDamping={0.4}
      >
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
      </RigidBody>
    </>
  );
}
