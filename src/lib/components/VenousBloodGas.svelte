<script lang="ts">
  import {
    VENOUS_BLOOD_GAS_REFERENCE_RANGES,
    type VenousBloodGasAnalyteId,
    type VenousBloodGasReferenceInterval,
  } from '@defs';
  import { interpretVenousBloodGas, type ComponentState, type VenousBloodGasInterpretation, type VenousBloodGasValues } from '../helpers/venousBloodGas';
  import { patient, type Patient, type Species } from '../stores/patient';

  type RawBloodGasValues = Record<VenousBloodGasAnalyteId, string>;
  type BloodGasField = {
    id: VenousBloodGasAnalyteId;
    required: boolean;
    step: string;
    min?: string;
  };

  const speciesOptions: readonly { value: Species; label: string }[] = [
    { value: 'dog', label: 'Dog' },
    { value: 'cat', label: 'Cat' },
  ];

  const fields: readonly BloodGasField[] = [
    { id: 'pH', required: true, step: '0.01', min: '0' },
    { id: 'PvCO2', required: true, step: '0.1', min: '0' },
    { id: 'HCO3', required: true, step: '0.1', min: '0' },
    { id: 'BEecf', required: true, step: '0.1' },
    { id: 'TCO2', required: false, step: '0.1', min: '0' },
    { id: 'PvO2', required: false, step: '0.1', min: '0' },
  ];

  const acidBaseLabels = {
    ACIDEMIA: 'Acidemia',
    ALKALEMIA: 'Alkalemia',
    WITHIN_RI: 'Within RI',
  };

  const componentLabels = {
    LOW: 'Low',
    NORMAL: 'Within RI',
    HIGH: 'High',
    DISCORDANT: 'Discordant',
    MISSING: 'Missing',
  };

  const primaryProcessLabels = {
    METABOLIC: 'Metabolic',
    RESPIRATORY: 'Respiratory',
    MIXED: 'Mixed',
    NO_PRIMARY_PROCESS: 'None identified',
    INDETERMINATE: 'Indeterminate',
  };

  const disorderLabels = {
    METABOLIC_ACIDOSIS: 'Metabolic acidosis',
    METABOLIC_ALKALOSIS: 'Metabolic alkalosis',
    RESPIRATORY_ACIDOSIS: 'Respiratory acidosis',
    RESPIRATORY_ALKALOSIS: 'Respiratory alkalosis',
    MIXED_ACIDOSIS_PATTERN: 'Mixed acidosis pattern',
    MIXED_ALKALOSIS_PATTERN: 'Mixed alkalosis pattern',
    NO_ACID_BASE_DISORDER: 'No acid-base disorder',
    INDETERMINATE: 'Indeterminate',
  };

  const compensationLabels = {
    NO_COMPENSATION: 'No compensation',
    PARTIAL_COMPENSATION: 'Partial compensation',
    COMPLETE_COMPENSATION: 'Complete compensation',
    NOT_APPLICABLE: 'Not applicable',
    INDETERMINATE: 'Indeterminate',
  };

  const confidenceLabels = {
    STANDARD: 'Standard',
    MODERATE: 'Moderate',
    LOW: 'Low',
  };

  const noteLabels = {
    METABOLIC_COMPONENT_DISCORDANT: 'Metabolic markers are discordant.',
    PRIMARY_PROCESS_UNCERTAIN: 'Primary process is uncertain from these values.',
    PH_WITHIN_RI_WITH_ISOLATED_COMPONENT_ABNORMALITY: 'pH is within RI with an abnormal component.',
    QUALITATIVE_COMPENSATION_ASSESSMENT: 'Compensation assessment is qualitative for cats.',
    RESPIRATORY_RESPONSE_APPROPRIATE: 'pCO2 fits expected dog compensation.',
    RESPIRATORY_RESPONSE_ABOVE_EXPECTED: 'pCO2 is above expected dog compensation.',
    RESPIRATORY_RESPONSE_BELOW_EXPECTED: 'pCO2 is below expected dog compensation.',
    METABOLIC_RESPONSE_APPROPRIATE: 'HCO3 fits expected dog compensation.',
    METABOLIC_RESPONSE_ABOVE_EXPECTED: 'HCO3 is above expected dog compensation.',
    METABOLIC_RESPONSE_BELOW_EXPECTED: 'HCO3 is below expected dog compensation.',
    VENOUS_OXYGEN_NOT_INTERPRETED: 'Venous pO2 is not interpreted for oxygenation.',
    POSSIBLE_AIR_CONTAMINATION: 'Pattern can occur with air contamination.',
  };

  function createEmptyValues(): RawBloodGasValues {
    return {
      pH: '',
      PvCO2: '',
      HCO3: '',
      BEecf: '',
      TCO2: '',
      PvO2: '',
    };
  }

  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  let selectedSpecies: Species = 'dog';
  let speciesTouched = false;
  $: if (!speciesTouched && p.species) {
    selectedSpecies = p.species;
  }

  let rawValues: RawBloodGasValues = createEmptyValues();
  let referenceRanges: Record<VenousBloodGasAnalyteId, VenousBloodGasReferenceInterval> = VENOUS_BLOOD_GAS_REFERENCE_RANGES[selectedSpecies];
  $: referenceRanges = VENOUS_BLOOD_GAS_REFERENCE_RANGES[selectedSpecies];

  function selectSpecies(species: Species): void {
    selectedSpecies = species;
    speciesTouched = true;
  }

  function updateRawValue(id: VenousBloodGasAnalyteId, event: Event): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    rawValues = { ...rawValues, [id]: target.value };
  }

  function numeric(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  let values: VenousBloodGasValues = {};
  $: values = {
    pH: numeric(rawValues.pH),
    PvCO2: numeric(rawValues.PvCO2),
    HCO3: numeric(rawValues.HCO3),
    BEecf: numeric(rawValues.BEecf),
    TCO2: numeric(rawValues.TCO2),
    PvO2: numeric(rawValues.PvO2),
  };

  let hasAnyInput = false;
  $: hasAnyInput = fields.some((field) => rawValues[field.id].trim() !== '');

  let missingRequiredLabels: string[] = [];
  $: missingRequiredLabels = fields
    .filter((field) => field.required && values[field.id] == null)
    .map((field) => referenceRanges[field.id].label);

  let result: VenousBloodGasInterpretation | null = null;
  $: result = missingRequiredLabels.length === 0 ? interpretVenousBloodGas(selectedSpecies, values) : null;

  function clearValues(): void {
    rawValues = createEmptyValues();
  }

  function formatRangeValue(value: number, id: VenousBloodGasAnalyteId): string {
    if (id === 'pH') return value.toFixed(2);
    return Number.isInteger(value) ? value.toFixed(0) : value.toString();
  }

  function formatRange(id: VenousBloodGasAnalyteId, range: VenousBloodGasReferenceInterval): string {
    const unit = range.unit ? ` ${range.unit}` : '';
    return `${formatRangeValue(range.low, id)} to ${formatRangeValue(range.high, id)}${unit}`;
  }

  function fieldLabel(field: BloodGasField, range: VenousBloodGasReferenceInterval): string {
    const label = range.label;
    return field.required ? label : `${label} (optional)`;
  }

  function formatList(labels: string[]): string {
    if (labels.length <= 1) return labels[0] ?? '';
    return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
  }

  function stateClass(state: ComponentState): string {
    const base = 'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold';
    if (state === 'NORMAL') return `${base} border-emerald-300/25 bg-emerald-950/35 text-emerald-100`;
    if (state === 'LOW' || state === 'HIGH') return `${base} border-amber-300/30 bg-amber-950/40 text-amber-100`;
    if (state === 'DISCORDANT') return `${base} border-rose-300/30 bg-rose-950/40 text-rose-100`;
    return `${base} border-slate-600/40 bg-surface-sunken text-slate-300`;
  }
</script>

<section class="grid min-w-0 gap-2 text-slate-200 sm:gap-3" aria-label="Venous blood gas">
  <div class="grid min-w-0 gap-2 sm:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(310px,0.72fr)]">
    <article class="ui-card min-w-0 p-2.5 sm:p-3">
      <div class="flex min-w-0 items-center justify-between gap-2">
        <h2 class="text-[13px] font-black uppercase text-slate-200 sm:text-sm">Values</h2>
        <button
          type="button"
          class="ui-button px-2 py-1 text-xs"
          on:click={clearValues}
          disabled={!hasAnyInput}
        >
          Clear
        </button>
      </div>

      <div class="mt-2 grid min-w-0 gap-2 sm:mt-3 sm:gap-3 md:grid-cols-2">
        <div class="grid min-w-0 gap-1.5 md:col-span-2">
          <div class="text-xs font-semibold uppercase text-slate-300" id="venous-bg-species-label">Species</div>
          <div class="grid min-w-0 grid-cols-2 gap-1.5" role="group" aria-labelledby="venous-bg-species-label">
            {#each speciesOptions as option (option.value)}
              <button
                type="button"
                class={`rounded-md border px-3 py-2 text-sm font-semibold transition-colors ${selectedSpecies === option.value ? 'border-sky-400/60 bg-sky-400/15 text-slate-100' : 'border-slate-700/50 bg-surface-sunken text-slate-300 hover:border-slate-600/70'}`}
                aria-pressed={selectedSpecies === option.value}
                on:click={() => selectSpecies(option.value)}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>

        {#each fields as field (field.id)}
          <label class="grid min-w-0 gap-1.5">
            <span class="flex min-w-0 flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <span class="text-xs font-semibold uppercase text-slate-300">{fieldLabel(field, referenceRanges[field.id])}</span>
              <span class="text-[11px] font-medium text-slate-400">RI {formatRange(field.id, referenceRanges[field.id])}</span>
            </span>

            {#if referenceRanges[field.id].unit}
              <span class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <input
                  class="field-control"
                  type="number"
                  min={field.min}
                  step={field.step}
                  inputmode="decimal"
                  aria-label={fieldLabel(field, referenceRanges[field.id])}
                  value={rawValues[field.id]}
                  on:input={(event) => updateRawValue(field.id, event)}
                />
                <span class="text-xs font-semibold text-slate-400">{referenceRanges[field.id].unit}</span>
              </span>
            {:else}
              <input
                class="field-control"
                type="number"
                min={field.min}
                step={field.step}
                inputmode="decimal"
                aria-label={fieldLabel(field, referenceRanges[field.id])}
                value={rawValues[field.id]}
                on:input={(event) => updateRawValue(field.id, event)}
              />
            {/if}
          </label>
        {/each}
      </div>
    </article>

    <article class="ui-card min-w-0 p-2.5 sm:p-3" aria-live="polite">
      <h2 class="text-[13px] font-black uppercase text-slate-200 sm:text-sm">Result</h2>

      {#if result}
        <div class="mt-2 grid gap-2 sm:mt-3">
          <div class="ui-inset p-3">
            <div class="text-xs font-semibold uppercase text-slate-400">Disorder</div>
            <div class="mt-1 text-2xl font-black leading-tight text-slate-100">{disorderLabels[result.disorder]}</div>
            <div class="mt-1 text-sm font-semibold text-slate-300">{acidBaseLabels[result.acidBaseStatus]}</div>
          </div>

          <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <div class="ui-inset p-3">
              <div class="text-xs font-semibold uppercase text-slate-400">Primary process</div>
              <div class="mt-1 text-lg font-black text-slate-100">{primaryProcessLabels[result.primaryProcess]}</div>
            </div>

            <div class="ui-inset p-3">
              <div class="text-xs font-semibold uppercase text-slate-400">Compensation</div>
              <div class="mt-1 text-lg font-black text-slate-100">{compensationLabels[result.compensationStatus]}</div>
            </div>
          </div>

          <div class="ui-inset p-3">
            <div class="grid gap-2 text-sm">
              <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span class="text-slate-300">Respiratory</span>
                <span class={stateClass(result.respiratoryComponent)}>{componentLabels[result.respiratoryComponent]}</span>
              </div>
              <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span class="text-slate-300">Metabolic</span>
                <span class={stateClass(result.metabolicComponent)}>{componentLabels[result.metabolicComponent]}</span>
              </div>
              <div class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                <span class="text-slate-300">Confidence</span>
                <span class="font-black text-slate-100">{confidenceLabels[result.confidence]}</span>
              </div>
            </div>
          </div>

          {#if result.notes.length}
            <div class="rounded-lg border border-amber-300/30 bg-amber-950/35 px-3 py-2 text-sm text-amber-100">
              <ul class="grid gap-1">
                {#each result.notes as note}
                  <li>{noteLabels[note]}</li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {:else if hasAnyInput}
        <div class="mt-2 rounded-lg border border-amber-300/30 bg-amber-950/40 px-3 py-2 text-sm font-semibold text-amber-100 sm:mt-3">
          Enter {formatList(missingRequiredLabels)}.
        </div>
      {:else}
        <div class="mt-2 ui-inset px-3 py-2 text-sm text-slate-400 sm:mt-3">
          Enter pH, pCO2, HCO3, and base excess.
        </div>
      {/if}
    </article>
  </div>
</section>
