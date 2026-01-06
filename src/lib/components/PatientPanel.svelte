<script lang="ts">
  import { onMount } from 'svelte';
  import { patient } from '../stores/patient';
  import type { Species, Patient } from '../stores/patient';

  // bind to local fields, then sync to store reactively
  let p: Patient = $patient; // initialize immediately to avoid undefined
  $: p = $patient; // keep in sync reactively

  let weight = p.weightKg ?? '';
  let species: Species | '' = p.species ?? '';
  let name = p.name ?? '';

  let isDesktop = false;
  let hasMedia = false;
  let panelOpen = true;

  function formatKg(kg: number): string {
    const rounded = Math.round(kg * 10) / 10;
    return rounded % 1 === 0 ? String(Math.trunc(rounded)) : rounded.toFixed(1);
  }

  function patientSummary(patient: Patient): string {
    const parts: string[] = [];
    if (patient.weightKg != null && patient.weightKg > 0) parts.push(`${formatKg(patient.weightKg)} kg`);
    if (patient.species) parts.push(patient.species === 'dog' ? 'Dog' : 'Cat');
    if (patient.name.trim()) parts.push(patient.name.trim());
    return parts.length ? parts.join(' · ') : 'Enter patient info';
  }

  let summaryText = patientSummary(p);
  $: summaryText = patientSummary(p);

  let patientReady = false;
  $: patientReady = !!(p.weightKg != null && p.weightKg > 0 && p.species);

  let prevReady = patientReady;
  $: if (hasMedia) {
    if (isDesktop) {
      panelOpen = true;
    } else {
      if (patientReady && !prevReady) panelOpen = false;
      if (!patientReady && prevReady) panelOpen = true;
    }
    prevReady = patientReady;
  }

  onMount(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const sync = () => {
      isDesktop = mql.matches;
      hasMedia = true;
      panelOpen = isDesktop ? true : !patientReady;
      prevReady = patientReady;
    };

    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  });

  // keep store in sync with inputs
  $: patient.update(prev => ({
    ...prev,
    weightKg: weight === '' ? null : Number(weight),
    species,
    name
  }));
</script>

<aside
  class="ui-panel p-3 text-slate-100 sm:p-4 md:sticky md:top-4 md:self-start"
  aria-label="Patient inputs"
>
  <details class="group" bind:open={panelOpen}>
    <summary class="ui-summary flex cursor-pointer items-center justify-between gap-3 md:hidden">
      <div class="min-w-0">
        <div class="text-xs font-black uppercase tracking-wide text-slate-300">Patient</div>
        <div class="mt-0.5 truncate text-sm font-semibold text-slate-100">{summaryText}</div>
      </div>
      <svg class="h-4 w-4 flex-none text-slate-400 transition group-open:rotate-180" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fill="currentColor"
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.173l3.71-3.94a.75.75 0 011.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        />
      </svg>
    </summary>

    <div class="mt-3 md:mt-0">
      <h2 class="mb-3 hidden text-sm font-semibold uppercase tracking-wide text-slate-200 md:block">Patient</h2>

      <div class="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-1 sm:gap-3">
        <div class="flex flex-col gap-2">
          <label class="text-xs font-semibold uppercase tracking-wide text-slate-300" for="weight">Weight (kg)</label>
          <input
            id="weight"
            class="field-control"
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
            class="field-select"
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
            class="field-control"
            type="text"
            placeholder="e.g., Bella"
            bind:value={name}
          />
        </div>
      </div>
    </div>
  </details>
</aside>
