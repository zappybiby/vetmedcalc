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

<section class="grid min-w-0 gap-4 text-slate-200" aria-label="RER calculator">
  <header class="text-base font-black uppercase tracking-wide text-slate-100">RER Calculator</header>

  <div class="grid min-w-0 gap-4">
    <div class="ui-card min-w-0 p-4">
      <h2 class="text-sm font-black uppercase tracking-wide text-slate-200">Inputs</h2>

      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <div class="ui-inset p-3">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Patient weight</div>
          <div class="mt-2 text-2xl font-black tabular-nums text-slate-100">
            {#if weightKg != null}
              {fmt(weightKg, 2)} kg
            {:else}
              —
            {/if}
          </div>
          <div class="mt-2 text-xs text-slate-400">Pulled from the shared Patient panel.</div>
        </div>

        <label class="grid gap-2">
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

        <label class="grid gap-2">
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

        <label class="grid gap-2">
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

      <div class="mt-3 text-xs text-slate-400">
        Uses RER = 70 x kg^0.75. Adjusted target = RER x factor.
      </div>

      {#if issues.length}
        <div class="mt-3 rounded-lg border border-amber-300/30 bg-amber-950/40 px-3 py-2 text-sm font-semibold text-amber-100">
          {#each issues as issue}
            <div>{issue}</div>
          {/each}
        </div>
      {/if}
    </div>

    {#if plan}
      <div class="ui-card min-w-0 p-4">
        <h2 class="text-sm font-black uppercase tracking-wide text-slate-200">Administration target</h2>

        <div class="mt-3 ui-inset p-4">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Give every {fmtCompact(plan.intervalHours)} hr</div>
          <div class="mt-2 text-3xl font-black tabular-nums text-slate-100">{fmt(plan.mlPerInterval, 2)} mL</div>
          <div class="mt-2 text-sm text-slate-300">
            Delivers {fmt(plan.kcalPerInterval, 2)} kcal q{fmtCompact(plan.intervalHours)}h
          </div>
        </div>

        <div class="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article class="ui-inset p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Base RER</header>
            <div class="mt-3 text-right text-lg font-black tabular-nums text-slate-100">{fmt(plan.rerKcalPerDay, 2)} kcal/day</div>
          </article>

          <article class="ui-inset p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Adjusted target</header>
            <div class="mt-3 text-right text-lg font-black tabular-nums text-slate-100">{fmt(plan.targetKcalPerDay, 2)} kcal/day</div>
          </article>

          <article class="ui-inset p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Daily volume</header>
            <div class="mt-3 text-right text-lg font-black tabular-nums text-slate-100">{fmt(plan.totalMlPerDay, 2)} mL/day</div>
          </article>

          <article class="ui-inset p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Continuous rate</header>
            <div class="mt-3 text-right text-lg font-black tabular-nums text-slate-100">{fmt(plan.mlPerHour, 2)} mL/hr</div>
          </article>

          <article class="ui-inset p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">kcal per hour</header>
            <div class="mt-3 text-right text-lg font-black tabular-nums text-slate-100">{fmt(plan.kcalPerHour, 2)} kcal/hr</div>
          </article>

          <article class="ui-inset p-4">
            <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Diet density</header>
            <div class="mt-3 text-right text-lg font-black tabular-nums text-slate-100">{fmt(plan.kcalPerMl, 2)} kcal/mL</div>
          </article>
        </div>
      </div>
    {/if}
  </div>
</section>
