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
  <article class="ui-card grid min-w-0 gap-3 ui-card-padding">
    <div class="io-context-row">
      <label class="grid min-w-0 gap-1.5" for="io-duration">
        <span class="ui-label">Time period</span>
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
          <span class="ui-unit">hr</span>
        </div>
      </label>

      <fieldset class="grid min-w-0 gap-1.5">
        <legend class="ui-label mb-1.5">Enter fluid in as</legend>
        <div class="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Fluid in entry mode">
          <label class="ui-choice" class:is-selected={insMode === 'total'} for="ins-mode-total">
            <input
              id="ins-mode-total"
              class="field-radio h-3.5 w-3.5"
              type="radio"
              name="ins-mode"
              checked={insMode === 'total'}
              on:change={() => selectInsMode('total')}
            />
            Total
          </label>
          <label class="ui-choice" class:is-selected={insMode === 'rate'} for="ins-mode-rate">
            <input
              id="ins-mode-rate"
              class="field-radio h-3.5 w-3.5"
              type="radio"
              name="ins-mode"
              checked={insMode === 'rate'}
              on:change={() => selectInsMode('rate')}
            />
            Rate
          </label>
        </div>
      </fieldset>
    </div>

    <div class="grid min-w-0 grid-cols-2 gap-3">
      <label class="grid min-w-0 gap-1.5" for={insMode === 'rate' ? 'ins-rate' : 'ins-total'}>
        <span class="ui-label">Fluid in <span class="ui-unit">({insMode === 'rate' ? 'mL/hr' : 'mL'})</span></span>
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
        {/if}
      </label>
      <label class="grid min-w-0 gap-1.5" for="out-total">
        <span class="ui-label">Urine out <span class="ui-unit">(mL)</span></span>
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
      </label>
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
  .io-context-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    align-items: end;
    gap: 0.75rem;
  }

  .io-comparison :is(th, td) {
    padding: 0.5rem 0;
  }

  .io-comparison :is(th, td) + :is(th, td) {
    padding-left: 0.75rem;
  }

  @media (min-width: 640px) {
    .io-context-row {
      grid-template-columns: minmax(10rem, 1fr) minmax(0, 1fr);
    }
  }
</style>
