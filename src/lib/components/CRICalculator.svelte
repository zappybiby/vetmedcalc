<script lang="ts">
  // CRI Calculator with optional dilution mapping (rate ↔ dose).
  // Adjust the helper import path if needed:
  import { onDestroy } from 'svelte';
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

  const DEFAULT_DOSE_UNIT: Record<MedicationDef['id'], DoseUnit> = {
    'diazepam-5': 'mg/kg/hr',
    'dobutamine-12-5': 'mcg/kg/min',
    'dopamine-40': 'mcg/kg/min',
    'fentanyl-50': 'mcg/kg/hr',
    'furosemide-50': 'mg/kg/hr',
    'midazolam-5': 'mg/kg/hr',
    'metoclopramide-5': 'mg/kg/hr',
    'norepinephrine-1': 'mcg/kg/min',
    'propofol-10': 'mg/kg/min',
    'lidocaine-20': 'mcg/kg/min',
    'ketamine-100': 'mcg/kg/min',
  };
  const FALLBACK_DOSE_UNIT: DoseUnit = 'mg/kg/hr';

  let doseUnit: DoseUnit = DEFAULT_DOSE_UNIT[medId] ?? FALLBACK_DOSE_UNIT;
  let desiredDose: number | '' = '';
  let durationHr: number | '' = '';

  let desiredRateMlPerHr: number | '' = '';
  let enableDilution = false;
  $: {
    const rate = desiredRateMlPerHr;
    const rNum = rate === '' || rate == null ? NaN : (typeof rate === 'number' ? rate : Number(rate));
    enableDilution = Number.isFinite(rNum) && rNum > 0;
  }

  let unitFlash = false;
  let unitFlashTimer: ReturnType<typeof setTimeout> | null = null;
  const unitFlashDurationMs = 650;

  function triggerUnitFlash() {
    unitFlash = false;
    if (unitFlashTimer) clearTimeout(unitFlashTimer);
    requestAnimationFrame(() => {
      unitFlash = true;
      unitFlashTimer = setTimeout(() => {
        unitFlash = false;
      }, unitFlashDurationMs);
    });
  }

  onDestroy(() => {
    if (unitFlashTimer) clearTimeout(unitFlashTimer);
  });

  let previousMedId = medId;
  $: if (medId !== previousMedId) {
    const nextUnit = DEFAULT_DOSE_UNIT[medId] ?? FALLBACK_DOSE_UNIT;
    const shouldFlash = doseUnit !== nextUnit;
    doseUnit = nextUnit;
    previousMedId = medId;
    if (shouldFlash) triggerUnitFlash();
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

  const alertBase = 'rounded-lg border px-3 py-2 text-sm font-semibold';
  const defaultAlert = 'border-slate-600/40 bg-surface-sunken text-slate-200';
  const alertStyles: Record<string, string> = {
    warn: 'border-amber-300/30 bg-amber-950/40 text-amber-100',
    info: 'border-sky-300/25 bg-sky-950/55 text-sky-100'
  };
</script>

<section class="grid min-w-0 gap-4 text-slate-200" aria-label="CRI Calculator">
  <header class="text-base font-black uppercase tracking-wide text-slate-100">CRI Calculator</header>

  <!-- Inputs -->
  <div class="grid min-w-0 gap-3 md:grid-cols-2">
    <div class="flex min-w-0 flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="cri-med">Medication</label>
      <select id="cri-med" bind:value={medId} class="field-select">
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
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="cri-dose">Dose</label>
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <input
          id="cri-dose"
          class="field-control"
          type="number"
          min="0"
          step="0.001"
          bind:value={desiredDose}
          inputmode="decimal"
          placeholder="e.g., 0.4"
        />
        <select bind:value={doseUnit} aria-label="Dose unit" class="field-select" class:unit-flash={unitFlash}>
          <option value="mg/kg/hr">mg/kg/hr</option>
          <option value="mg/kg/min">mg/kg/min</option>
          <option value="mg/kg/day">mg/kg/day</option>
          <option value="mcg/kg/hr">mcg/kg/hr</option>
          <option value="mcg/kg/min">mcg/kg/min</option>
        </select>
      </div>
    </div>

    <div class="flex min-w-0 flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="cri-duration">Duration (hr)</label>
      <input
        id="cri-duration"
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
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="cri-rate">Target pump rate (mL/hr)</label>
      <input
        id="cri-rate"
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
  {#if vm}
    <div class="grid gap-3">
      {#if vm.alerts?.length}
        <div class="grid gap-2" aria-live="polite">
          {#each vm.alerts as a}
            <div class={`${alertBase} ${alertStyles[a.severity] ?? defaultAlert}`}>{a.message}</div>
          {/each}
        </div>
      {/if}

      <div class="grid min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {#each vm.drawCards as card}
          <div class="ui-card p-4">
            <div class="flex items-center justify-between gap-2 text-xs">
              <span class="ui-chip -ml-px text-sm">{card.kind === 'diluent' ? 'Diluent' : 'Stock'}</span>
              {#if card.fills && card.fills > 1}
                <span class="font-semibold text-amber-500">{card.fills} fills</span>
              {/if}
            </div>
            <div class="mt-2 text-xl font-black tabular-nums text-slate-100">{card.volumeText}</div>
            <div class="text-base tabular-nums text-slate-300">
              in <span class="ui-chip text-sm">{card.syringeText}</span>
              {#if card.tickText}
                <span class="ml-2 text-slate-400">({card.tickText})</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <div class="ui-card grid gap-3 p-4">
        <div class="grid items-center gap-x-4 gap-y-2 text-base [grid-template-columns:minmax(0,1fr)_auto]">
          <div class="text-slate-300">Total volume</div>
          <div class="text-right font-black tabular-nums text-slate-100">{vm.resultCard.totalVolumeText}</div>
          <div class="text-slate-300">Final concentration</div>
          <div class="text-right font-black tabular-nums text-slate-100">{vm.resultCard.finalConcentrationText}</div>
        </div>
        <div class="ui-divider" role="presentation"></div>
        <div class="tabular-nums text-base text-slate-200">
          At <span class="font-black text-slate-100">{vm.resultCard.pumpRateText}</span> this will deliver
          <span class="font-black text-slate-100">{vm.resultCard.deliveredDoseText}</span>
        </div>

        <details class="ui-inset p-3">
          <summary class="ui-summary cursor-pointer select-none text-xs font-black uppercase tracking-wide text-slate-300">
            Dose conversions
          </summary>
          <div class="mt-3 grid gap-1 text-sm sm:grid-cols-2 sm:gap-x-3">
            {#each vm.resultCard.doseLines as ln}
              <div class="font-black tabular-nums text-slate-100">{ln}</div>
            {/each}
          </div>
        </details>

        <details class="ui-inset p-3">
          <summary class="ui-summary cursor-pointer select-none text-xs font-black uppercase tracking-wide text-slate-300">
            Step by step calculation
          </summary>
          <table class="mt-3 w-full table-fixed border-collapse text-xs">
            <tbody>
              {#each vm.stepByStep.rows as row}
                <tr class="align-top">
                  <th class="py-1 pr-3 text-left font-semibold text-slate-300">
                    {row.label}
                  </th>
                  <td class="py-1 text-left tabular-nums text-slate-100">
                    <div class="flex items-start gap-2">
                      <div class="min-w-0 flex-1 break-words text-slate-100">{row.math}</div>
                      {#if row.popover}
                        <details class="group relative mt-0.5 flex-none">
                          <summary
                            class="ui-summary inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-md border border-slate-600/40 bg-surface-sunken text-slate-300 transition-colors hover:border-slate-500/60 hover:text-slate-100"
                            aria-label="Optimization details"
                          >
                            <svg viewBox="0 0 20 20" class="h-4 w-4" aria-hidden="true">
                              <path
                                fill="currentColor"
                                fill-rule="evenodd"
                                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-11a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-1 2a1 1 0 0 1 2 0v5a1 1 0 1 1-2 0V9Z"
                                clip-rule="evenodd"
                              />
                            </svg>
                          </summary>

                          <div
                            class="absolute right-0 top-full z-30 mt-2 hidden w-72 max-w-[calc(100vw-3rem)] rounded-lg border border-slate-600/40 bg-surface-raised p-3 text-xs text-slate-200 shadow-lg group-hover:block group-open:block"
                            role="dialog"
                            aria-label={row.popover.title}
                          >
                            <div class="text-xs font-black uppercase tracking-wide text-slate-300">{row.popover.title}</div>

                            {#if row.popover.bars?.length}
                              <div class="mt-2 grid gap-2">
                                {#each row.popover.bars as bar}
                                  <div class="grid gap-1">
                                    <div class="flex items-baseline justify-between gap-2">
                                      <div class="font-semibold text-slate-200">{bar.label}</div>
                                      <div class={`tabular-nums ${bar.severity === 'warn' ? 'text-amber-300' : 'text-emerald-300'}`}>{bar.valueText}</div>
                                    </div>
                                    <div class="h-2 overflow-hidden rounded bg-slate-700/40">
                                      <div
                                        class={`h-full ${bar.severity === 'warn' ? 'bg-amber-400/70' : 'bg-emerald-400/70'}`}
                                        style={`width:${Math.max(0, Math.min(100, bar.fillPct)).toFixed(0)}%`}
                                      ></div>
                                    </div>
                                  </div>
                                {/each}
                              </div>
                            {/if}

                            {#if row.popover.lines?.length}
                              <div class="mt-2 grid gap-1 text-slate-300">
                                {#each row.popover.lines as ln}
                                  <div class="break-words">{ln}</div>
                                {/each}
                              </div>
                            {/if}

                            <div class="mt-2 text-[11px] text-slate-400">Hover on desktop, tap the icon on mobile.</div>
                          </div>
                        </details>
                      {/if}
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </details>
      </div>
    </div>
  {/if}
</section>
