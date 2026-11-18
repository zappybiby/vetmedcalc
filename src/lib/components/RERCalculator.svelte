<script lang="ts">
  import SegmentedToggle from './SegmentedToggle.svelte';
  import ToolDisclosure from './ToolDisclosure.svelte';
  import { calculateRERPlan, type RERPlan } from '../helpers/rer';
  import { patient, type Patient } from '../stores/patient';

  type MathToken = { kind: 'num' | 'op' | 'text'; text: string };
  type CalculationRow = { label: string; math: string };

  const DEFAULT_KCAL_PER_ML = 0.9;
  const DEFAULT_RER_FACTOR = 1.0;
  const DEFAULT_INTERVAL_HOURS = 6;
  const continuousRateFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    useGrouping: false
  });

  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  let weightKg: number | null = null;
  $: weightKg = p.weightKg != null && !Number.isNaN(p.weightKg) && p.weightKg > 0 ? p.weightKg : null;

  let continuousFeeding = false;
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

  function tokenizeMath(expr: string): MathToken[] {
    const tokens: MathToken[] = [];
    const re = /(-?\d+(?:\.\d+)?)|([=≈×÷^()+;])/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(expr)) !== null) {
      const idx = match.index;
      if (idx > lastIndex) {
        tokens.push({ kind: 'text', text: expr.slice(lastIndex, idx) });
      }

      if (match[1]) tokens.push({ kind: 'num', text: match[1] });
      else if (match[2]) tokens.push({ kind: 'op', text: match[2] });

      lastIndex = idx + match[0].length;
    }

    if (lastIndex < expr.length) {
      tokens.push({ kind: 'text', text: expr.slice(lastIndex) });
    }

    return tokens;
  }

  let kcalPerMlValue: number | null = null;
  let rerFactorValue: number | null = null;
  let planIntervalHours: number | null = null;
  $: kcalPerMlValue = numeric(kcalPerMl);
  $: rerFactorValue = numeric(rerFactor);
  // The plan uses the interval only to calculate per-feeding values.
  $: planIntervalHours = continuousFeeding ? DEFAULT_INTERVAL_HOURS : numeric(intervalHours);

  let issues: string[] = [];
  $: {
    const next: string[] = [];

    if (kcalPerMlValue != null && kcalPerMlValue <= 0) {
      next.push('kcal per mL must be greater than 0.');
    }
    if (rerFactorValue != null && rerFactorValue <= 0) {
      next.push('RER factor must be greater than 0.');
    }
    if (planIntervalHours != null && planIntervalHours <= 0) {
      next.push('Interval hours must be greater than 0.');
    }

    issues = next;
  }

  let plan: RERPlan | null = null;
  $: plan = (
    weightKg != null &&
    kcalPerMlValue != null &&
    rerFactorValue != null &&
    planIntervalHours != null &&
    issues.length === 0
  )
    ? calculateRERPlan({
        weightKg,
        kcalPerMl: kcalPerMlValue,
        rerFactor: rerFactorValue,
        intervalHours: planIntervalHours
      })
    : null;

  $: continuousRate = plan ? continuousRateFormatter.format(plan.mlPerHour) : '';

  let calculationRows: CalculationRow[] = [];
  $: calculationRows = plan
    ? [
        {
          label: 'RER',
          math: `RER = 70 × ${fmtCompact(plan.weightKg)}^0.75 = ${fmt(plan.rerKcalPerDay, 2)} kcal/day`
        },
        {
          label: 'Calorie goal',
          math: `Calorie goal = ${fmt(plan.rerKcalPerDay, 2)} kcal/day × ${fmtCompact(plan.rerFactor)} = ${fmt(plan.targetKcalPerDay, 2)} kcal/day`
        },
        {
          label: 'Daily volume',
          math: `Daily volume = ${fmt(plan.targetKcalPerDay, 2)} kcal/day ÷ ${fmt(plan.kcalPerMl, 2)} kcal/mL = ${fmt(plan.totalMlPerDay, 2)} mL/day`
        },
        continuousFeeding
          ? {
              label: 'Continuous rate',
              math: `Continuous rate = ${fmt(plan.totalMlPerDay, 2)} mL/day ÷ 24 hr ≈ ${continuousRate} mL/hr`
            }
          : {
              label: 'Volume per feeding',
              math: `Volume per feeding = ${fmt(plan.totalMlPerDay, 2)} mL/day × ${fmtCompact(plan.intervalHours)} hr ÷ (24 hr/day) ≈ ${fmtWhole(plan.mlPerInterval)} mL`
            }
      ]
    : [];
