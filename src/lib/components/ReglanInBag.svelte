<script lang="ts">
  import { patient } from '../stores/patient';
  import type { Patient } from '../stores/patient';
  import { SYRINGES } from '@defs';
  import type { SyringeDef } from '@defs';

  // Constants
  const REGLAN_CONC_MG_PER_ML = 5; // Reglan 5 mg/mL

  // Patient
  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  // Inputs
  let dose: number | '' = '';
  let doseUnit: 'mg/kg/day' | 'mg/kg/hr' = 'mg/kg/day';
  let bagVolumeMl: number | '' = '';
  let maintRateMlHr: number | '' = '';

  // Helpers
  function fmt(x: number | null | undefined, digits = 2) {
    if (x == null || Number.isNaN(x)) return '—';
    return Number(x).toFixed(digits);
  }
  function chooseSyringeForVolume(volMl: number, syrs: readonly SyringeDef[]): SyringeDef {
    const sorted = [...syrs].sort((a, b) => a.sizeCc - b.sizeCc || a.incrementMl - b.incrementMl);
    const oneFill = sorted.filter((s) => s.sizeCc >= volMl);
    if (oneFill.length) {
      return oneFill.sort((a, b) => a.incrementMl - b.incrementMl || a.sizeCc - b.sizeCc)[0];
    }
    return sorted[sorted.length - 1];
  }

  // Derived/calculation according to: mL_to_add = (Dose × Wt × (V_bag / Rate) / H) / 5
  // where H = 24 if dose is mg/kg/day, else 1 for mg/kg/hr
  let H: number | null = null;
  $: H = doseUnit === 'mg/kg/day' ? 24 : 1;

  let bagHours: number | null = null;
  $: bagHours = (bagVolumeMl !== '' && maintRateMlHr !== '' && Number(maintRateMlHr) > 0)
    ? Number(bagVolumeMl) / Number(maintRateMlHr)
    : null;

  let mlToAdd: number | null = null;
  $: mlToAdd = (p.weightKg && dose !== '' && bagHours != null && H != null)
    ? ((Number(dose) * (p.weightKg as number) * bagHours) / H) / REGLAN_CONC_MG_PER_ML
    : null;

  let mgToAdd: number | null = null;
  $: mgToAdd = mlToAdd != null ? mlToAdd * REGLAN_CONC_MG_PER_ML : null;

  // Syringe suggestion for drawing drug volume
  let syr: SyringeDef | null = null;
  $: syr = mlToAdd != null ? chooseSyringeForVolume(mlToAdd, SYRINGES) : null;
  let fills: number | null = null;
  $: fills = mlToAdd != null && syr ? Math.ceil(mlToAdd / syr.sizeCc) : null;

  // Validation flags
  let ready: boolean = false;
  $: ready = !!(p.weightKg && dose !== '' && bagVolumeMl !== '' && maintRateMlHr !== '');
</script>

