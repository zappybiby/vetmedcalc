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
  <article class="ui-card io-inputs ui-card-padding">
    <div class="io-field io-period">
      <div class="io-field-heading">
        <label class="ui-label" for="io-duration">Time period</label>
      </div>
      <div class="io-control-row">
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
    </div>

    <div class="io-field">
      <div class="io-field-heading">
        <label class="ui-label" for={insMode === 'rate' ? 'ins-rate' : 'ins-total'}>Fluid in</label>
        <button
          type="button"
          role="switch"
          aria-checked={insMode === 'rate'}
          aria-label="Fluid in rate mode"
          title={insMode === 'total' ? 'Switch to rate (mL/hr)' : 'Switch to total (mL)'}
          class="ui-inline-toggle"
          on:click={() => selectInsMode(insMode === 'total' ? 'rate' : 'total')}
        >
          {insMode === 'total' ? 'Total' : 'Rate'}
        </button>
      </div>
      <div class="io-control-row">
        {#if insMode === 'rate'}
          <input
            id="ins-rate"
            class="field-control"
            type="number"
            min="0"
            step="0.1"
            bind:value={insRateMlHr}
            aria-label="Fluid in (mL/hr)"
            inputmode="decimal"
            placeholder="0"
          />
        {:else}
          <input
            id="ins-total"
            class="field-control"
            type="number"
            min="0"
            step="1"
            bind:value={insMl}
            aria-label="Fluid in (mL)"
            inputmode="decimal"
            placeholder="0"
          />
        {/if}
        <span class="ui-unit">{insMode === 'rate' ? 'mL/hr' : 'mL'}</span>
      </div>
    </div>

    <div class="io-field">
      <div class="io-field-heading">
        <label class="ui-label" for="out-total">Urine out</label>
      </div>
      <div class="io-control-row">
        <input
          id="out-total"
          class="field-control"
          type="number"
          min="0"
          step="1"
          bind:value={urineOutMl}
          aria-label="Urine out (mL)"
          inputmode="decimal"
          placeholder="0"
        />
        <span class="ui-unit">mL</span>
      </div>
    </div>
  </article>

  {#if hasInput}
    <article class="ui-card min-w-0 ui-card-padding" aria-label="Fluid balance results">
      <div class="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b pb-3 ui-rule">
        <div class="grid gap-1">
          <h2 class="ui-label-strong">Net balance</h2>
          <p class="ui-meta-compact">{balanceDescriptor}</p>
          {#if windowHours != null && windowHours > 0}
            <p class="ui-meta-compact">Over {fmtCompact(windowHours)} hr</p>
          {/if}
        </div>
        <div class="grid min-w-0 gap-1 text-right">
          <div>
            <span class="ui-result-value" data-testid="io-net-total">{fmtSigned(netTotalMl)}</span>
            <span class="ml-1 ui-unit">mL</span>
          </div>
          <div>
            <span class="ui-row-value" data-testid="io-net-rate">{fmtSigned(netMlPerHr)}</span>
            <span class="ml-1 ui-unit">mL/hr</span>
          </div>
        </div>
      </div>

      <table class="io-comparison mt-2 w-full text-sm" aria-label="Fluid in and urine out comparison">
        <thead>
          <tr class="ui-label">
            <th scope="col" class="text-left"><span class="sr-only">Measurement</span></th>
            <th scope="col" class="text-right">Fluid in</th>
            <th scope="col" class="text-right">Urine out</th>
          </tr>
        </thead>
        <tbody class="ui-table-rows">
          <tr>
            <th scope="row" class="text-left font-semibold">Total <span class="ui-unit">(mL)</span></th>
            <td class="ui-row-value text-right">{fmt(totalInsMl)}</td>
            <td class="ui-row-value text-right">{fmt(totalOutMl)}</td>
          </tr>
          <tr>
            <th scope="row" class="text-left font-semibold">Rate <span class="ui-unit">(mL/hr)</span></th>
            <td class="ui-row-value text-right">{fmt(insMlPerHr)}</td>
            <td class="ui-row-value text-right">{fmt(outMlPerHr)}</td>
          </tr>
          <tr>
            <th scope="row" class="text-left font-semibold">Weight rate <span class="ui-unit">(mL/kg/hr)</span></th>
            <td class="ui-row-value text-right">{fmt(insMlPerKgHr)}</td>
            <td class="ui-row-value text-right">{fmt(outMlPerKgHr)}</td>
          </tr>
        </tbody>
      </table>
    </article>
  {/if}
</section>

<style>
  .io-inputs {
    display: grid;
    min-width: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 1rem;
  }

  .io-period {
    grid-column: 1 / -1;
  }

  .io-field {
    display: grid;
    min-width: 0;
    gap: 0.375rem;
  }

  .io-field-heading {
    display: flex;
    min-height: 1.5rem;
    align-items: center;
    gap: 0.375rem;
  }

  .io-control-row {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
  }

  .io-comparison :is(th, td) {
    padding: 0.5rem 0;
  }

  .io-comparison :is(th, td) + :is(th, td) {
    padding-left: 0.75rem;
  }

  @media (min-width: 640px) {
    .io-inputs {
      grid-template-columns: minmax(8rem, 0.8fr) repeat(2, minmax(0, 1fr));
      gap: 1.25rem;
    }

    .io-period {
      grid-column: auto;
    }
  }
</style>
