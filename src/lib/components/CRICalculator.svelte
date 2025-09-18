<script lang="ts">
  // CRI Calculator with optional dilution mapping (rate ↔ dose).
  // Adjust the helper import path if needed:
  import type { DoseUnit } from '../helpers/doseMapping';
  import { buildCRIViewModel, type CRIViewModel } from '../viewmodels/criViewModel';

  import { patient } from '../stores/patient';
  import type { Patient } from '../stores/patient';
  import { MEDICATIONS, SYRINGES } from '@defs';
  import type { MedicationDef, SyringeDef } from '@defs';

  // Reactive patient from store
  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  // -------- Inputs --------
  let medId: string = MEDICATIONS[0]?.id ?? '';
  let med: MedicationDef | undefined;
  $: med = MEDICATIONS.find((m) => m.id === medId);

  let doseUnit: DoseUnit = 'mg/kg/hr';
  let desiredDose: number | '' = '';
  let durationHr: number | '' = '';

  let desiredRateMlPerHr: number | '' = '';
  let enableDilution = false;
  $: {
    const rate = desiredRateMlPerHr;
    enableDilution = rate !== '' && rate != null && !Number.isNaN(typeof rate === 'number' ? rate : Number(rate));
  }

  // -------- Helpers --------
  function concMgPerMl(m?: MedicationDef | null) {
    if (!m) return null;
    return m.concentration.units === 'mg/mL'
      ? m.concentration.value
      : m.concentration.value / 1000;
  }
  function formatConcDisplay(m?: MedicationDef | null): string {
    if (!m) return '';
    // Keep internals in mg/mL; display Fentanyl as mcg/mL for clarity.
    if (m.name.toLowerCase() === 'fentanyl') {
      const mg = concMgPerMl(m) ?? 0;
      const mcg = Math.round(mg * 1000);
      return `${mcg} mcg/mL`;
    }
    return `${m.concentration.value} ${m.concentration.units}`;
  }
  function fmt(x: number | null | undefined, digits = 2) {
    if (x == null || Number.isNaN(x)) return '—';
    return Number(x).toFixed(digits);
  }

  // Unified view-model (presence-based)
  let vm: CRIViewModel | null = null;
  $: vm = buildCRIViewModel({
    enableDilution,
    p,
    med,
    desiredDose,
    doseUnit,
    durationHr,
    desiredRateMlPerHr,
  });
</script>

