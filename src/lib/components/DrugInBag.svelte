<script lang="ts">
  import SegmentedToggle from './SegmentedToggle.svelte';
  import ToolDisclosure from './ToolDisclosure.svelte';
  import { onMount, tick } from 'svelte';
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
  let drugs: Drug[] = [blankDrug(), blankDrug()];
  let bagVolumeMl: Input = '';
  let duration: Input = '';
  let rate: Input = '';
  let mode: 'duration' | 'rate' = 'rate';
  let rateIncrement: 1 | 0.1 = 1;
  let isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  let settingsOpen = false;
  let submittedInput: string | null = null;
  onMount(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => isMobile = media.matches;
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });
  $: if (!isMobile && drugs.length && drugs.every(drug => drug.id !== '' && positive(drug.dose) && (drug.id !== CUSTOM_MEDICATION_ID || positive(drug.concentration)))) {
    drugs = [...drugs, blankDrug()];
  }
  const units: DoseUnit[] = ['mg/kg/day', 'mg/kg/hr', 'mg/kg/min', 'mcg/kg/hr', 'mcg/kg/min'];
  const positive = (value: Input | null): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const fmt = (value: number, digits = 3) => value !== 0 && Math.abs(value) < 0.001 ? Number(value.toPrecision(3)).toString() : Number(value.toFixed(digits)).toString();
  const volume = (value: number) => value > 0 && value < 0.000001 ? value.toPrecision(3) : fmt(value, 6);
  const calculationNumber = (value: number) => Math.abs(value) < 1
    ? Number(value.toPrecision(3)).toString()
    : fmt(value, 2);

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
    if (!sharedReady) settingsOpen = true;
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

