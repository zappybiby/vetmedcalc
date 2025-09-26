<script lang="ts">
  import { patient } from '../stores/patient';
  import { MEDICATIONS, CPR_DRUG_DOSES, CPR_FLUID_BOLUS, SYRINGES } from '@defs';
  import type { SyringeDef } from '@defs';

  // ⬇️ NEW: ET tube helper
  import { estimateEtForPatient } from '../helpers/etTube';
  import type { EtTubeEstimate } from '../helpers/etTube';

  const epiMed = MEDICATIONS.find(m => m.name.toLowerCase() === 'epinephrine');
  const atropineMed = MEDICATIONS.find(m => m.name.toLowerCase() === 'atropine');
  const epiDose = CPR_DRUG_DOSES.find(d => d.name.toLowerCase() === 'epinephrine');
  const atropineDose = CPR_DRUG_DOSES.find(d => d.name.toLowerCase() === 'atropine');

  type VolumeInfo = {
    ml: number;
    syringe: SyringeDef;
    decimals: number;
  };

  function roundToIncrement(value: number, increment: number): number {
    return Math.round(value / increment) * increment;
  }

  function decimalsForIncrement(increment: number): number {
    const str = increment.toString();
    const decimalPart = str.split('.')[1];
    return decimalPart ? decimalPart.length : 0;
  }

  function chooseSyringeForVolume(volMl: number, syrs: readonly SyringeDef[]): SyringeDef {
    const sorted = [...syrs].sort((a, b) => a.sizeCc - b.sizeCc || a.incrementMl - b.incrementMl);
    const oneFill = sorted.filter(s => s.sizeCc >= volMl);
    if (oneFill.length) {
      return oneFill.sort((a, b) => a.incrementMl - b.incrementMl || a.sizeCc - b.sizeCc)[0];
    }
    return sorted[sorted.length - 1];
  }

  function computeRoundedVolume(mgPerKg: number, weightKg: number, concentrationMgPerMl: number): VolumeInfo {
    const rawMl = (mgPerKg * weightKg) / concentrationMgPerMl;
    const syringe = chooseSyringeForVolume(rawMl, SYRINGES);
    const decimals = decimalsForIncrement(syringe.incrementMl);
    const rounded = roundToIncrement(rawMl, syringe.incrementMl);
    const ml = Number(rounded.toFixed(decimals));
    return { ml, syringe, decimals };
  }

  const r0 = (x: number) => Math.round(x);
  function roundRateMlHr(x: number) {
    return x < 100 ? Math.round(x) : Math.round(x / 10) * 10;
  }

  const fmtVolume = (info: VolumeInfo | null) => info == null ? '—' : info.ml.toFixed(info.decimals);
  const fmt0 = (x: number | null) => x == null ? '—' : String(r0(x));
  function fmtRate(xRounded: number | null, raw: number | null) {
    if (xRounded == null || raw == null) return '—';
    return raw < 99 ? xRounded.toFixed(1) : String(xRounded);
  }

  $: p = $patient;

  // ⬇️ NEW: live ET tube estimate (null until weight/species present)
  let et: EtTubeEstimate | null = null;
  $: et = estimateEtForPatient(p);

  type EtLabelDisplaySegment = {
    role: 'low' | 'mid' | 'high';
    className: 'et-small' | 'et-big';
    display: string;
  };

  type EtLabelCandidate = EtLabelDisplaySegment & {
    priority: number;
    index: number;
  };

  let etLabelSegments: EtLabelDisplaySegment[] | null = null;
  $: etLabelSegments = et
    ? (() => {
        const candidates: EtLabelCandidate[] = [
          { role: 'low', className: 'et-small', display: et.lowMm.toFixed(1), priority: 1, index: 0 },
          { role: 'mid', className: 'et-big', display: et.estimateMm.toFixed(1), priority: 0, index: 1 },
          { role: 'high', className: 'et-small', display: et.highMm.toFixed(1), priority: 1, index: 2 },
        ];

        const deduped: EtLabelCandidate[] = [];
        for (const entry of candidates) {
          const existingIdx = deduped.findIndex(item => item.display === entry.display);
          if (existingIdx === -1) {
            deduped.push(entry);
          } else if (entry.priority < deduped[existingIdx].priority) {
            deduped[existingIdx] = entry;
          }
        }

        return deduped
          .sort((a, b) => a.index - b.index)
          .map<EtLabelDisplaySegment>(({ role, className, display }) => ({
            role,
            className,
            display,
          }));
      })()
    : null;

  $: epiVolume =
    p.weightKg && epiDose && epiMed
      ? computeRoundedVolume(epiDose.mgPerKg, p.weightKg, epiMed.concentration.value)
      : null;

  $: atropineVolume =
    p.weightKg && atropineDose && atropineMed
      ? computeRoundedVolume(atropineDose.mgPerKg, p.weightKg, atropineMed.concentration.value)
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
      /* Remove browser margins; lock label sheet size in landscape */
      @page { size: 3in 2.25in; margin: 0; }
      /* Fill the page box and center the label */
      html, body { margin: 0; padding: 0; height: 100%; }
      body { display: grid; place-items: center; overflow: hidden; background: #fff; }
      /* Fixed-size label area */
      #cpr-print-label { width: 3in; height: 2.25in; box-sizing: border-box; overflow: hidden; }
      .label-outer {
        width: 100%; height: 100%; box-sizing: border-box;
        border: 2px solid #000;
        padding: 0.05in 0.05in;
        display: grid; grid-template-rows: auto minmax(0, 1.5fr) minmax(0, 0.5fr); gap: 0.04in; align-content: stretch;
        font-family: system-ui, Arial, Helvetica, sans-serif;
        color: #000;
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
      .label-hdr { display: grid; grid-template-columns: 1fr 1fr; gap: 0.04in; border: 2px solid #000; border-radius: .06in; padding: 0.03in 0.045in; font-weight: 800; font-size: 9.3pt; line-height: 1.08; }
      .label-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13pt; line-height: 1.1; }
      .label-weight { text-align: right; font-size: 13pt; line-height: 1.1; }
      .label-table {
        display: grid;
        border: 2px solid #000; border-radius: .06in; overflow: hidden;
        height: 100%;
        grid-template-rows: repeat(2, 1fr);
      }
      .label-row { display: grid; grid-template-columns: 1.48fr 0.92fr; align-items: stretch; border-bottom: 2px solid #000; }
      .label-row:last-child { border-bottom: none; }
      .med { padding: 0.035in 0.05in; display: grid; grid-template-rows: auto auto; row-gap: 0.01in; align-content: center; }
      .drug { font-weight: 800; font-size: 8.6pt; line-height: 1.05; }
      .perkg { font-size: 7.8pt; line-height: 1; opacity: .9; }
      .dose { border-left: 2px solid #000; display: flex; justify-content: center; align-items: center; gap: 0.035in; padding: 0.02in 0.035in; font-weight: 900; text-align: center; }
      .dose-value { font-size: 13.4pt; line-height: 1; white-space: nowrap; }
      .dose-unit { font-size: 9.8pt; font-weight: 800; line-height: 1; }
      .label-bolus { display: flex; flex-direction: column; align-items: stretch; gap: 0; min-height: 0; flex: 1 1 auto; }
      .bolus-box { border: 2px solid #000; border-radius: .06in; padding: 0.028in; font-weight: 900; font-size: 9.2pt; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box; max-width: 100%; flex: 1 1 auto; width: 100%; }
      .et-box { text-align: center; justify-self: stretch; align-self: stretch; display: flex; flex-direction: column; justify-content: center; align-items: center; flex: 1 1 auto; width: 100%; }
      .et-label { font-weight: 800; font-size: 9pt; text-align: center; }
      .et-row { display: flex; justify-content: center; align-items: baseline; gap: 0.045in; }
      .et-small { font-weight: 700; font-size: 9pt; opacity: .9; }
      .et-big { font-weight: 900; font-size: 13pt; }
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

<section class="grid gap-[0.6rem]" aria-label="CPR Card">
  <header class="flex items-center justify-between font-extrabold">
    <div>CPR Card</div>
    <div class="print:hidden">
      <button
        class="inline-flex items-center rounded-lg border-2 border-slate-200 bg-slate-800 px-3 py-1.5 font-bold text-slate-200 shadow-[2px_2px_0_#0b0b0b] transition disabled:cursor-not-allowed disabled:opacity-60"
        on:click={printLabel}
        disabled={!p.weightKg || !p.species}
      >
        Print label
      </button>
    </div>
  </header>

  <div class="grid gap-[0.5rem]">
    <!-- Epi -->
    <div class="grid grid-cols-[1.5fr_.9fr_.9fr] items-center gap-[0.5rem] rounded-[0.45rem] border border-slate-200 bg-slate-900 px-[0.7rem] py-[0.55rem] text-slate-200 shadow-[2px_2px_0_#0b0b0b]">
      <div class="font-semibold">Epi {epiMed?.concentration.value} {epiMed?.concentration.units}</div>
      <div>{epiDose?.mgPerKg} mg/kg</div>
      <div class="font-extrabold">{fmtVolume(epiVolume)} mL</div>
    </div>

    <!-- Atropine -->
    <div class="grid grid-cols-[1.5fr_.9fr_.9fr] items-center gap-[0.5rem] rounded-[0.45rem] border border-slate-200 bg-slate-900 px-[0.7rem] py-[0.55rem] text-slate-200 shadow-[2px_2px_0_#0b0b0b]">
      <div class="font-semibold">Atropine {atropineMed?.concentration.value} {atropineMed?.concentration.units}</div>
      <div>{atropineDose?.mgPerKg} mg/kg</div>
      <div class="font-extrabold">{fmtVolume(atropineVolume)} mL</div>
    </div>

    <!-- Shock Bolus -->
    <div class="grid grid-cols-[1.5fr_.9fr_.9fr] items-center gap-[0.5rem] rounded-[0.45rem] border border-slate-200 bg-slate-900 px-[0.7rem] py-[0.55rem] text-slate-200 shadow-[2px_2px_0_#0b0b0b]">
      <div class="font-semibold">
        Qtr. Shock Bolus {#if bolus}({bolus.mlPerKg} mL/kg){/if}
      </div>
      <div>Total: <span class="font-extrabold">{fmt0(totalBolusMl)}</span> mL</div>
      <div class="flex items-center justify-end gap-[0.4rem]">
        <span>Rate:</span>
        <span class="inline-grid justify-items-center leading-tight">
          <span class="border-b-2 border-slate-200 pb-px font-extrabold">{fmtRate(rateRounded, rateRaw)} mL/hr</span>
          <span class="font-bold">{bolus?.overMinutes ?? '—'} min</span>
        </span>
      </div>
    </div>

    <!-- ET Tube (moved to bottom) -->
    <div class="grid grid-cols-[1.5fr_.9fr_.9fr] items-center gap-[0.5rem] rounded-[0.45rem] border border-slate-200 bg-slate-900 px-[0.7rem] py-[0.55rem] text-slate-200 shadow-[2px_2px_0_#0b0b0b]">
      <div class="font-semibold">ET Tube (ID)</div>
      <div>
        {#if et}
          Range: {et.lowMm.toFixed(1)}–{et.highMm.toFixed(1)} mm
        {:else}
          —
        {/if}
      </div>
      <div class="font-extrabold">
        {#if et}{et.estimateMm.toFixed(1)} mm{:else}—{/if}
      </div>
    </div>
  </div>

  <p class="m-0 text-[0.8rem] opacity-80">Enter weight and species, then “Print label”.</p>
</section>

<!-- PRINT-ONLY LABEL (unchanged) -->


<!-- PRINT-ONLY LABEL -->
<div id="cpr-print-label" class="printable hidden print:block" aria-hidden="true">
  <div class="label-outer">
    <div class="label-hdr">
      <div class="label-name">{p.name || 'NAME'}</div>
      <div class="label-weight">
        {p.weightKg ? `${p.weightKg.toFixed(1)} kg` : 'WEIGHT'}
      </div>
    </div>

    <div class="label-table">
      <div class="label-row">
        <div class="med">
          <div class="drug">EPINEPHRINE {epiMed?.concentration.value} {epiMed?.concentration.units}</div>
          <div class="perkg">{epiDose?.mgPerKg} mg/kg</div>
        </div>
        <div class="dose">
          <span class="dose-value">{fmtVolume(epiVolume)}</span>
          <span class="dose-unit">mL</span>
        </div>
      </div>
      <div class="label-row">
        <div class="med">
          <div class="drug">ATROPINE {atropineMed?.concentration.value} {atropineMed?.concentration.units}</div>
          <div class="perkg">{atropineDose?.mgPerKg} mg/kg</div>
        </div>
        <div class="dose">
          <span class="dose-value">{fmtVolume(atropineVolume)}</span>
          <span class="dose-unit">mL</span>
        </div>
      </div>
    </div>

    <div class="label-bolus">
      <!-- ET Tube sizes: full-width, centered; bolus removed per request -->
      <div class="bolus-box et-box">
        <div class="et-label">Est. ET Tube Size</div>
        {#if etLabelSegments?.length}
          <div class="et-row" aria-label="ET tube size range">
            {#each etLabelSegments as segment, index (segment.role)}
              <span class={segment.className}>{segment.display}</span>
              {#if index < etLabelSegments.length - 1}
                <span class="dash">-</span>
              {/if}
            {/each}
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
      width: 3in;           /* match label width */
      height: 2.25in;       /* match label height */
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
      page-break-inside: avoid;
    }

    /* Lock paper size and orientation for 3"x2.25" landscape stock */
    @page { size: 3in 2.25in; margin: 0; }

    /* Label design */
    .label-outer {
      width: 100%; height: 100%; box-sizing: border-box;
      border: 2px solid #000;
      padding: 0.05in 0.05in;
      display: grid; grid-template-rows: auto minmax(0, 1.5fr) minmax(0, 0.5fr); gap: 0.04in; align-content: stretch;
      font-family: system-ui, Arial, Helvetica, sans-serif;
      color: #000;
    }
    .label-hdr {
      display: grid; grid-template-columns: 1fr 1fr; gap: 0.04in;
      border: 2px solid #000; border-radius: .06in; padding: 0.03in 0.045in; font-weight: 800;
      font-size: 9.3pt; line-height: 1.08;
    }
    .label-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13pt; line-height: 1.1; }
    .label-weight { text-align: right; font-size: 13pt; line-height: 1.1; }

    .label-table {
      display: grid; border: 2px solid #000; border-radius: .06in; overflow: hidden;
      height: 100%;
      grid-template-rows: repeat(2, 1fr);
    }
    .label-row {
      display: grid; grid-template-columns: 1.48fr 0.92fr; align-items: stretch; border-bottom: 2px solid #000;
    }
    .label-row:last-child { border-bottom: none; }
    .med { padding: 0.035in 0.05in; display: grid; grid-template-rows: auto auto; row-gap: 0.01in; align-content: center; }
    .drug { font-weight: 800; font-size: 8.6pt; line-height: 1.05; }
    .perkg { font-size: 7.8pt; line-height: 1; opacity: .9; }
    .dose { border-left: 2px solid #000; display: flex; justify-content: center; align-items: center; gap: 0.035in; padding: 0.02in 0.035in; font-weight: 900; text-align: center; }
    .dose-value { font-size: 13.4pt; line-height: 1; white-space: nowrap; }
    .dose-unit { font-size: 9.8pt; font-weight: 800; line-height: 1; }

    .label-bolus {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 0;
      min-height: 0;
      flex: 1 1 auto;
    }
    .bolus-box {
      border: 2px solid #000; border-radius: .06in; padding: 0.028in; font-weight: 900; font-size: 9.2pt;
      display: flex; flex-direction: column; justify-content: center; align-items: center;
      box-sizing: border-box; max-width: 100%; flex: 1 1 auto; width: 100%;
    }
    /* ET tube area: full-width, centered vertically/horizontally */
    .et-box { text-align: center; justify-self: stretch; align-self: stretch; display: flex; flex-direction: column; justify-content: center; align-items: center; flex: 1 1 auto; width: 100%; }
    .et-label { font-weight: 800; font-size: 9pt; text-align: center; }
    .et-row { display: flex; justify-content: center; align-items: baseline; gap: 0.045in; }
    .et-small { font-weight: 700; font-size: 9pt; opacity: .9; }
    .et-big { font-weight: 900; font-size: 13pt; }
    .dash { font-weight: 800; font-size: 11pt; line-height: 1; }
  }
</style>
