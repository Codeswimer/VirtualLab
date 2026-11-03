/** DC circuits: Ohm's law, internal resistance, metre bridge, potentiometer. */

export interface Cell {
  emfV: number;
  internalResistanceOhm: number;
}

/** Terminal p.d. and current for a cell driving an external resistance. */
export function cellCurrent(cell: Cell, externalOhm: number): number {
  return cell.emfV / (externalOhm + cell.internalResistanceOhm);
}

export function terminalPdv(cell: Cell, externalOhm: number): number {
  return cellCurrent(cell, externalOhm) * externalOhm;
}

export function equivalentResistance(values: readonly number[], mode: 'series' | 'parallel'): number {
  if (values.length === 0) return 0;
  if (mode === 'series') return values.reduce((s, r) => s + r, 0);
  return 1 / values.reduce((s, r) => s + 1 / r, 0);
}

/** Current through each resistor in a simple series circuit. */
export function seriesCurrent(emfV: number, resistances: readonly number[], internal = 0): number {
  const total = equivalentResistance(resistances, 'series') + internal;
  return total === 0 ? 0 : emfV / total;
}

/** Metre bridge: R_unknown = R_box · ℓ / (100 − ℓ). */
export function metreBridgeResistance(
  resistanceBoxOhm: number,
  balanceLengthCm: number,
  wireLengthCm = 100,
): number {
  const rest = wireLengthCm - balanceLengthCm;
  if (rest <= 0) return Infinity;
  return (resistanceBoxOhm * balanceLengthCm) / rest;
}

/** Potentiometer: E ∝ balance length. Unknown EMF from a standard cell. */
export function potentiometerEmf(
  standardEmfV: number,
  standardLengthCm: number,
  unknownLengthCm: number,
): number {
  return (standardEmfV / standardLengthCm) * unknownLengthCm;
}

/**
 * Internal resistance from two potentiometer readings (open circuit E and
 * terminal p.d. V across a known resistor R): r = R(E − V)/V.
 */
export function internalResistance(emfV: number, terminalV: number, externalOhm: number): number {
  if (terminalV <= 0) return Infinity;
  return (externalOhm * (emfV - terminalV)) / terminalV;
}
