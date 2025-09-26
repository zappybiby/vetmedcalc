import type { CPRDrugDose, CPRFluidBolus } from './types';

export const CPR_FLUID_BOLUS: readonly CPRFluidBolus[] = [
  { species: 'cat', mlPerKg: 5,  overMinutes: 15 },
  { species: 'dog', mlPerKg: 15, overMinutes: 20 },
] as const;

export const CPR_DRUG_DOSES: readonly CPRDrugDose[] = [
  { name: 'Epinephrine', mgPerKg: 0.01, route: 'IV' },
  { name: 'Atropine',    mgPerKg: 0.04, route: 'IV' },
] as const;
