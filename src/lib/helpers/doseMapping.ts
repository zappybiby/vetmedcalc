
type SearchParams = {
  S_mg_per_mL: number;            // stock mg/mL
  C_target: number;               // requested concentration (may be capped by S)
  V_target: number;               // target bag volume
  incDrug: number;                // drug syringe increment (mL)
  incDil: number;                 // diluent syringe increment (mL)
  maxFillsPerLiquid: number;      // max draws (each can be up to syringe capacity)
  drugSyr: SyringeDef;
  dilSyr: SyringeDef;
  desiredDurationHr: number;
  r_plan: number;
  weightings: { conc: number; vol: number }; // objective weighting
  spanSteps: number;              // +/- steps around nearest m0
};

type SearchResult = {
  vStock: number;
  vDil: number;
  V: number;
  C_final: number;
  concErr: number;
  volErr: number;
};

/**
 * Search a grid of feasible (stock,diluent) volumes that are multiples of increments,
 * trying to hit both the concentration ratio and the total volume.
 *
 * We parametrize by m = ticks of drug. For each m, compute the ideal total V from ratio,
 * then snap diluent to its increment and evaluate.
 */
function searchSnappedVolumes(p: SearchParams): SearchResult | null {
  const ratio = p.C_target / p.S_mg_per_mL; // desired vStock / V
  if (ratio <= 0 || ratio >= 1) {
    // ratio==1 means diluent=0; ratio<=0 invalid. We'll still allow the search to catch diluent=0 below.
  }

  const m0 = Math.max(1, Math.round((ratio * p.V_target) / p.incDrug)); // m0 ≈ vStock/incDrug
  const mMin = Math.max(1, m0 - p.spanSteps);
  const mMax = m0 + p.spanSteps;

  let best: SearchResult | null = null;
  const incDrug = p.incDrug, incDil = p.incDil;

  for (let m = mMin; m <= mMax; m++) {
    const vStock = m * incDrug;

    // If ratio≈1, ideal diluent may be zero; otherwise estimate ideal total and diluent
    const V_ideal = ratio > 0 ? (vStock / ratio) : p.V_target;
    let vDilIdeal = Math.max(0, V_ideal - vStock);

    // Snap diluent to its increment (try nearest and neighbors to give the search wiggle room)
    const nIdeal = Math.round(vDilIdeal / incDil);
    for (let dn = -2; dn <= 2; dn++) {
      const n = Math.max(0, nIdeal + dn);
      const vDil = n * incDil;
      const V = vStock + vDil;
      if (V <= 0) continue;

      const C_final = p.S_mg_per_mL * (vStock / V);
      const concErr = Math.abs(C_final - p.C_target) / Math.max(1e-9, p.C_target);
      const volErr = Math.abs(V - p.V_target) / Math.max(1e-9, p.V_target);

      // Check rough fill counts constraints (not strict; just guard extremes)
      const fillsDrug = Math.ceil(vStock / p.drugSyr.sizeCc);
      const fillsDil = Math.ceil(vDil / p.dilSyr.sizeCc);
      if (fillsDrug > p.maxFillsPerLiquid || fillsDil > p.maxFillsPerLiquid) continue;

      // Objective: weighted sum; prioritize concentration match
      const score = p.weightings.conc * concErr + p.weightings.vol * volErr;

      if (!best) {
        best = { vStock, vDil, V, C_final, concErr, volErr };
      } else {
        const bestScore = p.weightings.conc * best.concErr + p.weightings.vol * best.volErr;
        if (score < bestScore) best = { vStock, vDil, V, C_final, concErr, volErr };
      }
    }
  }

  return best;
}

// ---------- main entry ----------

