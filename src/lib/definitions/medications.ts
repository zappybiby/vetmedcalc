import type { DoseUnit, MedicationDef } from './types';

export const FALLBACK_MEDICATION_DOSE_UNIT: DoseUnit = 'mg/kg/hr';
export const CUSTOM_MEDICATION_ID = 'custom';

export const DEFAULT_MEDICATION_DOSE_UNITS: Readonly<Record<string, DoseUnit>> = {
  'diazepam-5': 'mg/kg/hr',
  'dobutamine-12-5': 'mcg/kg/min',
  'dopamine-40': 'mcg/kg/min',
  'epinephrine-1': 'mcg/kg/min',
  'fentanyl-50': 'mcg/kg/hr',
  'furosemide-50': 'mg/kg/hr',
  'midazolam-5': 'mg/kg/hr',
  'metoclopramide-5': 'mg/kg/hr',
  'norepinephrine-1': 'mcg/kg/min',
  'propofol-10': 'mg/kg/min',
  'lidocaine-20': 'mcg/kg/min',
  'ketamine-100': 'mcg/kg/min',
} as const;

export function getDefaultMedicationDoseUnit(id: string): DoseUnit {
  return DEFAULT_MEDICATION_DOSE_UNITS[id] ?? FALLBACK_MEDICATION_DOSE_UNIT;
}

export const MEDICATIONS: readonly MedicationDef[] = [
  {
    id: 'diazepam-5',
    name: 'Diazepam',
    concentration: { value: 5, units: 'mg/mL' },
    criDoseRange: { minMgPerKgHr: 0.5, maxMgPerKgHr: 1 },
  },
  {
    id: 'dobutamine-12-5',
    name: 'Dobutamine',
    concentration: { value: 12.5, units: 'mg/mL' },
    criDoseRange: { minMgPerKgHr: 0.06, maxMgPerKgHr: 0.6 },
  },
  {
    id: 'dopamine-40',
    name: 'Dopamine',
    concentration: { value: 40, units: 'mg/mL' },
    criDoseRange: { minMgPerKgHr: 0.12, maxMgPerKgHr: 0.6 },
  },
  {
    id: 'epinephrine-1',
    name: 'Epinephrine',
    concentration: { value: 1, units: 'mg/mL' },
  },
  {
    id: 'fentanyl-50',
    name: 'Fentanyl',
    concentration: { value: 0.05, units: 'mg/mL' },
    criDoseRange: { minMgPerKgHr: 0.0012, maxMgPerKgHr: 0.0048 },
  },
  {
    id: 'furosemide-50',
    name: 'Furosemide',
    concentration: { value: 50, units: 'mg/mL' },
    criDoseRange: { minMgPerKgHr: 0.1, maxMgPerKgHr: 1 },
  },
  {
    id: 'midazolam-5',
    name: 'Midazolam',
    concentration: { value: 5, units: 'mg/mL' },
    criDoseRange: { minMgPerKgHr: 0.2, maxMgPerKgHr: 0.4 },
  },
  {
    id: 'metoclopramide-5',
    name: 'Metoclopramide',
    concentration: { value: 5, units: 'mg/mL' },
    criDoseRange: { minMgPerKgHr: 0.01, maxMgPerKgHr: 0.02 },
  },
  {
    id: 'norepinephrine-1',
    name: 'Norepinephrine',
    concentration: { value: 1, units: 'mg/mL' },
    criDoseRange: { minMgPerKgHr: 0.003, maxMgPerKgHr: 0.12 },
  },
  {
    id: 'propofol-10',
    name: 'Propofol',
    concentration: { value: 10, units: 'mg/mL' },
    criDoseRange: { minMgPerKgHr: 1, maxMgPerKgHr: 10 },
  },
  {
    id: 'lidocaine-20',
    name: 'Lidocaine',
    concentration: { value: 20, units: 'mg/mL' },
    criDoseRange: { minMgPerKgHr: 0.6, maxMgPerKgHr: 3 },
  },
  {
    id: 'ketamine-100',
    name: 'Ketamine',
    concentration: { value: 100, units: 'mg/mL' },
    criDoseRange: { minMgPerKgHr: 0.12, maxMgPerKgHr: 1.2 },
  },
] as const;
