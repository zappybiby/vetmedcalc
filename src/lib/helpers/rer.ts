export type RERPlanInput = {
  weightKg: number;
  kcalPerMl: number;
  rerFactor: number;
  intervalHours: number;
};

export type RERPlan = {
  weightKg: number;
  kcalPerMl: number;
  rerFactor: number;
  intervalHours: number;
  rerKcalPerDay: number;
  targetKcalPerDay: number;
  kcalPerHour: number;
  kcalPerInterval: number;
  totalMlPerDay: number;
  mlPerHour: number;
  mlPerInterval: number;
};

export function calculateRERPlan(input: RERPlanInput): RERPlan {
  const { weightKg, kcalPerMl, rerFactor, intervalHours } = input;
  const rerKcalPerDay = 70 * weightKg ** 0.75;
  const targetKcalPerDay = rerKcalPerDay * rerFactor;
  const kcalPerHour = targetKcalPerDay / 24;
  const kcalPerInterval = kcalPerHour * intervalHours;
  const totalMlPerDay = targetKcalPerDay / kcalPerMl;
  const mlPerHour = totalMlPerDay / 24;
  const mlPerInterval = mlPerHour * intervalHours;

  return {
    weightKg,
    kcalPerMl,
    rerFactor,
    intervalHours,
    rerKcalPerDay,
    targetKcalPerDay,
    kcalPerHour,
    kcalPerInterval,
    totalMlPerDay,
    mlPerHour,
    mlPerInterval,
  };
}
