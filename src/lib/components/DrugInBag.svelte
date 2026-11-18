<script lang="ts">
  import SegmentedToggle from './SegmentedToggle.svelte';
  import ToolDisclosure from './ToolDisclosure.svelte';
  import { tick } from 'svelte';
  import { patient } from '../stores/patient';
  import { CUSTOM_MEDICATION_ID, MEDICATIONS, getDefaultMedicationDoseUnit } from '@defs';
  import type { DoseUnit } from '@defs';
  import { optimizeDrugBag, DOSE_TARGET_PCT, DOSE_REVIEW_PCT } from '../helpers/drugInBag';

  type Input = number | '' | undefined;
  type Drug = {
    key: number;
    id: string;
    name: string;
    concentration: Input;
    dose: Input;
    unit: DoseUnit;
  };
  let nextKey = 0;
  function blankDrug(): Drug {
    return { key: nextKey++, id: '', name: '', concentration: '', dose: '', unit: 'mg/kg/hr' };
  }
  let drugs: Drug[] = [blankDrug()];
  let bagVolumeMl: Input = '';
  let duration: Input = '';
  let rate: Input = '';
  let mode: 'duration' | 'rate' = 'rate';
  let rateIncrement: 1 | 0.1 = 1;
  let submittedInput: string | null = null;
  const units: DoseUnit[] = ['mg/kg/day', 'mg/kg/hr', 'mg/kg/min', 'mcg/kg/hr', 'mcg/kg/min'];
  const positive = (value: Input | null): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const fmt = (value: number, digits = 3) => value !== 0 && Math.abs(value) < 0.001 ? Number(value.toPrecision(3)).toString() : Number(value.toFixed(digits)).toString();
  const volume = (value: number) => value > 0 && value < 0.000001 ? value.toPrecision(3) : fmt(value, 6);
  const calculationNumber = (value: number) => Math.abs(value) < 1
    ? Number(value.toPrecision(3)).toString()
    : fmt(value, 2);

  function formatBagConcentration(mgPerMl: number): string {
    const useMicrograms = mgPerMl < 0.1;
    const concentration = useMicrograms ? mgPerMl * 1000 : mgPerMl;
    return `${Number(concentration.toPrecision(4))} ${useMicrograms ? 'mcg/mL' : 'mg/mL'}`;
  }

  async function addDrug() {
    const drug = blankDrug();
    drugs = [...drugs, drug];
    await tick();
    document.getElementById(`drugbag-drug-${drug.key}`)?.focus();
  }
  function selectDrug(drug: Drug) {
    drug.unit = getDefaultMedicationDoseUnit(drug.id);
    drugs = drugs;
  }
  function factor(unit: DoseUnit): number {
    switch (unit) {
      case 'mg/kg/day': return 1 / 24;
      case 'mg/kg/min': return 60;
      case 'mcg/kg/hr': return 1 / 1000;
      case 'mcg/kg/min': return 60 / 1000;
      default: return 1;
    }
  }
  function conversion(unit: DoseUnit): string {
    switch (unit) {
      case 'mg/kg/day': return ' ÷ 24';
      case 'mg/kg/min': return ' × 60';
      case 'mcg/kg/hr': return ' ÷ 1000';
      case 'mcg/kg/min': return ' × 60 ÷ 1000';
      default: return '';
    }
  }
  $: sharedReady = positive($patient.weightKg) && positive(bagVolumeMl)
    && positive(mode === 'duration' ? duration : rate);
  $: activeInputs = drugs.map(drug => {
    const med = MEDICATIONS.find(m => m.id === drug.id);
    const custom = drug.id === CUSTOM_MEDICATION_ID;
    const name = custom ? drug.name.trim() || 'Custom' : med?.name || 'Medication';
    const concentration = custom ? drug.concentration : med
      ? med.concentration.value / (med.concentration.units === 'mcg/mL' ? 1000 : 1) : null;
    const started = drug.id !== '' || drug.dose !== '' && drug.dose != null;
    return { drug, name, concentration, started, valid: positive(drug.dose) && positive(concentration) };
  }).filter(result => result.started);
  $: ready = sharedReady && activeInputs.length > 0 && activeInputs.every(result => result.valid);
  $: inputSignature = JSON.stringify([$patient.weightKg, bagVolumeMl, mode, duration, rate, rateIncrement, drugs]);
  $: if (submittedInput !== null && submittedInput !== inputSignature) submittedInput = null;
  async function calculate() {
    await tick();
    const missingDrug = activeInputs.find(result => !result.valid);
    const missingId = !positive($patient.weightKg) ? 'patient-weight'
      : !positive(bagVolumeMl) ? 'drugbag-bag'
      : !positive(mode === 'duration' ? duration : rate) ? 'drugbag-time'
      : missingDrug ? `drugbag-${!missingDrug.drug.id ? 'drug' : !positive(missingDrug.drug.dose) ? 'dose' : 'stock'}-${missingDrug.drug.key}`
      : !activeInputs.length ? `drugbag-drug-${drugs[0].key}` : null;
    if (missingId) document.getElementById(missingId)?.focus();
    else submittedInput = inputSignature;
  }
  $: outcome = ready ? optimizeDrugBag({
    weightKg: $patient.weightKg!, bagMl: Number(bagVolumeMl), increment: rateIncrement,
    drugs: activeInputs.map(result => ({ doseMgKgHr: Number(result.drug.dose) * factor(result.drug.unit), concentrationMgMl: Number(result.concentration) })),
    ...(mode === 'duration'
      ? { mode: 'duration' as const, durationHr: Number(duration) }
      : { mode: 'rate' as const, rateMlHr: Number(rate) }),
  }) : null;
  $: plan = outcome?.plan;
  $: active = plan ? activeInputs.map((result, index) => ({ ...result, ...plan!.drugs[index], delivered: plan!.drugs[index].deliveredMgKgHr / factor(result.drug.unit) })) : [];
  $: pumpRate = plan?.rate;
  $: runtime = plan?.hours;
  $: totalDraw = plan?.totalDraw ?? 0;
  // Syringe increments can leave floating-point noise at a whole-mL boundary.
  // Only removal is rounded up; calculations continue to use nominal bag volume.
  $: removalVolume = Math.ceil(Number(totalDraw.toFixed(8)));
  const deviation = (value: number) => `${value > 0 ? '+' : ''}${fmt(value, 1)}%`;
