<script lang="ts">
  import { patient } from '../stores/patient';
  import type { Patient } from '../stores/patient';
  import {
    buildNorEpiDextroseViewModel,
    type NorEpiDextroseViewModel,
  } from '../viewmodels/norEpiDextroseViewModel';

  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  let targetDose: number | '' = 0.1;
  let pumpRate: number | '' = 1;
  let durationHr: number | '' = 24;

  let vm: NorEpiDextroseViewModel | null = null;
  $: vm = buildNorEpiDextroseViewModel({
    patient: p,
    targetDoseMcgPerKgMin: targetDose,
    pumpRateMlPerHr: pumpRate,
    durationHr,
  });
</script>

<section class="cri" aria-label="NorEpi + Dextrose CRI Calculator">
  <header class="hdr">NorEpi + Dextrose CRI</header>

  <div class="grid">
    <div class="field">
      <label for="dose">Target dose (mcg/kg/min)</label>
      <input
        id="dose"
        type="number"
        min="0"
        step="0.01"
        bind:value={targetDose}
        class="field-control"
      />
    </div>

    <div class="field">
      <label for="rate">Pump rate (mL/hr)</label>
      <input
        id="rate"
        type="number"
        min="0"
        step="0.01"
        bind:value={pumpRate}
        class="field-control"
      />
    </div>

    <div class="field">
      <label for="duration">Planned duration (hr)</label>
      <input
        id="duration"
        type="number"
        min="0"
        step="0.1"
        bind:value={durationHr}
        class="field-control"
      />
    </div>
  </div>

  <div class="results">
    <h3 class="sub">Mixture Plan</h3>

    {#if vm}
      {#if vm.alerts?.length}
        <div class="alerts" aria-live="polite">
          {#each vm.alerts as a}
            <div class={`alert ${a.severity}`}>{a.message}</div>
          {/each}
        </div>
      {/if}

      {#if vm.drawCards.length}
        <div class="section">
          <div class="section-title">Draw Volumes</div>
          <div class="draws">
            {#each vm.drawCards as card}
              <div class="card">
                <div class="card-title">{card.title}</div>
                <div class="big">{card.volumeText}</div>
                <div class="detail">
                  in <span class="pill">{card.syringeText}</span>
                  {#if card.fills}
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
            <div class="card-title">Result</div>
            <div class="kv">
              <div class="k">Total volume</div>
              <div class="v strong">{vm.resultCard.totalVolumeText}</div>
              <div class="k">Pump rate</div>
              <div class="v">{vm.resultCard.pumpRateText}</div>
              <div class="k">Planned duration</div>
              <div class="v">{vm.resultCard.plannedDurationText}</div>
              <div class="k">Delivered duration</div>
              <div class="v">{vm.resultCard.deliveredDurationText}</div>
            </div>
            <div class="divider" role="presentation"></div>
            <div class="kv">
              <div class="k">Target dose</div>
              <div class="v">{vm.resultCard.targetDoseText}</div>
              <div class="k">Delivered dose</div>
              <div class="v strong">{vm.resultCard.deliveredDoseText}</div>
              <div class="k">Final NorEpi concentration</div>
              <div class="v">{vm.resultCard.finalNorEpiConcText}</div>
              <div class="k">Final Dextrose</div>
              <div class="v">{vm.resultCard.finalDextroseText}</div>
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
        <p class="muted">Unable to build a mixture with these settings.</p>
      {/if}
    {:else}
      <p class="muted">Enter patient weight, dose, pump rate, and duration to see the plan.</p>
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

  .results {
    border: 2px solid #e5e7eb; border-radius: .5rem;
    padding: .7rem .8rem; box-shadow: 2px 2px 0 #0b0b0b; background: #111827; color: #e5e7eb;
    min-width: 0; max-width: 100%;
  }
  .sub { margin: 0 0 .4rem 0; font-size: .95rem; font-weight: 900; }

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

  @media (max-width: 720px) {
    .grid { grid-template-columns: 1fr; }
  }

  .section { border: 1.5px solid #e5e7eb; border-radius: .45rem; padding: .55rem .6rem; background: #0b1220; color: #e5e7eb; margin-bottom: .6rem; min-width: 0; }
  .section-title { font-size: .8rem; font-weight: 900; margin-bottom: .35rem; }
  .kv { display: grid; grid-template-columns: minmax(0, 1fr) auto; row-gap: .35rem; column-gap: .6rem; align-items: center; min-width: 0; }
  .kv .k { opacity: .9; }
  .kv .v { font-variant-numeric: tabular-nums; text-align: right; }
  .kv .v.strong { font-weight: 900; }

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
  .divider { border-top: 1px solid #1f2937; margin: .2rem 0; }
  details.rounding { border: 1.5px solid #e5e7eb; border-radius: .45rem; padding: .55rem .6rem; background: #0b1220; color: #e5e7eb; margin-top: .65rem; }
  details.rounding summary { font-weight: 900; cursor: pointer; }
  details.rounding summary::-webkit-details-marker { display: none; }
  details.rounding summary::after { content: '▾'; font-size: .75rem; margin-left: .35rem; }
  details.rounding[open] summary::after { content: '▴'; }
  details.rounding table { margin-top: .4rem; }

  @media (max-width: 720px) {
    .draws { grid-template-columns: 1fr; }
  }
</style>