export function computeMixturePlan(input: MappingInput): MixturePlan {
  const {
    weightKg,
    medication,
    desiredDose,
    doseUnit,
    desiredRateMlPerHr,
    desiredDurationHr,
    syringes,
    typicalRateMlPerHr,
    maxFillsPerLiquid = 20,
    searchSpanSteps = 400,
    tolerancePct = { concentration: 1, totalVolume: 5 },
    searchWeight = { conc: 0.8, vol: 0.2 },
  } = input;

  const warnings: string[] = [];

  // 1) Normalize stock to mg/mL
  const S_mg_per_mL = normalizeConcToMgPerMl(medication.concentration);

  // 2) Needed concentration for chosen mapping
  const C_needed = computeNeededConcentrationMgPerMl(doseUnit, desiredDose, weightKg, desiredRateMlPerHr);

  // 3) Feasibility: cannot exceed stock concentration by dilution
  let feasibleAtDesiredRate = true;
  let C_target = C_needed;
  if (C_needed - S_mg_per_mL > 1e-9) {
    feasibleAtDesiredRate = false;
    C_target = S_mg_per_mL; // you can at most use stock as-is (no diluent)
    const r_map = (unitConstant(doseUnit) * desiredDose * weightKg) / S_mg_per_mL;
    warnings.push(
      `Stock too weak to achieve mapping at ${desiredRateMlPerHr} mL/hr. ` +
      `Use ${r_map.toFixed(3)} mL/hr ↔ ${desiredDose} ${doseUnit} instead, or get stronger stock.`
    );
  }

  // 4) Choose planning rate (for duration sizing)
  const r_plan = typicalRateMlPerHr && typicalRateMlPerHr > 0 ? typicalRateMlPerHr : desiredRateMlPerHr;

  // 5) Target bag volume for desired duration
  const V_target = desiredDurationHr * r_plan;

  // 6) Raw ideal volumes (before considering increments)
  const rawStock = (C_target / S_mg_per_mL) * V_target;
  const rawDil = V_target - rawStock;

  // 7) Pick syringes (heuristic: pick the smallest that can do 1 fill; otherwise largest)
  const drugSyr = chooseSyringeForVolume(rawStock, syringes);
  const dilSyr  = chooseSyringeForVolume(rawDil,  syringes);

  // 8) Search snapped solution under increments
  const best = searchSnappedVolumes({
    S_mg_per_mL,
    C_target,
    V_target,
    incDrug: drugSyr.incrementMl,
    incDil: dilSyr.incrementMl,
    maxFillsPerLiquid,
    drugSyr,
    dilSyr,
    desiredDurationHr,
    r_plan,
    weightings: searchWeight,
    spanSteps: searchSpanSteps,
  });

  // If search fails (should be rare), fall back to naive rounding
  let snappedStock = rawStock;
  let snappedDil = rawDil;
  let C_final = (S_mg_per_mL * snappedStock) / Math.max(1e-9, snappedStock + snappedDil);

  if (best) {
    snappedStock = best.vStock;
    snappedDil = best.vDil;
    C_final = best.C_final;
  } else {
    snappedStock = roundToIncrement(rawStock, drugSyr.incrementMl);
    // Maintain ratio as best we can with diluent increment
    const ratio = C_target / S_mg_per_mL;
    const V_from_ratio = ratio > 0 ? (snappedStock / ratio) : V_target;
    snappedDil = roundToIncrement(Math.max(0, V_from_ratio - snappedStock), dilSyr.incrementMl);
    C_final = S_mg_per_mL * (snappedStock / Math.max(1e-9, snappedStock + snappedDil));
    warnings.push('Used simple rounding because a snapped combo within search bounds was not found.');
  }

  const V_final = snappedStock + snappedDil;

  // 9) Errors vs targets
  const relConcErr = Math.abs(C_final - C_target) / Math.max(1e-9, C_target);
  const relVolErr = Math.abs(V_final - V_target) / Math.max(1e-9, V_target);

  // 10) Build draw plans (fills = ceil(volume / syringe size))
  const stockFills = Math.ceil(snappedStock / drugSyr.sizeCc);
  const dilFills   = Math.ceil(snappedDil  / dilSyr.sizeCc);

  if (stockFills > maxFillsPerLiquid) {
    warnings.push(`Stock volume ${snappedStock.toFixed(2)} mL requires ${stockFills} fills of ${drugSyr.sizeCc} mL syringe.`);
  }
  if (dilFills > maxFillsPerLiquid) {
    warnings.push(`Diluent volume ${snappedDil.toFixed(2)} mL requires ${dilFills} fills of ${dilSyr.sizeCc} mL syringe.`);
  }

  // 11) Mapping outcomes
  const mappingRate = (unitConstant(doseUnit) * desiredDose * weightKg) / C_final; // r s.t. D at C_final
  const deliveredAtDesiredRate = deliveredDoseFrom(C_final, desiredRateMlPerHr, weightKg, doseUnit);

  // 12) Tolerance checks (informational)
  const concTol = (tolerancePct.concentration ?? 1) / 100;
  const volTol  = (tolerancePct.totalVolume ?? 5) / 100;

  if (relConcErr > concTol) {
    warnings.push(
      `Concentration error ${(100*relConcErr).toFixed(2)}% exceeds tolerance ${(100*concTol).toFixed(2)}%.`
    );
  }
  if (relVolErr > volTol) {
    warnings.push(
      `Total volume error ${(100*relVolErr).toFixed(2)}% exceeds tolerance ${(100*volTol).toFixed(2)}%.`
    );
  }

  // 13) Package result
  const plan: MixturePlan = {
    feasibleAtDesiredRate,
    warnings,

    neededConcentrationMgPerMl: C_needed,
    chosenConcentrationMgPerMl: C_final,
    stockConcentrationMgPerMl: S_mg_per_mL,

    desiredRateMlPerHr,
    mappingRateMlPerHr: mappingRate,             // equals desiredRate if concentration hit exactly
    deliveredDoseAtDesiredRate: deliveredAtDesiredRate,                  // useful if not feasible/exact

    targetTotalVolumeMl: V_target,
    finalTotalVolumeMl: V_final,
    rawStockVolumeMl: rawStock,
    rawDiluentVolumeMl: rawDil,
    snappedStockVolumeMl: snappedStock,
    snappedDiluentVolumeMl: snappedDil,

    stockDraw: {
      syringeId: drugSyr.id,
      syringeLabel: drugSyr.label,
      incrementMl: drugSyr.incrementMl,
      syringeSizeMl: drugSyr.sizeCc,
      fills: stockFills,
      volumeMl: snappedStock,
    },
    diluentDraw: {
      syringeId: dilSyr.id,
      syringeLabel: dilSyr.label,
      incrementMl: dilSyr.incrementMl,
      syringeSizeMl: dilSyr.sizeCc,
      fills: dilFills,
      volumeMl: snappedDil,
    },

    relConcentrationErrorPct: relConcErr * 100,
    relTotalVolumeErrorPct: relVolErr * 100,
    doseUnit,
  };

  return plan;
}
import type { MedicationDef, MedicationConcentration, SyringeDef } from '../definitions/types';

