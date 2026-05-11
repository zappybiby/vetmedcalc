<script lang="ts">
  import { patient } from '../stores/patient';

  type WeightInput = number | '' | undefined;

  let weight: WeightInput = $patient.weightKg ?? '';

  function normalizeWeight(value: WeightInput): number | null {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  $: patient.update(prev => {
    const weightKg = normalizeWeight(weight);
    return prev.weightKg === weightKg ? prev : { ...prev, weightKg };
  });
</script>

<aside
  class="ui-panel ui-panel-contrast mx-auto w-full max-w-[360px] min-w-0 p-2 text-slate-100 sm:max-w-[390px] sm:p-2.5"
  aria-label="Patient weight"
>
  <label class="patient-weight-field grid min-w-0 gap-1.5">
    <span class="ui-label">Weight (kg)</span>
    <input
      id="patient-weight"
      class="field-control patient-weight-input"
      type="number"
      min="0"
      step="0.1"
      bind:value={weight}
      inputmode="decimal"
    />
  </label>
</aside>

<style>
  .patient-weight-input {
    min-height: 3rem;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    font-size: 1.4rem;
    font-weight: 800;
    line-height: 1;
  }
</style>
