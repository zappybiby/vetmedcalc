<script lang="ts">
  import {
    buildBloodTransfusionPlan,
    type BloodTransfusionPlan,
    type TransfusionInterval,
  } from '../viewmodels/bloodTransfusionViewModel';

  let totalVolumeMl: number | '' = '';
  let totalTimeHr: number | '' = '';

  function numeric(value: number | '' | null | undefined): number | null {
    if (value == null || value === '') return null;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function fmt(value: number | null | undefined, digits = 2): string {
    if (value == null || Number.isNaN(value)) return 'N/A';
    const num = Number(value);
    if (Math.abs(num) < 10 ** -digits) return Number(0).toFixed(digits);
    return num.toFixed(digits);
  }

  function fmtSigned(value: number | null | undefined, digits = 2): string {
    if (value == null || Number.isNaN(value)) return 'N/A';
    const num = Number(value);
    if (Math.abs(num) < 10 ** -digits) return Number(0).toFixed(digits);
    const rounded = fmt(num, digits);
    if (rounded === 'N/A') return rounded;
    return num > 0 ? `+${rounded}` : rounded;
  }

  function formatMinutes(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return 'N/A';
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  }

  function intervalLabel(step: TransfusionInterval): string {
    return `${formatMinutes(step.startMin)}-${formatMinutes(step.endMin)} min`;
  }

  let volumeValue: number | null = null;
  let timeValue: number | null = null;
  $: volumeValue = numeric(totalVolumeMl);
  $: timeValue = numeric(totalTimeHr);

  let issues: string[] = [];
  let showIssues = false;
  let hasInput = false;
  $: hasInput = totalVolumeMl !== '' || totalTimeHr !== '';
  $: {
    const next: string[] = [];
    if (volumeValue != null && volumeValue <= 0) {
      next.push('Total volume must be greater than 0 mL.');
    }
    if (timeValue != null && timeValue <= 1) {
      next.push('Total time must be greater than 1 hour.');
    }
    issues = next;
    showIssues = hasInput && next.length > 0;
  }

  let plan: BloodTransfusionPlan | null = null;
  $: plan = (volumeValue != null && timeValue != null && issues.length === 0)
    ? buildBloodTransfusionPlan({ targetVolumeMl: volumeValue, totalHours: timeValue })
    : null;

  let summaryOpen = false;
</script>

<section class="grid min-w-0 gap-4 text-slate-200" aria-label="Blood transfusion planner">
  <header class="text-base font-black uppercase tracking-wide text-slate-100">Blood Transfusion</header>

  <div class="grid min-w-0 gap-4">
    <div class="min-w-0 rounded-lg border-2 border-slate-200 bg-surface p-4 shadow-card">
      <h2 class="text-sm font-black uppercase tracking-wide text-slate-200">Inputs</h2>
      <div class="mt-3 grid gap-3">
        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Total volume (mL)</span>
          <input
            class="field-control"
            type="number"
            min="0"
            step="1"
            bind:value={totalVolumeMl}
            inputmode="decimal"
            placeholder="e.g., 250"
          />
        </label>

        <label class="grid gap-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Total time (hr)</span>
          <input
            class="field-control"
            type="number"
            min="0"
            step="0.1"
            bind:value={totalTimeHr}
            inputmode="decimal"
            placeholder="e.g., 3"
          />
        </label>
      </div>

      {#if showIssues}
        <div class="mt-3 rounded-lg border-2 border-amber-300 bg-amber-900/60 px-3 py-2 text-sm font-semibold text-amber-100">
          {#each issues as issue}
            <div>{issue}</div>
          {/each}
        </div>
      {/if}

      <div class="mt-3 text-xs text-slate-400">
        First hour ramps at 20/40/60/80% of the final rate, then continues at the final rate.
      </div>
    </div>

    <div class="min-w-0 rounded-lg border-2 border-slate-200 bg-surface p-4 shadow-panel">
      <h3 class="text-sm font-black uppercase tracking-wide text-slate-200">Step-by-step plan</h3>
      {#if plan}
        <div class="mt-3 overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="text-xs font-semibold uppercase tracking-wide text-slate-400">
              <tr class="border-b border-slate-700">
                <th class="px-3 py-2 text-left">Interval</th>
                <th class="px-3 py-2 text-right">Rate (mL/hr)</th>
                <th class="px-3 py-2 text-right">Volume (mL)</th>
                <th class="px-3 py-2 text-right">Cumulative (mL)</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800">
              {#each plan.steps as step}
                <tr class="text-slate-200">
                  <td class="px-3 py-2 font-semibold text-slate-100">{intervalLabel(step)}</td>
                  <td class="px-3 py-2 text-right tabular-nums">{fmt(step.rateMlHr, 0)}</td>
                  <td class="px-3 py-2 text-right tabular-nums">{fmt(step.volumeMl, 2)}</td>
                  <td class="px-3 py-2 text-right tabular-nums">{fmt(step.cumulativeMl, 2)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <div class="mt-3 text-sm text-slate-400">Plan details will appear here once inputs are set.</div>
      {/if}
    </div>

    <div class="min-w-0 rounded-lg border-2 border-slate-200 bg-surface p-4 shadow-card">
      <h2 class="text-sm font-black uppercase tracking-wide text-slate-200">
        <button
          type="button"
          class="flex w-full items-center justify-between text-left"
          aria-expanded={summaryOpen}
          aria-controls="blood-transfusion-summary"
          on:click={() => (summaryOpen = !summaryOpen)}
        >
          <span>Summary</span>
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            class={`h-4 w-4 text-slate-300 transition-transform duration-200 ${summaryOpen ? 'rotate-90' : ''}`}
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M7.21 14.79a.75.75 0 0 1 0-1.06L10.94 10 7.21 6.27a.75.75 0 1 1 1.06-1.06l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0Z"
            />
          </svg>
        </button>
      </h2>
      <div
        id="blood-transfusion-summary"
        class={summaryOpen ? 'mt-3' : 'mt-3 hidden'}
      >
        {#if plan}
          <div class="grid gap-3 text-sm">
            <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
              <span class="text-slate-300">Ideal final rate</span>
              <span class="font-black tabular-nums text-slate-100">{fmt(plan.summary.idealFinalRateMlHr, 2)} mL/hr</span>
            </div>
            <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
              <span class="text-slate-300">Final rate (rounded)</span>
              <span class="font-black tabular-nums text-slate-100">{fmt(plan.summary.finalRateMlHr, 0)} mL/hr</span>
            </div>
            <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
              <span class="text-slate-300">Total time</span>
              <span class="font-black tabular-nums text-slate-100">{fmt(plan.summary.totalHours, 2)} hr</span>
            </div>
            <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
              <span class="text-slate-300">Target volume</span>
              <span class="font-black tabular-nums text-slate-100">{fmt(plan.summary.targetVolumeMl, 2)} mL</span>
            </div>
            <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
              <span class="text-slate-300">Delivered volume</span>
              <span class="font-black tabular-nums text-slate-100">{fmt(plan.summary.deliveredVolumeMl, 2)} mL</span>
            </div>
            <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2">
              <span class="text-slate-300">Delta vs target</span>
              <span class="font-black tabular-nums text-slate-100">{fmtSigned(plan.summary.deltaMl, 2)} mL</span>
            </div>
          </div>
          <div class="mt-3 text-xs text-slate-400">
            Rates are rounded to whole mL/hr (minimum 1). Delivered volume can differ slightly from target.
          </div>
        {:else}
          <div class="text-sm text-slate-400">
            Enter a total volume and a total time greater than 1 hour.
          </div>
        {/if}
      </div>
    </div>
  </div>
</section>