export type DoseUnit = 'mcg/kg/min' | 'mg/kg/hr';

export type MappingInput = {
  weightKg: number;
  medication: MedicationDef;         // uses medication.concentration (mg/mL or mcg/mL)
  desiredDose: number;               // numeric dose value
  doseUnit: DoseUnit;                // 'mcg/kg/min' | 'mg/kg/hr'
  desiredRateMlPerHr: number;        // r_ref (the pump rate that should equal the dose)
  desiredDurationHr: number;         // T_hr
  syringes: readonly SyringeDef[];   // from your SYRINGES list
  typicalRateMlPerHr?: number;       // if you expect to run mostly above/below r_ref
  // tolerances & search knobs (all optional)
  tolerancePct?: {
    concentration?: number;          // default 1 (%)
    totalVolume?: number;            // default 5 (%)
  };
  maxFillsPerLiquid?: number;        // default 20 (per syringe chosen for drug/diluent)
  searchSpanSteps?: number;          // default 400 (± around the nearest stock ticks)
  searchWeight?: { conc: number; vol: number }; // default conc: 0.8, vol: 0.2
};

export type DrawPlan = {
  syringeId: string;
  syringeLabel?: string;
  incrementMl: number;
  syringeSizeMl: number;
  fills: number;           // how many full/partial fills to measure the volume
  volumeMl: number;        // total volume to draw with this syringe
};

