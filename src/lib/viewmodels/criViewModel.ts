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

export type StepBar = {
  label: string;
  valueText: string;
  fillPct: number; // 0–100
  severity: 'ok' | 'warn';
};

export type StepPopover = {
  title: string;
  lines: string[];
  bars?: StepBar[];
};

export type StepRow = {
  label: string;
  math: string;
  popover?: StepPopover;
};

export type StepByStep = {
  rows: StepRow[];
};

export type CRIViewModel = {
  mode: 'stock' | 'dilution';
  alerts: VMAlert[];
  drawCards: DrawCard[];
  resultCard: ResultCard;
  stepByStep: StepByStep;
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

function doseToMgKgHrMath(dose: number, unit: DoseUnit): string {
  const result = unitConstant(unit) * dose;
  switch (unit) {
    case 'mg/kg/hr':
      return `Dose_mg/kg/hr = Dose = ${fmt(dose, 3)} mg/kg/hr`;
    case 'mg/kg/min':
      return `Dose_mg/kg/hr = Dose × 60 = ${fmt(dose, 3)} × 60 = ${fmt(result, 4)} mg/kg/hr`;
    case 'mg/kg/day':
      return `Dose_mg/kg/hr = Dose ÷ 24 = ${fmt(dose, 3)} ÷ 24 = ${fmt(result, 4)} mg/kg/hr`;
    case 'mcg/kg/hr':
      return `Dose_mg/kg/hr = Dose ÷ 1000 = ${fmt(dose, 3)} ÷ 1000 = ${fmt(result, 4)} mg/kg/hr`;
    case 'mcg/kg/min':
    default:
      return `Dose_mg/kg/hr = Dose × 60 ÷ 1000 = ${fmt(dose, 3)} × 60 ÷ 1000 = ${fmt(result, 4)} mg/kg/hr`;
  }
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
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
    const stockConcMgPerMl = concMgPerMl(med) as number;
    const rateMlHr = (dosePerKgHr * weightKg) / stockConcMgPerMl;
    const targetVol = rateMlHr * Number(durationHr);
    const syr = chooseSyringeForVolume(targetVol, SYRINGES);
    const drawVol = roundToInc(targetVol, syr.incrementMl);
    const fills = Math.ceil(drawVol / syr.sizeCc);

    const massRateMgHr = rateMlHr * stockConcMgPerMl;
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

    const doseToMgKgHrRow: StepRow = {
      label: 'Dose → mg/kg/hr',
      math: doseToMgKgHrMath(Number(desiredDose), doseUnit),
    };

    const roundingDeltaMl = drawVol - targetVol;
    const hasRoundingChange = Math.abs(roundingDeltaMl) > 1e-9;
    const requestedDurationHr = Number(durationHr);
    const actualRuntimeHr = rateMlHr > 0 ? (drawVol / rateMlHr) : requestedDurationHr;
    const runtimeDeltaHr = actualRuntimeHr - requestedDurationHr;

    const stepRows: StepRow[] = [
      doseToMgKgHrRow,
      {
        label: 'Pump rate',
        math: `r = (Dose × W) ÷ S = (${fmt(dosePerKgHr, 4)} × ${fmt(weightKg, 2)}) ÷ ${fmt(stockConcMgPerMl, 4)} = ${fmt(rateMlHr, 3)} mL/hr`,
      },
      {
        label: 'Volume for duration',
        math: `V = r × T = ${fmt(rateMlHr, 3)} × ${fmt(requestedDurationHr, 2)} = ${fmt(targetVol, 3)} mL`,
      },
      {
        label: 'Rounded draw volume',
        math: `round(${fmt(targetVol, 3)} mL → ${fmt(syr.incrementMl, 3)} mL ticks) = ${fmt(drawVol, 2)} mL${hasRoundingChange ? ` (Δ ${fmt(roundingDeltaMl, 2)} mL)` : ''}`,
      },
    ];

    if (hasRoundingChange && rateMlHr > 0) {
      stepRows.push({
        label: 'Actual runtime',
        math: `T = V ÷ r = ${fmt(drawVol, 2)} ÷ ${fmt(rateMlHr, 3)} = ${fmt(actualRuntimeHr, 2)} hr (Δ ${fmt(runtimeDeltaHr, 2)} hr)`,
      });
    }

    const resultCard: ResultCard = {
      title: 'Result',
      totalVolumeText: `${fmt(drawVol, 2)} mL`,
      finalConcentrationText: `${fmt(stockConcMgPerMl, 4)} mg/mL`,
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

    return { mode: 'stock', alerts, drawCards: [drawCard], resultCard, stepByStep: { rows: stepRows } };
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
  const targetConcMgPerMl = plan.feasibleAtDesiredRate
    ? plan.neededConcentrationMgPerMl
    : plan.stockConcentrationMgPerMl;
  const targetRuntimeHr = plan.desiredRateMlPerHr > 0 ? (plan.finalTotalVolumeMl / plan.desiredRateMlPerHr) : Number(durationHr);

  const concTolPct = plan.optimization.tolerancePct.concentration;
  const volTolPct = plan.optimization.tolerancePct.totalVolume;
  const concErrPct = plan.relConcentrationErrorPct;
  const volErrPct = plan.relTotalVolumeErrorPct;

  const concQuality = clamp01(1 - concErrPct / Math.max(1e-9, concTolPct)) * 100;
  const volQuality = clamp01(1 - volErrPct / Math.max(1e-9, volTolPct)) * 100;

  const optimizationPopover: StepPopover = {
    title: 'Tick-snap optimization',
    lines: [
      plan.optimization.method === 'search'
        ? `Method: tick-search (scored ${plan.optimization.candidatesScored}/${plan.optimization.candidatesConsidered} candidates)`
        : `Method: fallback rounding (search scored ${plan.optimization.candidatesScored}/${plan.optimization.candidatesConsidered} candidates)`,
      `Objective: ${Math.round(plan.optimization.weight.conc * 100)}% concentration, ${Math.round(plan.optimization.weight.vol * 100)}% volume`,
      `Ideal: stock ${fmt(plan.rawStockVolumeMl, 3)} mL, diluent ${fmt(plan.rawDiluentVolumeMl, 3)} mL`,
      `Chosen: stock ${fmt(plan.snappedStockVolumeMl, 3)} mL, diluent ${fmt(plan.snappedDiluentVolumeMl, 3)} mL`,
    ],
    bars: [
      {
        label: 'Concentration',
        valueText: `${fmt(concErrPct, 2)}% error (tol ${fmt(concTolPct, 2)}%)`,
        fillPct: concQuality,
        severity: concErrPct > concTolPct ? 'warn' : 'ok',
      },
      {
        label: 'Volume',
        valueText: `${fmt(volErrPct, 2)}% error (tol ${fmt(volTolPct, 2)}%)`,
        fillPct: volQuality,
        severity: volErrPct > volTolPct ? 'warn' : 'ok',
      },
    ],
  };

  const snappedStockDelta = plan.snappedStockVolumeMl - plan.rawStockVolumeMl;
  const snappedDilDelta = plan.snappedDiluentVolumeMl - plan.rawDiluentVolumeMl;
  const hasStockDelta = Math.abs(snappedStockDelta) > 1e-9;
  const hasDilDelta = Math.abs(snappedDilDelta) > 1e-9;

  const deliveredDoseLine = formatDose(actualDoseMgPerKgHr, doseUnit);
  const deliveredDoseMgKgHrLine = formatDose(actualDoseMgPerKgHr, 'mg/kg/hr');
  const deliveredDoseSuffix = doseUnit === 'mg/kg/hr' ? '' : ` (= ${deliveredDoseLine})`;

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

  const durationNum = Number(durationHr);
  const stepRows: StepRow[] = [
    {
      label: 'Dose → mg/kg/hr',
      math: doseToMgKgHrMath(Number(desiredDose), doseUnit),
    },
    {
      label: 'Needed concentration',
      math: `C = (Dose × W) ÷ r = (${fmt(dosePerKgHr, 4)} × ${fmt(weightKg, 2)}) ÷ ${fmt(plan.desiredRateMlPerHr, 3)} = ${fmt(plan.neededConcentrationMgPerMl, 4)} mg/mL`,
    },
    {
      label: 'Target concentration',
      math: `C_target = min(C, S) = min(${fmt(plan.neededConcentrationMgPerMl, 4)}, ${fmt(plan.stockConcentrationMgPerMl, 4)}) = ${fmt(targetConcMgPerMl, 4)} mg/mL`,
    },
    {
      label: 'Total volume',
      math: `V_target = r × T = ${fmt(plan.desiredRateMlPerHr, 3)} × ${fmt(durationNum, 2)} = ${fmt(plan.targetTotalVolumeMl, 3)} mL`,
    },
    {
      label: 'Ideal volumes',
      math: `stock = (C_target/S)×V = (${fmt(targetConcMgPerMl, 4)}/${fmt(plan.stockConcentrationMgPerMl, 4)})×${fmt(plan.targetTotalVolumeMl, 3)} = ${fmt(plan.rawStockVolumeMl, 3)} mL; dil = ${fmt(plan.rawDiluentVolumeMl, 3)} mL`,
    },
    {
      label: 'Tick-snap result',
      math: `stock ${fmt(plan.snappedStockVolumeMl, 2)} mL${hasStockDelta ? ` (Δ ${fmt(snappedStockDelta, 2)} mL)` : ''} + dil ${fmt(plan.snappedDiluentVolumeMl, 2)} mL${hasDilDelta ? ` (Δ ${fmt(snappedDilDelta, 2)} mL)` : ''} → C_final ${fmt(plan.chosenConcentrationMgPerMl, 4)} mg/mL (ΔC ${fmt(concErrPct, 2)}%, ΔV ${fmt(volErrPct, 2)}%)`,
      popover: optimizationPopover,
    },
    {
      label: 'Delivered dose',
      math: `Dose = (C_final × r) ÷ W = (${fmt(plan.chosenConcentrationMgPerMl, 4)} × ${fmt(plan.desiredRateMlPerHr, 3)}) ÷ ${fmt(weightKg, 2)} = ${deliveredDoseMgKgHrLine}${deliveredDoseSuffix}`,
    },
  ];

  const mappingRateDeltaPct = Math.abs(plan.mappingRateMlPerHr - plan.desiredRateMlPerHr) / Math.max(1e-9, plan.desiredRateMlPerHr) * 100;
  if (plan.desiredRateMlPerHr > 0 && (mappingRateDeltaPct >= 0.5 || !plan.feasibleAtDesiredRate)) {
    stepRows.push({
      label: 'Rate to hit target dose',
      math: `r = (Dose × W) ÷ C_final = (${fmt(dosePerKgHr, 4)} × ${fmt(weightKg, 2)}) ÷ ${fmt(plan.chosenConcentrationMgPerMl, 4)} = ${fmt(plan.mappingRateMlPerHr, 3)} mL/hr`,
    });
  }

  if (plan.desiredRateMlPerHr > 0 && Math.abs(targetRuntimeHr - durationNum) >= 0.05) {
    stepRows.push({
      label: 'Actual runtime',
      math: `T = V_final ÷ r = ${fmt(plan.finalTotalVolumeMl, 2)} ÷ ${fmt(plan.desiredRateMlPerHr, 3)} = ${fmt(targetRuntimeHr, 2)} hr (Δ ${fmt(targetRuntimeHr - durationNum, 2)} hr)`,
    });
  }

  return { mode: 'dilution', alerts, drawCards, resultCard, stepByStep: { rows: stepRows } };
}
