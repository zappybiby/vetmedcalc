<script lang="ts">
  import { patient } from '../stores/patient';
  import { MEDICATIONS, CPR_DRUG_DOSES, CPR_FLUID_BOLUS } from '@defs';

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

  <!-- existing on-screen rows ... -->
  <div class="rows">
    <div class="row">
      <div class="col label">Epi {epiMed?.concentration.value} {epiMed?.concentration.units}</div>
      <div class="col">{epiDose?.mgPerKg} mg/kg</div>
      <div class="col strong">{fmt2(epiMl)} mL</div>
    </div>

    <div class="row">
      <div class="col label">Atropine {atropineMed?.concentration.value} {atropineMed?.concentration.units}</div>
      <div class="col">{atropineDose?.mgPerKg} mg/kg</div>
      <div class="col strong">{fmt2(atropineMl)} mL</div>
    </div>

    <div class="row grid4">
      <div class="col label">
        Qtr. Shock Bolus {#if bolus}({bolus.mlPerKg} mL/kg){/if}
      </div>
      <div class="col">Total: <span class="strong">{fmt0(totalBolusMl)}</span> mL</div>
      <div class="col">Rate: <span class="strong">{fmtRate(rateRounded, rateRaw)}</span> mL/hr</div>
      <div class="col">Time: <span class="strong">{bolus?.overMinutes ?? '—'}</span> min</div>
    </div>
  </div>

  <p class="hint">Enter weight and species, then “Print label”.</p>
</section>

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
      <div class="bolus-pill">
        BOLUS&nbsp;|&nbsp;{bolus?.mlPerKg ?? '—'} mL/kg&nbsp;|&nbsp;Total {fmt0(totalBolusMl)} mL
      </div>
      <div class="bolus-box">
        <div class="rate">{fmtRate(rateRounded, rateRaw)} mL/hr</div>
        <div class="time">{bolus?.overMinutes ?? '—'} mins</div>
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
      display: grid; grid-template-rows: auto 1fr auto; gap: 0.06in;
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
      min-height: 0.8in;
    }
    .lt-left { padding: 0.05in 0.06in; display: grid; grid-auto-rows: 1fr; gap: 0.02in; border-right: 2px solid #000; }
    .lt-right { display: grid; align-items: stretch; }
    .lt-row { display: grid; grid-template-rows: auto auto; }
    .drug { font-weight: 800; font-size: 9pt; line-height: 1.05; }
    .perkg { font-size: 8pt; opacity: .9; }
    .dose { display: grid; place-items: center; border-bottom: 2px solid #000; font-weight: 900; font-size: 14pt; }
    .dose:last-child { border-bottom: none; }

    .label-bolus {
      display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0.06in;
    }
    .bolus-pill {
      border: 2px solid #000; border-radius: 999px; padding: 0.04in 0.08in; font-weight: 800;
      font-size: 9pt; text-align: center;
    }
    .bolus-box {
      border: 2px solid #000; border-radius: .06in; padding: 0.05in 0.07in; font-weight: 900; font-size: 10pt;
      display: grid; gap: 0.02in; text-align: right; min-width: 0.9in;
    }
  }
</style>
