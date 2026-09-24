<script lang="ts">
  import { tick } from 'svelte';
  import { patient } from '../stores/patient';
  import { CUSTOM_MEDICATION_ID, MEDICATIONS, SYRINGES, getDefaultMedicationDoseUnit } from '@defs';
  import type { DoseUnit } from '@defs';

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
  let mode: 'duration' | 'rate' = 'duration';
  let allowTenths = false;
  $: if (drugs.length && drugs.every(drug => drug.id !== '' && positive(drug.dose) && (drug.id !== CUSTOM_MEDICATION_ID || positive(drug.concentration)))) {
    drugs = [...drugs, blankDrug()];
  }
  const units: DoseUnit[] = ['mg/kg/day', 'mg/kg/hr', 'mg/kg/min', 'mcg/kg/hr', 'mcg/kg/min'];
  const positive = (value: Input | null): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
  const fmt = (value: number, digits = 3) => Number(value.toFixed(digits)).toString();
  const volume = (value: number) => value > 0 && value < 0.000001 ? value.toPrecision(3) : fmt(value, 6);

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
  $: hours = mode === 'duration' ? (positive(duration) ? duration : null)
    : positive(bagVolumeMl) && positive(rate) ? bagVolumeMl / rate : null;
  $: requestedRate = mode === 'rate' ? (positive(rate) ? rate : null)
    : positive(bagVolumeMl) && positive(hours) ? bagVolumeMl / hours : null;
  $: pumpRate = requestedRate == null ? null : Math.round(requestedRate * (allowTenths ? 10 : 1)) / (allowTenths ? 10 : 1);
  $: runtime = positive(pumpRate) && positive(bagVolumeMl) ? bagVolumeMl / pumpRate : null;
  $: sharedReady = positive($patient.weightKg) && positive(bagVolumeMl) && positive(hours) && positive(pumpRate);
  $: results = drugs.map(drug => {
    const med = MEDICATIONS.find(m => m.id === drug.id);
    const custom = drug.id === CUSTOM_MEDICATION_ID;
    const name = custom ? drug.name.trim() || 'Custom' : med?.name || 'Medication';
    const concentration = custom ? drug.concentration : med
      ? med.concentration.value / (med.concentration.units === 'mcg/mL' ? 1000 : 1) : null;
    const started = drug.id !== '' || drug.dose !== '' && drug.dose != null;
    const valid = sharedReady && positive(drug.dose) && positive(concentration);
    const amount = valid ? Number(drug.dose) * $patient.weightKg! * hours! * factor(drug.unit) : null;
    const rawDraw = amount == null ? null : amount / Number(concentration);
    const syringe = SYRINGES.find(syringe => syringe.sizeCc >= (rawDraw ?? 0)) ?? SYRINGES[SYRINGES.length - 1];
    const draw = rawDraw == null ? null : Number((Math.round(rawDraw * (1 / syringe.incrementMl)) / (1 / syringe.incrementMl)).toFixed(2));
    const delivered = draw == null ? null : draw * Number(concentration) / Number(bagVolumeMl) * Number(pumpRate) / $patient.weightKg! / factor(drug.unit);
    return { drug, name, concentration, started, valid, amount, rawDraw, syringe, draw, delivered };
  });
  $: active = results.filter(result => result.started);
  $: totalDraw = active.reduce((sum, result) => sum + (result.draw ?? 0), 0);
  $: ready = sharedReady && active.length > 0 && active.every(result => result.valid)
    && Number.isFinite(totalDraw);
  $: fits = ready && totalDraw <= Number(bagVolumeMl);
</script>

