<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { DoseUnit } from '../helpers/doseMapping';
  import { buildCRIViewModel, type CRIViewModel } from '../viewmodels/criViewModel';
  import { patient } from '../stores/patient';
  import type { Patient } from '../stores/patient';
  import { MEDICATIONS } from '@defs';
  import type { MedicationDef } from '@defs';

  type MathToken = { kind: 'num' | 'op' | 'text'; text: string };
  type PrepareLine = { label: string; value: string };
  type SummaryCard = { label: string; value: string; secondary?: string };

  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

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
          value: durationHr === '' ? '—' : `${fmt(Number(durationHr), 2)} hr`,
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

<section class="grid min-w-0 gap-2.5 text-slate-200" aria-label="CRI calculator">
  <article class="ui-card grid gap-2.5 p-3">
    <div class="grid min-w-0 gap-2.5 xl:grid-cols-[minmax(220px,300px)_minmax(220px,280px)_104px_120px] xl:justify-center">
      <div class="flex min-w-0 flex-col gap-1.5">
        <label class="ui-label" for="cri-med">Medication</label>
        <select id="cri-med" bind:value={medId} class="field-select">
          {#each MEDICATIONS as m}
            <option value={m.id}>
              {m.name} — {formatConcDisplay(m)}
            </option>
          {/each}
        </select>
      </div>

      <div class="flex min-w-0 flex-col gap-1.5">
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
            class="field-select min-w-[8rem]"
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
      <section class="px-3.5 py-3.5 lg:px-4 lg:py-4">
        <div class="ui-label-strong">Instruction</div>
        <div class="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1.5 text-[15px] leading-relaxed text-slate-300">
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
          <section class={`min-w-0 px-3.5 py-3 sm:px-4 ${index > 0 ? 'border-t border-slate-700/40 md:border-t-0 md:border-l' : ''}`}>
            <div class="ui-label-strong">{card.label}</div>
            <div class="mt-1.5 text-[1.6rem] font-semibold leading-none tracking-tight tabular-nums text-slate-100">{card.value}</div>
            {#if card.secondary}
              <div class="ui-meta mt-1">{card.secondary}</div>
            {/if}
          </section>
        {/each}
      </div>
    </article>

    <details class="group ui-card overflow-hidden">
      <summary class="ui-summary flex cursor-pointer items-center justify-between gap-3 px-3.5 py-3 lg:px-4">
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

      <div class="border-t border-slate-700/40 px-3.5 py-3 lg:px-4">
        <div class="grid gap-3">
          <div class="grid gap-2">
            <div class="ui-label-strong">Dose conversions</div>
            <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {#each vm.resultCard.doseLines as line}
                <div class="ui-inset px-3 py-2.5">
                  <div class="text-[13px] font-medium leading-none tabular-nums text-slate-200">{line}</div>
                </div>
              {/each}
            </div>
          </div>

          <div class="overflow-hidden rounded-lg border border-slate-700/40 divide-y divide-slate-700/40">
            {#each vm.stepByStep.rows as row}
              <div class="grid gap-2.5 p-3 lg:grid-cols-[190px_minmax(0,1fr)] lg:items-stretch">
                <div class="ui-inset flex items-center justify-between gap-3 px-3 py-2.5">
                  <div class="text-[13px] font-medium leading-snug text-slate-200">{row.label}</div>

                  {#if row.popover}
                    <details class="group relative flex-none">
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
                        <div class="ui-label-strong">{row.popover.title}</div>

                        {#if row.popover.bars?.length}
                          <div class="mt-2 grid gap-2">
                            {#each row.popover.bars as bar}
                              <div class="grid gap-1">
                                <div class="flex items-baseline justify-between gap-2">
                                  <div class="font-medium text-slate-200">{bar.label}</div>
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
                      </div>
                    </details>
                  {/if}
                </div>

                <div class="ui-inset flex items-center px-3 py-2.5 font-mono text-[12.5px] leading-[1.6] tracking-tight text-slate-100">
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
      </div>
    </details>
  {/if}
</section>
