import type { SyringeDef } from './types';

export const SYRINGES: readonly SyringeDef[] = [
  { id: '1cc-0-01',  sizeCc: 1,  incrementMl: 0.01, label: '1 cc (0.01 mL ticks)' },
  { id: '3cc-0-1',   sizeCc: 3,  incrementMl: 0.1,  label: '3 cc (0.1 mL ticks)' },
  { id: '6cc-0-2',   sizeCc: 6,  incrementMl: 0.2,  label: '6 cc (0.2 mL ticks)' },
  { id: '12cc-0-2',  sizeCc: 12, incrementMl: 0.2,  label: '12 cc (0.2 mL ticks)' },
  { id: '35cc-1',    sizeCc: 35, incrementMl: 1,    label: '35 cc (1 mL ticks)' },
  { id: '60cc-1',    sizeCc: 60, incrementMl: 1,    label: '60 cc (1 mL ticks)' },
] as const;
