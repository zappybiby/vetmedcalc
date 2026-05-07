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
  let netTotalMl: number | null = null;
  $: windowHours = numeric(hoursWindow);
  $: hourlyInsRateMlHr = numeric(insRateMlHr);
  $: enteredInsTotalMl = numeric(insMl);
  $: totalInsMl = insMode === 'rate'
    ? hourlyInsRateMlHr == null || windowHours == null || windowHours <= 0
      ? null
      : hourlyInsRateMlHr * windowHours
    : enteredInsTotalMl;
  $: totalOutMl = numeric(urineOutMl);
  $: netTotalMl = totalInsMl == null || totalOutMl == null ? null : totalInsMl - totalOutMl;

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

<section class="grid min-w-0 gap-2 text-slate-200 sm:gap-3" aria-label="Ins and outs calculator">
  <div class="grid min-w-0 gap-2 sm:gap-3 lg:grid-cols-3">
    <article class="ui-card grid min-w-0 content-start gap-2 p-2.5 sm:p-3">
      <div class="text-xs font-black uppercase tracking-wide text-slate-200">Fluid in</div>

      <div class="grid min-w-0 grid-cols-2 gap-1.5" role="radiogroup" aria-label="Fluid in entry mode">
        <label
          class={`flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${insMode === 'rate' ? 'border-sky-400/50 bg-sky-400/10 text-slate-100' : 'border-slate-700/40 bg-surface-sunken text-slate-300 hover:border-slate-600/60'}`}
          for="ins-mode-rate"
        >
          <input
            id="ins-mode-rate"
            class="field-radio h-3.5 w-3.5"
            type="radio"
            checked={insMode === 'rate'}
            on:change={() => selectInsMode('rate')}
          />
          Rate
        </label>

        <label
          class={`flex min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors ${insMode === 'total' ? 'border-sky-400/50 bg-sky-400/10 text-slate-100' : 'border-slate-700/40 bg-surface-sunken text-slate-300 hover:border-slate-600/60'}`}
          for="ins-mode-total"
        >
          <input
            id="ins-mode-total"
            class="field-radio h-3.5 w-3.5"
            type="radio"
            checked={insMode === 'total'}
            on:change={() => selectInsMode('total')}
          />
          Total
        </label>
      </div>

      <label class="grid min-w-0 gap-1.5">
        <span class="ui-label">{insMode === 'rate' ? 'mL/hr' : totalInsLabel(windowHours)}</span>
        <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          {#if insMode === 'rate'}
            <input
              id="ins-rate"
              class="field-control"
              type="number"
              min="0"
              step="0.1"
              bind:value={insRateMlHr}
              inputmode="decimal"
              placeholder="0"
            />
            <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">mL/hr</span>
          {:else}
            <input
              id="ins-total"
              class="field-control"
              type="number"
              min="0"
              step="1"
              bind:value={insMl}
              inputmode="decimal"
              placeholder="0"
            />
            <span class="text-xs font-semibold uppercase tracking-wide text-slate-400">mL</span>
          {/if}
        </div>
      </label>
    </article>

    <article class="ui-card grid min-w-0 content-start gap-2 p-2.5 sm:p-3">
      <label class="grid min-w-0 gap-2">
        <span class="text-xs font-black uppercase tracking-wide text-slate-200">Urine out</span>
        <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
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
    </article>

    <article class="ui-card grid min-w-0 content-start gap-2 p-2.5 sm:p-3">
      <label class="grid min-w-0 gap-2">
        <span class="text-xs font-black uppercase tracking-wide text-slate-200">Hours</span>
        <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
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
    </article>
  </div>

  {#if hasInput}
    <div class="grid min-w-0 gap-2 sm:gap-3 lg:grid-cols-3">
      <article class="ui-card min-w-0 p-2.5 sm:p-3">
        <header class="text-xs font-black uppercase tracking-wide text-slate-200">Fluid in</header>
        <dl class="mt-2 grid min-w-0 gap-1.5 text-sm text-slate-300">
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Total</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmt(totalInsMl)}</span>
              <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mL</span>
            </dd>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Rate</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmt(insMlPerHr)}</span>
              <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mL/hr</span>
            </dd>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Weight rate</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmt(insMlPerKgHr)}</span>
              <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mL/kg/hr</span>
            </dd>
          </div>
        </dl>
      </article>

      <article class="ui-card min-w-0 p-2.5 sm:p-3">
        <header class="text-xs font-black uppercase tracking-wide text-slate-200">Urine out</header>
        <dl class="mt-2 grid min-w-0 gap-1.5 text-sm text-slate-300">
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Total</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmt(totalOutMl)}</span>
              <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mL</span>
            </dd>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Rate</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmt(outMlPerHr)}</span>
              <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mL/hr</span>
            </dd>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Weight rate</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmt(outMlPerKgHr)}</span>
              <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mL/kg/hr</span>
            </dd>
          </div>
        </dl>
      </article>

      <article class="ui-card min-w-0 p-2.5 sm:p-3">
        <header class="text-xs font-black uppercase tracking-wide text-slate-200">Net balance</header>
        <dl class="mt-2 grid min-w-0 gap-1.5 text-sm text-slate-300">
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Total</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmtSigned(netTotalMl)}</span>
              <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mL</span>
            </dd>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Rate</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmtSigned(netMlPerHr)}</span>
              <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mL/hr</span>
            </dd>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-400">Balance</dt>
            <dd class="text-right font-black text-slate-100">{balanceDescriptor}</dd>
          </div>
        </dl>
      </article>
    </div>
  {/if}
</section>
