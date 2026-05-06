<script lang="ts">
  import { calculateRERPlan, type RERPlan } from '../helpers/rer';
  import { patient, type Patient } from '../stores/patient';

  const DEFAULT_KCAL_PER_ML = 0.9;
  const DEFAULT_RER_FACTOR = 1.0;
  const DEFAULT_INTERVAL_HOURS = 4;

  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  let weightKg: number | null = null;
  $: weightKg = p.weightKg != null && !Number.isNaN(p.weightKg) && p.weightKg > 0 ? p.weightKg : null;

  let kcalPerMl: number | '' = DEFAULT_KCAL_PER_ML;
  let rerFactor: number | '' = DEFAULT_RER_FACTOR;
  let intervalHours: number | '' = DEFAULT_INTERVAL_HOURS;

  function numeric(value: number | '' | null | undefined): number | null {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function fmt(value: number | null | undefined, digits = 2): string {
    if (value == null || Number.isNaN(value)) return '—';
    const num = Number(value);
    if (Math.abs(num) < 10 ** -digits) return Number(0).toFixed(digits);
    return num.toFixed(digits);
  }

  function fmtWhole(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return Math.round(Number(value)).toString();
  }

  function fmtCompact(value: number | null | undefined, maxDigits = 2): string {
    if (value == null || Number.isNaN(value)) return '—';
    return Number(Number(value).toFixed(maxDigits)).toString();
  }

  let kcalPerMlValue: number | null = null;
  let rerFactorValue: number | null = null;
  let intervalHoursValue: number | null = null;
  $: kcalPerMlValue = numeric(kcalPerMl);
  $: rerFactorValue = numeric(rerFactor);
  $: intervalHoursValue = numeric(intervalHours);

  let issues: string[] = [];
  $: {
    const next: string[] = [];

    if (weightKg == null) {
      next.push('Enter a patient weight in the Patient panel to calculate RER.');
    }
    if (kcalPerMlValue != null && kcalPerMlValue <= 0) {
      next.push('kcal per mL must be greater than 0.');
    }
    if (rerFactorValue != null && rerFactorValue <= 0) {
      next.push('RER factor must be greater than 0.');
    }
    if (intervalHoursValue != null && intervalHoursValue <= 0) {
      next.push('Interval hours must be greater than 0.');
    }

    issues = next;
  }

  let plan: RERPlan | null = null;
  $: plan = (
    weightKg != null &&
    kcalPerMlValue != null &&
    rerFactorValue != null &&
    intervalHoursValue != null &&
    issues.length === 0
  )
    ? calculateRERPlan({
        weightKg,
        kcalPerMl: kcalPerMlValue,
        rerFactor: rerFactorValue,
        intervalHours: intervalHoursValue
      })
    : null;
</script>

<section class="grid min-w-0 gap-2 text-slate-200 sm:gap-3" aria-label="RER calculator">
  <div class="grid min-w-0 gap-2 sm:gap-4">
    <div class="ui-card min-w-0 p-2.5 sm:p-4">
      <h2 class="text-[13px] font-black uppercase tracking-wide text-slate-200 sm:text-sm">Inputs</h2>

      <div class="mt-2 grid gap-2 min-[360px]:grid-cols-2 sm:mt-3 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label class="grid gap-1.5 sm:gap-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Diet density (kcal/mL)</span>
          <input
            class="field-control"
            type="number"
            min="0"
            step="0.01"
            bind:value={kcalPerMl}
            inputmode="decimal"
            placeholder="e.g., 0.9"
          />
        </label>

        <label class="grid gap-1.5 sm:gap-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">RER factor</span>
          <input
            class="field-control"
            type="number"
            min="0"
            step="0.01"
            bind:value={rerFactor}
            inputmode="decimal"
            placeholder="e.g., 1.0"
          />
        </label>

        <label class="grid gap-1.5 min-[360px]:col-span-2 sm:gap-2 xl:col-span-1">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Interval (hours)</span>
          <input
            class="field-control"
            type="number"
            min="0"
            step="0.25"
            bind:value={intervalHours}
            inputmode="decimal"
            placeholder="e.g., 4"
          />
        </label>
      </div>

      <div class="mt-2 text-[11px] leading-relaxed text-slate-400 sm:mt-3 sm:text-xs">
        Uses patient weight from the Patient panel. RER = 70 x kg^0.75, then target kcal/day = RER x factor.
      </div>

      {#if issues.length}
        <div class="mt-2 rounded-lg border border-amber-300/30 bg-amber-950/40 px-3 py-2 text-sm font-semibold text-amber-100 sm:mt-3">
          {#each issues as issue}
            <div>{issue}</div>
          {/each}
        </div>
      {/if}
    </div>

    {#if plan}
      <div class="ui-card min-w-0 p-2.5 sm:p-4">
        <h2 class="text-[13px] font-black uppercase tracking-wide text-slate-200 sm:text-sm">Administration target</h2>

        <div class="mt-2 ui-inset p-3 sm:mt-3 sm:p-4">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Give every {fmtCompact(plan.intervalHours)} hr</div>
          <div class="mt-1.5 text-2xl font-black tabular-nums text-slate-100 sm:mt-2 sm:text-3xl">{fmtWhole(plan.mlPerInterval)} mL</div>
          <div class="mt-1.5 text-sm text-slate-300 sm:mt-2">
            Delivers about {fmtWhole(plan.kcalPerInterval)} kcal q{fmtCompact(plan.intervalHours)}h
          </div>
        </div>

        <div class="mt-2 grid gap-2 sm:mt-3 sm:gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,1fr)]">
          <div class="ui-inset p-3 sm:p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Calculation summary</header>
            <div class="mt-2 grid gap-2 text-sm text-slate-300 sm:mt-3 sm:gap-3">
              <div class="rounded-lg border border-slate-700/40 bg-surface-sunken px-3 py-2.5 sm:py-3">
                <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Step 1</div>
                <div class="mt-1 text-slate-100">
                  RER = 70 x {fmtCompact(plan.weightKg)}^0.75 = <span class="font-black tabular-nums">{fmtWhole(plan.rerKcalPerDay)} kcal/day</span>
                </div>
              </div>

              <div class="rounded-lg border border-slate-700/40 bg-surface-sunken px-3 py-2.5 sm:py-3">
                <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Step 2</div>
                <div class="mt-1 text-slate-100">
                  Calorie goal = {fmtWhole(plan.rerKcalPerDay)} x {fmtCompact(plan.rerFactor)} = <span class="font-black tabular-nums">{fmtWhole(plan.targetKcalPerDay)} kcal/day</span>
                </div>
              </div>

              <div class="rounded-lg border border-slate-700/40 bg-surface-sunken px-3 py-2.5 sm:py-3">
                <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Step 3</div>
                <div class="mt-1 text-slate-100">
                  Daily volume = {fmtWhole(plan.targetKcalPerDay)} / {fmt(plan.kcalPerMl, 2)} = <span class="font-black tabular-nums">{fmtWhole(plan.totalMlPerDay)} mL/day</span>
                </div>
              </div>
            </div>
          </div>

          <div class="ui-inset p-3 sm:p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Quick reference</header>
            <div class="mt-2 grid gap-2 text-sm sm:mt-3 sm:gap-3">
              <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                <span class="text-slate-300">Calorie goal</span>
                <span class="font-black tabular-nums text-slate-100">{fmtWhole(plan.targetKcalPerDay)} kcal/day</span>
              </div>
              <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                <span class="text-slate-300">Daily volume</span>
                <span class="font-black tabular-nums text-slate-100">{fmtWhole(plan.totalMlPerDay)} mL/day</span>
              </div>
              <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                <span class="text-slate-300">Continuous rate</span>
                <span class="font-black tabular-nums text-slate-100">{fmt(plan.mlPerHour, 2)} mL/hr</span>
              </div>
              <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
                <span class="text-slate-300">Diet density</span>
                <span class="font-black tabular-nums text-slate-100">{fmt(plan.kcalPerMl, 2)} kcal/mL</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</section>
