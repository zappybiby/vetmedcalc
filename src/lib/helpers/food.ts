import type { PetFoodCanDef } from '@defs';
import { calculateRERKcalPerDay } from './rer';

type CommonFraction = {
  value: number;
  label: string;
};

const COMMON_FRACTIONS: readonly CommonFraction[] = [
  { value: 0, label: '' },
  { value: 1 / 8, label: '1/8' },
  { value: 1 / 4, label: '1/4' },
  { value: 1 / 3, label: '1/3' },
  { value: 3 / 8, label: '3/8' },
  { value: 1 / 2, label: '1/2' },
  { value: 5 / 8, label: '5/8' },
  { value: 2 / 3, label: '2/3' },
  { value: 3 / 4, label: '3/4' },
  { value: 7 / 8, label: '7/8' },
];

const FRACTION_EPSILON = 0.000001;

export type FoodFeedingInput = {
  weightKg: number;
  rerFactor: number;
  intervalHours: number;
  food: PetFoodCanDef;
};

export type FoodFeedingPlan = {
  food: PetFoodCanDef;
  weightKg: number;
  rerFactor: number;
  intervalHours: number;
  rerKcalPerDay: number;
  targetKcalPerDay: number;
  kcalPerInterval: number;
  exactCansPerInterval: number;
  roundedCansPerInterval: number;
  roundedKcalPerInterval: number;
};

function findCommonFraction(value: number): CommonFraction | null {
  return COMMON_FRACTIONS.find(fraction => Math.abs(value - fraction.value) < FRACTION_EPSILON) ?? null;
}

export function roundCanPortion(cans: number): number {
  if (!Number.isFinite(cans) || cans <= 0) return 0;

  if (cans > 32) {
    return Math.round(cans * 2) / 2;
  }

  let best = 0;
  let bestDelta = Number.POSITIVE_INFINITY;
  const wholeLimit = Math.max(1, Math.ceil(cans) + 1);

  for (let whole = 0; whole <= wholeLimit; whole += 1) {
    for (const fraction of COMMON_FRACTIONS) {
      const candidate = whole + fraction.value;
      if (candidate === 0) continue;

      const delta = Math.abs(candidate - cans);
      if (delta < bestDelta) {
        best = candidate;
        bestDelta = delta;
      }
    }
  }

  return best;
}

export function formatCanPortion(cans: number): string {
  if (!Number.isFinite(cans) || cans <= 0) return '0 cans';

  const whole = Math.floor(cans + FRACTION_EPSILON);
  const fractionValue = cans - whole;
  const fraction = findCommonFraction(fractionValue);

  if (!fraction || fraction.value === 0) {
    const rounded = Number(cans.toFixed(2));
    const unit = rounded === 1 ? 'can' : 'cans';
    return `${rounded} ${unit}`;
  }

  if (whole === 0) {
    return `${fraction.label} can`;
  }

  if (fraction.label === '1/2') {
    return `${whole + 0.5} cans`;
  }

  return `${whole} ${fraction.label} cans`;
}

export function buildFoodFeedingPlan(input: FoodFeedingInput): FoodFeedingPlan {
  const { weightKg, rerFactor, intervalHours, food } = input;
  const rerKcalPerDay = calculateRERKcalPerDay(weightKg);
  const targetKcalPerDay = rerKcalPerDay * rerFactor;
  const kcalPerInterval = targetKcalPerDay * (intervalHours / 24);
  const exactCansPerInterval = kcalPerInterval / food.kcalPerCan;
  const roundedCansPerInterval = roundCanPortion(exactCansPerInterval);
  const roundedKcalPerInterval = roundedCansPerInterval * food.kcalPerCan;

  return {
    food,
    weightKg,
    rerFactor,
    intervalHours,
    rerKcalPerDay,
    targetKcalPerDay,
    kcalPerInterval,
    exactCansPerInterval,
    roundedCansPerInterval,
    roundedKcalPerInterval,
  };
}
