import type { Patient } from '../stores/patient';
import type { MedicationDef, SyringeDef } from '../definitions/types';
import { SYRINGES } from '../definitions';
import { computeMixturePlan, type DoseUnit } from '../helpers/doseMapping';

export type VMAlert = { severity: 'warn' | 'info'; message: string };

export type DrawCard = {
  kind: 'stock' | 'diluent';
  title: string;
  volumeText: string; // e.g. "12.30 mL"
  syringeText?: string; // e.g. "3 cc (0.1 mL ticks)"
  tickText?: string; // optional: prefer showing ticks via label; omit to avoid duplication
  fills?: number; // omit or 1 to hide in UI
};

export type ResultCard = {
  title: string;
  totalVolumeText: string;
  finalConcentrationText: string;
  pumpRateText: string;
  deliveredDoseText: string;
  doseLines: string[];
};

export type CRIViewModel = {
  mode: 'stock' | 'dilution';
  alerts: VMAlert[];
  drawCards: DrawCard[];
  resultCard: ResultCard;
};

export type BuildParams = {
  enableDilution: boolean;
  p: Patient;
  med?: MedicationDef;
  desiredDose: number | '';
  doseUnit: DoseUnit;
  durationHr: number | '';
  desiredRateMlPerHr: number | '';
};

// ---------- utilities ----------

function fmt(x: number | null | undefined, digits = 2) {
  if (x == null || Number.isNaN(x)) return '—';
  return Number(x).toFixed(digits);
}

function unitConstant(u: DoseUnit) {
  switch (u) {
    case 'mcg/kg/min':
      return 0.06;
    case 'mg/kg/min':
      return 60;
    case 'mg/kg/day':
      return 1 / 24;
    case 'mcg/kg/hr':
      return 1 / 1000;
    case 'mg/kg/hr':
    default:
      return 1;
  }
}

function concMgPerMl(m?: MedicationDef | null) {
  if (!m) return null;
  return m.concentration.units === 'mg/mL'
    ? m.concentration.value
    : m.concentration.value / 1000;
}

function chooseSyringeForVolume(volMl: number, syrs: readonly SyringeDef[]): SyringeDef {
  const sorted = [...syrs].sort((a, b) => a.sizeCc - b.sizeCc || a.incrementMl - b.incrementMl);
  const oneFill = sorted.filter((s) => s.sizeCc >= volMl);
  if (oneFill.length) {
    return oneFill.sort((a, b) => a.incrementMl - b.incrementMl || a.sizeCc - b.sizeCc)[0];
  }
  return sorted[sorted.length - 1];
}

function roundToInc(v: number, inc: number) {
  return Math.round(v / inc) * inc;
}

function classifyWarning(msg: string): VMAlert['severity'] {
  const m = msg.toLowerCase();
  if (m.startsWith('stock too weak')) return 'warn';
  if (m.includes('exceeds tolerance')) return 'info';
  if (m.includes('requires') && m.includes('fills')) return 'info';
  if (m.startsWith('used simple rounding')) return 'info';
  return 'info';
}

function convertMgPerKgHr(value: number, unit: DoseUnit): number {
  switch (unit) {
    case 'mg/kg/day':
      return value * 24;
    case 'mcg/kg/hr':
      return value * 1000;
    case 'mcg/kg/min':
      return (value * 1000) / 60;
    case 'mg/kg/min':
      return value / 60;
    case 'mg/kg/hr':
    default:
      return value;
  }
}

function formatDose(valueMgPerKgHr: number, unit: DoseUnit): string {
  return `${fmt(convertMgPerKgHr(valueMgPerKgHr, unit), 3)} ${unit}`;
}

// ---------- builder ----------

