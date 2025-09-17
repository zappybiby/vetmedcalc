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

<aside
  class="self-stretch rounded-md border bg-surface p-3 text-slate-100 shadow-card sm:rounded-lg sm:border-2 sm:p-4 md:sticky md:top-4 md:self-start"
  aria-label="Patient inputs"
>
  <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-200">Patient</h2>

  <div class="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-1 sm:gap-3">
    <div class="flex flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="weight">Weight (kg)</label>
      <input
        id="weight"
        class="rounded-md border border-slate-300/60 bg-surface-sunken px-3 py-2 text-base text-slate-100 shadow-inner placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
        type="number"
        min="0"
        step="0.1"
        bind:value={weight}
        inputmode="decimal"
      />
    </div>

    <div class="flex flex-col gap-2">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="species">Species</label>
      <select
        id="species"
        class="rounded-md border border-slate-300/60 bg-surface-sunken px-3 py-2 text-base text-slate-100 shadow-inner focus:border-sky-400 focus:outline-none"
        bind:value={species}
      >
        <option value="" disabled>Select...</option>
        <option value="dog">Dog</option>
        <option value="cat">Cat</option>
      </select>
    </div>

    <div class="col-span-2 flex flex-col gap-2 sm:col-span-1">
      <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="name">Patient name (optional)</label>
      <input
        id="name"
        class="rounded-md border border-slate-300/60 bg-surface-sunken px-3 py-2 text-base text-slate-100 shadow-inner placeholder:text-slate-400 focus:border-sky-400 focus:outline-none"
        type="text"
        placeholder="e.g., Bella"
        bind:value={name}
      />
    </div>
  </div>
</aside>
