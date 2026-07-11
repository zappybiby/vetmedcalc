import {
  KCL_K_MEQ_PER_ML,
  KPHOS_K_MEQ_PER_ML,
  KPHOS_PHOS_MMOL_PER_ML,
  type KPhosBaseFluid,
} from '../definitions/kphos';
import { SYRINGES } from '../definitions';
import type { SyringeDef } from '../definitions/types';

export type KPhosMode = 'bag' | 'cri';
export type KPhosKTargetBasis = 'added' | 'total';
export type KPhosCriRateIssue = 'below-stock-rate' | 'diluent-exceeds-phos-target';

export const KPHOS_EXCESS_WARNING_FRACTION = 0.15;

export function getKPhosExcessFraction(target: number, actual: number): number | null {
  if (actual <= target) return null;
  return target === 0 ? Number.POSITIVE_INFINITY : (actual - target) / target;
}

export type KPhosSyringeDraw = {
  rawVolumeMl: number;
  volumeMl: number;
  syringeId: string;
  syringeLabel: string;
  syringeSizeMl: number;
  incrementMl: number;
  fills: number;
};

export type KPhosPlanInput = {
  mode: KPhosMode;
  mainFluid: KPhosBaseFluid;
  criDiluentFluid: KPhosBaseFluid;
  weightKg: number | null;
  mainBagVolumeMl: number | null;
  mainFluidRateMlHr: number | null;
  phosTargetMmolKgHr: number | null;
  kTargetBasis: KPhosKTargetBasis;
  kTargetMeqPerL: number | null;
  criDurationHr: number | null;
  criRateMlHr: number | null;
};

export type KPhosPlan = {
  hasPhosTarget: boolean;
  hasKTarget: boolean;
  mainFluidRateMlKgHr: number | null;
  mainBagRuntimeHr: number | null;
  mainNativeKDeliveryMeqKgHr: number | null;
  mainNativePhosDeliveryMmolKgHr: number | null;
  criDiluentKDeliveryMeqKgHr: number | null;
  criDiluentPhosDeliveryMmolKgHr: number | null;
  kPhosPhosDeliveryMmolKgHr: number | null;
  kPhosKDeliveryMeqKgHr: number | null;
  kPhosKCreditMeqPerL: number | null;
  criDiluentKEquivalentMeqPerL: number | null;
  kPhosStockRateMlHr: number | null;
  kPhosRawStockMl: number | null;
  kPhosStockMl: number | null;
  kPhosDraw: KPhosSyringeDraw | null;
  criDiluentRateMlHr: number | null;
  criRawDiluentVolumeMl: number | null;
  criDiluentVolumeMl: number | null;
  criDiluentDraw: KPhosSyringeDraw | null;
  criPumpRateMlHr: number | null;
  criTotalVolumeMl: number | null;
  criActualRuntimeHr: number | null;
  criRequestedRateProvided: boolean;
  criRequestedRateFeasible: boolean | null;
  criRateIssue: KPhosCriRateIssue | null;
  kClRequiredMeqPerL: number | null;
  kClAddedMeqPerL: number | null;
  kClRawStockMl: number | null;
  kClTotalMeq: number | null;
  kClStockMl: number | null;
  kClDraw: KPhosSyringeDraw | null;
  addedKActualMeqPerL: number | null;
  totalKActualMeqPerL: number | null;
  selectedKActualMeqPerL: number | null;
  selectedKDeltaMeqPerL: number | null;
  finalMainBagKMeqPerL: number | null;
  finalMainBagPhosMmolPerL: number | null;
  totalKDeliveryMeqKgHr: number | null;
  totalPhosDeliveryMmolKgHr: number | null;
  combinedEquivalentKMeqPerL: number | null;
  combinedEquivalentPhosMmolPerL: number | null;
  kTargetExcessMeqPerL: number | null;
  fluidsMeetPhosTarget: boolean;
  phosTargetExcessMmolKgHr: number | null;
};

function positive(value: number | null): number | null {
  return value != null && Number.isFinite(value) && value > 0 ? value : null;
}

function nonNegative(value: number | null): number | null {
  return value != null && Number.isFinite(value) && value >= 0 ? value : null;
}

function chooseSyringeForVolume(volumeMl: number, syringes: readonly SyringeDef[]): SyringeDef {
  const sorted = [...syringes].sort((a, b) => a.sizeCc - b.sizeCc || a.incrementMl - b.incrementMl);
  const oneFill = sorted.filter((syringe) => syringe.sizeCc >= volumeMl);
  if (oneFill.length) {
    return oneFill.sort((a, b) => a.incrementMl - b.incrementMl || a.sizeCc - b.sizeCc)[0];
  }
  return sorted[sorted.length - 1];
}