</script>

<section class="ui-tool-stack text-slate-200" aria-label="Tube Feeding">
  <div class="ui-tool-stack">
    <div class="ui-card min-w-0 ui-card-padding">
      <div class={`grid items-end gap-2 min-[360px]:grid-cols-2 sm:gap-3 ${continuousFeeding ? 'ui-inputs-two' : 'ui-inputs-three xl:grid-cols-3'}`}>
        <div class="col-span-full w-full max-w-[17rem] justify-self-center">
          <SegmentedToggle
            label="Feeding mode"
            first="Intermittent"
            second="Continuous"
            secondSelected={continuousFeeding}
            onToggle={isContinuous => continuousFeeding = isContinuous}
          />
        </div>

        <label class="grid gap-1.5">
          <span class="ui-label">Diet density <span class="normal-case">(kcal/mL)</span></span>
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

        <label class="grid gap-1.5">
          <span class="ui-label">RER factor</span>
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

        {#if !continuousFeeding}
          <label class="grid gap-1.5 min-[360px]:col-span-2 xl:col-span-1">
            <span class="ui-label">Interval (hours)</span>
            <input
              class="field-control"
              type="number"
              min="0"
              step="0.25"
              bind:value={intervalHours}
              inputmode="decimal"
              placeholder="e.g., 6"
            />
          </label>
        {/if}
      </div>

      <div class={`mt-2 ui-meta sm:mt-3 ${continuousFeeding ? 'ui-inputs-two' : 'ui-inputs-three'}`}>
        RER = 70 x kg^0.75, then target kcal/day = RER x factor.
      </div>

      {#if issues.length}
        <div class="mt-2 ui-alert border-amber-300/30 bg-amber-950/40 text-amber-100 sm:mt-3">
          {#each issues as issue}
            <div>{issue}</div>
          {/each}
        </div>
      {/if}
    </div>

    {#if plan}
      <div class="ui-tool-stack md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        {#if continuousFeeding}
          <article class="ui-card ui-card-padding min-w-0" aria-labelledby="continuous-feeding-heading">
            <h2 id="continuous-feeding-heading" class="ui-label-strong">Continuous rate</h2>
            <div class="ui-result-value continuous-feeding-value mt-1.5">
              {continuousRate} <span class="ui-unit">mL/hr</span>
            </div>
          </article>
        {:else}
          <div class="ui-card ui-card-padding min-w-0">
            <div class="ui-label-strong">Give every {fmtCompact(plan.intervalHours)} <span class="normal-case">hr</span></div>
            <div class="ui-result-value mt-1.5">{fmtWhole(plan.mlPerInterval)} mL</div>
            <div class="mt-1.5 text-sm text-slate-300 sm:mt-2">
              Delivers about {fmtWhole(plan.kcalPerInterval)} kcal q{fmtCompact(plan.intervalHours)}h
            </div>
          </div>
        {/if}

        <div class="ui-card ui-card-padding min-w-0">
          <header class="ui-label-strong">Quick reference</header>
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
              <span class="text-slate-300">Diet density</span>
              <span class="font-black tabular-nums text-slate-100">{fmt(plan.kcalPerMl, 2)} kcal/mL</span>
            </div>
          </div>
        </div>
      </div>

    <ToolDisclosure title="Calculation summary">
      <div>
          <div class="grid gap-2">
            {#each calculationRows as row}
              <div class="ui-inset grid gap-1.5 px-2.5 py-2 sm:px-3 lg:grid-cols-[168px_minmax(0,1fr)] lg:items-center lg:gap-3 lg:py-1.5">
                <div class="text-[12px] font-semibold leading-snug text-slate-200">{row.label}</div>

                <div class="ui-formula">
                  <span class="whitespace-pre-wrap break-words">
                    {#each tokenizeMath(row.math) as t}
                      <span class={t.kind === 'num'
                        ? 'font-semibold text-slate-100'
                        : t.kind === 'op'
                          ? 'text-slate-400'
                          : 'text-slate-200'}
                      >
                        {t.text}
                      </span>
                    {/each}
                  </span>
                </div>
              </div>
            {/each}
          </div>
        </div>
    </ToolDisclosure>
    {/if}
  </div>
</section>

<style>
  .continuous-feeding-value {
    font-size: clamp(2rem, 3.6vw, 2.375rem);
    line-height: 1.1;
    overflow-wrap: anywhere;
  }
  .continuous-feeding-value .ui-unit {
    font-size: 14px;
    white-space: nowrap;
  }
</style>