export type MixturePlan = {
  feasibleAtDesiredRate: boolean;
  warnings: string[];

  // Target mapping & concentration
  neededConcentrationMgPerMl: number;        // C_needed
  chosenConcentrationMgPerMl: number;        // C_final after rounding
  stockConcentrationMgPerMl: number;         // S (normalized)

  // Rate mapping outcomes
  desiredRateMlPerHr: number;                // requested r_ref
  mappingRateMlPerHr: number;                // r_map if stock too weak, else == desiredRate
  deliveredDoseAtDesiredRate: number;        // in the same unit as input dose
  doseUnit: DoseUnit;

  // Volumes (raw target vs snapped)
  targetTotalVolumeMl: number;               // T * r_plan
  finalTotalVolumeMl: number;                // snapped to increments
  rawStockVolumeMl: number;                  // before snapping
  rawDiluentVolumeMl: number;
  snappedStockVolumeMl: number;              // after snapping
  snappedDiluentVolumeMl: number;

  // Syringe plans (how to measure)
  stockDraw: DrawPlan;
  diluentDraw: DrawPlan;

  // Errors
  relConcentrationErrorPct: number;
  relTotalVolumeErrorPct: number;
};

// ---------- core helpers ----------

function unitConstant(doseUnit: DoseUnit): number {
  // Pump delivers mg/min = (mg/mL * mL/hr) / 60
  // Equate D*W to (C * r / 60) converted to mg/min:
  // For D in mcg/kg/min: multiply numerator by 1 mcg = 1/1000 mg, so factor = 60/1000 = 0.06
  // For D in mg/kg/hr: time already in hr, so factor = 1
  return doseUnit === 'mcg/kg/min' ? 0.06 : 1.0;
}

function normalizeConcToMgPerMl(c: MedicationConcentration): number {
  if (c.units === 'mg/mL') return c.value;
  // mcg/mL -> mg/mL
  return c.value / 1000;
}

function computeNeededConcentrationMgPerMl(
  doseUnit: DoseUnit,
  desiredDose: number,
  weightKg: number,
  desiredRateMlPerHr: number
): number {
  const U = unitConstant(doseUnit);
  // C_needed = (U * D_ref * W) / r_ref (mg/mL)
  return (U * desiredDose * weightKg) / desiredRateMlPerHr;
}

function deliveredDoseFrom(C_mg_per_mL: number, r_mL_per_hr: number, W_kg: number, doseUnit: DoseUnit): number {
  // Rearranged: D = (C * r) / (U * W)
  const U = unitConstant(doseUnit);
  return (C_mg_per_mL * r_mL_per_hr) / (U * W_kg);
}

function chooseSyringeForVolume(volMl: number, syringes: readonly SyringeDef[]): SyringeDef {
  // Prefer the smallest syringe that can do the job in <= max fills,
  // but we choose the smallest that minimizes increment (precision). We'll compute fills later.
  const sorted = [...syringes].sort((a, b) => a.sizeCc - b.sizeCc || a.incrementMl - b.incrementMl);
  // If volume fits in any syringe in 1 fill, pick the one with smallest increment among those
  const oneFillCandidates = sorted.filter(s => s.sizeCc >= volMl);
  if (oneFillCandidates.length) {
    // Among 1-fill candidates, pick smallest increment; tie-break by smallest size
    return oneFillCandidates.sort((a, b) => a.incrementMl - b.incrementMl || a.sizeCc - b.sizeCc)[0];
  }
  // Otherwise pick the largest syringe (for fewer fills)
  return sorted[sorted.length - 1];
}

function gcdInt(a: number, b: number): number {
  let x = Math.abs(a), y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function roundToIncrement(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