function roundToIncrement(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

function makeDraw(rawVolumeMl: number, volumeMl: number, syringe: SyringeDef): KPhosSyringeDraw {
  return {
    rawVolumeMl,
    volumeMl,
    syringeId: syringe.id,
    syringeLabel: syringe.label ?? `${syringe.sizeCc} cc`,
    syringeSizeMl: syringe.sizeCc,
    incrementMl: syringe.incrementMl,
    fills: volumeMl > 0 ? Math.ceil(volumeMl / syringe.sizeCc) : 0,
  };
}

function snapSingleDraw(rawVolumeMl: number): KPhosSyringeDraw {
  const syringe = chooseSyringeForVolume(rawVolumeMl, SYRINGES);
  return makeDraw(rawVolumeMl, roundToIncrement(rawVolumeMl, syringe.incrementMl), syringe);
}

type SnappedMixture = {
  stockDraw: KPhosSyringeDraw;
  diluentDraw: KPhosSyringeDraw;
};

function snapCriMixture(
  rawStockMl: number,
  rawDiluentMl: number,
  diluentPhosMmolPerMl: number,
): SnappedMixture {
  const stockSyringe = chooseSyringeForVolume(rawStockMl, SYRINGES);
  const diluentSyringe = chooseSyringeForVolume(rawDiluentMl, SYRINGES);
  const targetVolumeMl = rawStockMl + rawDiluentMl;
  const targetPhosMmol = rawStockMl * KPHOS_PHOS_MMOL_PER_ML + rawDiluentMl * diluentPhosMmolPerMl;
  const targetConcentration = targetVolumeMl > 0 ? targetPhosMmol / targetVolumeMl : 0;
  const concentrationSpan = KPHOS_PHOS_MMOL_PER_ML - diluentPhosMmolPerMl;
  const stockRatio = concentrationSpan > 0
    ? (targetConcentration - diluentPhosMmolPerMl) / concentrationSpan
    : 1;
  const stockTickCenter = Math.max(1, Math.round(rawStockMl / stockSyringe.incrementMl));
  const stockTickMin = Math.max(1, stockTickCenter - 400);
  const stockTickMax = stockTickCenter + 400;

  let best: { stockMl: number; diluentMl: number; score: number; concentrationError: number; volumeError: number } | null = null;

  for (let stockTicks = stockTickMin; stockTicks <= stockTickMax; stockTicks++) {
    const stockMl = stockTicks * stockSyringe.incrementMl;
    const idealTotalVolumeMl = stockRatio > 0 ? stockMl / stockRatio : targetVolumeMl;
    const idealDiluentMl = Math.max(0, idealTotalVolumeMl - stockMl);
    const diluentTickCenter = Math.round(idealDiluentMl / diluentSyringe.incrementMl);

    for (let offset = -2; offset <= 2; offset++) {
      const diluentTicks = Math.max(0, diluentTickCenter + offset);
      const diluentMl = diluentTicks * diluentSyringe.incrementMl;
      const finalVolumeMl = stockMl + diluentMl;
      if (finalVolumeMl <= 0) continue;
      if (Math.ceil(stockMl / stockSyringe.sizeCc) > 20 || Math.ceil(diluentMl / diluentSyringe.sizeCc) > 20) continue;

      const finalConcentration = (stockMl * KPHOS_PHOS_MMOL_PER_ML + diluentMl * diluentPhosMmolPerMl) / finalVolumeMl;
      const concentrationError = Math.abs(finalConcentration - targetConcentration) / Math.max(1e-9, targetConcentration);
      const volumeError = Math.abs(finalVolumeMl - targetVolumeMl) / Math.max(1e-9, targetVolumeMl);
      const score = 0.8 * concentrationError + 0.2 * volumeError;

      if (
        best == null ||
        score < best.score - 1e-12 ||
        (Math.abs(score - best.score) <= 1e-12 && volumeError < best.volumeError - 1e-12) ||
        (Math.abs(score - best.score) <= 1e-12 && Math.abs(volumeError - best.volumeError) <= 1e-12 && concentrationError < best.concentrationError)
      ) {
        best = { stockMl, diluentMl, score, concentrationError, volumeError };
      }
    }
  }

  const snappedStockMl = best?.stockMl ?? roundToIncrement(rawStockMl, stockSyringe.incrementMl);
  const snappedDiluentMl = best?.diluentMl ?? roundToIncrement(rawDiluentMl, diluentSyringe.incrementMl);
  return {
    stockDraw: makeDraw(rawStockMl, snappedStockMl, stockSyringe),
    diluentDraw: makeDraw(rawDiluentMl, snappedDiluentMl, diluentSyringe),
  };
}

export function calculateKPhosPlan(input: KPhosPlanInput): KPhosPlan {
  const hasPhosTarget = input.phosTargetMmolKgHr != null;
  const weightKg = positive(input.weightKg);
  const mainBagVolumeMl = positive(input.mainBagVolumeMl);
  const mainFluidRateMlHr = positive(input.mainFluidRateMlHr);
  const phosTarget = nonNegative(input.phosTargetMmolKgHr);
  const kTarget = nonNegative(input.kTargetMeqPerL);
  const hasKTarget = kTarget != null && kTarget > 0;
  const criDurationHr = positive(input.criDurationHr);
  const requestedCriRateMlHr = positive(input.criRateMlHr);
  const criRequestedRateProvided = input.criRateMlHr != null;

  const mainFluidRateMlKgHr = weightKg != null && mainFluidRateMlHr != null
    ? mainFluidRateMlHr / weightKg
    : null;
  const mainBagRuntimeHr = mainBagVolumeMl != null && mainFluidRateMlHr != null
    ? mainBagVolumeMl / mainFluidRateMlHr
    : null;
  const mainNativeKDeliveryMeqKgHr = mainFluidRateMlKgHr != null
    ? input.mainFluid.nativeKMeqPerL * mainFluidRateMlKgHr / 1000
    : null;
  const mainNativePhosDeliveryMmolKgHr = mainFluidRateMlKgHr != null
    ? input.mainFluid.nativePhosMmolPerL * mainFluidRateMlKgHr / 1000
    : input.mainFluid.nativePhosMmolPerL === 0
      ? 0
      : null;

  let idealKPhosStockRateMlHr: number | null = null;
  let idealCriDiluentRateMlHr: number | null = input.mode === 'cri' && hasPhosTarget ? null : 0;
  let criPumpRateMlHr: number | null = input.mode === 'cri' && hasPhosTarget ? null : 0;
  let criRequestedRateFeasible: boolean | null = null;
  let criRateIssue: KPhosCriRateIssue | null = null;

  if (!hasPhosTarget) {
    idealKPhosStockRateMlHr = 0;
  } else if (phosTarget != null && weightKg != null && mainNativePhosDeliveryMmolKgHr != null) {
    const remainingPhosMmolHr = Math.max(0, phosTarget - mainNativePhosDeliveryMmolKgHr) * weightKg;

    if (input.mode === 'bag') {
      idealKPhosStockRateMlHr = remainingPhosMmolHr / KPHOS_PHOS_MMOL_PER_ML;
    } else if (remainingPhosMmolHr === 0) {
      idealKPhosStockRateMlHr = 0;
      idealCriDiluentRateMlHr = 0;
      criPumpRateMlHr = 0;
      criRequestedRateFeasible = requestedCriRateMlHr == null ? null : true;
    } else if (requestedCriRateMlHr != null) {
      const diluentPhosMmolPerMl = input.criDiluentFluid.nativePhosMmolPerL / 1000;
      const stockPhosMmolPerMl = KPHOS_PHOS_MMOL_PER_ML;
      const requiredStockRate = (remainingPhosMmolHr - diluentPhosMmolPerMl * requestedCriRateMlHr) /
        (stockPhosMmolPerMl - diluentPhosMmolPerMl);

      if (requiredStockRate < 0) {
        idealKPhosStockRateMlHr = remainingPhosMmolHr / KPHOS_PHOS_MMOL_PER_ML;
        idealCriDiluentRateMlHr = 0;
        criPumpRateMlHr = idealKPhosStockRateMlHr;
        criRequestedRateFeasible = false;
        criRateIssue = 'diluent-exceeds-phos-target';
      } else if (requiredStockRate <= requestedCriRateMlHr) {
        idealKPhosStockRateMlHr = requiredStockRate;
        idealCriDiluentRateMlHr = requestedCriRateMlHr - requiredStockRate;
        criPumpRateMlHr = requestedCriRateMlHr;
        criRequestedRateFeasible = true;
      } else {
        idealKPhosStockRateMlHr = remainingPhosMmolHr / KPHOS_PHOS_MMOL_PER_ML;
        idealCriDiluentRateMlHr = 0;
        criPumpRateMlHr = idealKPhosStockRateMlHr;
        criRequestedRateFeasible = false;
        criRateIssue = 'below-stock-rate';
      }
    } else {
      idealKPhosStockRateMlHr = remainingPhosMmolHr / KPHOS_PHOS_MMOL_PER_ML;
      idealCriDiluentRateMlHr = 0;
      criPumpRateMlHr = idealKPhosStockRateMlHr;
    }
  }

  const preparationHours = input.mode === 'bag' ? mainBagRuntimeHr : criDurationHr;
  const kPhosRawStockMl = hasPhosTarget && idealKPhosStockRateMlHr != null && preparationHours != null
    ? idealKPhosStockRateMlHr * preparationHours
    : hasPhosTarget && idealKPhosStockRateMlHr === 0
      ? 0
      : null;
  const criRawDiluentVolumeMl = input.mode === 'cri' && hasPhosTarget && idealCriDiluentRateMlHr != null && criDurationHr != null
    ? idealCriDiluentRateMlHr * criDurationHr
    : input.mode === 'bag' || !hasPhosTarget
      ? null
      : idealCriDiluentRateMlHr === 0
        ? 0
        : null;

  let kPhosDraw: KPhosSyringeDraw | null = null;
  let criDiluentDraw: KPhosSyringeDraw | null = null;
  let kPhosStockMl: number | null = kPhosRawStockMl;
  let criDiluentVolumeMl: number | null = criRawDiluentVolumeMl;
  let criTotalVolumeMl: number | null = input.mode === 'cri' && kPhosRawStockMl != null && criRawDiluentVolumeMl != null
    ? kPhosRawStockMl + criRawDiluentVolumeMl
    : null;
  let criActualRuntimeHr: number | null = input.mode === 'cri' && hasPhosTarget ? criDurationHr : null;
  let kPhosStockRateMlHr: number | null = idealKPhosStockRateMlHr;
  let criDiluentRateMlHr: number | null = idealCriDiluentRateMlHr;

  if (hasPhosTarget && kPhosRawStockMl != null) {
    if (kPhosRawStockMl === 0) {
      kPhosStockMl = 0;
      kPhosStockRateMlHr = 0;
      if (input.mode === 'cri') {
        criDiluentVolumeMl = 0;
        criDiluentRateMlHr = 0;
        criTotalVolumeMl = 0;
        criActualRuntimeHr = 0;
      }
    } else if (input.mode === 'bag' && mainBagRuntimeHr != null) {
      kPhosDraw = snapSingleDraw(kPhosRawStockMl);
      kPhosStockMl = kPhosDraw.volumeMl;
      kPhosStockRateMlHr = kPhosDraw.volumeMl / mainBagRuntimeHr;
    } else if (input.mode === 'cri' && criDurationHr != null && criPumpRateMlHr != null && criPumpRateMlHr > 0) {
      if (criRawDiluentVolumeMl != null && criRawDiluentVolumeMl > 0) {
        const snapped = snapCriMixture(
          kPhosRawStockMl,
          criRawDiluentVolumeMl,
          input.criDiluentFluid.nativePhosMmolPerL / 1000,
        );
        kPhosDraw = snapped.stockDraw;
        criDiluentDraw = snapped.diluentDraw;
      } else {
        kPhosDraw = snapSingleDraw(kPhosRawStockMl);
        const rawDiluent = criRawDiluentVolumeMl ?? 0;
        const diluentSyringe = chooseSyringeForVolume(rawDiluent, SYRINGES);
        criDiluentDraw = makeDraw(rawDiluent, 0, diluentSyringe);
      }

      kPhosStockMl = kPhosDraw.volumeMl;
      criDiluentVolumeMl = criDiluentDraw.volumeMl;
      criTotalVolumeMl = kPhosStockMl + criDiluentVolumeMl;
      if (criTotalVolumeMl > 0) {
        kPhosStockRateMlHr = criPumpRateMlHr * kPhosStockMl / criTotalVolumeMl;
        criDiluentRateMlHr = criPumpRateMlHr * criDiluentVolumeMl / criTotalVolumeMl;
        criActualRuntimeHr = criTotalVolumeMl / criPumpRateMlHr;
      }
    }
  }

  const criDiluentKDeliveryMeqKgHr = input.mode === 'cri' && criDiluentRateMlHr != null && weightKg != null
    ? input.criDiluentFluid.nativeKMeqPerL * criDiluentRateMlHr / 1000 / weightKg
    : input.mode === 'bag' || !hasPhosTarget
      ? 0
      : null;
  const criDiluentPhosDeliveryMmolKgHr = input.mode === 'cri' && criDiluentRateMlHr != null && weightKg != null
    ? input.criDiluentFluid.nativePhosMmolPerL * criDiluentRateMlHr / 1000 / weightKg
    : input.mode === 'bag' || !hasPhosTarget
      ? 0
      : null;
  const kPhosPhosDeliveryMmolKgHr = kPhosStockRateMlHr != null && weightKg != null
    ? kPhosStockRateMlHr * KPHOS_PHOS_MMOL_PER_ML / weightKg
    : !hasPhosTarget
      ? 0
      : null;
  const kPhosKDeliveryMeqKgHr = kPhosStockRateMlHr != null && weightKg != null
    ? kPhosStockRateMlHr * KPHOS_K_MEQ_PER_ML / weightKg
    : !hasPhosTarget
      ? 0
      : null;

  const supplementalKDeliveryMeqKgHr = kPhosKDeliveryMeqKgHr != null && criDiluentKDeliveryMeqKgHr != null
    ? kPhosKDeliveryMeqKgHr + criDiluentKDeliveryMeqKgHr
    : null;
  const kPhosKCreditMeqPerL = kPhosKDeliveryMeqKgHr == null
    ? null
    : kPhosKDeliveryMeqKgHr === 0
      ? 0
      : mainFluidRateMlKgHr != null
        ? kPhosKDeliveryMeqKgHr * 1000 / mainFluidRateMlKgHr
        : null;
  const criDiluentKEquivalentMeqPerL = criDiluentKDeliveryMeqKgHr == null
    ? null
    : criDiluentKDeliveryMeqKgHr === 0
      ? 0
      : mainFluidRateMlKgHr != null
        ? criDiluentKDeliveryMeqKgHr * 1000 / mainFluidRateMlKgHr
        : null;

  let rawKClAddedMeqPerL: number | null = null;
  let kClRequiredMeqPerL: number | null = null;
  const selectedKCreditMeqPerL = kPhosKCreditMeqPerL == null || criDiluentKEquivalentMeqPerL == null
    ? null
    : kPhosKCreditMeqPerL + (input.kTargetBasis === 'total'
      ? input.mainFluid.nativeKMeqPerL + criDiluentKEquivalentMeqPerL
      : 0);

  if (!hasKTarget) {
    kClRequiredMeqPerL = 0;
  } else if (kTarget != null && selectedKCreditMeqPerL != null) {
      rawKClAddedMeqPerL = kTarget - selectedKCreditMeqPerL;
      kClRequiredMeqPerL = Math.max(0, rawKClAddedMeqPerL);
  }

  const requiredKClTotalMeq = hasKTarget && kClRequiredMeqPerL != null && mainBagVolumeMl != null
    ? kClRequiredMeqPerL * mainBagVolumeMl / 1000
    : null;
  const kClRawStockMl = requiredKClTotalMeq == null ? null : requiredKClTotalMeq / KCL_K_MEQ_PER_ML;
  const kClDraw = kClRawStockMl == null ? null : snapSingleDraw(kClRawStockMl);
  const kClStockMl = kClDraw?.volumeMl ?? null;
  const kClTotalMeq = kClStockMl == null ? null : kClStockMl * KCL_K_MEQ_PER_ML;
  const kClAddedMeqPerL = !hasKTarget
    ? 0
    : kClTotalMeq != null && mainBagVolumeMl != null
      ? kClTotalMeq * 1000 / mainBagVolumeMl
      : null;
  const addedKActualMeqPerL = hasKTarget && kPhosKCreditMeqPerL != null && kClAddedMeqPerL != null
    ? kPhosKCreditMeqPerL + kClAddedMeqPerL
    : null;

  const bagKClContribution = hasKTarget ? kClAddedMeqPerL : 0;
  const bagKPhosKContribution = input.mode === 'bag' && hasPhosTarget ? kPhosKCreditMeqPerL : 0;
  const bagKPhosPhosContribution = input.mode === 'bag' && hasPhosTarget && kPhosPhosDeliveryMmolKgHr != null && mainFluidRateMlKgHr != null
    ? kPhosPhosDeliveryMmolKgHr * 1000 / mainFluidRateMlKgHr
    : input.mode === 'cri' || !hasPhosTarget
      ? 0
      : null;
  const finalMainBagKMeqPerL = bagKClContribution != null && bagKPhosKContribution != null
    ? input.mainFluid.nativeKMeqPerL + bagKClContribution + bagKPhosKContribution
    : null;
  const finalMainBagPhosMmolPerL = bagKPhosPhosContribution != null
    ? input.mainFluid.nativePhosMmolPerL + bagKPhosPhosContribution
    : null;

  const kClDeliveryMeqKgHr = mainFluidRateMlKgHr != null && bagKClContribution != null
    ? bagKClContribution * mainFluidRateMlKgHr / 1000
    : null;
  const totalKDeliveryMeqKgHr = mainNativeKDeliveryMeqKgHr != null && kClDeliveryMeqKgHr != null && supplementalKDeliveryMeqKgHr != null
    ? mainNativeKDeliveryMeqKgHr + kClDeliveryMeqKgHr + supplementalKDeliveryMeqKgHr
    : null;
  const totalPhosDeliveryMmolKgHr = mainNativePhosDeliveryMmolKgHr != null && criDiluentPhosDeliveryMmolKgHr != null && kPhosPhosDeliveryMmolKgHr != null
    ? mainNativePhosDeliveryMmolKgHr + criDiluentPhosDeliveryMmolKgHr + kPhosPhosDeliveryMmolKgHr
    : null;
  const combinedEquivalentKMeqPerL = totalKDeliveryMeqKgHr != null && mainFluidRateMlKgHr != null
    ? totalKDeliveryMeqKgHr * 1000 / mainFluidRateMlKgHr
    : null;
  const combinedEquivalentPhosMmolPerL = totalPhosDeliveryMmolKgHr != null && mainFluidRateMlKgHr != null
    ? totalPhosDeliveryMmolKgHr * 1000 / mainFluidRateMlKgHr
    : null;
  const totalKActualMeqPerL = hasKTarget ? combinedEquivalentKMeqPerL : null;
  const selectedKActualMeqPerL = input.kTargetBasis === 'total' ? totalKActualMeqPerL : addedKActualMeqPerL;
  const selectedKDeltaMeqPerL = selectedKActualMeqPerL != null && kTarget != null
    ? selectedKActualMeqPerL - kTarget
    : null;

  const phosTargetExcessMmolKgHr = phosTarget != null && totalPhosDeliveryMmolKgHr != null && totalPhosDeliveryMmolKgHr > phosTarget
    ? totalPhosDeliveryMmolKgHr - phosTarget
    : null;

  return {
    hasPhosTarget,
    hasKTarget,
    mainFluidRateMlKgHr,
    mainBagRuntimeHr,
    mainNativeKDeliveryMeqKgHr,
    mainNativePhosDeliveryMmolKgHr,
    criDiluentKDeliveryMeqKgHr,
    criDiluentPhosDeliveryMmolKgHr,
    kPhosPhosDeliveryMmolKgHr,
    kPhosKDeliveryMeqKgHr,
    kPhosKCreditMeqPerL,
    criDiluentKEquivalentMeqPerL,
    kPhosStockRateMlHr,
    kPhosRawStockMl,
    kPhosStockMl,
    kPhosDraw,
    criDiluentRateMlHr,
    criRawDiluentVolumeMl,
    criDiluentVolumeMl,
    criDiluentDraw,
    criPumpRateMlHr,
    criTotalVolumeMl,
    criActualRuntimeHr,
    criRequestedRateProvided,
    criRequestedRateFeasible,
    criRateIssue,
    kClRequiredMeqPerL,
    kClAddedMeqPerL,
    kClRawStockMl,
    kClTotalMeq,
    kClStockMl,
    kClDraw,
    addedKActualMeqPerL,
    totalKActualMeqPerL,
    selectedKActualMeqPerL,
    selectedKDeltaMeqPerL,
    finalMainBagKMeqPerL,
    finalMainBagPhosMmolPerL,
    totalKDeliveryMeqKgHr,
    totalPhosDeliveryMmolKgHr,
    combinedEquivalentKMeqPerL,
    combinedEquivalentPhosMmolPerL,
    kTargetExcessMeqPerL: rawKClAddedMeqPerL != null && rawKClAddedMeqPerL < 0
      ? Math.abs(rawKClAddedMeqPerL)
      : null,
    fluidsMeetPhosTarget: hasPhosTarget && kPhosStockRateMlHr === 0,
    phosTargetExcessMmolKgHr,
  };
}
