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

<section class="drug" aria-label="Drug in bag calculator">
  <header class="hdr">Drug in Bag</header>

  <div class="grid">
    <div class="field">
      <label for="drug">Drug</label>
      <select id="drug" bind:value={selectedDrugId}>
        {#each DRUG_OPTIONS as option}
          <option value={option.id}>{option.label}</option>
        {/each}
      </select>
    </div>

    <div class="field">
      <label for="dose">Dose</label>
      <div class="row">
        <input id="dose" type="number" min="0" step="0.01" bind:value={dose} inputmode="decimal" placeholder="e.g., 1" />
        <select bind:value={doseUnit} aria-label="Dose unit">
          <option value="mg/kg/day">mg/kg/day</option>
          <option value="mg/kg/hr">mg/kg/hr</option>
          <option value="mcg/kg/min">mcg/kg/min</option>
        </select>
      </div>
      <div class="muted small">Defaults to {DEFAULT_DOSE_UNIT[selectedDrugId]} for {selectedDrug.label}</div>
    </div>

    <div class="field">
      <label for="bag">Fluid bag volume (mL)</label>
      <input id="bag" type="number" min="0" step="1" bind:value={bagVolumeMl} inputmode="decimal" placeholder="e.g., 1000" />
    </div>

    <div class="field">
      <label for="rate">Maintenance rate (mL/hr)</label>
      <input id="rate" type="number" min="0" step="0.1" bind:value={maintRateMlHr} inputmode="decimal" placeholder="e.g., 60" />
    </div>

    <div class="field readonly">
      <span class="labeltext">Patient weight</span>
      <div class="pill">{p.weightKg != null ? `${p.weightKg.toFixed(2)} kg` : 'Enter in Patient panel'}</div>
    </div>
  </div>

  <div class="results">
    <h3 class="sub">Summary</h3>
    {#if ready && snappedMlToAdd != null}
      <div class="draws">
        <div class="card">
          <div class="card-title">Add to bag</div>
          <div class="big">{fmt(snappedMlToAdd, volumeDigits)} <span class="unit">mL</span></div>
          <div class="detail">{selectedDrug.label} {formatConcDisplay(med)}
            {#if syr}
              · in <span class="pill">{syr.label ?? `${syr.sizeCc} cc`}</span>
              <span class="muted">(ticks {fmt(syr.incrementMl, 2)} mL)</span>
              {#if fills && fills > 1}
                <span class="warn">requires {fills} fills</span>
              {/if}
            {/if}
          </div>
          {#if hasRoundingChange && rawMlToAdd != null}
            <div class="muted small">Rounded from {fmt(rawMlToAdd, volumeDigits)} mL</div>
          {/if}
        </div>
      </div>

      <div class="kv" style="margin-top:.45rem;">
        <div class="k">Drug amount drawn</div>
        <div class="v strong">{fmt(snappedMgToAdd, 2)} <span class="unit">mg</span></div>
        <div class="k">Bag runtime at rate</div>
        <div class="v">{fmt(bagHours, 2)} <span class="unit">hr</span></div>
        <div class="k">Stock concentration</div>
        <div class="v">{formatConcDisplay(med)}</div>
        <div class="k">Bag concentration (rounded)</div>
        <div class="v">{fmt(finalConcMgPerMl, 4)} <span class="unit">mg/mL</span></div>
        <div class="k">Delivered dose at rate</div>
        <div class="v">
          <strong>{formatDeliveredDose(deliveredDoseMgPerKgHr, doseUnit)}</strong>
          {#if deliveredDoseMgPerKgHr != null}
            <div class="muted small">= {formatDeliveredDose(deliveredDoseMgPerKgHr, 'mg/kg/hr')}</div>
          {/if}
        </div>
      </div>

      <div class="section">
        <div class="section-title">How calculated</div>
        <table class="kvtable"><tbody>
          <tr>
            <th>Hours the bag runs</th>
            <td class="num">{fmt(bagHours, 3)} <span class="unit">hr</span></td>
          </tr>
          <tr>
            <th>Unit conversion factor</th>
            <td class="num">
              {fmt(unitFactor, 4)}
              <span class="unit">({UNIT_FACTOR_DETAILS[doseUnit]})</span>
            </td>
          </tr>
          <tr>
            <th>mL to add</th>
            <td class="num">
              (<span class="strong">{dose || 0}</span>
              × <span class="strong">{fmt(p.weightKg ?? 0, 2)}</span>
              × <span class="strong">{fmt(unitFactor, 4)}</span>)
              ÷ <span class="strong">{fmt(concentrationMgPerMl, 2)}</span>
              = <span class="strong">{fmt(rawMlToAdd, 3)}</span> <span class="unit">mL</span>
            </td>
          </tr>
          {#if hasRoundingChange}
            <tr>
              <th>Rounded to syringe ticks</th>
              <td class="num strong">{fmt(snappedMlToAdd, volumeDigits)} <span class="unit">mL</span>
                <div class="muted small">Δ {fmt(roundingDeltaMl, volumeDigits)} mL</div>
              </td>
            </tr>
          {/if}
        </tbody></table>
      </div>
    {:else}
      <p class="muted">Enter dose, bag volume, rate, and patient weight.</p>
    {/if}
  </div>
</section>

<style>
  .drug { display: grid; gap: .9rem; min-width: 0; }
  .hdr { font-weight: 900; font-size: 1.05rem; }

  .grid {
    display: grid;
    gap: .6rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    min-width: 0;
  }
  .field { display: grid; gap: .3rem; min-width: 0; }
  .field.readonly { align-content: end; }
  label { font-size: .85rem; font-weight: 700; }
  .labeltext { font-size: .85rem; font-weight: 700; }
  input, select {
    border: 1.5px solid #e5e7eb; border-radius: .4rem;
    padding: .4rem .5rem; font-size: .95rem;
    background: #0b1220; color: #e5e7eb;
    max-width: 100%;
  }
  .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .4rem; align-items: center; min-width: 0; }
  .row > * { min-width: 0; }
  .small { font-size: .72rem; margin-top: .15rem; }

  .results {
    border: 2px solid #e5e7eb; border-radius: .5rem;
    padding: .7rem .8rem; box-shadow: 2px 2px 0 #0b0b0b; background: #111827; color: #e5e7eb;
    min-width: 0; max-width: 100%;
  }
  .sub { margin: 0 0 .4rem 0; font-size: .95rem; font-weight: 900; }
  .muted { opacity: .7; margin: 0 .2rem; }
  .warn { color: #b45309; font-weight: 800; margin-left: .25rem; }
  .pill {
    border: 1.5px solid #e5e7eb; border-radius: 999px;
    padding: .08rem .4rem; font-weight: 800; background: #0b1220; color: #e5e7eb;
  }

  .section { border: 1.5px solid #e5e7eb; border-radius: .45rem; padding: .55rem .6rem; background: #0b1220; color: #e5e7eb; margin-bottom: .6rem; min-width: 0; }
  .section-title { font-size: .8rem; font-weight: 900; margin-bottom: .35rem; }
  .kv { display: grid; grid-template-columns: minmax(0, 1fr) auto; row-gap: .35rem; column-gap: .6rem; align-items: center; min-width: 0; }
  .kv .k { opacity: .9; }
  .kv .v { font-variant-numeric: tabular-nums; text-align: right; }
  .kv .v.strong { font-weight: 900; }
  .unit { opacity: .85; font-weight: 700; margin-left: .15rem; }
  .kvtable { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .kvtable th { text-align: left; padding: .2rem 0; font-weight: 700; opacity: .9; vertical-align: top; }
  .kvtable td { text-align: right; padding: .2rem 0; font-variant-numeric: tabular-nums; }
  .kvtable th, .kvtable td { word-break: break-word; overflow-wrap: anywhere; }
  .kvtable td.num { font-weight: 700; }

  .draws { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .6rem; min-width: 0; }
  .card { border: 1.5px solid #e5e7eb; border-radius: .45rem; padding: .6rem .65rem; background: #0b1220; color: #e5e7eb; min-width: 0; }
  .card-title { font-weight: 900; font-size: .85rem; margin-bottom: .25rem; }
  .big { font-variant-numeric: tabular-nums; font-weight: 900; font-size: 1.05rem; margin-bottom: .2rem; }
</style>
