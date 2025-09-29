import type { CPRDrugDose, MedicationDef } from './types';

export const CPR_DRUG_DOSES: readonly CPRDrugDose[] = [
  { name: 'Epinephrine', mgPerKg: 0.01, route: 'IV' },
  { name: 'Atropine',    mgPerKg: 0.04, route: 'IV' },
] as const;

export const CPR_MEDICATIONS: readonly MedicationDef[] = [
  {
    id: 'epinephrine-1',
    name: 'Epinephrine',
    concentration: { value: 1, units: 'mg/mL' },
  },
  {
    id: 'atropine-0-54',
    name: 'Atropine',
    concentration: { value: 0.54, units: 'mg/mL' },
  },
] as const;