<section class="cri" aria-label="CRI Calculator">
  <header class="hdr">CRI Calculator</header>

  <!-- Inputs -->
  <div class="grid">
    <div class="field">
      <label for="med">Medication</label>
      <select id="med" bind:value={medId}>
        {#each MEDICATIONS as m}
          <option value={m.id}>
            {m.name} — {formatConcDisplay(m)}
          </option>
        {/each}
      </select>
      {#if med?.notes}<div class="note">⚠ {med.notes}</div>{/if}
    </div>

    <div class="field">
      <label for="dose">Dose</label>
      <div class="row">
        <input
          id="dose"
          type="number"
          min="0"
          step="0.001"
          bind:value={desiredDose}
          inputmode="decimal"
          placeholder="e.g., 0.4"
        />
        <select bind:value={doseUnit} aria-label="Dose unit">
          <option value="mg/kg/hr">mg/kg/hr</option>
          <option value="mg/kg/day">mg/kg/day</option>
          <option value="mcg/kg/hr">mcg/kg/hr</option>
          <option value="mcg/kg/min">mcg/kg/min</option>
        </select>
      </div>
    </div>

    <div class="field">
      <label for="duration">Duration (hr)</label>
      <input
        id="duration"
        type="number"
        min="0"
        step="0.1"
        bind:value={durationHr}
        inputmode="decimal"
        placeholder="e.g., 12"
      />
    </div>

    <div class="field">
      <label for="rate">Target pump rate (mL/hr)</label>
      <input
        id="rate"
        type="number"
        min="0"
        step="0.1"
        bind:value={desiredRateMlPerHr}
        inputmode="decimal"
        placeholder="e.g., 5"
      />
    </div>
  </div>

  <!-- Unified Results -->
  <div class="results">
    <h3 class="sub">{enableDilution ? 'Dilution Plan' : 'From Stock (no dilution)'}</h3>

    {#if vm}
      {#if vm.alerts?.length}
        <div class="alerts" aria-live="polite">
          {#each vm.alerts as a}
            <div class={`alert ${a.severity}`}>{a.message}</div>
          {/each}
        </div>
      {/if}

      <div class="section">
        <div class="section-title">Summary</div>
        <div class="draws">
          {#each vm.drawCards as card}
            <div class="card">
              <div class="card-title">{card.title}</div>
              <div class="big">{card.volumeText}</div>
              <div class="detail">
                in <span class="pill">{card.syringeText}</span>
                {#if card.fills && card.fills > 1}
                  <span class="warn">· {card.fills} fills</span>
                {/if}
                {#if card.tickText}
                  <span class="muted">({card.tickText})</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
        <div class="card result">
          <div class="card-title">{vm.resultCard.title}</div>
          <div class="kv">
            <div class="k">Total volume</div>
            <div class="v strong">{vm.resultCard.totalVolumeText}</div>
            <div class="k">Final concentration</div>
            <div class="v strong">{vm.resultCard.finalConcentrationText}</div>
          </div>
          <div class="divider" role="presentation"></div>
          <div class="result-line">At <span class="strong">{vm.resultCard.pumpRateText}</span> this will deliver <span class="strong">{vm.resultCard.deliveredDoseText}</span></div>
          <div class="result-line muted">Giving a dose of:</div>
          <div class="divider" role="presentation"></div>
          <div class="dose-lines">
            {#each vm.resultCard.doseLines as ln}
              <div class="dose">{ln}</div>
            {/each}
          </div>
        </div>
      </div>
      {#if vm.roundingDetail}
        <details class="rounding">
          <summary>{vm.roundingDetail.title}</summary>
          <table class="kvtable">
            <tbody>
              {#each vm.roundingDetail.rows as r}
                <tr>
                  <th>{r.label}</th>
                  <td class="num strong">{r.value}
                    {#if r.subnote}
                      <div class="subnote">{r.subnote}</div>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </details>
      {/if}
    {:else}
      <p class="muted">Enter all inputs to see the {enableDilution ? 'dilution plan' : 'calculation'}.</p>
    {/if}
  </div>
</section>

<style>
  .cri { display: grid; gap: .9rem; min-width: 0; }
  .hdr { font-weight: 900; font-size: 1.05rem; }

  .grid {
    display: grid;
    gap: .6rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    min-width: 0;
  }
  .field { display: grid; gap: .3rem; min-width: 0; }
  label { font-size: .85rem; font-weight: 700; }
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
  /* .rows and .val were used by the old layout */

  /* Alerts (stacked at top) */
  .alerts { display: grid; gap: .4rem; margin-bottom: .2rem; }
  .alert { border: 2px solid; border-radius: .4rem; padding: .5rem .6rem; font-weight: 800; }
  .alert.warn { border-color: #facc15; border-style: dashed; background: #3b2f00; color: #fef3c7; }
  .alert.info { border-color: #93c5fd; background: #0b2545; color: #dbeafe; }
  .muted { opacity: .7; margin: 0 .2rem; }
  .warn { color: #b45309; font-weight: 800; margin-left: .25rem; }
  .pill {
    border: 1.5px solid #e5e7eb; border-radius: 999px;
    padding: .08rem .4rem; font-weight: 800; background: #0b1220; color: #e5e7eb;
  }
  .note { font-size: .8rem; opacity: .85; }

  /* (deprecated) formerly used for bottom warnings list */

  @media (max-width: 720px) {
    .grid { grid-template-columns: 1fr; }
  }

  /* New mapping layout */

  .section { border: 1.5px solid #e5e7eb; border-radius: .45rem; padding: .55rem .6rem; background: #0b1220; color: #e5e7eb; margin-bottom: .6rem; min-width: 0; }
  .section-title { font-size: .8rem; font-weight: 900; margin-bottom: .35rem; }
  .kv { display: grid; grid-template-columns: minmax(0, 1fr) auto; row-gap: .35rem; column-gap: .6rem; align-items: center; min-width: 0; }
  .kv .k { opacity: .9; }
  .kv .v { font-variant-numeric: tabular-nums; text-align: right; }
  .kv .v.strong { font-weight: 900; }
  .unit { opacity: .85; font-weight: 700; margin-left: .15rem; }

  /* Table-style alignment */
  .kvtable { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .kvtable th { text-align: left; padding: .2rem 0; font-weight: 700; opacity: .9; vertical-align: top; }
  .kvtable td { text-align: right; padding: .2rem 0; font-variant-numeric: tabular-nums; }
  .kvtable th, .kvtable td { word-break: break-word; overflow-wrap: anywhere; }
  .kvtable td.num { font-weight: 700; }
  .kvtable td.num.strong { font-weight: 900; }
  .subnote { font-size: .85rem; opacity: .75; font-weight: 500; margin-top: .15rem; }

  .draws { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .6rem; min-width: 0; }
  .card { border: 1.5px solid #e5e7eb; border-radius: .45rem; padding: .6rem .65rem; background: #0b1220; color: #e5e7eb; min-width: 0; }
  .card-title { font-weight: 900; font-size: .85rem; margin-bottom: .25rem; }
  .big { font-variant-numeric: tabular-nums; font-weight: 900; font-size: 1.05rem; margin-bottom: .2rem; }
  .detail { font-variant-numeric: tabular-nums; }
  .card.result { margin-top: .65rem; display: grid; gap: .5rem; }
  .card.result .kv { margin: 0; }
  .divider { border-top: 1px solid #1f2937; margin: .2rem 0; }
  .result-line { font-variant-numeric: tabular-nums; }
  .result-line .strong { font-weight: 900; }
  .dose-lines { display: grid; gap: .2rem; }
  .dose { font-variant-numeric: tabular-nums; font-weight: 900; }
  details.rounding { border: 1.5px solid #e5e7eb; border-radius: .45rem; padding: .55rem .6rem; background: #0b1220; color: #e5e7eb; margin-top: .65rem; }
  details.rounding summary { font-weight: 900; cursor: pointer; }
  details.rounding summary::-webkit-details-marker { display: none; }
  details.rounding summary::after { content: '▾'; font-size: .75rem; margin-left: .35rem; }
  details.rounding[open] summary::after { content: '▴'; }
  details.rounding table { margin-top: .4rem; }

  @media (max-width: 720px) {
    .draws { grid-template-columns: 1fr; }
  }

  /* Stack dose row on very narrow screens to keep unit text intact */
  @media (max-width: 430px) {
    .row { grid-template-columns: 1fr; }
    .row select { justify-self: start; }
  }
</style>
