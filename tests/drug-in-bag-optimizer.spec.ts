import { expect, test } from '@playwright/test';
import { optimizeDrugBag } from '../src/lib/helpers/drugInBag';

const mlk = {
  weightKg: 20, bagMl: 500, increment: 0.1 as const,
  drugs: [
    { doseMgKgHr: 0.12, concentrationMgMl: 15 },
    { doseMgKgHr: 3, concentrationMgMl: 20 },
    { doseMgKgHr: 0.6, concentrationMgMl: 100 },
  ],
};
const timing = { mode: 'duration' as const, durationHr: 12 };

test('MLK reaches 12 hours with each dose within 1%; whole rates minimize the worst error', () => {
  const precise = optimizeDrugBag({ ...mlk, ...timing }).plan!;
  expect(precise.rate).toBe(40.4);
  expect(precise.drugs.map(d => d.draw)).toEqual([2, 37, 1.5]);
  expect(precise.hours).toBeCloseTo(12.3762376);
  expect(precise.worstErrorPct).toBeCloseTo(1);
  expect(precise.drugs.map(d => d.deliveredMgKgHr)).toEqual([0.1212, 2.9896000000000003, 0.606]);
  const whole = optimizeDrugBag({ ...mlk, ...timing, increment: 1 }).plan!;
  expect(whole.rate).toBe(40);
  expect(whole.drugs.map(d => d.draw)).toEqual([2, 38, 1.5]);
  expect(whole.worstErrorPct).toBeCloseTo(100 / 75);
});

test('entered rate is locked and volumes are recalculated at its pump setting', () => {
  const plan = optimizeDrugBag({ ...mlk, weightKg: 22, increment: 1, mode: 'rate', rateMlHr: 41.7 }).plan!;
  expect(plan.rate).toBe(42);
  expect(plan.drugs.map(d => d.draw)).toEqual([2.1, 39, 1.6]);
  expect(plan.drugs[1].deliveredMgKgHr).toBeCloseTo(2.9781818);
});

test('runtime bounds apply before displaying rounded hours; timing remains fixed', () => {
  const rejected = optimizeDrugBag({ ...mlk, ...timing, increment: 1, bagMl: 10 });
  expect(rejected.plan).toBeNull();
  expect(rejected.error).toContain('No pump rate');
  const onTime = optimizeDrugBag({ ...mlk, ...timing, increment: 1, durationHr: 12.5 }).plan!;
  expect(onTime.rate).toBe(40);
  expect(onTime.hours).toBe(12.5);
  for (const bagMl of [100, 500, 1000]) {
    for (const increment of [1, 0.1] as const) {
      const plan = optimizeDrugBag({ ...mlk, ...timing, bagMl, increment }).plan!;
      expect(plan.hours).toBeGreaterThanOrEqual(12 - 10 / 60 - 1e-9);
      expect(plan.hours).toBeLessThanOrEqual(12.5 + 1e-9);
      expect(plan.totalDraw).toBeLessThanOrEqual(bagMl);
      for (const drug of plan.drugs) {
        expect(drug.draw / drug.syringe.incrementMl).toBeCloseTo(Math.round(drug.draw / drug.syringe.incrementMl));
        expect(drug.deliveredMgKgHr).toBeCloseTo(drug.draw * mlk.drugs[plan.drugs.indexOf(drug)].concentrationMgMl * plan.rate / bagMl / 20);
      }
    }
  }
});

test('no hidden zero-dose preparations, zero rates, overfilled bags, or unbounded searches', () => {
  const tiny = optimizeDrugBag({ ...mlk, mode: 'rate', rateMlHr: 40, drugs: [{ doseMgKgHr: 0.00001, concentrationMgMl: 100 }] }).plan!;
  expect(tiny.drugs[0].draw).toBe(0.01);
  expect(tiny.worstErrorPct).toBeGreaterThan(5);
  expect(optimizeDrugBag({ ...mlk, mode: 'rate', rateMlHr: 0.4, increment: 1 }).error).toContain('below');
  expect(optimizeDrugBag({ ...mlk, mode: 'rate', rateMlHr: 1 }).error).toContain('capacity');
  expect(optimizeDrugBag({ ...mlk, ...timing, durationHr: 0.1 }).plan).toBeNull();
  expect(optimizeDrugBag({ ...mlk, ...timing, bagMl: 1e10 }).error).toContain('range');
});
