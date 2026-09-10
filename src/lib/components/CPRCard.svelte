<script lang="ts">
  import { patient } from '../stores/patient';
  import type { Species } from '../stores/patient';
  import {
    computeCprLabel,
    fmtVolume,
    renderCprLabelMarkup,
    CPR_LABEL_PRINT_STYLES,
  } from '../labels/cprLabel';
  import { cprBatchMode } from '../stores/cprUi';

  $: p = $patient;
  $: label = computeCprLabel(p);

  const speciesOptions: readonly { value: Species; label: string }[] = [
    { value: 'dog', label: 'Dog' },
    { value: 'cat', label: 'Cat' },
  ];

  function updateName(event: Event): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLInputElement)) return;
    patient.update(prev => prev.name === target.value ? prev : { ...prev, name: target.value });
  }

  function selectSpecies(species: Species): void {
    patient.update(prev => prev.species === species ? prev : { ...prev, species });
  }

  function printLabel(): void {
    const labelMarkup = renderCprLabelMarkup(label);

    const iframe = document.createElement('iframe');
    iframe.title = 'CPR Label Print';
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.remove();
      return;
    }

    const pageMarkup = `<div class="label-page"><div class="label-sheet">${labelMarkup}</div></div>`;

    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8" />
<title>CPR Label</title>
<style>${CPR_LABEL_PRINT_STYLES}</style>
</head><body class="print-mode-single">${pageMarkup}</body></html>`);
    doc.close();

    const win = iframe.contentWindow;
    if (!win) {
      iframe.remove();
      return;
    }

    const cleanup = () => {
      setTimeout(() => {
        iframe.remove();
      }, 0);
    };

    win.addEventListener('afterprint', cleanup, { once: true });
    win.focus();
    setTimeout(() => {
      win.print();
      cleanup();
    }, 100);
  }
</script>

<section class="ui-tool-stack" aria-label="CPR Card">
  <div class="ui-card grid gap-2 ui-card-padding">
    <div class="cpr-control-grid print:hidden">
      <label class="ui-inset cpr-batch-toggle inline-flex items-center gap-2 px-2.5 py-2 text-sm font-semibold text-slate-200 sm:px-3" for="cpr-batch-toggle">
        <input
          id="cpr-batch-toggle"
          type="checkbox"
          class="field-checkbox h-4 w-4"
          bind:checked={$cprBatchMode}
        />
        Batch mode
      </label>

      <button class="ui-button cpr-print-button px-2.5 py-2 text-xs font-bold sm:px-3 sm:text-sm" on:click={printLabel} disabled={!p.weightKg || !p.species}>
        Print label
      </button>
    </div>

    <div class="cpr-patient-grid grid min-w-0 gap-2 sm:gap-3">
      <label class="grid min-w-0 gap-1.5">
        <span class="ui-label">Patient name</span>
        <input
          id="cpr-patient-name"
          class="field-control"
          type="text"
          value={p.name}
          on:input={updateName}
        />
      </label>

      <div class="grid min-w-0 gap-1.5">
        <div class="ui-label" id="cpr-species-label">Species</div>
        <div class="cpr-species-grid" role="group" aria-labelledby="cpr-species-label">
          {#each speciesOptions as option (option.value)}
            <button
              type="button"
              class:is-selected={p.species === option.value}
              class="ui-choice cpr-species-button"
              aria-pressed={p.species === option.value}
              on:click={() => selectSpecies(option.value)}
            >
              {option.label}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <article class="ui-inset ui-card-padding">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="ui-label-strong">Epinephrine</div>
          <div class="mt-1 text-sm font-semibold text-slate-100">
            {label.epiMed?.concentration.value ?? '—'} {label.epiMed?.concentration.units ?? ''}
          </div>
          <div class="mt-1 ui-meta">{label.epiDose?.mgPerKg ?? '—'} mg/kg</div>
        </div>
        <div class="text-right">
          <div class="ui-label">Volume</div>
          <div class="mt-1 text-lg font-black tabular-nums text-slate-100">{fmtVolume(label.epiVolume)} mL</div>
        </div>
      </div>
    </article>

    <article class="ui-inset ui-card-padding">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="ui-label-strong">Atropine</div>
          <div class="mt-1 text-sm font-semibold text-slate-100">
            {label.atropineMed?.concentration.value ?? '—'} {label.atropineMed?.concentration.units ?? ''}
          </div>
          <div class="mt-1 ui-meta">{label.atropineDose?.mgPerKg ?? '—'} mg/kg</div>
        </div>
        <div class="text-right">
          <div class="ui-label">Volume</div>
          <div class="mt-1 text-lg font-black tabular-nums text-slate-100">{fmtVolume(label.atropineVolume)} mL</div>
        </div>
      </div>
    </article>

    <article class="ui-inset ui-card-padding">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="ui-label-strong">ET Tube</div>
        </div>
        <div class="text-right">
          <div class="ui-label">Estimated ET Tube Size</div>
          <div class="mt-1 text-lg font-black tabular-nums text-slate-100">
            {#if label.etEstimate}{label.etEstimate.estimateMm.toFixed(1)} mm{:else}—{/if}
          </div>
          {#if label.etEstimate}
            <div class="mt-1 ui-meta">
              Range {label.etEstimate.lowMm.toFixed(1)}–{label.etEstimate.highMm.toFixed(1)} mm
            </div>
          {/if}
        </div>
      </div>
    </article>
  </div>

  <p class="m-0 ui-meta">
    ET Tube sizing for dogs is calculated from the formula <code>3.85 * (kg)^(1/3)</code> derived from a
    <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6625165/" target="_blank" rel="noreferrer">2019 study</a>
    published in the Canadian Veterinary Journal.
  </p>
</section>

<style>
  .cpr-control-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    align-items: stretch;
  }

  .cpr-batch-toggle,
  .cpr-print-button {
    min-width: 0;
    min-height: 2.35rem;
  }

  .cpr-batch-toggle {
    justify-self: start;
  }

  .cpr-print-button {
    justify-self: end;
  }

  .cpr-patient-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .cpr-species-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.45rem;
  }

  .cpr-species-button {
    min-width: 0;
  }

  @media (min-width: 520px) {
    .cpr-patient-grid {
      grid-template-columns: minmax(0, 1.2fr) minmax(150px, 0.8fr);
      align-items: end;
    }
  }
</style>
