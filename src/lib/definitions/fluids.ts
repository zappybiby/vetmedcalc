import type { MaintenanceFluidRate } from './types';

export const MAINTENANCE_RATES: readonly MaintenanceFluidRate[] = [
  { species: 'dog', mlPerKgPerDay: 60 },
  { species: 'cat', mlPerKgPerDay: 40 },
] as const;