<section class="ui-tool-stack drugbag-layout text-slate-200" aria-label="Drug in bag calculator">
  <div class="ui-tool-stack input-column">
  <article class="ui-card ui-card-padding bag-settings">
    <button class="mode-toggle" type="button" role="switch" aria-label="Enter pump rate instead of duration" aria-checked={mode === 'rate'} on:click={() => mode = mode === 'duration' ? 'rate' : 'duration'}><span class="toggle-dot" class:enabled={mode === 'rate'} aria-hidden="true"></span>Change to {mode === 'duration' ? 'Rate' : 'Duration'} Mode</button>
    <div class="field">
      <label class="ui-label" for="drugbag-bag">Final bag volume <span class="normal-case">(mL)</span></label>
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
    <button class="ui-button add-drug" aria-label="Add medication" title="Add medication" type="button" on:click={addDrug}><span aria-hidden="true">+</span><span class="add-label">Add medication</span></button>
  </article>

  <div class="drug-grid">
    {#each drugs as drug, index (drug.key)}
      <article class="ui-card ui-card-padding drug-card" aria-label={`Medication ${index + 1}`}>
        <div class="medication-heading">
          <label class="ui-label" for={`drugbag-drug-${drug.key}`}>Medication {index + 1}</label>
          <button class="remove-drug" type="button" disabled={drugs.length === 1} aria-label={`Remove medication ${index + 1}`} on:click={() => drugs = drugs.filter(item => item.key !== drug.key)}>×</button>
        </div>
        <select id={`drugbag-drug-${drug.key}`} class="field-select" bind:value={drug.id} on:change={() => selectDrug(drug)}>
          <option value="">Select medication</option>
          <option value={CUSTOM_MEDICATION_ID}>Custom</option>
          {#each MEDICATIONS as option}
            <option value={option.id}>{option.name} — {option.concentration.value} {option.concentration.units}</option>
          {/each}
        </select>
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
        <div class="field">
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

  </div>
  <div class="ui-tool-stack output-column">
  <div class="precision-control">
    <button class="mode-toggle" type="button" role="switch" aria-label="Allow tenths of mL/hr" aria-checked={allowTenths} on:click={() => allowTenths = !allowTenths}><span class="toggle-dot" class:enabled={allowTenths} aria-hidden="true"></span>{allowTenths ? '0.1 mL/hr' : 'Whole mL/hr'}</button>
  </div>
  {#if requestedRate != null && pumpRate === 0}
    <p class="ui-meta" role="status">Rate is below the selected pump increment.</p>
  {/if}
  {#if ready && !fits}
    <div class="ui-card ui-card-padding" role="alert">Drug volumes total {volume(totalDraw)} mL, exceeding the {bagVolumeMl} mL bag. Increase the final bag volume or change the preparation.</div>
  {:else if fits}
    <article class="ui-card ui-card-padding" aria-label="Bag preparation">
      <div class="ui-instruction">Remove <strong class="ui-statement-value">{volume(totalDraw)} mL</strong> from the bag, then add:</div>
      <div class="drug-grid results-grid">
        {#each active as result}
          <div class="ui-inset draw-result">
            <div class="ui-label-strong">{result.name}</div>
            <div class="ui-result-value">{volume(result.draw!)} <span class="ui-unit">mL</span></div>
            <div class="ui-meta-compact delivered-result">Delivers {fmt(result.delivered!)} {result.drug.unit}</div>
          </div>
        {/each}
      </div>
      <div class="ui-instruction mt-2">Run at <strong class="ui-statement-value">{fmt(pumpRate!, 1)} mL/hr</strong>, which lasts <strong>{fmt(runtime!, 1)} hours</strong></div>
    </article>
  {:else if sharedReady && active.length > 0}
    <p class="ui-meta" role="status">Enter a medication, positive dose and stock concentration for each started card to calculate the complete bag.</p>
  {/if}

  {#if fits}
    <details class="group ui-card overflow-hidden">
      <summary class="ui-summary ui-card-padding flex cursor-pointer items-center justify-between gap-3">
        <span class="ui-section-title">Step-By-Step calculations</span>
        <span class="transition group-open:rotate-180" aria-hidden="true">⌄</span>
      </summary>
      <div class="border-t ui-rule ui-card-padding calculation-body">
        <div class="calculation-step"><strong>1. Pump rate</strong> <div class="ui-formula">{#if mode === 'duration'}{bagVolumeMl} mL ÷ {hours} hr = {fmt(requestedRate!)} → {fmt(pumpRate!, 1)} mL/hr{:else}{rate} → {fmt(pumpRate!, 1)} mL/hr{/if} · {bagVolumeMl} ÷ {fmt(pumpRate!, 1)} = {fmt(runtime!, 1)} hr</div></div>
        <div class="calculation-step"><strong>2. Drug volumes</strong>
          {#each active as result}
            <div class="calculation-drug">
              <div class="ui-formula"><strong>{result.name}</strong> · {result.drug.dose} {result.drug.unit} × {$patient.weightKg} kg × {fmt(hours!)} hr{conversion(result.drug.unit)} = {volume(result.amount!)} mg</div>
              <div class="ui-formula">{volume(result.amount!)} ÷ {fmt(Number(result.concentration), 6)} mg/mL = {volume(result.rawDraw!)} → <strong>{volume(result.draw!)} mL</strong> ({result.syringe.sizeCc} cc, {result.syringe.incrementMl} mL ticks)</div>

            </div>
          {/each}
        </div>
        <div class="ui-formula">Dose (mg/kg/hr) = draw × stock × rate ÷ bag ÷ weight.</div>
        <div class="calculation-step"><strong>3. Prepare bag</strong> <div class="ui-formula">Remove {active.map(result => volume(result.draw!)).join(' + ')} = {volume(totalDraw)} mL, then add the drugs.</div></div>
      </div>
    </details>
  {/if}
  </div>
</section>

<style>
  .field { display: grid; gap: 6px; min-width: 0; }
  .bag-settings { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: end; gap: 10px; }
  .add-drug { box-shadow: none; grid-column: 1 / -1; background: #166534; color: #fff; border-color: #15803d; }
  .add-drug > span:first-child { font-size: 20px; line-height: 1; }
  .drug-grid { display: grid; gap: 10px; min-width: 0; }
  .drug-card { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .dose-fields { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
  .custom-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .medication-heading { position: relative; display: flex; align-items: end; padding-right: 28px; }
  .remove-drug { position: absolute; right: 0; bottom: -4px; font-size: 20px; line-height: 24px; min-width: 28px; border-radius: 4px; }
  .remove-drug:disabled { opacity: 0.35; }
  .results-grid { margin-top: 8px; }
  .draw-result { display: grid; gap: 4px; padding: 8px 10px; overflow-wrap: anywhere; }
  .calculation-body { display: grid; gap: 6px; }
  .calculation-step { font-size: 12px; }
  .calculation-step + .calculation-step { border-top: 1px solid var(--ui-border); padding-top: 6px; }
  .calculation-drug { padding: 4px 0; overflow-wrap: anywhere; }
  .calculation-drug + .calculation-drug { border-top: 1px solid var(--ui-border); }
  .mode-toggle { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--ui-field-border); border-radius: 9999px; background: var(--ui-field-bg); color: var(--ui-text-200); padding: 4px 8px; font-size: 12px; font-weight: 600; line-height: 16px; }
  .mode-toggle:focus-visible { outline: 2px solid var(--ui-accent-border); outline-offset: 2px; }
  .bag-settings > .mode-toggle { grid-column: 1 / -1; justify-self: end; }
  .toggle-dot { width: 12px; height: 12px; border-radius: 50%; background: #38bdf8; flex: none; }
  .toggle-dot.enabled { background: #f59e0b; }
  .precision-control { display: flex; justify-content: end; }
  @media (min-width: 1024px) {
    .drugbag-layout { grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr); align-items: start; }
    .input-column, .output-column { align-content: start; }
    .drug-grid { grid-template-columns: 1fr; }
    .drug-card { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: end; column-gap: 10px; }
    .drug-card > div:first-child { grid-column: 1; grid-row: 1; }
    .drug-card > .field { display: contents; }
    .drug-card > .field > label { grid-column: 2; grid-row: 1; }
    .dose-fields { grid-column: 2; grid-row: 2; }
    .bag-settings { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; }
    .add-drug { grid-column: auto; width: 36px; height: 36px; padding: 6px; }
    .add-label { display: none; }
    .drug-card > select { grid-column: 1; grid-row: 2; }
    .drug-card > .field { grid-column: 2; grid-row: 2; }
    .custom-fields { grid-column: 1 / -1; }
    .results-grid { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); }
    .draw-result { grid-template-rows: auto auto 1fr; gap: 3px; padding: 6px; }
    .drug-card { padding: 8px; }
    .input-column > .drug-grid { gap: 8px; }
    .calculation-step:first-child > .ui-formula, .calculation-step:last-child > .ui-formula { display: inline; }
    .draw-result .ui-result-value { font-size: 18px; }
    .delivered-result { grid-column: 1 / -1; }
    .calculation-drug { padding: 3px 0; }
    .output-column > article { padding: 10px; }
    .calculation-body { padding: 8px 10px; }
    .output-column summary { padding-top: 8px; padding-bottom: 8px; }
    .calculation-body, .results-grid { gap: 4px; }
  }
  @media (min-width: 768px) and (max-width: 1023px) {
    .bag-settings { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; }
    .add-drug { grid-column: auto; }
    .drug-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
</style>
