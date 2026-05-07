<script lang="ts">
  import { patient, type Patient } from '../stores/patient';

  const DEFAULT_HOURS_WINDOW = 4;
  type InsMode = 'rate' | 'total';

  // Patient context
  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;
  let weightKg: number | null = null;
  $: weightKg = p.weightKg != null && !Number.isNaN(p.weightKg) && p.weightKg > 0 ? p.weightKg : null;

  // Inputs
  let hoursWindow: number | '' = DEFAULT_HOURS_WINDOW;
  let insMode: InsMode = 'total';
  let insRateMlHr: number | '' = '';
  let insMl: number | '' = '';
  let urineOutMl: number | '' = '';

  let hasInput = false;
  $: hasInput = (insMode === 'rate' ? insRateMlHr !== '' : insMl !== '') || urineOutMl !== '';

  function numeric(value: number | '' | null | undefined): number | null {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function fmt(value: number | null | undefined, digits = 2) {
    if (value == null || Number.isNaN(value)) return '—';
    const num = Number(value);
    if (Math.abs(num) < 10 ** -digits) return Number(0).toFixed(digits);
    return num.toFixed(digits);
  }

  function fmtCompact(value: number | null | undefined, maxDigits = 2) {
    if (value == null || Number.isNaN(value)) return '—';
    const num = Number(value);
    const rounded = Number(num.toFixed(maxDigits));
    return rounded.toString();
  }

  function fmtSigned(value: number | null | undefined, digits = 2) {
    if (value == null || Number.isNaN(value)) return '—';
    const num = Number(value);
    if (Math.abs(num) < 10 ** -digits) return fmt(0, digits);
    const rounded = fmt(num, digits);
    if (rounded === '—') return '—';
    return num > 0 ? `+${rounded}` : rounded;
  }

  function totalInsLabel(hours: number | null): string {
    if (hours == null || hours <= 0) return 'Total fluid ins';
    return `Total over ${fmtCompact(hours)} hr`;
  }

  function selectInsMode(mode: InsMode) {
    if (insMode === mode) return;
    insMode = mode;
    if (mode === 'rate') {
      insMl = '';
    } else {
      insRateMlHr = '';
    }
  }

  // Core numbers
  let windowHours: number | null = null;
  let hourlyInsRateMlHr: number | null = null;
  let enteredInsTotalMl: number | null = null;
  let totalInsMl: number | null = null;
  let totalOutMl: number | null = null;
  $: windowHours = numeric(hoursWindow);
  $: hourlyInsRateMlHr = numeric(insRateMlHr);
  $: enteredInsTotalMl = numeric(insMl);
  $: totalInsMl = insMode === 'rate'
    ? hourlyInsRateMlHr == null || windowHours == null || windowHours <= 0
      ? null
      : hourlyInsRateMlHr * windowHours
    : enteredInsTotalMl;
  $: totalOutMl = numeric(urineOutMl);

  // Derived rates
  let insMlPerHr: number | null = null;
  let insMlPerKgHr: number | null = null;
  let outMlPerHr: number | null = null;
  let outMlPerKgHr: number | null = null;
  let netMlPerHr: number | null = null;
  let balanceDescriptor = '—';

  $: insMlPerHr = insMode === 'rate'
    ? hourlyInsRateMlHr
    : totalInsMl == null || windowHours == null || windowHours <= 0
      ? null
      : totalInsMl / windowHours;
  $: insMlPerKgHr = insMlPerHr == null || !weightKg ? null : insMlPerHr / weightKg;

  $: outMlPerHr = totalOutMl == null || windowHours == null || windowHours <= 0 ? null : totalOutMl / windowHours;
  $: outMlPerKgHr = outMlPerHr == null || !weightKg ? null : outMlPerHr / weightKg;

  $: netMlPerHr = insMlPerHr == null || outMlPerHr == null ? null : insMlPerHr - outMlPerHr;
  $: balanceDescriptor = netMlPerHr == null
    ? '—'
    : netMlPerHr > 0
      ? 'Input > output'
      : netMlPerHr < 0
        ? 'Input < output'
        : 'Input = output';
</script>

<section class="grid min-w-0 gap-2 text-slate-200 sm:gap-4" aria-label="Ins and outs calculator">
  <div class="grid min-w-0 gap-2 sm:gap-4">
    <div class="ui-card min-w-0 p-2 sm:p-4">
      <div class="grid min-w-0 gap-2 sm:gap-4 md:grid-cols-2 md:divide-x md:divide-slate-800">
        <div class="min-w-0 md:col-span-2">
          <h2 class="text-[13px] font-semibold uppercase tracking-wide text-slate-200 sm:text-sm">Inputs</h2>
          <div class="mt-2 grid gap-2 sm:mt-3 sm:gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
            <fieldset class="ui-inset min-w-0 p-2 sm:p-3">
              <legend class="px-1 text-xs font-semibold uppercase tracking-wide text-slate-300">Fluid ins</legend>
              <div class="grid gap-2 min-[520px]:grid-cols-2">
                <div
                  class={`grid cursor-pointer gap-1.5 rounded-lg border p-2 transition-colors sm:gap-2 sm:p-3 ${insMode === 'rate' ? 'border-sky-400/50 bg-sky-400/10' : 'border-slate-700/40 bg-surface-sunken hover:border-slate-600/60'}`}
                >
                  <label class="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300" for="ins-mode-rate">
                    <input
                      id="ins-mode-rate"
                      class="field-radio h-4 w-4"
                      type="radio"
                      checked={insMode === 'rate'}
                      on:change={() => selectInsMode('rate')}
                    />
                    Hourly fluid rate
                  </label>
                  <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <input
                      id="ins-rate"
                      class="field-control"
                      type="number"
                      min="0"
                      step="0.1"
                      bind:value={insRateMlHr}
                      on:focus={() => selectInsMode('rate')}
                      inputmode="decimal"
                      placeholder="0"
                    />
                    <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">mL/hr</span>
                  </div>
                </div>

                <div
                  class={`grid cursor-pointer gap-1.5 rounded-lg border p-2 transition-colors sm:gap-2 sm:p-3 ${insMode === 'total' ? 'border-sky-400/50 bg-sky-400/10' : 'border-slate-700/40 bg-surface-sunken hover:border-slate-600/60'}`}
                >
                  <label class="flex cursor-pointer items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-300" for="ins-mode-total">
                    <input
                      id="ins-mode-total"
                      class="field-radio h-4 w-4"
                      type="radio"
                      checked={insMode === 'total'}
                      on:change={() => selectInsMode('total')}
                    />
                    {totalInsLabel(windowHours)}
                  </label>
                  <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <input
                      id="ins-total"
                      class="field-control"
                      type="number"
                      min="0"
                      step="1"
                      bind:value={insMl}
                      on:focus={() => selectInsMode('total')}
                      inputmode="decimal"
                      placeholder="0"
                    />
                    <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">mL</span>
                  </div>
                </div>
              </div>
            </fieldset>

            <div class="grid min-w-0 gap-2 min-[360px]:grid-cols-2 lg:grid-cols-1">
              <label class="grid gap-1.5 sm:gap-2">
                <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Urine output</span>
                <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <input
                    id="out-total"
                    class="field-control"
                    type="number"
                    min="0"
                    step="1"
                    bind:value={urineOutMl}
                    inputmode="decimal"
                    placeholder="0"
                  />
                  <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">mL</span>
                </div>
              </label>

              <label class="grid gap-1.5 sm:gap-2">
                <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Duration</span>
                <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <input
                    id="io-duration"
                    class="field-control"
                    type="number"
                    min="0.25"
                    step="0.25"
                    bind:value={hoursWindow}
                    inputmode="decimal"
                  />
                  <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">hr</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    {#if hasInput}
      <div class="grid min-w-0 gap-2 sm:gap-4">
        <div class="ui-card min-w-0 p-2 sm:p-4">
          <h3 class="text-[13px] font-black uppercase tracking-wide text-slate-200 sm:text-sm">Fluid summary</h3>
          <div class="mt-2 grid gap-2 sm:mt-3 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
            <article class="ui-inset min-w-0 p-2.5 sm:p-4">
              <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Fluid ins</header>
              <dl class="mt-2 grid gap-1.5 text-sm text-slate-300 sm:mt-3 sm:gap-3">
                <div class="flex items-baseline justify-between gap-2">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Total</dt>
                  <dd class="text-right text-base font-black text-slate-100 sm:text-lg">
                    <span class="tabular-nums">{fmt(totalInsMl)}</span>
                    <span class="ml-1 text-sm font-semibold text-slate-300">mL</span>
                  </dd>
                </div>
                <div class="flex items-baseline justify-between gap-2">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">mL/hr</dt>
                  <dd class="text-right text-base font-black text-slate-100 sm:text-lg">
                    <span class="tabular-nums">{fmt(insMlPerHr)}</span>
                    <span class="ml-1 text-sm font-semibold text-slate-300">mL/hr</span>
                  </dd>
                </div>
                <div class="flex items-baseline justify-between gap-2">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">mL/kg/hr</dt>
                  <dd class="text-right text-base font-black text-slate-100 sm:text-lg">
                    <span class="tabular-nums">{fmt(insMlPerKgHr)}</span>
                    <span class="ml-1 text-sm font-semibold text-slate-300">mL/kg/hr</span>
                  </dd>
                </div>
              </dl>
            </article>

            <article class="ui-inset min-w-0 p-2.5 sm:p-4">
              <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Fluid outs</header>
              <dl class="mt-2 grid gap-1.5 text-sm text-slate-300 sm:mt-3 sm:gap-3">
                <div class="flex items-baseline justify-between gap-2">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">mL/hr</dt>
                  <dd class="text-right text-base font-black text-slate-100 sm:text-lg">
                    <span class="tabular-nums">{fmt(outMlPerHr)}</span>
                    <span class="ml-1 text-sm font-semibold text-slate-300">mL/hr</span>
                  </dd>
                </div>
                <div class="flex items-baseline justify-between gap-2">
                  <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">mL/kg/hr</dt>
                  <dd class="text-right text-base font-black text-slate-100 sm:text-lg">
                    <span class="tabular-nums">{fmt(outMlPerKgHr)}</span>
                    <span class="ml-1 text-sm font-semibold text-slate-300">mL/kg/hr</span>
                  </dd>
                </div>
              </dl>
            </article>

            <article class="ui-inset min-w-0 p-2.5 sm:p-4">
              <header class="text-xs font-semibold uppercase tracking-wide text-slate-300">Net balance</header>
              <div class="mt-1.5 space-y-1.5 text-sm text-slate-300 sm:mt-3 sm:space-y-3">
                <div class="text-right text-xs font-semibold uppercase tracking-wide text-slate-100 sm:text-sm">{balanceDescriptor}</div>
                <div class="flex items-baseline justify-between gap-2">
                  <span>Δ mL/hr</span>
                  <span class="text-right text-base font-black text-slate-100 sm:text-lg">
                    <span class="tabular-nums">{fmtSigned(netMlPerHr)}</span>
                    <span class="ml-1 text-sm font-semibold text-slate-300">mL/hr</span>
                  </span>
                </div>
              </div>
            </article>
          </div>
        </div>

      </div>
    {/if}
  </div>
</section>
