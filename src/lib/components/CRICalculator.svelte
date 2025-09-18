<script lang="ts">
  // CRI Calculator with optional dilution mapping (rate ↔ dose).
  // Adjust the helper import path if needed:
  import type { DoseUnit } from '../helpers/doseMapping';
  import { buildCRIViewModel, type CRIViewModel } from '../viewmodels/criViewModel';

  import { patient } from '../stores/patient';
  import type { Patient } from '../stores/patient';
  import { MEDICATIONS, SYRINGES } from '@defs';
  import type { MedicationDef, SyringeDef } from '@defs';

  // Reactive patient from store
  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  // -------- Inputs --------
  let medId: string = MEDICATIONS[0]?.id ?? '';
  let med: MedicationDef | undefined;
  $: med = MEDICATIONS.find((m) => m.id === medId);

  let doseUnit: DoseUnit = 'mg/kg/hr';
  let desiredDose: number | '' = '';
  let durationHr: number | '' = '';

  let desiredRateMlPerHr: number | '' = '';
  let enableDilution = false;
  $: {
    const rate = desiredRateMlPerHr;
    enableDilution = rate !== '' && rate != null && !Number.isNaN(typeof rate === 'number' ? rate : Number(rate));
  }

  // -------- Helpers --------
  function concMgPerMl(m?: MedicationDef | null) {
    if (!m) return null;
    return m.concentration.units === 'mg/mL'
      ? m.concentration.value
      : m.concentration.value / 1000;
  }
  function formatConcDisplay(m?: MedicationDef | null): string {
    if (!m) return '';
    // Keep internals in mg/mL; display Fentanyl as mcg/mL for clarity.
    if (m.name.toLowerCase() === 'fentanyl') {
      const mg = concMgPerMl(m) ?? 0;
      const mcg = Math.round(mg * 1000);
      return `${mcg} mcg/mL`;
    }
    return `${m.concentration.value} ${m.concentration.units}`;
  }
  function fmt(x: number | null | undefined, digits = 2) {
    if (x == null || Number.isNaN(x)) return '—';
    return Number(x).toFixed(digits);
  }

  // Unified view-model (presence-based)
  let vm: CRIViewModel | null = null;
  $: vm = buildCRIViewModel({
    enableDilution,
    p,
    med,
    desiredDose,
    doseUnit,
    durationHr,
    desiredRateMlPerHr,
  });

  const alertBase = 'rounded-lg border-2 px-3 py-2 font-bold';
  const defaultAlert = 'border-slate-200 bg-surface text-slate-200';
  const alertStyles: Record<string, string> = {
    warn: 'border-amber-300 border-dashed bg-amber-900/60 text-amber-100',
    info: 'border-sky-300 bg-sky-950/60 text-sky-100'
  };
</script>

