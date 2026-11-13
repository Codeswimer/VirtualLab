import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);

/** Three.js ignores CSS colour alpha; strip rgba() to avoid console warnings. */
export function solidColor(color: string): string {
  const match = color.match(/^rgba\(([^,]+),([^,]+),([^,]+),([^)]+)\)$/i);
  return match ? `rgb(${match[1]},${match[2]},${match[3]})` : color;
}

export type WorldPoint = (out: THREE.Vector3) => THREE.Vector3 | void;

const resolvePoint = (point: WorldPoint, out: THREE.Vector3): void => {
  const value = point(out);
  if (value) out.copy(value);
};

/** A taut thread or cord between two world-space points. */
export function TautCable({
  from,
  to,
  radius = 0.004,
  color = '#e7e5e4',
  roughness = 0.8,
}: {
  from: WorldPoint;
  to: WorldPoint;
  radius?: number;
  color?: string;
  roughness?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    resolvePoint(from, a);
    resolvePoint(to, b);
    direction.subVectors(b, a);
    const distance = direction.length();
    if (distance < 1e-5) return;
    mesh.position.copy(a).addScaledVector(direction, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, direction.normalize());
    mesh.scale.set(1, distance, 1);
  });

  return (
    <mesh ref={meshRef} castShadow>
      <cylinderGeometry args={[radius, radius, 1, 8]} />
      <meshStandardMaterial color={color} roughness={roughness} />
    </mesh>
  );
}

/**
 * Helical spring whose pitch responds to the distance between its ends.
 * Drawn as a three.js Line because a stretched spring is a curve, not a tube.
 */
export function SpringCoil({
  from,
  to,
  radius = 0.045,
  turns = 9,
  color = '#b8c0c9',
}: {
  from: WorldPoint;
  to: WorldPoint;
  radius?: number;
  turns?: number;
  color?: string;
}) {
  const samples = 260;
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);

  const { geometry, line } = useMemo(() => {
    const positions = new Float32Array(samples * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setDrawRange(0, samples);
    const material = new THREE.LineBasicMaterial({ color });
    const object = new THREE.Line(g, material);
    object.frustumCulled = false;
    return { geometry: g, line: object };
  }, [color]);

  useFrame(() => {
    resolvePoint(from, a);
    resolvePoint(to, b);
    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const array = position.array as Float32Array;
    for (let i = 0; i < samples; i += 1) {
      const t = i / (samples - 1);
      const envelope = Math.min(1, t * 10, (1 - t) * 10);
      const angle = t * turns * Math.PI * 2;
      array[i * 3] = a.x + (b.x - a.x) * t + Math.cos(angle) * radius * envelope;
      array[i * 3 + 1] = a.y + (b.y - a.y) * t;
      array[i * 3 + 2] = a.z + (b.z - a.z) * t + Math.sin(angle) * radius * envelope;
    }
    position.needsUpdate = true;
    geometry.computeBoundingSphere();
  });

  return <primitive object={line} />;
}

/** A liquid column inside a cylindrical/frustum vessel. */
export function LiquidColumn({
  base,
  radiusBottom,
  radiusTop,
  height,
  level,
  color,
  opacity = 0.72,
}: {
  base: readonly [number, number, number];
  radiusBottom: number;
  radiusTop: number;
  height: number;
  level: number;
  color: string;
  opacity?: number;
}) {
  const clamped = Math.min(1, Math.max(0, level));
  const filled = Math.max(0.001, clamped * height);
  const fill = solidColor(color);
  return (
    <group position={base}>
      <mesh position={[0, filled / 2, 0]}>
        <cylinderGeometry args={[radiusTop, radiusBottom, 1, 32]} />
        <meshStandardMaterial
          color={fill}
          transparent
          opacity={opacity}
          roughness={0.25}
          metalness={0.05}
        />
      </mesh>
      {clamped > 0.01 ? (
        <mesh position={[0, filled, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[Math.max(radiusTop, radiusBottom * 0.92), 32]} />
          <meshStandardMaterial color={fill} transparent opacity={opacity + 0.1} roughness={0.15} />
        </mesh>
      ) : null}
    </group>
  );
}

/** Falling stream from a bottle lip or burette tip. */
export function PourStream({
  from,
  to,
  color,
  radius = 0.008,
  visible,
}: {
  from: readonly [number, number, number];
  to: readonly [number, number, number];
  color: string;
  radius?: number;
  visible: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const dropA = useRef<THREE.Mesh>(null);
  const dropB = useRef<THREE.Mesh>(null);
  const fill = solidColor(color);
  const start = useMemo(() => new THREE.Vector3(...from), [from]);
  const end = useMemo(() => new THREE.Vector3(...to), [to]);
  const direction = useMemo(() => new THREE.Vector3(), []);

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    direction.subVectors(end, start);
    const length = direction.length();
    mesh.visible = visible && length > 0.01;
    if (!mesh.visible) return;
    mesh.position.copy(start).addScaledVector(direction, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, direction.clone().normalize());
    mesh.scale.set(1, length, 1);

    const phase = state.clock.elapsedTime * 5.5;
    [dropA.current, dropB.current].forEach((drop, index) => {
      if (!drop) return;
      const t = (phase + index * 0.5) % 1;
      drop.position.lerpVectors(start, end, t);
      drop.visible = visible;
    });
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <cylinderGeometry args={[radius * 0.65, radius, 1, 10]} />
        <meshStandardMaterial color={fill} transparent opacity={0.7} roughness={0.2} />
      </mesh>
      {[dropA, dropB].map((ref, index) => (
        <mesh key={index} ref={ref}>
          <sphereGeometry args={[radius * 1.15, 10, 10]} />
          <meshStandardMaterial color={fill} transparent opacity={0.85} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/** Metre-rule style tick strip used behind the spring and burette. */
export function Graduations({
  position,
  height,
  count = 11,
  color = '#475569',
  width = 0.12,
}: {
  position: readonly [number, number, number];
  height: number;
  count?: number;
  color?: string;
  width?: number;
}) {
  return (
    <group position={position}>
      {Array.from({ length: count }, (_, index) => {
        const major = index % 5 === 0;
        return (
          <mesh key={index} position={[0, (index / (count - 1)) * height, 0]}>
            <boxGeometry args={[major ? width : width * 0.55, 0.004, 0.006]} />
            <meshBasicMaterial color={color} transparent opacity={major ? 0.85 : 0.5} />
          </mesh>
        );
      })}
    </group>
  );
}
