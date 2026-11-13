/**
 * Bob placement for the pendulum scene (PHY-01).
 *
 * The bob is held one length from the pivot and swings in the x–y plane, so its
 * position is a pure function of the current angle. Keeping this analytic is
 * what lets the scene run without a physics engine in the bundle.
 */

export type Vec3 = [number, number, number];

/**
 * @param pivot World position of the point of suspension.
 * @param lengthM Pivot → centre of bob, in metres (examination convention).
 * @param angleRad Displacement from the vertical, in radians; 0 hangs straight down.
 */
export function pendulumBobPosition(
  pivot: readonly [number, number, number],
  lengthM: number,
  angleRad: number,
): Vec3 {
  if (!Number.isFinite(lengthM) || lengthM <= 0) {
    throw new RangeError(`lengthM must be a finite number > 0 (received ${lengthM})`);
  }
  if (!Number.isFinite(angleRad)) {
    throw new RangeError(`angleRad must be a finite number (received ${angleRad})`);
  }

  return [
    pivot[0] + lengthM * Math.sin(angleRad),
    pivot[1] - lengthM * Math.cos(angleRad),
    pivot[2],
  ];
}
