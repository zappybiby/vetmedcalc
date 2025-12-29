<script lang="ts">
  import { patient } from '../stores/patient';
  import type { Patient } from '../stores/patient';
  import { MEDICATIONS, SYRINGES } from '@defs';
  import type { MedicationDef, SyringeDef } from '@defs';

  type DoseUnit = 'mg/kg/day' | 'mg/kg/hr' | 'mcg/kg/min';

  type DrugOption = {
    id: MedicationDef['id'];
    label: string;
    defaultDoseUnit: DoseUnit;
  };

  const DRUG_OPTIONS: readonly DrugOption[] = [
    { id: 'metoclopramide-5', label: 'Reglan (metoclopramide)', defaultDoseUnit: 'mg/kg/day' },
    { id: 'norepinephrine-1', label: 'Norepinephrine', defaultDoseUnit: 'mcg/kg/min' },
  ] as const;

  const DEFAULT_DOSE_UNIT: Record<DrugOption['id'], DoseUnit> = {
    'metoclopramide-5': 'mg/kg/day',
    'norepinephrine-1': 'mcg/kg/min',
  };

  const UNIT_FACTOR_DETAILS: Record<DoseUnit, string> = {
    'mg/kg/day': 'bag hours ÷ 24',
    'mg/kg/hr': 'bag hours',
    'mcg/kg/min': '(bag hours × 60) ÷ 1000',
  };

  function concMgPerMl(m?: MedicationDef | null): number | null {
    if (!m) return null;
    if (m.concentration.units === 'mg/mL') return m.concentration.value;
    if (m.concentration.units === 'mcg/mL') return m.concentration.value / 1000;
    return null;
  }

  function formatConcDisplay(m?: MedicationDef | null): string {
    if (!m) return '—';
    return `${m.concentration.value} ${m.concentration.units}`;
  }

  function fmt(x: number | null | undefined, digits = 2) {
    if (x == null || Number.isNaN(x)) return '—';
    return Number(x).toFixed(digits);
  }

  function chooseSyringeForVolume(volMl: number, syrs: readonly SyringeDef[]): SyringeDef {
    const sorted = [...syrs].sort((a, b) => a.sizeCc - b.sizeCc || a.incrementMl - b.incrementMl);
    const oneFill = sorted.filter((s) => s.sizeCc >= volMl);
    if (oneFill.length) {
      return oneFill.sort((a, b) => a.incrementMl - b.incrementMl || a.sizeCc - b.sizeCc)[0];
    }
    return sorted[sorted.length - 1];
  }

  function roundToIncrement(value: number, increment: number): number {
    if (!Number.isFinite(value)) return value;
    if (increment <= 0) return value;
    const rounded = Math.round(value / increment) * increment;
    return Math.max(0, rounded);
  }

  function convertMgPerKgHrToUnit(value: number, unit: DoseUnit): number {
    if (!Number.isFinite(value)) return value;
    switch (unit) {
      case 'mg/kg/day':
        return value * 24;
      case 'mcg/kg/min':
        return (value * 1000) / 60;
      case 'mg/kg/hr':
      default:
        return value;
    }
  }

  function formatDeliveredDose(value: number | null, unit: DoseUnit): string {
    if (value == null || Number.isNaN(value)) return '—';
    const converted = convertMgPerKgHrToUnit(value, unit);
    if (!Number.isFinite(converted)) return '—';
    return `${Number(converted).toFixed(3)} ${unit}`;
  }

  // Patient
  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  // Inputs
  let selectedDrugId: DrugOption['id'] = DRUG_OPTIONS[0]?.id ?? 'metoclopramide-5';
  let dose: number | '' = '';
  let doseUnit: DoseUnit = DEFAULT_DOSE_UNIT[selectedDrugId];
  let bagVolumeMl: number | '' = '';
  let maintRateMlHr: number | '' = '';

  let selectedDrug = DRUG_OPTIONS[0];
  $: selectedDrug = DRUG_OPTIONS.find((d) => d.id === selectedDrugId) ?? DRUG_OPTIONS[0];

  let med: MedicationDef | undefined;
  $: med = MEDICATIONS.find((m) => m.id === selectedDrugId);

  let concentrationMgPerMl: number | null = null;
  $: concentrationMgPerMl = concMgPerMl(med);

  let previousDrugId: DrugOption['id'] = selectedDrugId;
  $: if (selectedDrugId !== previousDrugId) {
    doseUnit = DEFAULT_DOSE_UNIT[selectedDrugId];
    previousDrugId = selectedDrugId;
  }

  let bagVolumeValue: number | null = null;
  $: bagVolumeValue = bagVolumeMl !== '' ? Number(bagVolumeMl) : null;

  let maintRateValue: number | null = null;
  $: maintRateValue = maintRateMlHr !== '' ? Number(maintRateMlHr) : null;

  let bagHours: number | null = null;
  $: bagHours = (bagVolumeValue != null && maintRateValue != null && maintRateValue > 0)
    ? bagVolumeValue / maintRateValue
    : null;

  function calcUnitFactor(unit: DoseUnit, hours: number | null): number | null {
    if (hours == null) return null;
    if (unit === 'mg/kg/day') return hours / 24;
    if (unit === 'mg/kg/hr') return hours;
    if (unit === 'mcg/kg/min') return (hours * 60) / 1000;
    return null;
  }

  let unitFactor: number | null = null;
  $: unitFactor = calcUnitFactor(doseUnit, bagHours);

  let mgToAdd: number | null = null;
  $: mgToAdd = (p.weightKg != null && dose !== '' && unitFactor != null)
    ? Number(dose) * Number(p.weightKg) * unitFactor
    : null;

  let rawMlToAdd: number | null = null;
  $: rawMlToAdd = (mgToAdd != null && concentrationMgPerMl != null && concentrationMgPerMl > 0)
    ? mgToAdd / concentrationMgPerMl
    : null;

  let syr: SyringeDef | null = null;
  $: syr = rawMlToAdd != null ? chooseSyringeForVolume(rawMlToAdd, SYRINGES) : null;

  let snappedMlToAdd: number | null = null;
  $: snappedMlToAdd = (rawMlToAdd != null && syr)
    ? roundToIncrement(rawMlToAdd, syr.incrementMl)
    : rawMlToAdd;

  let fills: number | null = null;
  $: fills = snappedMlToAdd != null && syr ? Math.ceil(snappedMlToAdd / syr.sizeCc) : null;

  let snappedMgToAdd: number | null = null;
  $: snappedMgToAdd = (snappedMlToAdd != null && concentrationMgPerMl != null)
    ? snappedMlToAdd * concentrationMgPerMl
    : null;

  let volumeDigits: number = 2;
  $: volumeDigits = syr && syr.incrementMl < 0.1 ? 3 : 2;

  let finalConcMgPerMl: number | null = null;
  $: finalConcMgPerMl = (snappedMgToAdd != null && bagVolumeValue != null && bagVolumeValue > 0)
    ? snappedMgToAdd / bagVolumeValue
    : null;

  let deliveredMgPerHr: number | null = null;
  $: deliveredMgPerHr = (finalConcMgPerMl != null && maintRateValue != null && maintRateValue > 0)
    ? finalConcMgPerMl * maintRateValue
    : null;

  let deliveredDoseMgPerKgHr: number | null = null;
  $: deliveredDoseMgPerKgHr = (deliveredMgPerHr != null && p.weightKg)
    ? deliveredMgPerHr / Number(p.weightKg)
    : null;

  let roundingDeltaMl: number | null = null;
  $: roundingDeltaMl = (rawMlToAdd != null && snappedMlToAdd != null)
    ? snappedMlToAdd - rawMlToAdd
    : null;

  let hasRoundingChange: boolean = false;
  $: hasRoundingChange = !!(roundingDeltaMl != null && Math.abs(roundingDeltaMl) > 1e-6);

  let ready: boolean = false;
  $: ready = !!(p.weightKg && dose !== '' && bagVolumeMl !== '' && maintRateMlHr !== '');
