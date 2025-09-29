export type Species = 'dog' | 'cat';

export type SyringeDef = {
  id: string;                 // slug for stable references
  sizeCc: number;             // syringe size in cc
  incrementMl: number;        // smallest marking in mL
  label?: string;             // optional display label
};

export type MedicationConcentration = {
  value: number;              // numeric amount
  units: 'mg/mL' | 'mcg/mL';  // normalize by declaring units
};

export type CRIDoseRange = {
  minMgPerKgHr: number;       // lower bound of typical CRI dose (mg/kg/hr)
  maxMgPerKgHr: number;       // upper bound of typical CRI dose (mg/kg/hr)
};

export type MedicationDef = {
  id: string;
  name: string;
  concentration: MedicationConcentration;
  notes?: string;
  criDoseRange?: CRIDoseRange;
};

export type CPRDrugDose = {
  name: string;
  mgPerKg: number;
  route?: 'IV' | 'IO' | 'ET';
  notes?: string;
};

export type MaintenanceFluidRate = {
  species: Species;
  mlPerKgPerDay: number;
  notes?: string;
};