<section class="ui-tool-stack drugbag-layout text-slate-200" aria-label="Drug in bag calculator">
  <div class="ui-tool-stack input-column">
  <article class="ui-card ui-card-padding bag-settings">
    <div class="bag-settings-header">
      <div><span class="ui-label-strong">Bag settings</span><span class="ui-meta settings-summary">{bagVolumeMl || '—'} mL · {mode === 'rate' ? `${rate || '—'} mL/hr` : `${duration || '—'} hr`}</span></div>
      <button class="ui-button ui-action-quiet settings-toggle" type="button" aria-label="Bag settings" aria-expanded={settingsOpen} aria-controls="drugbag-settings" on:click={() => settingsOpen = !settingsOpen}>
        <svg width="18" height="18" viewBox="0 0 20 20" class:expanded={settingsOpen} aria-hidden="true"><path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" /></svg>
      </button>
    </div>
    <div class="bag-settings-fields" class:is-collapsed={!settingsOpen} id="drugbag-settings">
    <div class="settings-controls">
      <fieldset class="precision-control" aria-label="Pump rate precision">
        <legend>Pump rate precision</legend>
        <SegmentedToggle label="Pump rate precision" first="1 mL/hr" second="0.1 mL/hr" secondSelected={rateIncrement === 0.1} onToggle={precise => rateIncrement = precise ? 0.1 : 1} />
      </fieldset>
      <fieldset class="precision-control" aria-label="Calculation mode">
        <legend>Calculation mode</legend>
        <SegmentedToggle label="Calculation mode" first="Duration" second="Rate" secondSelected={mode === 'rate'} onToggle={rateMode => mode = rateMode ? 'rate' : 'duration'} />
      </fieldset>
    </div>
    <div class="field">
      <label class="ui-label" for="drugbag-bag">Volume <span class="normal-case">(mL)</span></label>
      <input id="drugbag-bag" class="field-control" type="number" min="0" step="any" bind:value={bagVolumeMl} inputmode="decimal" placeholder="100 mL" />
    </div>
    <div class="field">
      <label class="ui-label" for="drugbag-time">{mode === 'duration' ? 'Duration' : 'Rate'} <span class="normal-case">({mode === 'duration' ? 'hr' : 'mL/hr'})</span></label>
      {#if mode === 'duration'}
        <input id="drugbag-time" class="field-control" type="number" min="0" step="any" bind:value={duration} inputmode="decimal" placeholder="12 hr" />
      {:else}
        <input id="drugbag-time" class="field-control" type="number" min="0" step="any" bind:value={rate} inputmode="decimal" placeholder="mL/hr" />
      {/if}
    </div>
    </div>
  </article>

  <div class="drug-grid">
    {#each drugs as drug, index (drug.key)}
      <article class="ui-card ui-card-padding drug-card" aria-label={`Medication ${index + 1}`}>
<button class="ui-button ui-action-quiet remove-drug" type="button" disabled={drugs.length === 1} aria-label={`Remove medication ${index + 1}`} on:click={() => drugs = drugs.filter(item => item.key !== drug.key)}>×</button>
        <div class="field medication-field">
          <label class="ui-label" for={`drugbag-drug-${drug.key}`}>Medication {index + 1}</label>
          <div class="medication-controls">
            <select id={`drugbag-drug-${drug.key}`} class="field-select" bind:value={drug.id} on:change={() => selectDrug(drug)}>
              <option value="">Select medication</option>
              <option value={CUSTOM_MEDICATION_ID}>Custom</option>
              {#each MEDICATIONS as option}
                <option value={option.id}>{option.name} — {option.concentration.value} {option.concentration.units}</option>
              {/each}
            </select>
          </div>
        </div>
        {#if drug.id === CUSTOM_MEDICATION_ID}
          <div class="custom-fields">
            <div class="field">
              <label class="ui-label" for={`drugbag-name-${drug.key}`}>Drug name</label>
              <input id={`drugbag-name-${drug.key}`} class="field-control" bind:value={drug.name} placeholder="Medication" />
            </div>
            <div class="field">
              <label class="ui-label" for={`drugbag-stock-${drug.key}`}>Stock <span class="normal-case">(mg/mL)</span></label>
              <input id={`drugbag-stock-${drug.key}`} class="field-control" type="number" min="0" step="any" bind:value={drug.concentration} inputmode="decimal" />
            </div>
          </div>
        {/if}
        <div class="field dose-field">
          <label class="ui-label" for={`drugbag-dose-${drug.key}`}>Dose</label>
          <div class="dose-fields">
            <input id={`drugbag-dose-${drug.key}`} class="field-control" type="number" min="0" step="any" bind:value={drug.dose} inputmode="decimal" placeholder="Dose" />
            <select class="field-select" bind:value={drug.unit} aria-label={`Dose unit ${index + 1}`}>
              {#each units as unit}<option value={unit}>{unit}</option>{/each}
            </select>
          </div>
        </div>
      </article>
    {/each}
  </div>
  <div class="drug-actions">
    <button class="ui-button ui-action-quiet add-drug" aria-label="Add medication" title="Add medication" type="button" on:click={addDrug}><span aria-hidden="true">+</span><span class="add-label">Add medication</span></button>
    <button class="ui-button calculate-button" type="button" on:click={calculate}>Calculate</button>
  </div>

  </div>
  <div class="ui-tool-stack output-column" class:awaiting-calculation={submittedInput === null}>
  {#if outcome?.error}
    <div class="ui-alert border-amber-300/30 bg-amber-950/40 text-amber-100" role="alert">{outcome.error}</div>
  {:else if plan}
    <article class="ui-card overflow-hidden" aria-label="Bag preparation">
      <div class="ui-card-padding">
        <div class="ui-label-strong">Instruction</div>
        <div class="ui-instruction mt-1.5">Remove <strong class="ui-statement-value" data-testid="drugbag-removal">{removalVolume} mL</strong> from the bag, then add:</div>
      </div>
      <div class="results-grid ui-card-padding">
        {#each active as result}
          <div class="draw-result ui-inset">
            <div class="drug-result-description">
            <div class="ui-label-strong">{result.name}</div>
            <div class="ui-meta-compact delivered-result">Delivers {fmt(result.delivered!)} {result.drug.unit}{#if Math.abs(result.errorPct) > DOSE_TARGET_PCT + 1e-9}{' '}<span class:large-error={Math.abs(result.errorPct) > DOSE_REVIEW_PCT + 1e-9}>({deviation(result.errorPct)}{Math.abs(result.errorPct) > DOSE_REVIEW_PCT + 1e-9 ? '; exceeds 5%' : ''})</span>{/if}</div>
            </div>
            <div class="ui-result-value draw-volume">{volume(result.draw!)} <span class="ui-unit">mL</span></div>
          </div>
        {/each}
      </div>
      <div class="bag-summary border-t ui-rule">
        <div class="ui-card-padding"><div class="ui-label-strong">Run at</div><div class="ui-result-value mt-1.5">{fmt(pumpRate!, 1)} <span class="ui-unit">mL/hr</span></div></div>
        <div class="ui-card-padding"><div class="ui-label-strong">Lasts</div><div class="ui-result-value mt-1.5">{fmt(runtime!, 1)} <span class="ui-unit">hours</span></div></div>
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
  .bag-settings-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: end; gap: 12px; }
  .bag-settings-header, .calculate-button { display: none; }
  .drug-actions { display: contents; }
  .settings-controls { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: end; gap: 12px; }
  .add-drug { justify-self: start; gap: 6px; }
  .add-drug > span:first-child { font-size: 20px; line-height: 1; }
  .drug-grid { display: grid; gap: 12px; min-width: 0; }
  .drug-card { position: relative; display: grid; gap: 12px; min-width: 0; }
  .dose-fields { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
  .custom-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .medication-controls { min-width: 0; }
  .medication-field > label { padding-right: 34px; }
  .remove-drug { position: absolute; top: 4px; right: 4px; width: 24px; min-height: 24px; z-index: 1; padding: 0; font-size: 20px; line-height: 1; }
  .results-grid { display: grid; min-width: 0; gap: 8px; padding-top: 0; }
  .draw-result { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 10px; overflow-wrap: anywhere; }
  .drug-result-description { display: grid; gap: 6px; min-width: 0; }
  .draw-volume { text-align: right; white-space: nowrap; }
  .bag-summary { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bag-summary > div + div { border-left: 1px solid var(--ui-result-divider); }
  .calculation-body { display: grid; gap: 8px; }
  .calculation-step { display: grid; gap: 6px; min-width: 0; padding: 10px; }
  .calculation-step h4 { margin: 0; }
  .large-error { font-weight: 700; color: var(--ui-text-100); }
  .precision-control { border: 0; padding: 0; margin: 0; min-width: 0; font-size: 12px; color: var(--ui-text-200); }
  .precision-control legend { width: 100%; margin-bottom: 6px; padding: 0; text-align: center; font-weight: 900; text-transform: uppercase; letter-spacing: 0.025em; line-height: 1; }
  @media (max-width: 767px) {
    .bag-settings { padding: 8px; }
    .bag-settings-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .settings-summary { display: block; margin-top: 2px; }
    .settings-toggle { min-height: 32px; width: 32px; padding: 0; align-self: flex-start; }
    .settings-toggle svg.expanded { transform: rotate(180deg); }
    .bag-settings-fields { margin-top: 8px; gap: 8px; }
    .bag-settings-fields.is-collapsed, .output-column.awaiting-calculation { display: none; }
    .settings-controls { grid-template-columns: 1fr; }
    .precision-control { width: 100%; }
    .drug-card { gap: 8px; padding: 8px; }
    .drug-card .field-control, .drug-card .field-select { min-height: 40px; padding-block: 4px; }
    .remove-drug { top: 0; right: 0; width: 28px; min-height: 28px; font-size: 18px; border-radius: 0 8px 0 8px; }
    .medication-field > label { min-height: 14px; padding-right: 28px; }
    .drug-actions { display: grid; gap: 8px; }
    .add-drug { justify-self: end; min-height: 36px; font-size: 12px; }
    .calculate-button { display: inline-flex; justify-self: center; width: min(100%, 15rem); min-height: 44px; font-size: 16px; border-color: var(--ui-accent-border); background: var(--ui-accent-surface); }

  }
  @media (max-width: 399px) {
    .custom-fields { grid-template-columns: 1fr; }
  }
  @media (min-width: 1024px) {
    .custom-fields { grid-template-columns: minmax(0, 15rem) minmax(0, 12rem); }
    .drugbag-layout { grid-template-columns: minmax(0, 31rem) minmax(0, 1fr); align-items: start; }
    .input-column, .output-column { align-content: start; }
    .calculation-column { min-width: 0; }
    .drug-card { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: end; }
    .medication-field { grid-column: 1; grid-row: 1; }
    .dose-field { grid-column: 2; grid-row: 1; }
    .dose-field > label { padding-right: 34px; }
    .custom-fields { grid-column: 1 / -1; }
  }
  @media (min-width: 768px) and (max-width: 1023px) {
    .drug-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
