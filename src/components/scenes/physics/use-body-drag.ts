import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { RapierRigidBody } from '@react-three/rapier';

export interface BodyDragOptions {
  /** Turn the interaction off without unmounting the mesh. */
  enabled?: boolean;
  /** How hard the body is pulled toward the pointer, per second. */
  follow?: number;
  /** Cap on the commanded speed, m/s. */
  maxSpeed?: number;
  /** Restrict motion to the vertical through the grab point. */
  axis?: 'free' | 'y';
  /**
   * World-space point the student has actually grabbed. Defaults to the body
   * centre. A pendulum grabs its bob, which is offset from the body origin.
   */
  getPoint?: (body: RapierRigidBody, out: THREE.Vector3) => boolean;
  onGrab?: () => void;
  onRelease?: () => void;
}

/**
 * Pointer-driven grab for a Rapier body.
 *
 * The body stays dynamic and the joint constraints stay active, so a bob on a
 * rope swings along its arc and a mass on a spring stretches it, instead of
 * being teleported through the apparatus. A velocity-matching impulse is
 * applied at the grabbed point every frame; releasing leaves the body with the
 * momentum the student gave it.
 */
export function useBodyDrag(
  bodyRef: React.RefObject<RapierRigidBody | null>,
  options: BodyDragOptions = {},
) {
  const { camera } = useThree();
  const [dragging, setDragging] = useState(false);
  const active = useRef(false);

  const plane = useMemo(() => new THREE.Plane(), []);
  const cameraDir = useMemo(() => new THREE.Vector3(), []);
  const target = useMemo(() => new THREE.Vector3(), []);
  const point = useMemo(() => new THREE.Vector3(), []);
  const bodyPosition = useMemo(() => new THREE.Vector3(), []);
  const velocityAtPoint = useMemo(() => new THREE.Vector3(), []);
  const desired = useMemo(() => new THREE.Vector3(), []);
  const radius = useMemo(() => new THREE.Vector3(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const startPoint = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
    };
  }, []);

  const readPoint = useCallback(
    (body: RapierRigidBody, out: THREE.Vector3): boolean => {
      if (options.getPoint) return options.getPoint(body, out);
      const t = body.translation();
      out.set(t.x, t.y, t.z);
      return true;
    },
    [options.getPoint],
  );

  const stop = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    setDragging(false);
    document.body.style.cursor = '';
    options.onRelease?.();
  }, [options.onRelease]);

  const onPointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const body = bodyRef.current;
      if (!body || options.enabled === false) return;
      event.stopPropagation();
      const targetElement = event.target as unknown as {
        setPointerCapture?: (pointerId: number) => void;
      };
      targetElement.setPointerCapture?.(event.pointerId);

      if (!readPoint(body, point)) return;
      camera.getWorldDirection(cameraDir);
      plane.setFromNormalAndCoplanarPoint(cameraDir, point);

      const hit = event.ray.intersectPlane(plane, target);
      if (!hit) target.copy(point);
      startPoint.copy(target);
      active.current = true;
      setDragging(true);
      document.body.style.cursor = 'grabbing';
      options.onGrab?.();
    },
    [bodyRef, camera, cameraDir, options, plane, point, readPoint, startPoint, target],
  );

  useFrame((state, delta) => {
    const body = bodyRef.current;
    if (!active.current || !body) return;
    raycaster.setFromCamera(state.pointer, camera);
    if (!raycaster.ray.intersectPlane(plane, target)) return;

    if (!readPoint(body, point)) return;
    if (options.axis === 'y') {
      target.x = startPoint.x;
      target.z = startPoint.z;
    }

    const t = body.translation();
    bodyPosition.set(t.x, t.y, t.z);
    radius.subVectors(point, bodyPosition);

    const linear = body.linvel();
    const angular = body.angvel();
    velocityAtPoint.set(
      linear.x + (angular.y * radius.z - angular.z * radius.y),
      linear.y + (angular.z * radius.x - angular.x * radius.z),
      linear.z + (angular.x * radius.y - angular.y * radius.x),
    );

    desired.subVectors(target, point).multiplyScalar(options.follow ?? 16);
    const speed = desired.length();
    const maxSpeed = options.maxSpeed ?? 4;
    if (speed > maxSpeed) desired.multiplyScalar(maxSpeed / speed);

    desired.sub(velocityAtPoint);
    const mass = Math.max(0.001, body.mass());
    const gain = Math.min(1, delta * 60) * 0.55;
    body.applyImpulseAtPoint(
      { x: desired.x * mass * gain, y: desired.y * mass * gain, z: desired.z * mass * gain },
      { x: point.x, y: point.y, z: point.z },
      true,
    );
  });

  const bind = useMemo(
    () => ({
      onPointerDown,
      onPointerUp: (event: ThreeEvent<PointerEvent>) => {
        const targetElement = event.target as unknown as {
          releasePointerCapture?: (pointerId: number) => void;
        };
        targetElement.releasePointerCapture?.(event.pointerId);
        stop();
      },
      onPointerCancel: () => stop(),
      onLostPointerCapture: () => stop(),
    }),
    [onPointerDown, stop],
  );

  return { dragging, bind };
}
