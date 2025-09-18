import { SYRINGES } from '../definitions';
import type { SyringeDef } from '../definitions';
import type { Patient } from '../stores/patient';

const STOCK_NOREPI_MG_PER_ML = 1; // from medications.ts (Norepinephrine)
const STOCK_DEXTROSE_MG_PER_ML = 500; // 50% dextrose
const TARGET_DEXTROSE_PERCENT = 5; // aim for 5% final
const TARGET_DEXTROSE_MG_PER_ML = TARGET_DEXTROSE_PERCENT * 10; // 50 mg/mL
const DEXTROSE_TOLERANCE_PERCENT = 0.25; // ±0.25%
const DEXTROSE_MIN_MG_PER_ML = (TARGET_DEXTROSE_PERCENT - DEXTROSE_TOLERANCE_PERCENT) * 10; // 47.5 mg/mL
const DEXTROSE_MAX_MG_PER_ML = (TARGET_DEXTROSE_PERCENT + DEXTROSE_TOLERANCE_PERCENT) * 10; // 52.5 mg/mL
const MAX_FILLS_PER_COMPONENT = 20;

export type VMAlert = { severity: 'warn' | 'info'; message: string };

export type DrawCard = {
  id: 'norEpi' | 'dextrose' | 'swfi';
  title: string;
  volumeText: string;
  syringeText?: string;
  tickText?: string;
  fills?: number;
};

export type ResultCard = {
  totalVolumeText: string;
  pumpRateText: string;
  plannedDurationText: string;
  deliveredDurationText: string;
  targetDoseText: string;
  deliveredDoseText: string;
  finalNorEpiConcText: string;
  finalDextroseText: string;
};

export type RoundingDetail = {
  title: string;
  rows: { label: string; value: string; subnote?: string }[];
};

export type BuildParams = {
  patient: Patient;
  targetDoseMcgPerKgMin: number | '';
  pumpRateMlPerHr: number | '';
  durationHr: number | '';
};

export type NorEpiDextroseViewModel = {
  alerts: VMAlert[];
  drawCards: DrawCard[];
  resultCard: ResultCard;
  roundingDetail?: RoundingDetail | null;
};

const doseUnitConstant = 0.06; // converts mcg/kg/min → mg/kg/hr

const fmt = (value: number | null | undefined, digits = 2) => {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toFixed(digits);
};

function chooseSyringeForVolume(volMl: number, syringes: readonly SyringeDef[]): SyringeDef {
  const sorted = [...syringes].sort((a, b) => a.sizeCc - b.sizeCc || a.incrementMl - b.incrementMl);
  const candidates = sorted.filter((s) => s.sizeCc >= volMl && volMl > 0);
  if (candidates.length) {
    return candidates.sort((a, b) => a.incrementMl - b.incrementMl || a.sizeCc - b.sizeCc)[0];
  }
  return sorted[0];
}

