/** Thermal physics and gas laws. */

export const WATER_SPECIFIC_HEAT = 4.2; // J g⁻¹ K⁻¹
export const ALUMINIUM_SPECIFIC_HEAT = 0.9;

// ---------------------------------------------------------------------------
// Method of mixtures (PHY-14)
// ---------------------------------------------------------------------------

export interface MixtureInput {
  massWaterG: number;
  initialWaterTempC: number;
  massMetalG: number;
  initialMetalTempC: number;
  finalTempC: number;
  /** Heat capacity of the calorimeter in J/K (0 for a perfect insulator). */
  calorimeterHeatCapacity?: number;
}

/**
 * Specific heat capacity of the solid, J g⁻¹ K⁻¹:
 *   c_m m_m (T_m − T_f) = (m_w c_w + C_cal)(T_f − T_w)
 */
export function specificHeatFromMixture(input: MixtureInput): number {
  const heatGained =
    input.massWaterG * WATER_SPECIFIC_HEAT * (input.finalTempC - input.initialWaterTempC) +
    (input.calorimeterHeatCapacity ?? 0) * (input.finalTempC - input.initialWaterTempC);
  const denominator = input.massMetalG * (input.initialMetalTempC - input.finalTempC);
  if (denominator <= 0) return NaN;
  return heatGained / denominator;
}

/** Equilibrium temperature ignoring heat loss, for generating the scenario. */
export function mixtureEquilibriumTemp(
  massWaterG: number,
  waterTempC: number,
  massMetalG: number,
  metalTempC: number,
  metalSpecificHeat: number,
  calorimeterHeatCapacity = 0,
): number {
  const waterCapacity = massWaterG * WATER_SPECIFIC_HEAT + calorimeterHeatCapacity;
  const metalCapacity = massMetalG * metalSpecificHeat;
  return (
    (waterCapacity * waterTempC + metalCapacity * metalTempC) /
    (waterCapacity + metalCapacity)
  );
}

// ---------------------------------------------------------------------------
// Newton's law of cooling (PHY-15)
// ---------------------------------------------------------------------------

export function coolingTemperature(
  initialTempC: number,
  roomTempC: number,
  kPerMinute: number,
  minutes: number,
): number {
  return roomTempC + (initialTempC - roomTempC) * Math.exp(-kPerMinute * minutes);
}

/** Cooling rate constant from two observations. */
export function coolingConstant(
  initialTempC: number,
  roomTempC: number,
  tempAtC: number,
  minutes: number,
): number {
  if (minutes <= 0) return NaN;
  const ratio = (tempAtC - roomTempC) / (initialTempC - roomTempC);
  if (ratio <= 0) return NaN;
  return -Math.log(ratio) / minutes;
}

/** Linear expansivity from an original length and a measured expansion. */
export function linearExpansivity(
  originalLengthMm: number,
  expansionMm: number,
  temperatureRiseC: number,
): number {
  return expansionMm / (originalLengthMm * temperatureRiseC);
}

// ---------------------------------------------------------------------------
// Gas laws (PHY-16)
// ---------------------------------------------------------------------------

export const KELVIN_OFFSET = 273;

export function boylePressure(initialPressure: number, initialVolume: number, volume: number): number {
  return (initialPressure * initialVolume) / volume;
}

export function charlesVolume(initialVolume: number, initialTempK: number, finalTempK: number): number {
  return (initialVolume * finalTempK) / initialTempK;
}

export function pressureLaw(initialPressure: number, initialTempK: number, finalTempK: number): number {
  return (initialPressure * finalTempK) / initialTempK;
}

/** P·V product, used to check Boyle's law constancy. */
export function pressureVolumeProduct(pressureKPa: number, volumeCm3: number): number {
  return pressureKPa * volumeCm3;
}
