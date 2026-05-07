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
  const speciesOptions: readonly { value: Species; label: string }[] = [
    { value: 'dog', label: 'Dog' },
    { value: 'cat', label: 'Cat' }
  ];

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

  function selectSpecies(nextSpecies: Species): void {
    species = nextSpecies;
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
  class="ui-panel ui-panel-contrast min-w-0 p-2 text-slate-100 sm:p-3 md:sticky md:top-3 md:self-start"
  aria-label="Patient inputs"
>
  <div class="hidden md:mx-auto md:grid md:max-w-[760px] md:grid-cols-[minmax(255px,0.95fr)_minmax(270px,1fr)] md:items-stretch md:gap-2.5">
    <div class="patient-left-stack">
      <div class="patient-primary-field flex min-w-0 flex-col gap-2">
        <label class="ui-label" for="weight">Weight (kg)</label>
        <input
          id="weight"
          class="field-control patient-weight-input"
          type="number"
          min="0"
          step="0.1"
          bind:value={weight}
          inputmode="decimal"
        />
      </div>

      <div class="patient-primary-field patient-species-field flex min-w-0 flex-col gap-2">
        <div class="ui-label" id="species-label">Species</div>
        <div class="species-toggle-grid" role="group" aria-labelledby="species-label">
          {#each speciesOptions as option (option.value)}
            <button
              type="button"
              class:is-selected={species === option.value}
              class="species-toggle"
              aria-pressed={species === option.value}
              on:click={() => selectSpecies(option.value)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="patient-name-field patient-name-field-desktop flex min-w-0 flex-col gap-1.5">
      <label class="ui-label" for="name">Patient name</label>
      <input
        id="name"
        class="field-control patient-name-input"
        type="text"
        bind:value={name}
      />
    </div>
  </div>

  <details class="group md:hidden" bind:open={panelOpen}>
    <summary class="ui-summary flex cursor-pointer items-center justify-between gap-3 px-0.5 py-0.5">
      <div class="min-w-0">
        <div class="ui-label-strong">Patient</div>
        <div class="mt-0.5 truncate text-[13px] font-semibold leading-tight text-slate-100 sm:text-sm">{summaryText}</div>
      </div>
      <svg class="h-5 w-5 flex-none text-slate-400 transition group-open:rotate-180" viewBox="0 0 20 20" aria-hidden="true">
        <path
          fill="currentColor"
          fill-rule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.173l3.71-3.94a.75.75 0 011.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z"
          clip-rule="evenodd"
        />
      </svg>
    </summary>

    <div class="mt-2">
      <div class="patient-mobile-grid grid gap-2.5">
        <div class="patient-primary-field patient-mobile-weight flex flex-col gap-2">
          <label class="ui-label" for="weight-mobile">Weight (kg)</label>
          <input
            id="weight-mobile"
            class="field-control patient-weight-input"
            type="number"
            min="0"
            step="0.1"
            bind:value={weight}
            inputmode="decimal"
          />
        </div>

        <div class="patient-primary-field patient-mobile-species patient-species-field flex flex-col gap-2">
          <div class="ui-label" id="species-mobile-label">Species</div>
          <div class="species-toggle-grid" role="group" aria-labelledby="species-mobile-label">
            {#each speciesOptions as option (option.value)}
              <button
                type="button"
                class:is-selected={species === option.value}
                class="species-toggle"
                aria-pressed={species === option.value}
                on:click={() => selectSpecies(option.value)}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>

        <div class="patient-name-field patient-mobile-name flex flex-col gap-1.5">
          <label class="ui-label" for="name-mobile">Patient name</label>
          <input
            id="name-mobile"
            class="field-control patient-name-input"
            type="text"
            bind:value={name}
          />
        </div>
      </div>
    </div>
  </details>
</aside>

<style>
  .patient-primary-field,
  .patient-name-field {
    border: 1px solid color-mix(in srgb, var(--ui-border) 72%, var(--ui-accent-border));
    border-radius: 0.5rem;
    background-color: color-mix(in srgb, var(--ui-surface-2) 84%, var(--ui-accent-surface));
    box-shadow:
      0 1px 0 rgba(255, 255, 255, 0.05) inset,
      0 8px 18px rgba(2, 6, 23, 0.14);
  }

  .patient-primary-field {
    min-height: 5.6rem;
    padding: 0.65rem;
  }

  .patient-left-stack {
    display: grid;
    min-width: 0;
    gap: 0.65rem;
  }

  .patient-species-field {
    min-height: 4.25rem;
    padding: 0.55rem 0.65rem;
  }

  .patient-name-field {
    padding: 0.55rem;
    background-color: color-mix(in srgb, var(--ui-surface-2) 88%, transparent);
  }

  .patient-name-field-desktop {
    justify-content: center;
    padding: 0.75rem;
  }

  .patient-weight-input {
    min-height: 3.25rem;
    padding-top: 0.55rem;
    padding-bottom: 0.55rem;
    font-size: 1.45rem;
    font-weight: 800;
    line-height: 1;
  }

  .patient-name-input {
    min-height: 2.25rem;
    font-size: 0.875rem;
  }

  .species-toggle-grid {
    display: grid;
    flex: 1;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
  }

  .species-toggle {
    display: inline-flex;
    min-width: 0;
    min-height: 2.35rem;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--ui-field-border);
    border-radius: 0.5rem;
    background-color: var(--ui-field-bg);
    color: var(--ui-text-200);
    font-size: 0.92rem;
    font-weight: 800;
    line-height: 1;
    transition:
      background-color 140ms ease,
      border-color 140ms ease,
      color 140ms ease,
      box-shadow 140ms ease;
  }

  .species-toggle:hover {
    border-color: var(--ui-field-border-strong);
    background-color: var(--ui-field-bg-hover);
    color: var(--ui-text-100);
  }

  .species-toggle.is-selected {
    border-color: var(--ui-accent-border);
    background-color: color-mix(in srgb, var(--ui-accent-surface) 66%, var(--ui-surface-2));
    color: var(--ui-text-100);
    box-shadow:
      inset 0 2px 0 rgba(127, 192, 229, 0.6),
      0 0 0 1px color-mix(in srgb, var(--ui-accent-border) 54%, transparent);
  }

  @media (max-width: 767px) {
    .patient-primary-field {
      min-height: 6rem;
      padding: 0.6rem;
    }

    .patient-species-field {
      min-height: 4.5rem;
      padding: 0.55rem 0.6rem;
    }

    .patient-weight-input {
      min-height: 3rem;
    }

    .species-toggle {
      min-height: 2.6rem;
    }

    .patient-weight-input {
      font-size: 1.35rem;
    }

    .species-toggle {
      font-size: 0.9rem;
    }
  }

  @media (min-width: 520px) and (max-width: 767px) {
    .patient-mobile-grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      align-items: stretch;
    }

    .patient-mobile-name {
      grid-column: 2;
      grid-row: 1 / span 2;
      justify-content: center;
      padding: 0.7rem;
    }
  }
</style>
