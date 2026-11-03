/** Redox titrations (CHM-03). */

export interface RedoxSystem {
  id: 'permanganate-iron' | 'permanganate-oxalate' | 'iodine-thiosulfate';
  name: string;
  titrant: string;
  analyte: string;
  /** Moles of analyte per mole of titrant. */
  analytePerTitrant: number;
  endpoint: string;
}

export const REDOX_SYSTEMS: RedoxSystem[] = [
  {
    id: 'permanganate-iron',
    name: 'KMnO₄ against iron(II)',
    titrant: 'KMnO₄',
    analyte: 'Fe²⁺',
    analytePerTitrant: 5,
    endpoint: 'first permanent pink',
  },
  {
    id: 'permanganate-oxalate',
    name: 'KMnO₄ against ethanedioic acid',
    titrant: 'KMnO₄',
    analyte: 'H₂C₂O₄',
    analytePerTitrant: 2.5,
    endpoint: 'first permanent pink (solution warmed)',
  },
  {
    id: 'iodine-thiosulfate',
    name: 'Iodine against thiosulfate',
    titrant: 'I₂',
    analyte: 'S₂O₃²⁻',
    analytePerTitrant: 2,
    endpoint: 'starch blue–black → colourless',
  },
];

export function redoxSystem(id: RedoxSystem['id']): RedoxSystem {
  const found = REDOX_SYSTEMS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown redox system ${id}`);
  return found;
}

/** Concentration (mol/dm³) of the analyte from a redox titre. */
export function redoxAnalyteMolarity(
  system: RedoxSystem,
  titrantMolarity: number,
  titreCm3: number,
  analyteVolumeCm3: number,
): number {
  const molesTitrant = (titrantMolarity * titreCm3) / 1000;
  const molesAnalyte = molesTitrant * system.analytePerTitrant;
  return molesAnalyte / (analyteVolumeCm3 / 1000);
}