<section class="reglan" aria-label="Reglan in bag calculator">
  <header class="hdr">Reglan in Bag</header>

  <div class="grid">
    <div class="field">
      <label for="dose">Dose</label>
      <div class="row">
        <input id="dose" type="number" min="0" step="0.01" bind:value={dose} inputmode="decimal" placeholder="e.g., 1" />
        <select bind:value={doseUnit} aria-label="Dose unit">
          <option value="mg/kg/day">mg/kg/day</option>
          <option value="mg/kg/hr">mg/kg/hr</option>
        </select>
      </div>
    </div>

    <div class="field">
      <label for="bag">Fluid bag volume (mL)</label>
      <input id="bag" type="number" min="0" step="1" bind:value={bagVolumeMl} inputmode="decimal" placeholder="e.g., 1000" />
    </div>

    <div class="field">
      <label for="rate">Maintenance rate (mL/hr)</label>
      <input id="rate" type="number" min="0" step="0.1" bind:value={maintRateMlHr} inputmode="decimal" placeholder="e.g., 60" />
    </div>

    <div class="field readonly">
      <span class="labeltext">Patient weight</span>
      <div class="pill">{p.weightKg != null ? `${p.weightKg.toFixed(2)} kg` : 'Enter in Patient panel'}</div>
    </div>
  </div>

  <div class="results">
    <h3 class="sub">Summary</h3>
    {#if ready && mlToAdd != null}
      <div class="draws">
        <div class="card">
          <div class="card-title">Add to bag</div>
          <div class="big">{fmt(mlToAdd, 2)} <span class="unit">mL</span></div>
          <div class="detail">Reglan {REGLAN_CONC_MG_PER_ML} mg/mL
            {#if syr}
              · in <span class="pill">{syr.label ?? `${syr.sizeCc} cc`}</span>
              <span class="muted">(ticks {fmt(syr.incrementMl, 2)} mL)</span>
              {#if fills && fills > 1}
                <span class="warn">requires {fills} fills</span>
              {/if}
            {/if}
          </div>
        </div>
      </div>

      <div class="kv" style="margin-top:.45rem;">
        <div class="k">Drug amount</div>
        <div class="v strong">{fmt(mgToAdd, 2)} <span class="unit">mg</span></div>
        <div class="k">Bag runtime at rate</div>
        <div class="v">{fmt(bagHours, 2)} <span class="unit">hr</span></div>
        <div class="k">Reglan concentration</div>
        <div class="v">{REGLAN_CONC_MG_PER_ML} <span class="unit">mg/mL</span></div>
      </div>

      <div class="section">
        <div class="section-title">How calculated</div>
        <table class="kvtable"><tbody>
          <tr>
            <th>Hours the bag runs</th>
            <td class="num">{fmt(Number(bagVolumeMl) / Number(maintRateMlHr), 3)} <span class="unit">hr</span></td>
          </tr>
          <tr>
            <th>Unit factor H</th>
            <td class="num">{H}</td>
          </tr>
          <tr>
            <th>mL to add</th>
            <td class="num">
              (<span class="strong">{dose || 0}</span> × <span class="strong">{fmt(p.weightKg ?? 0, 2)}</span> × <span class="strong">{fmt(bagHours, 3)}</span> ÷ <span class="strong">{H}</span>) ÷ <span class="strong">{REGLAN_CONC_MG_PER_ML}</span>
              = <span class="strong">{fmt(mlToAdd, 2)}</span> <span class="unit">mL</span>
            </td>
          </tr>
        </tbody></table>
      </div>
    {:else}
      <p class="muted">Enter dose, bag volume, rate, and patient weight.</p>
    {/if}
  </div>
</section>

<style>
  .reglan { display: grid; gap: .9rem; min-width: 0; }
  .hdr { font-weight: 900; font-size: 1.05rem; }

  .grid {
    display: grid;
    gap: .6rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    min-width: 0;
  }
  .field { display: grid; gap: .3rem; min-width: 0; }
  .field.readonly { align-content: end; }
  label { font-size: .85rem; font-weight: 700; }
  .labeltext { font-size: .85rem; font-weight: 700; }
  input, select {
    border: 1.5px solid #e5e7eb; border-radius: .4rem;
    padding: .4rem .5rem; font-size: .95rem;
    background: #0b1220; color: #e5e7eb;
    max-width: 100%;
  }
  .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: .4rem; align-items: center; min-width: 0; }
  .row > * { min-width: 0; }

  .results {
    border: 2px solid #e5e7eb; border-radius: .5rem;
    padding: .7rem .8rem; box-shadow: 2px 2px 0 #0b0b0b; background: #111827; color: #e5e7eb;
    min-width: 0; max-width: 100%;
  }
  .sub { margin: 0 0 .4rem 0; font-size: .95rem; font-weight: 900; }
  .muted { opacity: .7; margin: 0 .2rem; }
  .warn { color: #b45309; font-weight: 800; margin-left: .25rem; }
  .pill {
    border: 1.5px solid #e5e7eb; border-radius: 999px;
    padding: .08rem .4rem; font-weight: 800; background: #0b1220; color: #e5e7eb;
  }

  .section { border: 1.5px solid #e5e7eb; border-radius: .45rem; padding: .55rem .6rem; background: #0b1220; color: #e5e7eb; margin-bottom: .6rem; min-width: 0; }
  .section-title { font-size: .8rem; font-weight: 900; margin-bottom: .35rem; }
  .kv { display: grid; grid-template-columns: minmax(0, 1fr) auto; row-gap: .35rem; column-gap: .6rem; align-items: center; min-width: 0; }
  .kv .k { opacity: .9; }
  .kv .v { font-variant-numeric: tabular-nums; text-align: right; }
  .kv .v.strong { font-weight: 900; }
  .unit { opacity: .85; font-weight: 700; margin-left: .15rem; }
  .kvtable { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .kvtable th { text-align: left; padding: .2rem 0; font-weight: 700; opacity: .9; vertical-align: top; }
  .kvtable td { text-align: right; padding: .2rem 0; font-variant-numeric: tabular-nums; }
  .kvtable th, .kvtable td { word-break: break-word; overflow-wrap: anywhere; }
  .kvtable td.num { font-weight: 700; }

  .draws { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .6rem; min-width: 0; }
  .card { border: 1.5px solid #e5e7eb; border-radius: .45rem; padding: .6rem .65rem; background: #0b1220; color: #e5e7eb; min-width: 0; }
  .card-title { font-weight: 900; font-size: .85rem; margin-bottom: .25rem; }
  .big { font-variant-numeric: tabular-nums; font-weight: 900; font-size: 1.05rem; margin-bottom: .2rem; }
  .detail { font-variant-numeric: tabular-nums; }
 
  @media (max-width: 720px) {
    .grid { grid-template-columns: 1fr; }
    .draws { grid-template-columns: 1fr; }
  }

  /* Stack dose row on very narrow screens */
  @media (max-width: 430px) {
    .row { grid-template-columns: 1fr; }
    .row select { justify-self: start; }
  }
</style>
