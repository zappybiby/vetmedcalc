// etTube.ts
import { derived, type Readable } from 'svelte/store';   // ⬅️ add this
import { patient } from '../stores/patient';
import type { Species, Patient } from '../stores/patient';

export type EtTubeEstimate = {
  species: Species;
  estimateMm: number; // recommended tube ID (mm)
  lowMm: number;      // lower end of expected range (mm)
  highMm: number;     // upper end of expected range (mm)
  note?: string;      // e.g., method or caveats
};

/** Round to the nearest 0.5 mm and normalize to one decimal place. */
function r05(mm: number): number {
  const rounded = Math.round(mm * 2 + 1e-9) / 2; // guard tiny FP errors
  return Number(rounded.toFixed(1));
}

/** Core canine math helpers */
function dogEstimateRaw(kg: number) {
  const cbrt = Math.cbrt(kg);
  const est = 3.85 * cbrt;           // (kg)^(1/3) / 0.26
  const low = cbrt / 0.31;           // broad expected range (low)
  const high = cbrt / 0.22;          // broad expected range (high)
  return { est, low, high };
}

/** Estimate ET tube size in mm for dogs, rounded to nearest 0.5 mm. */
export function estimateDogEt(kg: number): EtTubeEstimate {
  if (!(kg > 0)) throw new Error('Weight (kg) must be a positive number.');
  const { est, low, high } = dogEstimateRaw(kg);
  return {
    species: 'dog',
    estimateMm: r05(est),
    lowMm: r05(low),
    highMm: r05(high),
    note: 'Canine formula: ET ID ≈ 3.85 × (kg)^(1/3); range uses 1/0.31 to 1/0.22.',
  };
}

/** Estimate ET tube size in mm for cats, using weight bands. */
export function estimateCatEt(kg: number): EtTubeEstimate {
  if (!(kg > 0)) throw new Error('Weight (kg) must be a positive number.');

  // Defaults
  let low = 3.0;
  let high = 3.0;
  let est = 3.0;

  if (kg < 2) {
    low = high = est = 3.0;
  } else if (kg <= 6) {
    // Recommend the higher size in the range per spec
    low = 3.5; high = 4.0; est = 4.0;
  } else {
    low = 4.5; high = 5.0; est = 5.0;
  }

  // Already 0.5 steps, but run through r05 for consistency
  return {
    species: 'cat',
    estimateMm: r05(est),
    lowMm: r05(low),
    highMm: r05(high),
    note: 'Feline bands: <2 kg → 3 mm; 2–6 kg → 3.5–4 mm (recommend 4); >6 kg → 4.5–5 mm (recommend 5).',
  };
}

/** Single entry point by species. */
export function estimateEtByWeight(kg: number, species: Species): EtTubeEstimate {
  return species === 'dog' ? estimateDogEt(kg) : estimateCatEt(kg);
}

/** Convenience wrapper for your Patient type. Returns null if incomplete. */
export function estimateEtForPatient(p: Pick<Patient, 'weightKg' | 'species'>): EtTubeEstimate | null {
  if (!p.weightKg || !p.species) return null;
  return estimateEtByWeight(p.weightKg, p.species);
}

/**
 * Optional: a live Svelte store that emits the current ET estimate
 * (or null until weight/species are set).
 */
export const etTubeEstimate: Readable<EtTubeEstimate | null> = derived(patient, (p) =>
  estimateEtForPatient(p)
);