</script>

<section class="grid min-w-0 gap-4 text-slate-200" aria-label="Drug in bag calculator">
  <header class="text-base font-black uppercase tracking-wide text-slate-100">Drug in Bag</header>

  <div class="grid min-w-0 gap-3 md:grid-cols-2">
    <div class="flex min-w-0 flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="drugbag-drug">Drug</label>
      <select id="drugbag-drug" class="field-select" bind:value={selectedDrugId}>
        {#each DRUG_OPTIONS as option}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
    </div>

    <div class="flex min-w-0 flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="drugbag-dose">Dose</label>
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <input
          id="drugbag-dose"
          class="field-control"
          type="number"
          min="0"
          step="0.01"
          bind:value={dose}
          inputmode="decimal"
          placeholder="e.g., 1"
        />
        <select bind:value={doseUnit} aria-label="Dose unit" class="field-select">
          <option value="mg/kg/day">mg/kg/day</option>
          <option value="mg/kg/hr">mg/kg/hr</option>
          <option value="mcg/kg/min">mcg/kg/min</option>
        </select>
      </div>
      <div class="text-xs text-slate-400">Defaults to {DEFAULT_DOSE_UNIT[selectedDrugId]} for {selectedDrug.label}</div>
    </div>

    <div class="flex min-w-0 flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="drugbag-bag">Fluid bag volume (mL)</label>
      <input
        id="drugbag-bag"
        class="field-control"
        type="number"
        min="0"
        step="1"
        bind:value={bagVolumeMl}
        inputmode="decimal"
        placeholder="e.g., 1000"
      />
    </div>

    <div class="flex min-w-0 flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="drugbag-rate">Maintenance rate (mL/hr)</label>
      <input
        id="drugbag-rate"
        class="field-control"
        type="number"
        min="0"
        step="0.1"
        bind:value={maintRateMlHr}
        inputmode="decimal"
        placeholder="e.g., 60"
      />
    </div>

    <div class="flex min-w-0 flex-col gap-2 md:col-span-2 md:flex-row md:items-center md:justify-between">
      <span class="text-xs font-semibold uppercase tracking-wide text-slate-300">Patient weight</span>
      <div class="inline-flex items-center rounded-full border border-slate-200 bg-surface px-3 py-1 text-sm font-semibold text-slate-200">
        {p.weightKg != null ? `${p.weightKg.toFixed(2)} kg` : 'Enter in Patient panel'}
      </div>
    </div>
  </div>

  <div class="min-w-0 rounded-lg border-2 border-slate-200 bg-surface p-4 text-slate-200 shadow-panel">
    <h3 class="text-sm font-black uppercase tracking-wide text-slate-200">Summary</h3>
    {#if ready && snappedMlToAdd != null}
      <div class="mt-3 grid min-w-0 gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        <div class="rounded-lg border border-slate-200 bg-surface p-4">
          <div class="text-sm font-black uppercase tracking-wide text-slate-300">Add to bag</div>
          <div class="mt-2 text-lg font-black tabular-nums text-slate-100">
            {fmt(snappedMlToAdd, volumeDigits)} <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mL</span>
          </div>
          <div class="text-sm tabular-nums text-slate-300">
            {selectedDrug.label} {formatConcDisplay(med)}
            {#if syr}
              · in <span class="ml-1 inline-flex items-center rounded-full border border-slate-200 bg-surface-sunken px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-200">{syr.label ?? `${syr.sizeCc} cc`}</span>
              <span class="ml-2 text-slate-400">(ticks {fmt(syr.incrementMl, 2)} mL)</span>
              {#if fills && fills > 1}
                <span class="ml-2 font-semibold text-amber-500">requires {fills} fills</span>
              {/if}
            {/if}
          </div>
          {#if hasRoundingChange && rawMlToAdd != null}
            <div class="mt-2 text-xs text-slate-400">Rounded from {fmt(rawMlToAdd, volumeDigits)} mL</div>
          {/if}
        </div>
      </div>

      <div class="mt-4 grid items-center gap-x-4 gap-y-2 text-sm [grid-template-columns:minmax(0,1fr)_auto]">
        <div class="text-slate-300">Drug amount drawn</div>
        <div class="text-right font-black tabular-nums text-slate-100">
          {fmt(snappedMgToAdd, 2)} <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mg</span>
        </div>
        <div class="text-slate-300">Bag runtime at rate</div>
        <div class="text-right tabular-nums text-slate-100">
          {fmt(bagHours, 2)} <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">hr</span>
        </div>
        <div class="text-slate-300">Stock concentration</div>
        <div class="text-right tabular-nums text-slate-100">{formatConcDisplay(med)}</div>
        <div class="text-slate-300">Bag concentration (rounded)</div>
        <div class="text-right tabular-nums text-slate-100">
          {fmt(finalConcMgPerMl, 4)} <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mg/mL</span>
        </div>
        <div class="text-slate-300">Delivered dose at rate</div>
        <div class="text-right text-slate-100">
          <span class="font-black tabular-nums">{formatDeliveredDose(deliveredDoseMgPerKgHr, doseUnit)}</span>
          {#if deliveredDoseMgPerKgHr != null}
            <div class="mt-1 text-xs text-slate-400">= {formatDeliveredDose(deliveredDoseMgPerKgHr, 'mg/kg/hr')}</div>
          {/if}
        </div>
      </div>

      <div class="mt-4 rounded-lg border border-slate-200 bg-surface-sunken p-4">
        <div class="text-xs font-black uppercase tracking-wide text-slate-300">How calculated</div>
        <table class="mt-3 w-full table-fixed border-collapse text-sm">
          <tbody>
            <tr>
              <th class="py-1 pr-3 text-left font-semibold text-slate-300">Hours the bag runs</th>
              <td class="py-1 text-right tabular-nums text-slate-100">
                {fmt(bagHours, 3)} <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">hr</span>
              </td>
            </tr>
            <tr>
              <th class="py-1 pr-3 text-left font-semibold text-slate-300">Unit conversion factor</th>
              <td class="py-1 text-right tabular-nums text-slate-100">
                {fmt(unitFactor, 4)}
                <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">({UNIT_FACTOR_DETAILS[doseUnit]})</span>
              </td>
            </tr>
            <tr>
              <th class="py-1 pr-3 text-left font-semibold text-slate-300">mL to add</th>
              <td class="py-1 text-right tabular-nums text-slate-100">
                (<span class="font-black">{dose || 0}</span>
                × <span class="font-black">{fmt(p.weightKg ?? 0, 2)}</span>
                × <span class="font-black">{fmt(unitFactor, 4)}</span>)
                ÷ <span class="font-black">{fmt(concentrationMgPerMl, 2)}</span>
                = <span class="font-black">{fmt(rawMlToAdd, 3)}</span>
                <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mL</span>
              </td>
            </tr>
            {#if hasRoundingChange}
              <tr>
                <th class="py-1 pr-3 text-left font-semibold text-slate-300">Rounded to syringe ticks</th>
                <td class="py-1 text-right font-black tabular-nums text-slate-100">
                  {fmt(snappedMlToAdd, volumeDigits)}
                  <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mL</span>
                  <div class="mt-1 text-xs text-slate-400">Δ {fmt(roundingDeltaMl, volumeDigits)} mL</div>
                </td>
              </tr>
            {/if}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="mt-3 text-sm text-slate-400">Enter dose, bag volume, rate, and patient weight.</p>
    {/if}
  </div>
</section>
