import type { Species } from './types';

export type VenousBloodGasAnalyteId = 'pH' | 'PvCO2' | 'HCO3' | 'BEecf' | 'TCO2' | 'PvO2';

export type VenousBloodGasReferenceInterval = {
  low: number;
  high: number;
  unit: string;
  label: string;
};

export const VENOUS_BLOOD_GAS_ANALYTE_ORDER: readonly VenousBloodGasAnalyteId[] = [
  'pH',
  'PvCO2',
  'HCO3',
  'BEecf',
  'TCO2',
  'PvO2',
];

export const VENOUS_BLOOD_GAS_REFERENCE_RANGES: Record<
  Species,
  Record<VenousBloodGasAnalyteId, VenousBloodGasReferenceInterval>
> = {
  dog: {
    pH: { low: 7.32, high: 7.44, unit: '', label: 'pH' },
    PvCO2: { low: 26, high: 45, unit: 'mmHg', label: 'pCO2' },
    HCO3: { low: 16, high: 26, unit: 'mEq/L', label: 'HCO3' },
    BEecf: { low: -9, high: 1, unit: 'mEq/L', label: 'Base excess' },
    TCO2: { low: 16, high: 26, unit: 'mEq/L', label: 'TCO2' },
    PvO2: { low: 25, high: 70, unit: 'mmHg', label: 'pO2' },
  },
  cat: {
    pH: { low: 7.28, high: 7.46, unit: '', label: 'pH' },
    PvCO2: { low: 25, high: 42, unit: 'mmHg', label: 'pCO2' },
    HCO3: { low: 15, high: 24, unit: 'mEq/L', label: 'HCO3' },
    BEecf: { low: -11, high: -1, unit: 'mEq/L', label: 'Base excess' },
    TCO2: { low: 16, high: 24, unit: 'mEq/L', label: 'TCO2' },
    PvO2: { low: 27, high: 51, unit: 'mmHg', label: 'pO2' },
  },
};