export function buildCRIViewModel(params: BuildParams): CRIViewModel | null {
  const { enableDilution, p, med, desiredDose, doseUnit, durationHr, desiredRateMlPerHr } = params;

  const hasBasics = !!(p.weightKg && med && desiredDose !== '' && durationHr !== '');
  if (!hasBasics) return null;

  const dosePerKgHr = unitConstant(doseUnit) * Number(desiredDose); // mg/kg/hr
  // ---------- Stock-only path ----------
  if (!enableDilution) {
    const weightKg = p.weightKg as number;
    const rateMlHr = (dosePerKgHr * weightKg) / (concMgPerMl(med) as number);
    const targetVol = rateMlHr * Number(durationHr);
    const syr = chooseSyringeForVolume(targetVol, SYRINGES);
    const drawVol = roundToInc(targetVol, syr.incrementMl);
    const fills = Math.ceil(drawVol / syr.sizeCc);

    const massRateMgHr = rateMlHr * (concMgPerMl(med) as number);
    const actualDoseMgPerKgHr = massRateMgHr / weightKg;

    // Alerts: none special in stock-only right now (could add fill guidance)
    const alerts: VMAlert[] = [];

    // Summary cards
    const syringeText = syr.label ?? `${syr.sizeCc} cc`;
    const syringeHasTickInfo = syringeText.toLowerCase().includes('ticks');
    const drawCard: DrawCard = {
      kind: 'stock',
      title: 'Stock to Draw Up',
      volumeText: `${fmt(drawVol, 2)} mL`,
      syringeText,
      tickText: syringeHasTickInfo ? undefined : `${syr.incrementMl} mL ticks`,
      fills: fills > 1 ? fills : undefined,
    };
    const resultCard: ResultCard = {
      title: 'Result',
      totalVolumeText: `${fmt(drawVol, 2)} mL`,
      finalConcentrationText: `${fmt(concMgPerMl(med), 4)} mg/mL`,
      pumpRateText: `${fmt(rateMlHr, 2)} mL/hr`,
      deliveredDoseText: formatDose(actualDoseMgPerKgHr, doseUnit),
      doseLines: [
        formatDose(actualDoseMgPerKgHr, 'mg/kg/hr'),
        formatDose(actualDoseMgPerKgHr, 'mg/kg/min'),
        formatDose(actualDoseMgPerKgHr, 'mg/kg/day'),
        formatDose(actualDoseMgPerKgHr, 'mcg/kg/min'),
        formatDose(actualDoseMgPerKgHr, 'mcg/kg/hr'),
      ],
    };

    return { mode: 'stock', alerts, drawCards: [drawCard], resultCard };
  }

  // ---------- Dilution path ----------
  const weightKg = p.weightKg as number;
  const plan = computeMixturePlan({
    weightKg,
    medication: med!,
    desiredDose: Number(desiredDose),
    doseUnit,
    desiredRateMlPerHr: Number(desiredRateMlPerHr || 0),
    desiredDurationHr: Number(durationHr),
    syringes: SYRINGES,
  });

  const alerts: VMAlert[] = [];
  if (!plan.feasibleAtDesiredRate) {
    alerts.push({
      severity: 'warn',
      message: `At ${fmt(plan.desiredRateMlPerHr, 2)} mL/hr stock is too weak to match the dose. Use ${fmt(plan.mappingRateMlPerHr, 3)} mL/hr to hit the target.`,
    });
  }
  for (const msg of plan.warnings) {
    const low = msg.toLowerCase();
    if (!plan.feasibleAtDesiredRate && low.startsWith('stock too weak')) continue;
    alerts.push({ severity: classifyWarning(msg), message: msg });
  }

  const drawCards: DrawCard[] = [
    {
      kind: 'stock',
      title: 'Stock to Draw Up',
      volumeText: `${fmt(plan.snappedStockVolumeMl, 2)} mL`,
      syringeText: plan.stockDraw.syringeLabel ?? `${plan.stockDraw.syringeSizeMl} cc`,
      fills: plan.stockDraw.fills > 1 ? plan.stockDraw.fills : undefined,
    },
  ];
  if (plan.snappedDiluentVolumeMl > 1e-6) {
    drawCards.push({
      kind: 'diluent',
      title: 'Diluent to Draw Up',
      volumeText: `${fmt(plan.snappedDiluentVolumeMl, 2)} mL`,
      syringeText: plan.diluentDraw.syringeLabel ?? `${plan.diluentDraw.syringeSizeMl} cc`,
      fills: plan.diluentDraw.fills > 1 ? plan.diluentDraw.fills : undefined,
    });
  }

  const mgPerHr = plan.chosenConcentrationMgPerMl * plan.desiredRateMlPerHr; // mg/hr delivered
  const actualDoseMgPerKgHr = mgPerHr / weightKg;

  const resultCard: ResultCard = {
    title: 'Result',
    totalVolumeText: `${fmt(plan.finalTotalVolumeMl, 2)} mL`,
    finalConcentrationText: `${fmt(plan.chosenConcentrationMgPerMl, 4)} mg/mL`,
    pumpRateText: `${fmt(plan.desiredRateMlPerHr, 2)} mL/hr`,
    deliveredDoseText: formatDose(actualDoseMgPerKgHr, doseUnit),
      doseLines: [
        formatDose(actualDoseMgPerKgHr, 'mg/kg/hr'),
        formatDose(actualDoseMgPerKgHr, 'mg/kg/min'),
        formatDose(actualDoseMgPerKgHr, 'mg/kg/day'),
        formatDose(actualDoseMgPerKgHr, 'mcg/kg/min'),
        formatDose(actualDoseMgPerKgHr, 'mcg/kg/hr'),
      ],
  };

  return { mode: 'dilution', alerts, drawCards, resultCard };
}