const roundToIncrement = (value: number, increment: number) => {
  if (increment <= 0) return value;
  return Math.round(value / increment) * increment;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function buildComponentCard(
  id: DrawCard['id'],
  title: string,
  volumeMl: number,
  syringe: SyringeDef,
): DrawCard {
  const fills = Math.ceil(volumeMl / syringe.sizeCc);
  return {
    id,
    title,
    volumeText: `${fmt(volumeMl, 2)} mL`,
    syringeText: syringe.label ?? `${syringe.sizeCc} cc`,
    tickText: `ticks ${fmt(syringe.incrementMl, syringe.incrementMl < 1 ? 2 : 1)} mL`,
    fills: fills > 1 ? fills : undefined,
  };
}

export function buildNorEpiDextroseViewModel(params: BuildParams): NorEpiDextroseViewModel | null {
  const { patient, targetDoseMcgPerKgMin, pumpRateMlPerHr, durationHr } = params;

  const weightKg = patient.weightKg ?? null;
  if (!weightKg || weightKg <= 0) return null;
  if (targetDoseMcgPerKgMin === '' || pumpRateMlPerHr === '' || durationHr === '') return null;

  const doseMcgPerKgMin = Number(targetDoseMcgPerKgMin);
  const pumpRate = Number(pumpRateMlPerHr);
  const duration = Number(durationHr);

  if (doseMcgPerKgMin < 0 || pumpRate <= 0 || duration <= 0) return null;

  const alerts: VMAlert[] = [];

  const doseMgPerKgHr = doseMcgPerKgMin * doseUnitConstant;
  const targetConcMgPerMl = (doseMgPerKgHr * weightKg) / pumpRate;

  if (targetConcMgPerMl > STOCK_NOREPI_MG_PER_ML) {
    alerts.push({
      severity: 'warn',
      message: `Dose requires ${fmt(targetConcMgPerMl, 3)} mg/mL but stock is ${fmt(STOCK_NOREPI_MG_PER_ML, 3)} mg/mL. Increase pump rate or obtain more concentrated Norepinephrine.`,
    });
  }

  const totalVolumeTarget = pumpRate * duration;
  if (totalVolumeTarget <= 0) return null;

  const rawNorVolume = (targetConcMgPerMl / STOCK_NOREPI_MG_PER_ML) * totalVolumeTarget;
  const rawDexVolume = (TARGET_DEXTROSE_MG_PER_ML / STOCK_DEXTROSE_MG_PER_ML) * totalVolumeTarget;
  const rawSwVolume = Math.max(0, totalVolumeTarget - rawNorVolume - rawDexVolume);

  const norSyringe = chooseSyringeForVolume(rawNorVolume, SYRINGES);
  const dexSyringe = chooseSyringeForVolume(rawDexVolume, SYRINGES);
  const swSyringe = chooseSyringeForVolume(rawSwVolume, SYRINGES);

  const incNor = norSyringe.incrementMl;
  const incDex = dexSyringe.incrementMl;
  const incSw = swSyringe.incrementMl;

  const centerNorTicks = rawNorVolume / incNor;
  const centerDexTicks = rawDexVolume / incDex;

  const spanNor = Math.min(250, Math.max(3, Math.ceil(centerNorTicks * 0.05)));
  const spanDex = Math.min(250, Math.max(3, Math.ceil(centerDexTicks * 0.05)));

  const dexRatioLower = DEXTROSE_MIN_MG_PER_ML / STOCK_DEXTROSE_MG_PER_ML;
  const dexRatioUpper = DEXTROSE_MAX_MG_PER_ML / STOCK_DEXTROSE_MG_PER_ML;

  let bestScore = Number.POSITIVE_INFINITY;
  let best: {
    volNor: number;
    volDex: number;
    volSw: number;
    totalVol: number;
    finalNorConc: number;
    finalDexMgPerMl: number;
  } | null = null;

  const norStart = Math.max(0, Math.round(centerNorTicks) - spanNor);
  const norEnd = Math.max(norStart, Math.round(centerNorTicks) + spanNor);
  const dexStart = Math.max(1, Math.round(centerDexTicks) - spanDex);
  const dexEnd = Math.max(dexStart, Math.round(centerDexTicks) + spanDex);

  for (let norTicks = norStart; norTicks <= norEnd; norTicks++) {
    const volNor = norTicks * incNor;
    if (volNor < 0) continue;

    for (let dexTicks = dexStart; dexTicks <= dexEnd; dexTicks++) {
      const volDex = dexTicks * incDex;
      if (volDex <= 0) continue;

      const minTotal = volDex / dexRatioUpper;
      const maxTotal = volDex / dexRatioLower;
      const minSw = Math.max(0, minTotal - volNor - volDex);
      const maxSw = Math.max(0, maxTotal - volNor - volDex);
      if (minSw > maxSw + 1e-9) continue;

      const swTarget = totalVolumeTarget - volNor - volDex;
      const swTicksMin = Math.ceil(minSw / incSw);
      const swTicksMax = Math.floor(maxSw / incSw);
      if (swTicksMax < swTicksMin) continue;

      const targetTicks = clamp(Math.round(swTarget / incSw), swTicksMin, swTicksMax);
      const swCandidates = [
        targetTicks,
        clamp(targetTicks - 1, swTicksMin, swTicksMax),
        clamp(targetTicks + 1, swTicksMin, swTicksMax),
        swTicksMin,
        swTicksMax,
      ].filter((value, idx, arr) => arr.indexOf(value) === idx);

      for (const swTicks of swCandidates) {
        if (swTicks < swTicksMin || swTicks > swTicksMax) continue;
        const volSw = swTicks * incSw;
        const totalVol = volNor + volDex + volSw;
        if (totalVol <= 0) continue;

        const finalNorConc = STOCK_NOREPI_MG_PER_ML * (volNor / totalVol);
        const finalDexMgPerMl = STOCK_DEXTROSE_MG_PER_ML * (volDex / totalVol);

        if (finalDexMgPerMl < DEXTROSE_MIN_MG_PER_ML - 1e-6 || finalDexMgPerMl > DEXTROSE_MAX_MG_PER_ML + 1e-6) continue;

        const doseConcError = Math.abs(finalNorConc - targetConcMgPerMl) / Math.max(targetConcMgPerMl, 1e-9);
        const dexError = Math.abs(finalDexMgPerMl - TARGET_DEXTROSE_MG_PER_ML) / TARGET_DEXTROSE_MG_PER_ML;
        const volumeError = Math.abs(totalVol - totalVolumeTarget) / totalVolumeTarget;

        const score = doseConcError * 0.6 + dexError * 0.3 + volumeError * 0.1;
        if (score < bestScore) {
          bestScore = score;
          best = { volNor, volDex, volSw, totalVol, finalNorConc, finalDexMgPerMl };
        }
      }
    }
  }

  if (!best) {
    alerts.push({ severity: 'warn', message: 'Could not find volumes that meet the dose and dextrose constraints with syringe increments.' });
    return {
      alerts,
      drawCards: [],
      resultCard: {
        totalVolumeText: '—',
        pumpRateText: `${fmt(pumpRate, 2)} mL/hr`,
        plannedDurationText: `${fmt(duration, 1)} hr`,
        deliveredDurationText: '—',
        targetDoseText: `${fmt(doseMcgPerKgMin, 3)} mcg/kg/min`,
        deliveredDoseText: '—',
        finalNorEpiConcText: '—',
        finalDextroseText: '—',
      },
      roundingDetail: null,
    };
  }

  const { volNor, volDex, volSw, totalVol, finalNorConc, finalDexMgPerMl } = best;

  const deliveredDoseMcgPerKgMin = (finalNorConc * pumpRate) / (doseUnitConstant * weightKg);
  const deliveredDurationHr = totalVol / pumpRate;

  if (Math.abs(finalNorConc - targetConcMgPerMl) / Math.max(targetConcMgPerMl, 1e-9) > 0.05) {
    alerts.push({
      severity: 'info',
      message: `Dose differs from target by ${fmt(100 * Math.abs(finalNorConc - targetConcMgPerMl) / Math.max(targetConcMgPerMl, 1e-9), 1)}%.`,
    });
  }

  const norCard = buildComponentCard('norEpi', 'Norepinephrine (1 mg/mL)', volNor, norSyringe);
  const dexCard = buildComponentCard('dextrose', 'Dextrose 50%', volDex, dexSyringe);
  const swCard = buildComponentCard('swfi', 'Sterile Water for Injection', volSw, swSyringe);

  const roundingRows: RoundingDetail['rows'] = [];
  roundingRows.push({ label: 'Target total volume', value: `${fmt(totalVolumeTarget, 2)} mL` });
  roundingRows.push({ label: 'Snapped total volume', value: `${fmt(totalVol, 2)} mL (Δ ${fmt(totalVol - totalVolumeTarget, 2)} mL)` });
  roundingRows.push({ label: 'Target NorEpi volume', value: `${fmt(rawNorVolume, 3)} mL` });
  roundingRows.push({ label: 'Snapped NorEpi volume', value: `${fmt(volNor, 3)} mL` });
  roundingRows.push({ label: 'Target Dextrose volume', value: `${fmt(rawDexVolume, 3)} mL` });
  roundingRows.push({ label: 'Snapped Dextrose volume', value: `${fmt(volDex, 3)} mL` });
  roundingRows.push({ label: 'Target SWFI volume', value: `${fmt(rawSwVolume, 3)} mL` });
  roundingRows.push({ label: 'Snapped SWFI volume', value: `${fmt(volSw, 3)} mL` });

  const anyFillsOver = [
    [norCard, volNor / norSyringe.sizeCc],
    [dexCard, volDex / dexSyringe.sizeCc],
    [swCard, volSw / swSyringe.sizeCc],
  ] as const;

  for (const [card, fillsFloat] of anyFillsOver) {
    const fills = Math.ceil(fillsFloat);
    if (fills > MAX_FILLS_PER_COMPONENT) {
      alerts.push({ severity: 'info', message: `${card.title} volume requires ${fills} fills of ${card.syringeText}.` });
    }
  }

  const resultCard: ResultCard = {
    totalVolumeText: `${fmt(totalVol, 2)} mL`,
    pumpRateText: `${fmt(pumpRate, 2)} mL/hr`,
    plannedDurationText: `${fmt(duration, 1)} hr target`,
    deliveredDurationText: `${fmt(deliveredDurationHr, 2)} hr actual`,
    targetDoseText: `${fmt(doseMcgPerKgMin, 3)} mcg/kg/min`,
    deliveredDoseText: `${fmt(deliveredDoseMcgPerKgMin, 3)} mcg/kg/min`,
    finalNorEpiConcText: `${fmt(finalNorConc, 4)} mg/mL`,
    finalDextroseText: `${fmt(finalDexMgPerMl / 10, 2)}% (${fmt(finalDexMgPerMl, 2)} mg/mL)`,
  };

  const roundingDetail: RoundingDetail = {
    title: 'Rounding',
    rows: roundingRows,
  };

  return {
    alerts,
    drawCards: [norCard, dexCard, swCard],
    resultCard,
    roundingDetail,
  };
}
