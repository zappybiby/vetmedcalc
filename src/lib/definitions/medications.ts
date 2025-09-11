import type { MedicationDef } from './types';

export const MEDICATIONS: readonly MedicationDef[] = [
    { id: 'metoclopramide-5', name: 'Metoclopramide', concentration: { value: 5,  units: 'mg/mL' } },
    { id: 'fentanyl-50',      name: 'Fentanyl',       concentration: { value: 0.05, units: 'mg/mL' }},
    { id: 'lidocaine-20',     name: 'Lidocaine',      concentration: { value: 20, units: 'mg/mL' } },
    { id: 'dextrose-500',     name: 'Dextrose',       concentration: { value: 500,units: 'mg/mL' } },
    { id: 'norepinephrine-1', name: 'Norepinephrine', concentration: { value: 1,  units: 'mg/mL' } },
    { id: 'furosemide-50',    name: 'Furosemide',     concentration: { value: 50, units: 'mg/mL' } },
    { id: 'midazolam-5',      name: 'Midazolam',      concentration: { value: 5,  units: 'mg/mL' } },
    { id: 'diazepam-5',       name: 'Diazepam',       concentration: { value: 5,  units: 'mg/mL' } },
] as const;