</script>

<section class="ui-tool-stack drugbag-layout text-slate-200" aria-label="Multi-Drug CRI calculator">
  <article class="ui-card form-card">
    <div class="ui-card-padding">
      <div class="bag-settings-fields">
        <div class="field">
          <label class="ui-label" for="drugbag-bag">Bag volume <span class="normal-case">(mL)</span></label>
          <input id="drugbag-bag" class="field-control" type="number" min="0" step="any" bind:value={bagVolumeMl} inputmode="decimal" />
        </div>
        <div class="field">
          <label class="ui-label" for="drugbag-time">{mode === 'duration' ? 'Duration' : 'Rate'} <span class="normal-case">({mode === 'duration' ? 'hr' : 'mL/hr'})</span></label>
          {#if mode === 'duration'}
            <input id="drugbag-time" class="field-control" type="number" min="0" step="any" bind:value={duration} inputmode="decimal" />
          {:else}
            <input id="drugbag-time" class="field-control" type="number" min="0" step="any" bind:value={rate} inputmode="decimal" />
          {/if}
        </div>
        <fieldset class="field precision-control">
          <legend class="ui-label">Calculate by</legend>
          <SegmentedToggle label="Calculation mode" first="Duration" second="Rate" secondSelected={mode === 'rate'} onToggle={rateMode => mode = rateMode ? 'rate' : 'duration'} />
        </fieldset>
        <fieldset class="field precision-control">
          <legend class="ui-label">Pump precision</legend>
          <SegmentedToggle label="Pump rate precision" first="1 mL/hr" second="0.1 mL/hr" secondSelected={rateIncrement === 0.1} onToggle={precise => rateIncrement = precise ? 0.1 : 1} />
        </fieldset>
      </div>
    </div>

    <section class="ui-card-padding form-section medication-section" aria-labelledby="medications-title">
      <h2 class="sr-only" id="medications-title">Medications</h2>
      <div class="drug-list">
        {#each drugs as drug, index (drug.key)}
          <div class="drug-row" role="group" aria-label={`Medication ${index + 1}`} class:has-column-labels={index === 0} class:custom-medication={drug.id === CUSTOM_MEDICATION_ID}>
            <div class="medication-fields">
              <div class="field">
                <label class="ui-label row-label" for={`drugbag-drug-${drug.key}`}>Medication <span class="sr-only">{index + 1}</span></label>
                <select id={`drugbag-drug-${drug.key}`} class="field-select medication-select" bind:value={drug.id} on:change={() => selectDrug(drug)}>
                  <option value="">Select medication</option>
                  <option value={CUSTOM_MEDICATION_ID}>Custom</option>
                  {#each MEDICATIONS as option}
                    <option value={option.id}>{option.name} — {option.concentration.value} {option.concentration.units}</option>
                  {/each}
                </select>
              </div>
              {#if drug.id === CUSTOM_MEDICATION_ID}
                <div class="field">
                  <label class="ui-label" for={`drugbag-name-${drug.key}`}>Drug name</label>
                  <input id={`drugbag-name-${drug.key}`} class="field-control" bind:value={drug.name} />
                </div>
                <div class="field">
                  <label class="ui-label" for={`drugbag-stock-${drug.key}`}>Conc. <span class="normal-case whitespace-nowrap">(mg/mL)</span></label>
                  <input id={`drugbag-stock-${drug.key}`} class="field-control" type="number" min="0" step="any" bind:value={drug.concentration} inputmode="decimal" />
                </div>
              {/if}
            </div>
            <div class="field dose-field">
              <label class="ui-label row-label" for={`drugbag-dose-${drug.key}`}>Dose <span class="sr-only">{index + 1}</span></label>
              <input id={`drugbag-dose-${drug.key}`} class="field-control" type="number" min="0" step="any" bind:value={drug.dose} inputmode="decimal" />
            </div>
            <div class="field unit-field">
              <label class="ui-label row-label" for={`drugbag-unit-${drug.key}`}>Dose unit <span class="sr-only">{index + 1}</span></label>
              <select id={`drugbag-unit-${drug.key}`} class="field-select" bind:value={drug.unit}>
                {#each units as unit}<option value={unit}>{unit}</option>{/each}
              </select>
            </div>
            <button class="ui-button ui-action-quiet remove-drug" class:only-drug={drugs.length === 1} type="button" disabled={drugs.length === 1} aria-label={`Remove medication ${index + 1}`} on:click={() => drugs = drugs.filter(item => item.key !== drug.key)}>×</button>
          </div>
        {/each}
      </div>
      <div class="drug-actions">
        <button class="ui-button ui-action-quiet add-drug" type="button" on:click={addDrug}><span aria-hidden="true">+</span>Add medication</button>
        <button class="ui-button calculate-button" type="button" on:click={calculate}>Calculate</button>
      </div>
    </section>
  </article>

  <div class="ui-tool-stack output-column" class:awaiting-calculation={submittedInput === null}>
  {#if outcome?.error}
    <div class="ui-alert border-amber-300/30 bg-amber-950/40 text-amber-100" role="alert">{outcome.error}</div>
  {:else if plan}
    <article class="ui-card prep-card" aria-labelledby="bag-prep-title">
      <div class="ui-card-padding prep-heading">
        <h2 class="ui-section-title" id="bag-prep-title">Bag preparation</h2>
        <div class="prep-summary">
          <p class="ui-instruction">Remove <strong class="ui-statement-value" data-testid="drugbag-removal">{removalVolume} mL</strong> from bag, then add...</p>
          <dl class="prep-timing">
            <div class="timing-metric">
              <dt class="ui-instruction">Pump rate</dt>
              <dd class="ui-statement-value">{fmt(pumpRate!, 1)} <span class="ui-unit">mL/hr</span></dd>
            </div>
            <div class="timing-metric">
              <dt class="ui-instruction">Duration</dt>
              <dd class="ui-statement-value">{fmt(runtime!, 1)} <span class="ui-unit">hours</span></dd>
            </div>
          </dl>
        </div>
      </div>
      <div class="results-grid ui-card-padding">
        <div class="result-table" role="table" aria-label="Medication preparation">
          <div class="result-row result-headings" role="row">
            <div role="columnheader">Medication</div>
            <div role="columnheader">Bag concentration</div>
            <div role="columnheader">Delivered dose</div>
            <div role="columnheader" class="draw-volume">Add to bag</div>
          </div>
          <div role="rowgroup">
            {#each active as result}
              <div class="result-row draw-result" role="row">
                <div role="rowheader" class="drug-name">{result.name}</div>
                <div role="cell" class="bag-concentration">
                  <span class="mobile-result-label" aria-hidden="true">In bag</span>
                  <strong>{formatBagConcentration(result.bagConcentrationMgMl)}</strong>
                </div>
                <div role="cell" class="delivered-result">
                  <span class="mobile-result-label" aria-hidden="true">Delivers</span>
                  <strong>{fmt(result.delivered)} <span class="result-unit">{result.drug.unit}</span></strong>
                  {#if Math.abs(result.errorPct) > DOSE_TARGET_PCT + 1e-9}
                    <span class="dose-deviation" class:large-error={Math.abs(result.errorPct) > DOSE_REVIEW_PCT + 1e-9}>({deviation(result.errorPct)}{Math.abs(result.errorPct) > DOSE_REVIEW_PCT + 1e-9 ? '; exceeds 5%' : ''})</span>
                  {/if}
                </div>
                <div role="cell" class="draw-volume">
                  <span class="ui-result-value draw-amount">{volume(result.draw)} <span class="ui-unit">mL</span></span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </article>
  {/if}

  {#if plan}
  <div class="calculation-column">
    <ToolDisclosure title="Step-By-Step calculations">
      <div class="calculation-body">
        <section class="calculation-step ui-inset">
          <h4 class="text-xs font-semibold text-slate-200">1. Pump rate &amp; duration</h4>
          <div class="ui-formula">{#if mode === 'duration'}Target {duration} hr → {:else if rate !== pumpRate}{rate} → {/if}<strong>{fmt(pumpRate!, 1)} mL/hr</strong> · {bagVolumeMl} ÷ {fmt(pumpRate!, 1)} = <strong>{fmt(runtime!, 2)} hr</strong></div>
        </section>
          {#each active as result, index}
            <section class="calculation-step ui-inset">
              <h4 class="text-xs font-semibold text-slate-200">{index + 2}. {result.name}</h4>
              <div class="ui-formula">{result.drug.dose} {result.drug.unit} × {$patient.weightKg} kg × {fmt(runtime!, 2)} hr{conversion(result.drug.unit)} = <strong>{calculationNumber(result.amount!)} mg</strong></div>
              <div class="ui-formula">{calculationNumber(result.amount!)} mg ÷ {calculationNumber(Number(result.concentration))} mg/mL = {calculationNumber(result.rawDraw!)} mL → <strong>{volume(result.draw!)} mL</strong></div>
            </section>
          {/each}
        <section class="calculation-step ui-inset">
          <h4 class="text-xs font-semibold text-slate-200">{active.length + 2}. Prepare bag</h4>
          <div class="ui-formula">{active.map(result => `${result.name} ${volume(result.draw!)} mL`).join(' + ')} = <strong>{volume(totalDraw)} mL</strong> total medication</div>
        </section>
      </div>
    </ToolDisclosure>
  </div>
  {/if}
  </div>
</section>

<style>
  .field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .form-section { display: grid; min-width: 0; gap: 10px; }
  .medication-section { border-top: 1px solid var(--ui-divider); }
  .bag-settings-fields {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.25fr) minmax(0, 1.25fr);
    align-items: end;
    gap: 10px;
  }
  .precision-control { display: block; border: 0; padding: 0; margin: 0; }
  .precision-control legend { margin-bottom: 6px; padding: 0; }
  .drug-list { display: grid; gap: 8px; min-width: 0; }
  .drug-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(5rem, 8rem) minmax(7.5rem, 10rem) 34px;
    gap: 8px;
    min-width: 0;
    align-items: end;
  }
  .drug-row:not(.has-column-labels) .row-label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .medication-fields { min-width: 0; }
  .custom-medication .medication-fields {
    display: grid;
    grid-template-columns: minmax(6rem, 0.75fr) minmax(0, 1.8fr) minmax(6rem, 0.9fr);
    align-items: end;
    gap: 8px;
  }
  .custom-medication .medication-select {
    padding-right: 1.2rem;
    background-position: right 0.3rem center;
  }
  .remove-drug { width: 34px; min-height: 34px; padding: 0; font-size: 20px; line-height: 1; }
  .remove-drug.only-drug { visibility: hidden; }
  .drug-actions { display: flex; justify-content: space-between; gap: 8px; }
  .add-drug { gap: 6px; }
  .add-drug > span { font-size: 18px; line-height: 1; }
  .calculate-button { display: none; }
  .output-column:empty { display: none; }
  .prep-card {
    --prep-row-inset: 10px;
    --prep-table-border-width: 1px;
    overflow: hidden;
  }
  .prep-heading { margin-inline: calc(var(--prep-row-inset) + var(--prep-table-border-width)); }
  .prep-summary {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px 16px;
    margin-top: 6px;
    overflow-wrap: anywhere;
  }
  .prep-timing { display: flex; flex-wrap: wrap; gap: 6px 16px; }
  .timing-metric { display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 8px; }
  .timing-metric + .timing-metric { border-inline-start: 1px solid var(--ui-divider); padding-inline-start: 16px; }
  .results-grid { padding-top: 0; }
  .result-table { overflow: hidden; border: var(--prep-table-border-width) solid var(--ui-inset-border); border-radius: 6px; }
  .result-row {
    display: grid;
    grid-template-columns: minmax(0, 27fr) minmax(0, 24fr) minmax(0, 34fr) minmax(0, 15fr);
    align-items: center;
    gap: 10px;
    padding: 8px var(--prep-row-inset);
    overflow-wrap: anywhere;
  }
  .result-headings {
    background: var(--ui-surface);
    color: var(--ui-text-200);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.025em;
    text-transform: uppercase;
  }
  .draw-result { background: var(--ui-surface-3); border-top: 1px solid var(--ui-result-divider); }
  .draw-result:nth-child(even) { background: color-mix(in srgb, var(--ui-surface-2) 78%, var(--ui-surface-3)); }
  .drug-name, .bag-concentration, .delivered-result { color: var(--ui-text-100); font-size: 14px; line-height: 1.4; }
  .drug-name, .result-table strong { font-weight: 750; }
  .bag-concentration, .delivered-result { font-variant-numeric: tabular-nums; }
  .result-unit { white-space: nowrap; }
  .mobile-result-label { display: none; }
  .dose-deviation { color: var(--ui-text-200); font-size: 12px; white-space: normal; }
  .draw-volume { text-align: right; }
  .draw-amount { font-size: 18px; }
  .calculation-body { display: grid; gap: 8px; }
  .calculation-step { display: grid; gap: 6px; min-width: 0; padding: 10px; }
  .calculation-step h4 { margin: 0; }
  .large-error { font-weight: 700; color: var(--ui-text-100); }
  @media (min-width: 1024px) {
    .calculation-body { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 767px) {
    .bag-settings-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .output-column.awaiting-calculation { display: none; }
    .drug-row { grid-template-columns: minmax(0, 0.75fr) minmax(0, 1.25fr) 36px; }
    .drug-row + .drug-row { border-top: 1px solid var(--ui-divider); padding-top: 8px; }
    .drug-row:not(.has-column-labels) .row-label {
      position: static;
      width: auto;
      height: auto;
      overflow: visible;
      clip-path: none;
    }
    .medication-fields { grid-column: 1 / -2; grid-row: 1; }
    .dose-field, .unit-field { grid-row: 2; }
    .unit-field .field-select { padding-right: 1.2rem; background-position: right 0.3rem center; }
    .remove-drug { grid-column: -2; grid-row: 1; width: 36px; min-height: 40px; }
    .custom-medication .medication-fields {
      grid-column: 1 / -1;
      grid-template-columns: minmax(88px, 0.8fr) minmax(0, 1.5fr) minmax(72px, 0.85fr);
      gap: 6px;
    }
    .custom-medication .remove-drug { grid-row: 2; }
    .custom-medication .medication-fields .field-select { padding-left: 6px; }
    .drug-row .field-control, .drug-row .field-select { min-height: 40px; padding-block: 4px; }
    .drug-actions { flex-wrap: wrap; }
    .add-drug { min-height: 40px; }
    .calculate-button { display: inline-flex; min-height: 40px; border-color: var(--ui-accent-border); background: var(--ui-accent-surface); }
    .prep-timing { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; gap: 8px; }
    .timing-metric { display: block; }
    .timing-metric + .timing-metric { padding-inline-start: 8px; }
    .result-headings {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .draw-result {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: baseline;
      gap: 4px 8px;
    }
    .draw-result:first-child { border-top: 0; }
    .bag-concentration, .delivered-result { grid-column: 1 / -1; }
    .mobile-result-label { display: inline; color: var(--ui-text-200); margin-right: 4px; }
    .draw-volume { grid-column: 2; grid-row: 1; }
  }
</style>
