/**
 * Release geometry for the Rapier pendulum (PHY-01).
 *
 * A spherical joint holds the bob at a fixed distance from the pivot. The joint
 * anchors are expressed in each body's local frame, so a bob released at an
 * angle is NOT suspended from `[0, length, 0]`: that is only correct when the
 * bob hangs vertically. The offset has to be rotated by the release angle, or
 * the joint snaps the bob to the vertical on the first solver step.
 *
 * All vectors are world-space offsets; bodies start with identity rotation, so
 * local and world offsets coincide at release.
 */

export type Vec3 = [number, number, number];

export interface PendulumReleaseGeometry {
  /** World position of the bob centre at the release angle. */
  bobPosition: Vec3;
  /** Pivot position expressed in the bob's local frame. */
  pivotInBobFrame: Vec3;
}

const DEG_TO_RAD = Math.PI / 180;

/**
 * @param pivot World position of the point of suspension.
 * @param lengthM Pivot → centre of bob, in metres (examination convention).
 * @param releaseAngleDeg Displacement from the vertical, in degrees.
 */
export function pendulumReleaseGeometry(
  pivot: readonly [number, number, number],
  lengthM: number,
  releaseAngleDeg: number,
): PendulumReleaseGeometry {
  if (!Number.isFinite(lengthM) || lengthM <= 0) {
    throw new RangeError(`lengthM must be a finite number > 0 (received ${lengthM})`);
  }
  if (!Number.isFinite(releaseAngleDeg) || Math.abs(releaseAngleDeg) >= 90) {
    throw new RangeError(
      `releaseAngleDeg must be a finite angle smaller than 90° (received ${releaseAngleDeg})`,
    );
  }

  const theta = releaseAngleDeg * DEG_TO_RAD;
  const offsetX = lengthM * Math.sin(theta);
  const offsetY = lengthM * Math.cos(theta);

  return {
    bobPosition: [pivot[0] + offsetX, pivot[1] - offsetY, pivot[2]],
    pivotInBobFrame: [-offsetX, offsetY, 0],
  };
}
