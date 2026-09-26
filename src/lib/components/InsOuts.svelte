<script lang="ts">
  import SegmentedToggle from './SegmentedToggle.svelte';
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
  let insMl: number | '' = '';
  let urineOutMl: number | '' = '';

  let hasInput = false;
  $: hasInput = insMl !== '' || urineOutMl !== '';

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

  // Switching modes changes only how the entered number is interpreted.
  let windowHours: number | null = null;
  let insMlPerHr: number | null = null;
  let insMlPerKgHr: number | null = null;
  let outMlPerKgHr: number | null = null;
  $: windowHours = numeric(hoursWindow);
  $: insMlPerHr = insMode === 'rate'
    ? numeric(insMl)
    : numeric(insMl) == null || windowHours == null || windowHours <= 0
      ? null
      : Number(insMl) / windowHours;
  $: insMlPerKgHr = insMlPerHr == null || !weightKg ? null : insMlPerHr / weightKg;
  $: outMlPerKgHr = numeric(urineOutMl) == null || windowHours == null || windowHours <= 0 || !weightKg
    ? null
    : Number(urineOutMl) / windowHours / weightKg;
</script>

<section class="ui-tool-stack text-slate-200" aria-label="Ins and outs calculator">
  <article class="ui-card ui-card-padding">
    <div class="io-inputs">
    <div class="ui-field io-period">
      <div class="ui-field-heading">
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

    <div class="ui-field">
      <div class="ui-field-heading">
        <label class="ui-label" for={insMode === 'rate' ? 'ins-rate' : 'ins-total'}>Fluid in</label>

      </div>
      <div class="io-control-row">
        <input
          id={insMode === 'rate' ? 'ins-rate' : 'ins-total'}
          class="field-control"
          type="number"
          min="0"
          step={insMode === 'rate' ? '0.1' : '1'}
          bind:value={insMl}
          aria-label={insMode === 'rate' ? 'Fluid in (mL/hr)' : 'Fluid in (mL)'}
          inputmode="decimal"
          placeholder="0"
        />
        <span class="ui-unit">{insMode === 'rate' ? 'mL/hr' : 'mL'}</span>
      </div>
    </div>

    <div class="ui-field">
      <div class="ui-field-heading">
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
    <div class="ui-field io-mode">
      <span class="ui-label text-center">Fluid in mode</span>
      <SegmentedToggle label="Fluid in rate mode" first="Total" second="Rate" secondSelected={insMode === 'rate'} onToggle={rate => insMode = rate ? 'rate' : 'total'} />
    </div>
    </div>
  </article>

  {#if hasInput}
    <article class="ui-card min-w-0 ui-card-padding" aria-label="Ins and outs results">
      <div class="grid gap-3">
        <div class="io-result-row">
          <span class="ui-label">Fluid in</span>
          <div class="whitespace-nowrap">
            <span class="ui-result-value" data-testid="io-in-weight-rate">{fmt(insMlPerKgHr)}</span>
            <span class="ml-1 ui-unit">mL/kg/hr</span>
          </div>
        </div>
        <div class="io-result-row">
          <span class="ui-label">Fluid out</span>
          <div class="whitespace-nowrap">
            <span class="ui-result-value" data-testid="io-out-weight-rate">{fmt(outMlPerKgHr)}</span>
            <span class="ml-1 ui-unit">mL/kg/hr</span>
          </div>
        </div>
      </div>
    </article>
  {/if}
</section>

<style>
  .io-mode { grid-column: 2; grid-row: 1; }
  .io-result-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 12px; }
  @media (min-width: 640px) {
    .io-result-row { grid-template-columns: 12rem auto; justify-content: start; }
  }
  .io-inputs {
    display: grid;
    min-width: 0;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: start;
    gap: 12px;
  }

  .io-period {
    grid-column: 1;
  }

  @media (min-width: 1024px) {
    .io-inputs { width: 100%; max-width: 48rem; margin-inline: auto; }
  }

  .io-control-row {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
  }

  @media (min-width: 640px) {
    .io-inputs {
      grid-template-columns: minmax(8rem, 0.8fr) repeat(2, minmax(0, 1fr)) auto;
      gap: 12px;
    }

    .io-period {
      grid-column: auto;
    }

    .io-mode { grid-column: 4; }
  }
</style>
