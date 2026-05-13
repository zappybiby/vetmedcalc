<script lang="ts">
  import { patient } from '../stores/patient';
  import type { Patient } from '../stores/patient';
  import { CUSTOM_MEDICATION_ID, MEDICATIONS, SYRINGES, getDefaultMedicationDoseUnit } from '@defs';
  import type { DoseUnit, MedicationDef, SyringeDef } from '@defs';

  const UNIT_FACTOR_DETAILS: Record<DoseUnit, string> = {
    'mg/kg/day': 'bag hours ÷ 24',
    'mg/kg/hr': 'bag hours',
    'mg/kg/min': 'bag hours × 60',
    'mcg/kg/hr': 'bag hours ÷ 1000',
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
      case 'mg/kg/min':
        return value / 60;
      case 'mcg/kg/hr':
        return value * 1000;
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
  let selectedDrugId: MedicationDef['id'] = MEDICATIONS[0]?.id ?? '';
  let customDrugName = '';
  let customConcentrationMgMl: number | '' = '';
  let dose: number | '' = '';
  let doseUnit: DoseUnit = getDefaultMedicationDoseUnit(selectedDrugId);
  let bagVolumeMl: number | '' = '';
  let maintRateMlHr: number | '' = '';

  let isCustomDrug = false;
  $: isCustomDrug = selectedDrugId === CUSTOM_MEDICATION_ID;

  let customMed: MedicationDef | undefined;
  $: customMed = isCustomDrug && customConcentrationMgMl !== '' && Number(customConcentrationMgMl) > 0
    ? {
        id: CUSTOM_MEDICATION_ID,
        name: customDrugName.trim() || 'Custom',
        concentration: { value: Number(customConcentrationMgMl), units: 'mg/mL' },
      }
    : undefined;

  let med: MedicationDef | undefined;
  $: med = isCustomDrug ? customMed : MEDICATIONS.find((m) => m.id === selectedDrugId);

  let concentrationMgPerMl: number | null = null;
  $: concentrationMgPerMl = concMgPerMl(med);

  let previousDrugId: MedicationDef['id'] = selectedDrugId;
  $: if (selectedDrugId !== previousDrugId) {
    doseUnit = getDefaultMedicationDoseUnit(selectedDrugId);
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
    if (unit === 'mg/kg/min') return hours * 60;
    if (unit === 'mcg/kg/hr') return hours / 1000;
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

<section class="grid min-w-0 gap-2 text-slate-200 sm:gap-3" aria-label="Drug in bag calculator">
  <div class="grid min-w-0 gap-2 min-[380px]:grid-cols-2 sm:gap-3 md:grid-cols-2">
    <div class="flex min-w-0 flex-col gap-1.5 min-[380px]:col-span-2 sm:gap-2 md:col-span-1">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="drugbag-drug">Drug</label>
      <select id="drugbag-drug" class="field-select" bind:value={selectedDrugId}>
        {#each MEDICATIONS as option}
          <option value={option.id}>
            {option.name} {formatConcDisplay(option)}
          </option>
        {/each}
        <option value={CUSTOM_MEDICATION_ID}>Custom</option>
      </select>
    </div>

    {#if isCustomDrug}
      <div class="flex min-w-0 flex-col gap-1.5 sm:gap-2">
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="drugbag-custom-name">Drug name</label>
        <input
          id="drugbag-custom-name"
          class="field-control"
          type="text"
          bind:value={customDrugName}
          autocomplete="off"
        />
      </div>

      <div class="flex min-w-0 flex-col gap-1.5 sm:gap-2">
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="drugbag-custom-concentration">Stock concentration (mg/mL)</label>
        <input
          id="drugbag-custom-concentration"
          class="field-control"
          type="number"
          min="0"
          step="0.001"
          bind:value={customConcentrationMgMl}
          inputmode="decimal"
        />
      </div>
    {/if}

    <div class="flex min-w-0 flex-col gap-1.5 min-[380px]:col-span-2 sm:gap-2 md:col-span-1">
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
          <option value="mg/kg/min">mg/kg/min</option>
          <option value="mcg/kg/hr">mcg/kg/hr</option>
          <option value="mcg/kg/min">mcg/kg/min</option>
        </select>
      </div>
    </div>

    <div class="flex min-w-0 flex-col gap-1.5 sm:gap-2">
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

    <div class="flex min-w-0 flex-col gap-1.5 sm:gap-2">
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

  </div>

  {#if ready && snappedMlToAdd != null}
    <div class="grid gap-2 sm:gap-2.5">
      <div class="grid gap-2 sm:gap-3 md:grid-cols-2">
        <div class="ui-card p-3 text-center md:col-span-2">
          <div class="text-xs font-black uppercase tracking-wide text-slate-300">Delivered dose at rate</div>
          <div class="mt-1.5 text-2xl font-black tabular-nums text-slate-100">{formatDeliveredDose(deliveredDoseMgPerKgHr, doseUnit)}</div>
          {#if deliveredDoseMgPerKgHr != null}
            <div class="mt-1 text-xs text-slate-400">= {formatDeliveredDose(deliveredDoseMgPerKgHr, 'mg/kg/hr')}</div>
          {/if}
        </div>

        <div class="ui-card p-3">
          <div class="text-xs font-black uppercase tracking-wide text-slate-300">Draw up</div>

          <div class="mt-2 grid gap-2 min-[380px]:grid-cols-2">
            <div class="ui-inset p-2.5 sm:p-3">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Add to bag</div>
              <div class="mt-1 text-xl font-black tabular-nums text-slate-100 sm:text-2xl">
                {fmt(snappedMlToAdd, volumeDigits)} <span class="text-base font-semibold text-slate-300">mL</span>
              </div>
            </div>
            <div class="ui-inset p-2.5 sm:p-3">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Drug drawn</div>
              <div class="mt-1 text-xl font-black tabular-nums text-slate-100 sm:text-2xl">
                {fmt(snappedMgToAdd, 2)} <span class="text-base font-semibold text-slate-300">mg</span>
              </div>
            </div>
          </div>

          <div class="mt-2 grid gap-x-3 gap-y-1.5 text-sm [grid-template-columns:minmax(0,1fr)_auto]">
            <div class="text-slate-300">Drug</div>
            <div class="text-right text-slate-100">{med?.name ?? '—'}</div>

            <div class="text-slate-300">Stock</div>
            <div class="text-right"><span class="ui-chip">{formatConcDisplay(med)}</span></div>

            {#if syr}
              <div class="text-slate-300">Syringe</div>
              <div class="text-right"><span class="ui-chip">{syr.label ?? `${syr.sizeCc} cc`}</span></div>
              {#if fills && fills > 1}
                <div class="text-slate-300">Fills</div>
                <div class="text-right font-semibold text-amber-500">{fills}</div>
              {/if}
            {/if}
          </div>

          {#if hasRoundingChange && rawMlToAdd != null}
            <div class="mt-2 text-xs text-slate-400 sm:mt-3">Rounded from {fmt(rawMlToAdd, volumeDigits)} mL</div>
          {/if}
        </div>

        <div class="ui-card p-3">
          <div class="text-xs font-black uppercase tracking-wide text-slate-300">Bag + rate</div>

          <div class="mt-2 grid gap-x-3 gap-y-1.5 text-sm [grid-template-columns:minmax(0,1fr)_auto]">
            <div class="text-slate-300">Bag volume</div>
            <div class="text-right font-black tabular-nums text-slate-100">{bagVolumeMl || 0} <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mL</span></div>

            <div class="text-slate-300">Rate</div>
            <div class="text-right font-black tabular-nums text-slate-100">{maintRateMlHr || 0} <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mL/hr</span></div>

            <div class="text-slate-300">Runtime</div>
            <div class="text-right font-black tabular-nums text-slate-100">{fmt(bagHours, 2)} <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">hr</span></div>

            <div class="text-slate-300">Bag concentration</div>
            <div class="text-right font-black tabular-nums text-slate-100">
              {fmt(finalConcMgPerMl, 4)} <span class="ml-1 text-xs font-semibold uppercase tracking-wide text-slate-400">mg/mL</span>
            </div>
          </div>
        </div>
      </div>

      <details class="ui-inset p-3">
        <summary class="cursor-pointer select-none text-xs font-black uppercase tracking-wide text-slate-300">How calculated</summary>
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
      </details>
    </div>
  {/if}
</section>
