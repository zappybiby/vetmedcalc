<script lang="ts">
  import { patient } from '../stores/patient';
  import type { Species, Patient } from '../stores/patient';

  // bind to local fields, then sync to store reactively
  let current: Patient = $patient; // initialize immediately to avoid undefined
  $: current = $patient; // keep in sync reactively
  let weight = current.weightKg ?? '';
  let species: Species | '' = current.species ?? '';
  let name = current.name ?? '';

  // keep store in sync with inputs
  $: patient.update(p => ({
    ...p,
    weightKg: weight === '' ? null : Number(weight),
    species,
    name
  }));
</script>

<aside class="panel" aria-label="Patient inputs">
  <h2 class="panel__title">Patient</h2>

  <div class="field">
    <label for="weight">Weight (kg)</label>
    <input id="weight" type="number" min="0" step="0.1" bind:value={weight} inputmode="decimal" />
  </div>

  <div class="field">
    <label for="species">Species</label>
    <select id="species" bind:value={species}>
      <option value="" disabled selected>Select…</option>
      <option value="dog">Dog</option>
      <option value="cat">Cat</option>
    </select>
  </div>

  <div class="field">
    <label for="name">Patient name (optional)</label>
    <input id="name" type="text" placeholder="e.g., Bella" bind:value={name} />
  </div>
</aside>

<style>
  .panel {
    position: sticky;
    top: 1rem;
    align-self: start;
    background: #111827;
    border: 2px solid #e5e7eb;
    border-radius: .5rem;
    padding: .75rem .9rem;
    box-shadow: 2px 2px 0 #0b0b0b;
    color: #e5e7eb;
  }
  .panel__title {
    font-size: 0.95rem;
    margin: 0 0 .5rem 0;
    letter-spacing: .02em;
  }
  .field { display: grid; gap: .25rem; margin-bottom: .6rem; }
  label { font-size: .8rem; font-weight: 600; }
  input, select {
    border: 1.5px solid #e5e7eb; border-radius: .4rem; padding: .4rem .5rem; font-size: .95rem;
    background: #0b1220; color: #e5e7eb;
  }
</style>