<section class="grid min-w-0 gap-4 text-slate-200" aria-label="CRI Calculator">
  <header class="text-base font-black uppercase tracking-wide text-slate-100">CRI Calculator</header>

  <!-- Inputs -->
  <div class="grid min-w-0 gap-3 md:grid-cols-2">
    <div class="flex min-w-0 flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="med">Medication</label>
      <select id="med" bind:value={medId} class="field-select">
        {#each MEDICATIONS as m}
          <option value={m.id}>
            {m.name} — {formatConcDisplay(m)}
          </option>
        {/each}
      </select>
      {#if med?.notes}
        <div class="text-xs text-slate-400">⚠ {med.notes}</div>
      {/if}
    </div>

    <div class="flex min-w-0 flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="dose">Dose</label>
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <input
          id="dose"
          class="field-control"
          type="number"
          min="0"
          step="0.001"
          bind:value={desiredDose}
          inputmode="decimal"
          placeholder="e.g., 0.4"
        />
        <select bind:value={doseUnit} aria-label="Dose unit" class="field-select">
          <option value="mg/kg/hr">mg/kg/hr</option>
          <option value="mg/kg/day">mg/kg/day</option>
          <option value="mcg/kg/hr">mcg/kg/hr</option>
          <option value="mcg/kg/min">mcg/kg/min</option>
        </select>
      </div>
    </div>

    <div class="flex min-w-0 flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="duration">Duration (hr)</label>
      <input
        id="duration"
        class="field-control"
        type="number"
        min="0"
        step="0.1"
        bind:value={durationHr}
        inputmode="decimal"
        placeholder="e.g., 12"
      />
    </div>

    <div class="flex min-w-0 flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="rate">Target pump rate (mL/hr)</label>
      <input
        id="rate"
        class="field-control"
        type="number"
        min="0"
        step="0.1"
        bind:value={desiredRateMlPerHr}
        inputmode="decimal"
        placeholder="e.g., 5"
      />
    </div>
  </div>

  <!-- Unified Results -->
  <div class="min-w-0 rounded-lg border-2 border-slate-200 bg-surface p-4 text-slate-200 shadow-panel">
    <h3 class="text-sm font-black uppercase tracking-wide text-slate-200">{enableDilution ? 'Dilution Plan' : 'From Stock (no dilution)'}</h3>

    {#if vm}
      {#if vm.alerts?.length}
        <div class="grid gap-2" aria-live="polite">
          {#each vm.alerts as a}
            <div class={`${alertBase} ${alertStyles[a.severity] ?? defaultAlert}`}>{a.message}</div>
          {/each}
        </div>
      {/if}

      <div class="space-y-4">
        <div class="rounded-lg border border-slate-200 bg-surface-sunken p-4">
          <div class="text-xs font-black uppercase tracking-wide text-slate-300">Summary</div>
          <div class="mt-3 grid min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
            {#each vm.drawCards as card}
              <div class="rounded-lg border border-slate-200 bg-surface p-4">
                <div class="text-sm font-black uppercase tracking-wide text-slate-300">{card.title}</div>
                <div class="mt-2 text-lg font-black tabular-nums text-slate-100">{card.volumeText}</div>
                <div class="text-sm tabular-nums text-slate-300">
                  in <span class="inline-flex items-center rounded-full border border-slate-200 bg-surface-sunken px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-200">{card.syringeText}</span>
                  {#if card.fills && card.fills > 1}
                    <span class="ml-2 font-semibold text-amber-500">· {card.fills} fills</span>
                  {/if}
                  {#if card.tickText}
                    <span class="ml-2 text-slate-400">({card.tickText})</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>

          <div class="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-surface p-4">
            <div class="text-sm font-black uppercase tracking-wide text-slate-300">{vm.resultCard.title}</div>
            <div class="grid items-center gap-x-4 gap-y-2 text-sm [grid-template-columns:minmax(0,1fr)_auto]">
              <div class="text-slate-300">Total volume</div>
              <div class="text-right font-black tabular-nums text-slate-100">{vm.resultCard.totalVolumeText}</div>
              <div class="text-slate-300">Final concentration</div>
              <div class="text-right font-black tabular-nums text-slate-100">{vm.resultCard.finalConcentrationText}</div>
            </div>
            <div class="h-px bg-slate-700" role="presentation"></div>
            <div class="tabular-nums text-sm text-slate-200">
              At <span class="font-black text-slate-100">{vm.resultCard.pumpRateText}</span> this will deliver
              <span class="font-black text-slate-100">{vm.resultCard.deliveredDoseText}</span>
            </div>
            <div class="text-sm text-slate-400">Giving a dose of:</div>
            <div class="h-px bg-slate-700" role="presentation"></div>
            <div class="grid gap-1 text-sm">
              {#each vm.resultCard.doseLines as ln}
                <div class="font-black tabular-nums text-slate-100">{ln}</div>
              {/each}
            </div>
          </div>
        </div>

        {#if vm.roundingDetail}
          <details class="rounded-lg border border-slate-200 bg-surface-sunken p-4 text-slate-200">
            <summary class="flex cursor-pointer items-center justify-between text-sm font-black uppercase tracking-wide text-slate-200">
              <span>{vm.roundingDetail.title}</span>
              <span class="text-xs text-slate-400">▾</span>
            </summary>
            <table class="mt-3 w-full table-fixed border-collapse text-sm">
              <tbody>
                {#each vm.roundingDetail.rows as r}
                  <tr>
                    <th class="py-1 pr-3 text-left font-semibold text-slate-300">{r.label}</th>
                    <td class="py-1 text-right font-semibold tabular-nums text-slate-100">
                      {r.value}
                      {#if r.subnote}
                        <div class="mt-1 text-xs text-slate-400">{r.subnote}</div>
                      {/if}
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </details>
        {/if}
      </div>
    {:else}
      <p class="text-sm text-slate-400">Enter all inputs to see the {enableDilution ? 'dilution plan' : 'calculation'}.</p>
    {/if}
  </div>
</section>
