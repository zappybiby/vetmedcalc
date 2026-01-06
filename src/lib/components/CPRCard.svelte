<script lang="ts">
  import { patient } from '../stores/patient';
  import {
    computeCprLabel,
    fmtVolume,
    renderCprLabelMarkup,
    CPR_LABEL_PRINT_STYLES,
  } from '../labels/cprLabel';

  $: p = $patient;
  $: label = computeCprLabel(p);

  function printLabel() {
    const labelMarkup = renderCprLabelMarkup(label);

    const win = window.open('', 'cpr-print', 'width=400,height=320');
    if (!win) {
      window.print();
      return;
    }

    const pageMarkup = `<div class="label-page"><div class="label-sheet">${labelMarkup}</div></div>`;

    win.document.write(`<!doctype html><html><head><meta charset="utf-8" />
      <title>CPR Label</title>
      <style>${CPR_LABEL_PRINT_STYLES}</style>
    </head><body class="print-mode-single">
      ${pageMarkup}
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 50);
  }
</script>

<section class="grid gap-3" aria-label="CPR Card">
  <div class="flex flex-wrap items-center justify-between gap-3">
    <div class="text-sm font-black uppercase tracking-wide text-slate-100">CPR Card</div>
    <div class="print:hidden">
      <button class="ui-button font-bold" on:click={printLabel} disabled={!p.weightKg || !p.species}>
        Print label
      </button>
    </div>
  </div>

  <div class="ui-card grid gap-2 p-4">
    <article class="ui-inset p-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs font-black uppercase tracking-wide text-slate-300">Epi</div>
          <div class="mt-1 text-sm font-semibold text-slate-100">
            {label.epiMed?.concentration.value ?? '—'} {label.epiMed?.concentration.units ?? ''}
          </div>
          <div class="mt-1 text-xs text-slate-400">{label.epiDose?.mgPerKg ?? '—'} mg/kg</div>
        </div>
        <div class="text-right">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Volume</div>
          <div class="mt-1 text-lg font-black tabular-nums text-slate-100">{fmtVolume(label.epiVolume)} mL</div>
        </div>
      </div>
    </article>

    <article class="ui-inset p-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs font-black uppercase tracking-wide text-slate-300">Atropine</div>
          <div class="mt-1 text-sm font-semibold text-slate-100">
            {label.atropineMed?.concentration.value ?? '—'} {label.atropineMed?.concentration.units ?? ''}
          </div>
          <div class="mt-1 text-xs text-slate-400">{label.atropineDose?.mgPerKg ?? '—'} mg/kg</div>
        </div>
        <div class="text-right">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Volume</div>
          <div class="mt-1 text-lg font-black tabular-nums text-slate-100">{fmtVolume(label.atropineVolume)} mL</div>
        </div>
      </div>
    </article>

    <article class="ui-inset p-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs font-black uppercase tracking-wide text-slate-300">ET Tube</div>
        </div>
        <div class="text-right">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-400">Estimated ET Tube Size</div>
          <div class="mt-1 text-lg font-black tabular-nums text-slate-100">
            {#if label.etEstimate}{label.etEstimate.estimateMm.toFixed(1)} mm{:else}—{/if}
          </div>
          {#if label.etEstimate}
            <div class="mt-1 text-xs text-slate-400">
              Range {label.etEstimate.lowMm.toFixed(1)}–{label.etEstimate.highMm.toFixed(1)} mm
            </div>
          {/if}
        </div>
      </div>
    </article>
  </div>

  <p class="m-0 text-xs text-slate-400">
    ET Tube sizing for dogs is calculated from the formula <code>3.85 * (kg)^(1/3)</code> derived from a
    <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6625165/" target="_blank" rel="noreferrer">2019 study</a>
    published in the Canadian Veterinary Journal.
  </p>
</section>

<!-- PRINT-ONLY LABEL (unchanged) -->


<!-- PRINT-ONLY LABEL -->
<div id="cpr-print-label" class="printable hidden print:block" aria-hidden="true">
  <div class="label-page">
    <div class="label-sheet">
      {@html renderCprLabelMarkup(label)}
    </div>
  </div>
</div>

<style>
  /* ------------------- PRINT STYLES ------------------- */
  @media print {
    /* Hide the app; show only the label to avoid extra pages */
    :global(html, body) { margin: 0; padding: 0; height: 100%; }
    /* Center the single visible element (the label) */
    :global(body) { display: grid; place-items: center; }
    :global(#app *) { display: none !important; }
    :global(#cpr-print-label) { display: block !important; }

    /* Size + center the label per printed page */
    :global(#cpr-print-label .label-page) {
      width: 100%;
      min-height: 100vh;
      margin: 0 auto;
      padding: 0;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
      page-break-after: always;
      break-after: page;
    }

    :global(#cpr-print-label .label-page:last-child) {
      page-break-after: auto;
      break-after: auto;
    }

    :global(#cpr-print-label .label-sheet) {
      width: 3in;
      height: 2.25in;
      box-sizing: border-box;
      display: flex;
      overflow: hidden;
    }

    /* Lock paper size and orientation for 3"x2.25" landscape stock */
    @page { size: 3in 2.25in; margin: 0; }

    /* Label design */
    :global(.label-outer) {
      width: 100%; height: 100%; box-sizing: border-box;
      border: 2px solid #000;
      padding: 0.05in 0.05in;
      display: grid; grid-template-rows: auto minmax(0, 1.5fr) minmax(0, 0.5fr); gap: 0.04in; align-content: stretch;
      font-family: system-ui, Arial, Helvetica, sans-serif;
      color: #000;
    }
    :global(.label-hdr) {
      display: grid; grid-template-columns: 1fr 1fr; gap: 0.04in;
      border: 2px solid #000; border-radius: .06in; padding: 0.03in 0.045in; font-weight: 800;
      font-size: 9.3pt; line-height: 1.08;
    }
    :global(.label-name) { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13pt; line-height: 1.1; }
    :global(.label-weight) { text-align: right; font-size: 13pt; line-height: 1.1; }

    :global(.label-table) {
      display: grid; border: 2px solid #000; border-radius: .06in; overflow: hidden;
      height: 100%;
      grid-template-rows: repeat(2, 1fr);
    }
    :global(.label-row) {
      display: grid; grid-template-columns: 1.48fr 0.92fr; align-items: stretch; border-bottom: 2px solid #000;
    }
    :global(.label-row:last-child) { border-bottom: none; }
    :global(.med) { padding: 0.035in 0.05in; display: grid; grid-template-rows: auto auto; row-gap: 0.01in; align-content: center; }
    :global(.drug) { font-weight: 800; font-size: 8.6pt; line-height: 1.05; }
    :global(.perkg) { font-size: 7.8pt; line-height: 1; opacity: .9; }
    :global(.dose) { border-left: 2px solid #000; display: flex; justify-content: center; align-items: center; gap: 0.035in; padding: 0.02in 0.035in; font-weight: 900; text-align: center; }
    :global(.dose-value) { font-size: 13.4pt; line-height: 1; white-space: nowrap; }
    :global(.dose-unit) { font-size: 9.8pt; font-weight: 800; line-height: 1; }

    :global(.label-bolus) {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0;
      min-height: 0;
      flex: 1 1 auto;
    }
    :global(.bolus-box) {
      border: 2px solid #000; border-radius: .06in; padding: 0.028in; font-weight: 900; font-size: 9.2pt;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      box-sizing: border-box; max-width: 100%; flex: 1 1 auto; width: 100%;
    }
    /* ET tube area: full-width, centered vertically/horizontally */
    :global(.et-box) { text-align: center; justify-self: stretch; align-self: stretch; display: flex; flex-direction: column; justify-content: center; align-items: center; flex: 1 1 auto; width: 100%; }
    :global(.et-label) { font-weight: 800; font-size: 9pt; text-align: center; }
    :global(.et-row) { display: flex; justify-content: center; align-items: baseline; gap: 0.045in; }
    :global(.et-small) { font-weight: 700; font-size: 9pt; opacity: .9; }
    :global(.et-big) { font-weight: 900; font-size: 13pt; }
    :global(.dash) { font-weight: 800; font-size: 11pt; line-height: 1; }
  }
</style>
