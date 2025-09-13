<script lang="ts">
  import { patient } from '../stores/patient';
  import { MEDICATIONS, CPR_DRUG_DOSES, CPR_FLUID_BOLUS } from '@defs';

  // ⬇️ NEW: ET tube helper
  import { estimateEtForPatient } from '../helpers/etTube';
  import type { EtTubeEstimate } from '../helpers/etTube';

  const epiMed = MEDICATIONS.find(m => m.name.toLowerCase() === 'epinephrine');
  const atropineMed = MEDICATIONS.find(m => m.name.toLowerCase() === 'atropine');
  const epiDose = CPR_DRUG_DOSES.find(d => d.name.toLowerCase() === 'epinephrine');
  const atropineDose = CPR_DRUG_DOSES.find(d => d.name.toLowerCase() === 'atropine');

  const r2 = (x: number) => Math.round(x * 100) / 100;
  const r0 = (x: number) => Math.round(x);
  function roundRateMlHr(x: number) {
    return x < 100 ? Math.round(x) : Math.round(x / 10) * 10;
  }

  const fmt2 = (x: number | null) => x == null ? '—' : x.toFixed(2);
  const fmt0 = (x: number | null) => x == null ? '—' : String(r0(x));
  function fmtRate(xRounded: number | null, raw: number | null) {
    if (xRounded == null || raw == null) return '—';
    return raw < 99 ? xRounded.toFixed(1) : String(xRounded);
  }

  $: p = $patient;

  // ⬇️ NEW: live ET tube estimate (null until weight/species present)
  let et: EtTubeEstimate | null = null;
  $: et = estimateEtForPatient(p);

  $: epiMl =
    p.weightKg && epiDose && epiMed
      ? r2((epiDose.mgPerKg * p.weightKg) / epiMed.concentration.value)
      : null;

  $: atropineMl =
    p.weightKg && atropineDose && atropineMed
      ? r2((atropineDose.mgPerKg * p.weightKg) / atropineMed.concentration.value)
      : null;

  $: bolus = CPR_FLUID_BOLUS.find(b => b.species === p.species);
  $: totalBolusMl =
    p.weightKg && bolus ? r0(p.weightKg * bolus.mlPerKg) : null;

  $: rateRaw =
    p.weightKg && bolus ? (p.weightKg * bolus.mlPerKg) / bolus.overMinutes * 60 : null;

  $: rateRounded = rateRaw == null ? null : roundRateMlHr(rateRaw);

  function printLabel() {
    const node = document.getElementById('cpr-print-label');
    if (!node) {
      window.print();
      return;
    }

    const win = window.open('', 'cpr-print', 'width=400,height=320');
    if (!win) {
      window.print();
      return;
    }

    const labelHTML = node.innerHTML;
    const styles = `
      /* Remove browser margins; let printer use minimum hardware margins */
      @page { size: auto; margin: 0; }
      /* Fill the page box and center the label */
      html, body { margin: 0; padding: 0; height: 100%; }
      body { display: grid; place-items: center; overflow: hidden; background: #fff; }
      /* Fixed-size label area */
      #cpr-print-label { width: 2.625in; height: 2in; box-sizing: border-box; overflow: hidden; }
      .label-outer {
        width: 100%; height: 100%; box-sizing: border-box;
        border: 2px solid #000;
        padding: 0.08in 0.08in;
        display: grid; grid-template-rows: auto auto 1fr; gap: 0.06in;
        font-family: system-ui, Arial, Helvetica, sans-serif;
        color: #000;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      .label-hdr { display: grid; grid-template-columns: 1fr 1fr; gap: 0.06in; border: 2px solid #000; border-radius: .06in; padding: 0.04in 0.06in; font-weight: 800; font-size: 10pt; line-height: 1.1; }
      .label-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .label-weight { text-align: right; }
      .label-table { display: grid; grid-template-columns: 1.6fr 0.8fr; border: 2px solid #000; border-radius: .06in; }
      .lt-left { padding: 0.05in 0.06in; display: grid; grid-template-rows: 1fr 1fr; gap: 0; border-right: none; }
      .lt-right { display: grid; grid-template-rows: 1fr 1fr; align-items: stretch; }
      .lt-row { display: grid; grid-template-rows: auto auto; align-content: center; border-bottom: 2px solid #000; }
      .lt-row:last-child { border-bottom: none; }
      .drug { font-weight: 800; font-size: 9pt; line-height: 1.05; }
      .perkg { font-size: 8pt; opacity: .9; }
      .dose { display: grid; place-items: center; border-bottom: 2px solid #000; font-weight: 900; font-size: 14pt; }
      .dose:last-child { border-bottom: none; }
      .label-bolus { display: grid; grid-template-columns: 1fr; align-items: stretch; gap: 0; min-height: 0; }
      .bolus-box { border: 2px solid #000; border-radius: .06in; padding: 0.04in; font-weight: 900; font-size: 10pt; display: grid; gap: 0.04in; box-sizing: border-box; max-width: 100%; }
      .et-box { text-align: center; justify-self: stretch; align-self: stretch; display: grid; align-content: center; justify-items: center; }
      .et-label { font-weight: 800; font-size: 9pt; text-align: center; }
      .et-row { display: flex; justify-content: center; align-items: baseline; gap: 0.08in; }
      .et-small { font-weight: 700; font-size: 9pt; opacity: .9; }
      .et-big { font-weight: 900; font-size: 14pt; }
      .dash { font-weight: 800; font-size: 11pt; line-height: 1; }
    `;

    win.document.write(`<!doctype html><html><head><meta charset="utf-8" />
      <title>CPR Label</title>
      <style>${styles}</style>
    </head><body>
      <div id="cpr-print-label">${labelHTML}</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 50);
  }
</script>

<section class="card" aria-label="CPR Card">
  <header class="hdr">
    <div>CPR Card</div>
    <div class="screen-only">
      <button class="btn" on:click={printLabel} disabled={!p.weightKg || !p.species}>
        Print label
      </button>
    </div>
  </header>

  <div class="rows">
    <!-- Epi -->
    <div class="row">
      <div class="col label">Epi {epiMed?.concentration.value} {epiMed?.concentration.units}</div>
      <div class="col">{epiDose?.mgPerKg} mg/kg</div>
      <div class="col strong">{fmt2(epiMl)} mL</div>
    </div>

    <!-- Atropine -->
    <div class="row">
      <div class="col label">Atropine {atropineMed?.concentration.value} {atropineMed?.concentration.units}</div>
      <div class="col">{atropineDose?.mgPerKg} mg/kg</div>
      <div class="col strong">{fmt2(atropineMl)} mL</div>
    </div>

    <!-- Shock Bolus -->
    <div class="row bolus">
      <div class="col label">
        Qtr. Shock Bolus {#if bolus}({bolus.mlPerKg} mL/kg){/if}
      </div>
      <div class="col">Total: <span class="strong">{fmt0(totalBolusMl)}</span> mL</div>
      <div class="col rt">
        <span class="rate-label">Rate:</span>
        <span class="stack">
          <span class="value">{fmtRate(rateRounded, rateRaw)} mL/hr</span>
          <span class="time">{bolus?.overMinutes ?? '—'} min</span>
        </span>
      </div>
    </div>

    <!-- ET Tube (moved to bottom) -->
    <div class="row">
      <div class="col label">ET Tube (ID)</div>
      <div class="col">
        {#if et}
          Range: {et.lowMm.toFixed(1)}–{et.highMm.toFixed(1)} mm
        {:else}
          —
        {/if}
      </div>
      <div class="col strong">
        {#if et}{et.estimateMm.toFixed(1)} mm{:else}—{/if}
      </div>
    </div>
  </div>


  <p class="hint">Enter weight and species, then “Print label”.</p>
</section>

<!-- PRINT-ONLY LABEL (unchanged) -->


<!-- PRINT-ONLY LABEL -->
<div id="cpr-print-label" class="printable" aria-hidden="true">
  <div class="label-outer">
    <div class="label-hdr">
      <div class="label-name">{p.name || 'NAME'}</div>
      <div class="label-weight">
        {p.weightKg ? `${p.weightKg.toFixed(1)} kg` : 'WEIGHT'}
        {#if p.species}&nbsp;({p.species}){/if}
      </div>
    </div>

    <div class="label-table">
      <div class="lt-left">
        <div class="lt-row">
          <div class="drug">EPI {epiMed?.concentration.value} {epiMed?.concentration.units}</div>
          <div class="perkg">{epiDose?.mgPerKg} mg/kg</div>
        </div>
        <div class="lt-row">
          <div class="drug">ATROPINE {atropineMed?.concentration.value} {atropineMed?.concentration.units}</div>
          <div class="perkg">{atropineDose?.mgPerKg} mg/kg</div>
        </div>
      </div>
      <div class="lt-right">
        <div class="dose">{fmt2(epiMl)} mL</div>
        <div class="dose">{fmt2(atropineMl)} mL</div>
      </div>
    </div>

    <div class="label-bolus">
      <!-- ET Tube sizes: full-width, centered; bolus removed per request -->
      <div class="bolus-box et-box">
        <div class="et-label">ET Tube Size:</div>
        {#if et}
          <div class="et-row" aria-label="ET tube size range">
            <span class="et-small">{et.lowMm.toFixed(1)}</span>
            <span class="dash">-</span>
            <span class="et-big">{et.estimateMm.toFixed(1)}</span>
            <span class="dash">-</span>
            <span class="et-small">{et.highMm.toFixed(1)}</span>
          </div>
        {:else}
          <div class="et-row" aria-label="ET tube size unavailable">
            <span class="et-small">—</span>
            <span class="dash">-</span>
            <span class="et-big">—</span>
            <span class="dash">-</span>
            <span class="et-small">—</span>
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  /* --- screen card (unchanged from earlier, trimmed for brevity) --- */
  .card { display: grid; gap: .6rem; }
  .hdr { display: flex; justify-content: space-between; align-items: center; font-weight: 800; }
  .btn { border: 2px solid #e5e7eb; color: #e5e7eb; border-radius: .4rem; padding: .35rem .6rem; font-weight: 700; background: #1f2937; box-shadow: 2px 2px 0 #0b0b0b; }
  .rows { display: grid; gap: .5rem; }
  .row { display: grid; align-items: center; gap: .5rem; grid-template-columns: 1.5fr .9fr .9fr;
         background: #111827; color: #e5e7eb; border: 1.5px solid #e5e7eb; border-radius: .45rem; padding: .55rem .7rem; box-shadow: 2px 2px 0 #0b0b0b; }
  /* Shock bolus: stack rate over time, right aligned */
  /* Match base row column widths for perfect alignment */
  .row.bolus { grid-template-columns: 1.5fr .9fr .9fr; }
  .row.bolus .rt { display: flex; justify-content: flex-end; align-items: center; gap: .4rem; }
  .row.bolus .rt .stack { display: inline-grid; justify-items: center; line-height: 1.1; }
  .row.bolus .rt .value { font-weight: 800; border-bottom: 2px solid #e5e7eb; padding-bottom: 1px; }
  .row.bolus .rt .time { font-weight: 700; }
  .label { font-weight: 700; }
  .strong { font-weight: 800; }
  .hint { margin: 0; font-size: .8rem; opacity: .8; }
  .printable { display: none; }

  /* ------------------- PRINT STYLES ------------------- */
  @media print {
    /* Hide the app; show only the label to avoid extra pages */
    :global(html, body) { margin: 0; padding: 0; height: 100%; }
    /* Center the single visible element (the label) */
    :global(body) { display: grid; place-items: center; }
    :global(#app *) { display: none !important; }
    #cpr-print-label { display: block !important; }

    /* Size the label; keep static positioning to prevent repeating per page */
    #cpr-print-label {
      width: 2.625in;       /* 2-5/8" width */
      height: 2in;          /* 2" height */
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
      page-break-inside: avoid;
    }

    /* Use printer-selected paper size; remove margins */
    @page { size: auto; margin: 0; }

    /* Label design */
    .label-outer {
      width: 100%; height: 100%; box-sizing: border-box;
      border: 2px solid #000;
      padding: 0.08in 0.08in;
      /* Make header + meds stack to content height, and let bottom row stretch */
      display: grid; grid-template-rows: auto auto 1fr; gap: 0.06in;
      font-family: system-ui, Arial, Helvetica, sans-serif;
      color: #000;
    }
    .label-hdr {
      display: grid; grid-template-columns: 1fr 1fr; gap: 0.06in;
      border: 2px solid #000; border-radius: .06in; padding: 0.04in 0.06in; font-weight: 800;
      font-size: 10pt; line-height: 1.1;
    }
    .label-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .label-weight { text-align: right; }

    .label-table {
      display: grid; grid-template-columns: 1.6fr 0.8fr; border: 2px solid #000; border-radius: .06in;
      /* remove rigid min-height to avoid pushing content below label bottom */
    }
    /* Left column holds two medication rows; remove internal gap so the
       horizontal divider lines align perfectly with the right column. */
    .lt-left { padding: 0.05in 0.06in; display: grid; grid-template-rows: 1fr 1fr; gap: 0; border-right: none; }
    .lt-right { display: grid; grid-template-rows: 1fr 1fr; align-items: stretch; }
    /* Center contents within each medication row so text has
       balanced space above/below the divider lines. */
    .lt-row { display: grid; grid-template-rows: auto auto; align-content: center; border-bottom: 2px solid #000; }
    .lt-row:last-child { border-bottom: none; }
    .drug { font-weight: 800; font-size: 9pt; line-height: 1.05; }
    .perkg { font-size: 8pt; opacity: .9; }
    .dose { display: grid; place-items: center; border-bottom: 2px solid #000; font-weight: 900; font-size: 14pt; }
    .dose:last-child { border-bottom: none; }

    .label-bolus {
      display: grid;
      grid-template-columns: 1fr; /* single full-width area for ET */
      align-items: stretch;
      gap: 0;
      min-height: 0;
    }
    .bolus-box {
      border: 2px solid #000; border-radius: .06in; padding: 0.04in; font-weight: 900; font-size: 10pt;
      display: grid; gap: 0.04in; box-sizing: border-box; max-width: 100%;
    }
    /* ET tube area: full-width, centered vertically/horizontally */
    .et-box { text-align: center; justify-self: stretch; align-self: stretch; display: grid; align-content: center; justify-items: center; }
    .et-label { font-weight: 800; font-size: 9pt; text-align: center; }
    .et-row { display: flex; justify-content: center; align-items: baseline; gap: 0.06in; }
    .et-small { font-weight: 700; font-size: 9pt; opacity: .9; }
    .et-big { font-weight: 900; font-size: 14pt; }
    .dash { font-weight: 800; font-size: 11pt; line-height: 1; }
  }
</style>
