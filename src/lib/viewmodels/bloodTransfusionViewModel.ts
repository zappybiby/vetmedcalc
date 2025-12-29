const RAMP_FRACTIONS = [0.2, 0.4, 0.6, 0.8] as const;
const RAMP_STEP_HR = 0.25;

export type TransfusionInterval = {
  index: number;
  startMin: number;
  endMin: number;
  durationHr: number;
  rateMlHr: number;
  volumeMl: number;
  cumulativeMl: number;
  isRamp: boolean;
};

export type BloodTransfusionSummary = {
  targetVolumeMl: number;
  totalHours: number;
  totalMinutes: number;
  idealFinalRateMlHr: number;
  finalRateMlHr: number;
  deliveredVolumeMl: number;
  deltaMl: number;
};

export type BloodTransfusionPlan = {
  steps: TransfusionInterval[];
  summary: BloodTransfusionSummary;
};

export type BuildBloodTransfusionParams = {
  targetVolumeMl: number;
  totalHours: number;
};

export function buildBloodTransfusionPlan(params: BuildBloodTransfusionParams): BloodTransfusionPlan {
  const { targetVolumeMl, totalHours } = params;
  const idealFinalRateMlHr = targetVolumeMl / (totalHours - 0.5);
  const finalRateMlHr = Math.max(1, Math.round(idealFinalRateMlHr));

  const rampRates = RAMP_FRACTIONS.map((fraction) => Math.max(1, Math.round(fraction * finalRateMlHr)));
  const durationsHr = [
    RAMP_STEP_HR,
    RAMP_STEP_HR,
    RAMP_STEP_HR,
    RAMP_STEP_HR,
    totalHours - 1,
  ];
  const rates = [...rampRates, finalRateMlHr];

  let cumulativeMl = 0;
  let startMin = 0;
  const steps = rates.map((rate, index) => {
    const durationHr = durationsHr[index] ?? 0;
    const volumeMl = rate * durationHr;
    cumulativeMl += volumeMl;
    const endMin = startMin + durationHr * 60;
    const step: TransfusionInterval = {
      index: index + 1,
      startMin,
      endMin,
      durationHr,
      rateMlHr: rate,
      volumeMl,
      cumulativeMl,
      isRamp: index < 4,
    };
    startMin = endMin;
    return step;
  });

  const deliveredVolumeMl = cumulativeMl;
  const deltaMl = deliveredVolumeMl - targetVolumeMl;

  return {
    steps,
    summary: {
      targetVolumeMl,
      totalHours,
      totalMinutes: totalHours * 60,
      idealFinalRateMlHr,
      finalRateMlHr,
      deliveredVolumeMl,
      deltaMl,
    },
  };
}
