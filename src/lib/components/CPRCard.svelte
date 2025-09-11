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
    window.print();
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
      <!-- Bottom-left: Bolus rectangular box -->
      <div class="bolus-rect">
        <div class="bolus-main"><span class="bolus-amount">{bolus?.mlPerKg ?? '—'} mL/kg</span> <span class="bolus-word">BOLUS</span></div>
        <div class="bolus-total">Total {fmt0(totalBolusMl)} mL</div>
      </div>
      <!-- Bottom-right: ET Tube sizes box -->
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
  .btn { border: 2px solid #111; border-radius: .4rem; padding: .35rem .6rem; font-weight: 700; background: #fff; box-shadow: 2px 2px 0 #111; }
  .rows { display: grid; gap: .5rem; }
  .row { display: grid; align-items: center; gap: .5rem; grid-template-columns: 1.5fr .9fr .9fr;
         background: #fff; border: 1.5px solid #111; border-radius: .45rem; padding: .55rem .7rem; box-shadow: 2px 2px 0 #111; }
  .row.grid4 { grid-template-columns: 1.4fr .8fr .9fr .6fr; }
  /* Shock bolus: stack rate over time, right aligned */
  /* Match base row column widths for perfect alignment */
  .row.bolus { grid-template-columns: 1.5fr .9fr .9fr; }
  .row.bolus .rt { display: flex; justify-content: flex-end; align-items: center; gap: .4rem; }
  .row.bolus .rt .stack { display: inline-grid; justify-items: center; line-height: 1.1; }
  .row.bolus .rt .value { font-weight: 800; border-bottom: 2px solid #111; padding-bottom: 1px; }
  .row.bolus .rt .time { font-weight: 700; }
  .label { font-weight: 700; }
  .strong { font-weight: 800; }
  .hint { margin: 0; font-size: .8rem; opacity: .8; }
  .printable { display: none; }

  /* ------------------- PRINT STYLES ------------------- */
  @media print {
    /* Only show our label content */
    :global(body *) { visibility: hidden; }
    #cpr-print-label, #cpr-print-label * { visibility: visible; }

    /* Put label at origin and size it exactly to the label stock */
    #cpr-print-label {
      display: block !important;
      position: fixed;
      left: 0;
      top: 0;
      width: 2.625in;       /* 2-5/8" width */
      height: 2in;          /* 2" height */
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
    }

    /* Page size (many printers honor this; if not, choose the label size in the OS dialog) */
    @page { size: 2.625in 2in; margin: 0.05in; } /* small safety margin */

    /* Label design */
    .label-outer {
      width: 100%; height: 100%;
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
      grid-template-columns: 1fr auto; /* bolus on left, ET box on right */
      align-items: stretch;            /* ensure both boxes get equal height */
      gap: 0.06in;
      height: 100%;                    /* consume the available row height */
    }
    /* New rectangular bolus box (bottom-left) */
    .bolus-rect { border: 2px solid #000; border-radius: .06in; padding: 0.04in 0.06in 0.03in; font-weight: 900; font-size: 9pt; display: grid; gap: 0.02in; text-align: center; justify-self: start; height: 100%; }
    .bolus-main { font-size: 8pt; font-weight: 900; white-space: nowrap; }
    .bolus-amount { font-weight: 900; }
    .bolus-word { font-weight: 900; }
    .bolus-total { font-weight: 800; font-size: 10pt; text-align: center; }
    .bolus-box {
      border: 2px solid #000; border-radius: .06in; padding: 0.04in 0.06in 0.03in; font-weight: 900; font-size: 10pt;
      display: grid; gap: 0.02in; text-align: right; min-width: 0.9in; height: 100%;
    }

    /* ET tube box overrides/formatting */
    .et-box { text-align: center; justify-self: end; padding-bottom: 0.02in; align-self: stretch; } /* anchor to right, equal height */
    .et-label { font-weight: 800; font-size: 9pt; text-align: center; } /* centered label */
    .et-row { display: flex; justify-content: center; align-items: baseline; gap: 0.04in; } /* tighter dash spacing */
    .et-small { font-weight: 700; font-size: 9pt; opacity: .9; }
    .et-big { font-weight: 900; font-size: 14pt; }
    .dash { font-weight: 800; font-size: 11pt; line-height: 1; }
  }
</style>
