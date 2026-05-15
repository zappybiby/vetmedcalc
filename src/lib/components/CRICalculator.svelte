<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { DoseUnit } from '../helpers/doseMapping';
  import { buildCRIViewModel, type CRIViewModel } from '../viewmodels/criViewModel';
  import { patient } from '../stores/patient';
  import type { Patient } from '../stores/patient';
  import { CUSTOM_MEDICATION_ID, MEDICATIONS, getDefaultMedicationDoseUnit } from '@defs';
  import type { MedicationDef } from '@defs';

  type MathToken = { kind: 'num' | 'op' | 'text'; text: string };
  type PrepareLine = { label: string; value: string };
  type SummaryCard = { label: string; value: string; secondary?: string };

  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  let medId: string = MEDICATIONS[0]?.id ?? '';
  let customDrugName = '';
  let customConcentrationMgMl: number | '' = '';

  let isCustomDrug = false;
  $: isCustomDrug = medId === CUSTOM_MEDICATION_ID;

  let customMed: MedicationDef | undefined;
  $: customMed = isCustomDrug && customConcentrationMgMl !== '' && Number(customConcentrationMgMl) > 0
    ? {
        id: CUSTOM_MEDICATION_ID,
        name: customDrugName.trim() || 'Custom',
        concentration: { value: Number(customConcentrationMgMl), units: 'mg/mL' },
      }
    : undefined;

  let med: MedicationDef | undefined;
  $: med = isCustomDrug ? customMed : MEDICATIONS.find((m) => m.id === medId);

  let doseUnit: DoseUnit = getDefaultMedicationDoseUnit(medId);
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
    const nextUnit = getDefaultMedicationDoseUnit(medId);
    const shouldFlash = doseUnit !== nextUnit;
    doseUnit = nextUnit;
    previousMedId = medId;
    if (shouldFlash) triggerUnitFlash();
  }

  function concMgPerMl(m?: MedicationDef | null) {
    if (!m) return null;
    return m.concentration.units === 'mg/mL'
      ? m.concentration.value
      : m.concentration.value / 1000;
  }

  function formatConcDisplay(m?: MedicationDef | null): string {
    if (!m) return '';
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

  let prepareLines: PrepareLine[] = [];
  $: prepareLines = vm
    ? [
        ...vm.drawCards.map((card) => ({
          label: card.kind === 'diluent' ? 'Diluent' : 'Stock',
          value: card.volumeText,
        })),
      ]
    : [];

  let summaryCards: SummaryCard[] = [];
  $: summaryCards = vm
    ? [
        {
          label: 'Delivers',
          value: vm.resultCard.deliveredDoseText,
        },
        {
          label: 'Lasts',
          value: vm.resultCard.runtimeText,
          secondary: vm.resultCard.runtimeNoteText,
        },
        {
          label: 'Final concentration',
          value: vm.resultCard.finalConcentrationText,
        },
      ]
    : [];

  let stockLine: PrepareLine | null = null;
  $: stockLine = prepareLines.find((line) => line.label === 'Stock') ?? null;

  let diluentLine: PrepareLine | null = null;
  $: diluentLine = prepareLines.find((line) => line.label === 'Diluent') ?? null;

  const alertBase = 'rounded-lg border px-3 py-2 text-sm font-semibold';
  const defaultAlert = 'border-slate-600/40 bg-surface-sunken text-slate-200';
  const alertStyles: Record<string, string> = {
    warn: 'border-amber-300/30 bg-amber-950/40 text-amber-100',
    info: 'border-sky-300/25 bg-sky-950/55 text-sky-100'
  };

  function tokenizeMath(expr: string): MathToken[] {
    const tokens: MathToken[] = [];
    const re = /(-?\d+(?:\.\d+)?)|([=×÷→()+;])/g;
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
</script>

<section class="grid min-w-0 gap-2 text-slate-200 sm:gap-3" aria-label="CRI calculator">
  <article class="ui-card grid gap-2 p-2.5 sm:gap-3 sm:p-3">
    <div class="grid min-w-0 grid-cols-2 gap-2 sm:gap-2.5 xl:grid-cols-[minmax(220px,1.45fr)_minmax(220px,1.25fr)_minmax(104px,0.55fr)_minmax(120px,0.65fr)]">
      <div class="col-span-2 flex min-w-0 flex-col gap-1.5 xl:col-span-1">
        <label class="ui-label" for="cri-med">Medication</label>
        <select id="cri-med" bind:value={medId} class="field-select">
          {#each MEDICATIONS as m}
            <option value={m.id}>
              {m.name} — {formatConcDisplay(m)}
            </option>
          {/each}
          <option value={CUSTOM_MEDICATION_ID}>Custom</option>
        </select>
      </div>

      {#if isCustomDrug}
        <div class="flex min-w-0 flex-col gap-1.5">
          <label class="ui-label" for="cri-custom-name">Drug name</label>
          <input
            id="cri-custom-name"
            class="field-control"
            type="text"
            bind:value={customDrugName}
            autocomplete="off"
          />
        </div>

        <div class="flex min-w-0 flex-col gap-1.5">
          <label class="ui-label" for="cri-custom-concentration">Stock concentration (mg/mL)</label>
          <input
            id="cri-custom-concentration"
            class="field-control"
            type="number"
            min="0"
            step="0.001"
            bind:value={customConcentrationMgMl}
            inputmode="decimal"
          />
        </div>
      {/if}

      <div class="col-span-2 flex min-w-0 flex-col gap-1.5 xl:col-span-1">
        <label class="ui-label" for="cri-dose">Dose</label>
        <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
          <input
            id="cri-dose"
            class="field-control"
            type="number"
            min="0"
            step="0.001"
            bind:value={desiredDose}
            inputmode="decimal"
            placeholder="0.4"
          />
          <select
            bind:value={doseUnit}
            aria-label="Dose unit"
            class="field-select min-w-[7rem] sm:min-w-[8rem]"
            class:unit-flash={unitFlash}
          >
            <option value="mg/kg/hr">mg/kg/hr</option>
            <option value="mg/kg/min">mg/kg/min</option>
            <option value="mg/kg/day">mg/kg/day</option>
            <option value="mcg/kg/hr">mcg/kg/hr</option>
            <option value="mcg/kg/min">mcg/kg/min</option>
          </select>
        </div>
      </div>

      <div class="flex min-w-0 flex-col gap-1.5">
        <label class="ui-label" for="cri-duration">Duration</label>
        <input
          id="cri-duration"
          class="field-control"
          type="number"
          min="0"
          step="0.1"
          bind:value={durationHr}
          inputmode="decimal"
          placeholder="12 hr"
        />
      </div>

      <div class="flex min-w-0 flex-col gap-1.5">
        <label class="ui-label" for="cri-rate">Pump rate</label>
        <input
          id="cri-rate"
          class="field-control"
          type="number"
          min="0"
          step="0.1"
          bind:value={desiredRateMlPerHr}
          inputmode="decimal"
          placeholder="optional"
        />
      </div>
    </div>

    {#if med?.notes}
      <div class="border-t border-slate-700/40 pt-2 text-[12px] text-amber-300">{med.notes}</div>
    {/if}
  </article>

  {#if vm}
    {#if vm.alerts.length}
      <div class="grid gap-2 md:grid-cols-2" aria-live="polite">
        {#each vm.alerts as a}
          <div class={`${alertBase} ${alertStyles[a.severity] ?? defaultAlert}`}>{a.message}</div>
        {/each}
      </div>
    {/if}

    <article class="ui-card overflow-hidden">
      <section class="px-3 py-3 sm:px-3.5 sm:py-3.5 lg:px-4 lg:py-4">
        <div class="ui-label-strong">Instruction</div>
        <div class="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[14px] leading-relaxed text-slate-300 sm:gap-x-2 sm:gap-y-1.5 sm:text-[15px]">
          <span>Draw up</span>
          {#if stockLine}
            <span class="ui-statement-value">{stockLine.value}</span>
            <span>of</span>
          {/if}
          <span class="font-semibold text-slate-100">{med?.name ?? 'drug'}</span>
          {#if diluentLine}
            <span>+</span>
            <span class="ui-statement-value">{diluentLine.value}</span>
            <span>diluent</span>
          {/if}
          <span>and run at</span>
          <span class="ui-statement-value">{vm.resultCard.pumpRateText}</span>
          <span>.</span>
        </div>
      </section>

      <div class="grid gap-y-0 border-t border-slate-700/40 md:grid-cols-3">
        {#each summaryCards as card, index}
          <section class={`grid min-w-0 grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] items-baseline gap-2 px-3 py-2.5 sm:block sm:px-4 sm:py-3 ${index > 0 ? 'border-t border-slate-700/40 md:border-t-0 md:border-l' : ''}`}>
            <div class="ui-label-strong">{card.label}</div>
            <div class="text-right text-[1.12rem] font-black leading-tight tracking-tight tabular-nums text-slate-100 sm:mt-1.5 sm:text-left sm:text-[1.6rem] sm:leading-none">{card.value}</div>
            {#if card.secondary}
              <div class="ui-meta mt-1">{card.secondary}</div>
            {/if}
          </section>
        {/each}
      </div>
    </article>

    <details class="group ui-card overflow-hidden">
      <summary class="ui-summary flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 sm:px-3.5 sm:py-3 lg:px-4">
        <div class="ui-section-title">Step-By-Step calculations</div>
        <svg class="h-5 w-5 flex-none text-slate-400 transition group-open:rotate-180" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fill="currentColor"
            fill-rule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.173l3.71-3.94a.75.75 0 011.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
            clip-rule="evenodd"
          />
        </svg>
      </summary>

      <div class="border-t border-slate-700/40 px-2 py-2 sm:px-3 lg:px-3.5">
        <div class="divide-y divide-slate-700/40">
          {#each vm.stepByStep.rows as row}
            <div class="grid gap-1.5 px-2.5 py-2 sm:px-3 lg:grid-cols-[168px_minmax(0,1fr)] lg:items-center lg:gap-3 lg:py-1.5">
              <div class="text-[12px] font-semibold leading-snug text-slate-200">{row.label}</div>

              <div class="min-w-0 font-mono text-[11px] leading-snug tracking-tight text-slate-100 sm:text-[11.5px]">
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
    </details>
  {/if}
</section>
