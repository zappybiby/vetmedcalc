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

<section class="ui-tool-stack text-slate-200" aria-label="Ins and outs calculator">
  <div class="grid min-w-0 gap-2 sm:gap-3 lg:grid-cols-3">
    <article class="ui-card grid min-w-0 content-start gap-2 ui-card-padding">
      <div class="ui-label-strong">Fluid in</div>

      <div class="grid min-w-0 grid-cols-2 gap-1.5" role="radiogroup" aria-label="Fluid in entry mode">
        <label
          class="ui-choice"
          class:is-selected={insMode === 'rate'}
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
          class="ui-choice"
          class:is-selected={insMode === 'total'}
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
        <span class="ui-label">
          {#if insMode === 'rate'}
            <span class="normal-case">mL/hr</span>
          {:else if windowHours != null && windowHours > 0}
            Total over {fmtCompact(windowHours)} <span class="normal-case">hr</span>
          {:else}
            {totalInsLabel(windowHours)}
          {/if}
        </span>
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
            <span class="ui-unit">mL/hr</span>
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
            <span class="ui-unit">mL</span>
          {/if}
        </div>
      </label>
    </article>

    <article class="ui-card grid min-w-0 content-start gap-2 ui-card-padding">
      <label class="grid min-w-0 gap-2">
        <span class="ui-label-strong">Urine out</span>
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
          <span class="ui-unit">mL</span>
        </div>
      </label>
    </article>

    <article class="ui-card grid min-w-0 content-start gap-2 ui-card-padding">
      <label class="grid min-w-0 gap-2">
        <span class="ui-label-strong">Hours</span>
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
          <span class="ui-unit">hr</span>
        </div>
      </label>
    </article>
  </div>

  {#if hasInput}
    <div class="grid min-w-0 gap-2 sm:gap-3 lg:grid-cols-3">
      <article class="ui-card min-w-0 ui-card-padding">
        <header class="ui-label-strong">Fluid in</header>
        <dl class="mt-2 grid min-w-0 gap-1.5 text-sm text-slate-300">
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="ui-label">Total</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmt(totalInsMl)}</span>
              <span class="ml-1 ui-unit">mL</span>
            </dd>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="ui-label">Rate</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmt(insMlPerHr)}</span>
              <span class="ml-1 ui-unit">mL/hr</span>
            </dd>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="ui-label">Weight rate</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmt(insMlPerKgHr)}</span>
              <span class="ml-1 ui-unit">mL/kg/hr</span>
            </dd>
          </div>
        </dl>
      </article>

      <article class="ui-card min-w-0 ui-card-padding">
        <header class="ui-label-strong">Urine out</header>
        <dl class="mt-2 grid min-w-0 gap-1.5 text-sm text-slate-300">
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="ui-label">Total</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmt(totalOutMl)}</span>
              <span class="ml-1 ui-unit">mL</span>
            </dd>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="ui-label">Rate</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmt(outMlPerHr)}</span>
              <span class="ml-1 ui-unit">mL/hr</span>
            </dd>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="ui-label">Weight rate</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmt(outMlPerKgHr)}</span>
              <span class="ml-1 ui-unit">mL/kg/hr</span>
            </dd>
          </div>
        </dl>
      </article>

      <article class="ui-card min-w-0 ui-card-padding">
        <header class="ui-label-strong">Net balance</header>
        <dl class="mt-2 grid min-w-0 gap-1.5 text-sm text-slate-300">
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="ui-label">Total</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmtSigned(netTotalMl)}</span>
              <span class="ml-1 ui-unit">mL</span>
            </dd>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="ui-label">Rate</dt>
            <dd class="text-right font-black text-slate-100">
              <span class="tabular-nums">{fmtSigned(netMlPerHr)}</span>
              <span class="ml-1 ui-unit">mL/hr</span>
            </dd>
          </div>
          <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
            <dt class="ui-label">Balance</dt>
            <dd class="text-right font-black text-slate-100">{balanceDescriptor}</dd>
          </div>
        </dl>
      </article>
    </div>
  {/if}
</section>
