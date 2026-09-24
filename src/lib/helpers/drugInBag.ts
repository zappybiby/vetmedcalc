import { SYRINGES } from '../definitions/syringes';

export const DOSE_TARGET_PCT = 1;
export const DOSE_REVIEW_PCT = 5;
const EPS = 1e-9;

type DrugInput = { doseMgKgHr: number; concentrationMgMl: number };
type Input = {
  weightKg: number;
  bagMl: number;
  drugs: DrugInput[];
  increment: 1 | 0.1;
} & ({ mode: 'rate'; rateMlHr: number } | {
  mode: 'duration'; durationHr: number; earlyMinutes: number; lateMinutes: number;
});

function prepare(input: Input, rate: number) {
  const hours = input.bagMl / rate;
  const drugs = input.drugs.map(drug => {
    const amount = drug.doseMgKgHr * input.weightKg * hours;
    const rawDraw = amount / drug.concentrationMgMl;
    const syringe = SYRINGES.find(s => s.sizeCc >= rawDraw) ?? SYRINGES[SYRINGES.length - 1];
    const ticksPerMl = 1 / syringe.incrementMl;
    // A positive requested dose must never become a zero-drug preparation.
    const draw = Math.max(1, Math.round(rawDraw * ticksPerMl)) / ticksPerMl;
    const deliveredMgKgHr = draw * drug.concentrationMgMl * rate / input.bagMl / input.weightKg;
    const errorPct = (deliveredMgKgHr / drug.doseMgKgHr - 1) * 100;
    return { amount, rawDraw, syringe, draw, deliveredMgKgHr, errorPct };
  });
  const totalDraw = drugs.reduce((sum, drug) => sum + drug.draw, 0);
  const worstErrorPct = Math.max(...drugs.map(drug => Math.abs(drug.errorPct)));
  if (!Number.isFinite(hours) || !Number.isFinite(totalDraw) || !Number.isFinite(worstErrorPct)
    || totalDraw > input.bagMl + EPS) return null;
  return { rate, hours, drugs, totalDraw, worstErrorPct };
}
export type BagPlan = NonNullable<ReturnType<typeof prepare>>;
export type BagOutcome = { plan: BagPlan; error?: never } | { plan: null; error: string };

function prefer(candidate: BagPlan, best: BagPlan, duration: number): boolean {
  const candidateOnTarget = candidate.worstErrorPct <= DOSE_TARGET_PCT + EPS;
  const bestOnTarget = best.worstErrorPct <= DOSE_TARGET_PCT + EPS;
  if (candidateOnTarget !== bestOnTarget) return candidateOnTarget;
  // If no plan meets the goal, minimize the worst individual error first.
  if (!candidateOnTarget && Math.abs(candidate.worstErrorPct - best.worstErrorPct) > EPS) {
    return candidate.worstErrorPct < best.worstErrorPct;
  }
  const candidateLasts = candidate.hours >= duration - EPS;
  const bestLasts = best.hours >= duration - EPS;
  if (candidateLasts !== bestLasts) return candidateLasts;
  const candidateDistance = Math.abs(candidate.hours - duration);
  const bestDistance = Math.abs(best.hours - duration);
  if (Math.abs(candidateDistance - bestDistance) > EPS) return candidateDistance < bestDistance;
  return candidate.worstErrorPct < best.worstErrorPct;
}

/** Enumerate pump settings; at each rate, choose each drug's nearest positive syringe tick.
 * The bag stays fixed. Duration is a preference within explicit bounds; rate mode is locked.
 * Percentage thresholds are calculation goals, not drug-specific clinical dose limits.
 */
export function optimizeDrugBag(input: Input): BagOutcome {
  const positive = (v: number) => Number.isFinite(v) && v > 0;
  if (!positive(input.weightKg) || !positive(input.bagMl) || !input.drugs.length
    || !input.drugs.every(d => positive(d.doseMgKgHr) && positive(d.concentrationMgMl))) {
    return { plan: null, error: 'Complete the medication doses and concentrations.' };
  }
  const scale = input.increment === 0.1 ? 10 : 1;
  let firstTick: number;
  let lastTick: number;
  if (input.mode === 'rate') {
    if (!positive(input.rateMlHr)) return { plan: null, error: 'Enter a positive pump rate.' };
    firstTick = lastTick = Math.round(input.rateMlHr * scale);
    if (firstTick === 0) return { plan: null, error: 'Rate is below the selected pump increment.' };
  } else {
    const { durationHr, earlyMinutes, lateMinutes } = input;
    if (!positive(durationHr) || !Number.isFinite(earlyMinutes) || !Number.isFinite(lateMinutes)
      || earlyMinutes < 0 || lateMinutes < 0 || earlyMinutes >= durationHr * 60) {
      return { plan: null, error: 'Early allowance must be shorter than the duration.' };
    }
    firstTick = Math.max(1, Math.ceil(input.bagMl / (durationHr + lateMinutes / 60) * scale - EPS));
    lastTick = Math.floor(input.bagMl / (durationHr - earlyMinutes / 60) * scale + EPS);
    if (lastTick < firstTick) return { plan: null, error: 'No pump rate fits the timing allowance. Change precision or allowance.' };
  }
  // Reject extreme inputs rather than blocking the UI or silently sampling the search.
  if (!Number.isSafeInteger(firstTick) || !Number.isSafeInteger(lastTick) || lastTick - firstTick > 100_000) {
    return { plan: null, error: 'Rate range is too large. Narrow the timing allowance or enter a rate.' };
  }
  let best: BagPlan | null = null;
  for (let tick = firstTick; tick <= lastTick; tick++) {
    const candidate = prepare(input, tick / scale);
    if (candidate && (!best || input.mode === 'rate' || prefer(candidate, best, input.durationHr))) best = candidate;
  }
  return best ? { plan: best } : { plan: null, error: 'Drug volumes exceed the bag capacity at the available rates.' };
}
