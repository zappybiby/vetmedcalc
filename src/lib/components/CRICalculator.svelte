<script lang="ts">
  // CRI Calculator with optional dilution mapping (rate ↔ dose).
  // Adjust the helper import path if needed:
  import { computeMixturePlan, type DoseUnit, type MixturePlan } from '../helpers/doseMapping';

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

  let enableDilution = false;
  let desiredRateMlPerHr: number | '' = 5; // mapping rate for dilution mode

  // -------- Helpers --------
  function unitConstant(u: DoseUnit) {
    // Convert entered dose to mg/hr·kg
    switch (u) {
      case 'mcg/kg/min':
        return 0.06;      // 60/1000
      case 'mg/kg/day':
        return 1 / 24;    // per day → per hour
      case 'mcg/kg/hr':
        return 1 / 1000;  // mcg → mg
      case 'mg/kg/hr':
      default:
        return 1;
    }
  }
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
  function roundToInc(v: number, inc: number) {
    return Math.round(v / inc) * inc;
  }
  function chooseSyringeForVolume(volMl: number, syrs: readonly SyringeDef[]): SyringeDef {
    const sorted = [...syrs].sort((a, b) => a.sizeCc - b.sizeCc || a.incrementMl - b.incrementMl);
    const oneFill = sorted.filter((s) => s.sizeCc >= volMl);
    if (oneFill.length) {
      return oneFill.sort((a, b) => a.incrementMl - b.incrementMl || a.sizeCc - b.sizeCc)[0];
    }
    return sorted[sorted.length - 1];
  }
  function fmt(x: number | null | undefined, digits = 2) {
    if (x == null || Number.isNaN(x)) return '—';
    return Number(x).toFixed(digits);
  }

  // -------- STOCK (no dilution) calculations --------
  let canStock: boolean = false;
  $: canStock =
    !!(p.weightKg && med && desiredDose !== '' && durationHr !== '');

  let stockRateMlHr: number | null = null;
  $: stockRateMlHr =
    canStock && med
      ? (unitConstant(doseUnit) * Number(desiredDose) * (p.weightKg as number)) /
        (concMgPerMl(med) as number)
      : null;

  let stockTargetVolMl: number | null = null;
  $: stockTargetVolMl =
    stockRateMlHr != null && durationHr !== ''
      ? stockRateMlHr * Number(durationHr)
      : null;

  let stockSyr: SyringeDef | null = null;
  $: stockSyr =
    stockTargetVolMl != null ? chooseSyringeForVolume(stockTargetVolMl, SYRINGES) : null;

  let stockDrawVolMl: number | null = null;
  $: stockDrawVolMl =
    stockTargetVolMl != null && stockSyr
      ? roundToInc(stockTargetVolMl, stockSyr.incrementMl)
      : null;

  let stockFills: number | null = null;
  $: stockFills =
    stockDrawVolMl != null && stockSyr
      ? Math.ceil(stockDrawVolMl / stockSyr.sizeCc)
      : null;

  let stockDurationFromSnapHr: number | null = null;
  $: stockDurationFromSnapHr =
    stockRateMlHr != null && stockDrawVolMl != null
      ? stockDrawVolMl / stockRateMlHr
      : null;

  // -------- DILUTION mapping (rate ↔ dose) --------
  let canDilute: boolean = false;
  $: canDilute =
    enableDilution &&
    !!(p.weightKg && med && desiredDose !== '' && durationHr !== '' && desiredRateMlPerHr !== '');

  let plan: MixturePlan | null = null;
  $: plan =
    canDilute && med
      ? computeMixturePlan({
          weightKg: p.weightKg as number,
          medication: med,
          desiredDose: Number(desiredDose),
          doseUnit,
          desiredRateMlPerHr: Number(desiredRateMlPerHr),
          desiredDurationHr: Number(durationHr),
          syringes: SYRINGES
        })
      : null;
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

    <div class="field chk">
      <label>
        <input type="checkbox" bind:checked={enableDilution} />
        Dilute to map rate ↔ dose
      </label>
      <div class="hint">Re-compound so a chosen pump rate delivers the entered dose exactly.</div>
    </div>

    {#if enableDilution}
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
    {/if}
  </div>

  <!-- Results -->
  {#if !enableDilution}
    <div class="results">
      <h3 class="sub">From Stock (no dilution)</h3>

      <div class="section">
        <div class="section-title">Set Pump</div>
        <div class="kv">
          <div class="k">Rate</div>
          <div class="v strong">{fmt(stockRateMlHr ?? null, 2)} <span class="unit">mL/hr</span></div>
          <div class="k">Estimated runtime</div>
          <div class="v">{fmt(stockDurationFromSnapHr ?? null, 2)} <span class="unit">hr</span></div>
        </div>
      </div>

      <div class="draws">
        <div class="card">
          <div class="card-title">Draw Up Volume</div>
          <div class="big">{fmt(stockDrawVolMl ?? null, 2)} <span class="unit">mL</span></div>
          <div class="detail">
            {#if stockSyr}
              in <span class="pill">{stockSyr.label ?? `${stockSyr.sizeCc} cc`}</span>
              <span class="muted">(ticks {fmt(stockSyr.incrementMl, 2)} mL)</span>
              {#if stockFills && stockFills > 1}
                <span class="warn">· requires {stockFills} fills</span>
              {/if}
            {:else}
              —
            {/if}
          </div>
        </div>
      </div>

      <div class="section">
        <div class="kv">
          <div class="k">Target volume (unsnapped)</div>
          <div class="v">{fmt(stockTargetVolMl ?? null, 2)} <span class="unit">mL</span></div>
        </div>
      </div>
    </div>
  {:else}
    <div class="results">
      <h3 class="sub">Dilution Plan</h3>

      {#if plan}
        {#if !plan.feasibleAtDesiredRate}
          <div class="banner warn">
            At {fmt(plan.desiredRateMlPerHr, 2)} mL/hr stock is too weak to match the dose.
            Use {fmt(plan.mappingRateMlPerHr, 3)} mL/hr to hit the target.
          </div>
        {/if}

        <!-- Make this mixture -->
        <div class="section">
          <div class="section-title">Make This Mixture</div>
          <div class="kv">
            <div class="k">Final concentration</div>
            <div class="v strong">{fmt(plan.chosenConcentrationMgPerMl, 4)} <span class="unit">mg/mL</span></div>
            <div class="k">Total volume</div>
            <div class="v strong">{fmt(plan.finalTotalVolumeMl, 2)} <span class="unit">mL</span> <span class="muted">(target {fmt(plan.targetTotalVolumeMl, 2)} mL · {fmt(plan.relTotalVolumeErrorPct, 2)}% vol diff)</span></div>
          </div>
        </div>

        <!-- Draw steps first (what to do) -->
        <div class="draws">
          <div class="card">
            <div class="card-title">Stock draw</div>
            <div class="big">{fmt(plan.snappedStockVolumeMl, 2)} <span class="unit">mL</span></div>
            <div class="detail">
              in <span class="pill">{plan.stockDraw.syringeLabel ?? `${plan.stockDraw.syringeSizeMl} cc`}</span>
              <span class="muted">(ticks {fmt(plan.stockDraw.incrementMl, 2)} mL)</span>
              {#if plan.stockDraw.fills > 1}
                <span class="warn">· {plan.stockDraw.fills} fills</span>
              {/if}
            </div>
          </div>

          <div class="card">
            <div class="card-title">Diluent draw</div>
            <div class="big">{fmt(plan.snappedDiluentVolumeMl, 2)} <span class="unit">mL</span></div>
            <div class="detail">
              in <span class="pill">{plan.diluentDraw.syringeLabel ?? `${plan.diluentDraw.syringeSizeMl} cc`}</span>
              <span class="muted">(ticks {fmt(plan.diluentDraw.incrementMl, 2)} mL)</span>
              {#if plan.diluentDraw.fills > 1}
                <span class="warn">· {plan.diluentDraw.fills} fills</span>
              {/if}
            </div>
          </div>
        </div>

        <!-- Then how to run it -->
        <div class="section">
          <div class="section-title">Infusion Setup</div>
          <div class="kv">
            <div class="k">Set pump</div>
            <div class="v strong">{fmt(plan.desiredRateMlPerHr, 2)} <span class="unit">mL/hr</span></div>
            <div class="k">Delivers at that rate</div>
            <div class="v">{fmt(plan.deliveredDoseAtDesiredRate, 3)} <span class="unit">{plan.doseUnit}</span> <span class="muted">(±{fmt(plan.relConcentrationErrorPct, 2)}% vs target)</span></div>
            <div class="k">Exact mapping (with this mix)</div>
            <div class="v">{fmt(plan.mappingRateMlPerHr, 3)} <span class="unit">mL/hr</span></div>
          </div>
        </div>

        <!-- Details & checks below -->
        <div class="section">
          <div class="section-title">Details</div>
          <div class="kv">
            <div class="k">Needed concentration</div>
            <div class="v">{fmt(plan.neededConcentrationMgPerMl, 4)} <span class="unit">mg/mL</span></div>
            <div class="k">Stock concentration</div>
            <div class="v">{fmt(plan.stockConcentrationMgPerMl, 4)} <span class="unit">mg/mL</span></div>
          </div>
        </div>

        {#if plan.warnings.length}
          <ul class="warnings">
            {#each plan.warnings as w}
              <li>{w}</li>
            {/each}
          </ul>
        {/if}
      {:else}
        <p class="muted">Enter all inputs to see the dilution plan.</p>
      {/if}
    </div>
  {/if}
</section>

<style>
  .cri { display: grid; gap: .9rem; }
  .hdr { font-weight: 900; font-size: 1.05rem; }

  .grid {
    display: grid;
    gap: .6rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .field { display: grid; gap: .3rem; }
  .field.chk { grid-column: 1 / -1; }
  label { font-size: .85rem; font-weight: 700; }
  input, select {
    border: 1.5px solid #111; border-radius: .4rem;
    padding: .4rem .5rem; font-size: .95rem;
  }
  .row { display: grid; grid-template-columns: 1fr auto; gap: .4rem; align-items: center; }

  .results {
    border: 2px solid #111; border-radius: .5rem;
    padding: .7rem .8rem; box-shadow: 2px 2px 0 #111; background: #fff;
  }
  .sub { margin: 0 0 .4rem 0; font-size: .95rem; font-weight: 900; }
  /* .rows and .val were used by the old layout */

  .banner.warn {
    border: 2px dashed #111; padding: .5rem; border-radius: .4rem;
    background: #fffae6; font-weight: 800;
  }
  .muted { opacity: .7; margin: 0 .2rem; }
  .warn { color: #b45309; font-weight: 800; margin-left: .25rem; }
  .pill {
    border: 1.5px solid #111; border-radius: 999px;
    padding: .08rem .4rem; font-weight: 800; background: #f6f6f6;
  }
  .note { font-size: .8rem; opacity: .85; }

  .warnings { margin: .5rem 0 0; padding-left: 1rem; }
  .warnings li { margin: .2rem 0; }

  @media (max-width: 720px) {
    .grid { grid-template-columns: 1fr; }
  }

  /* New mapping layout */

  .section { border: 1.5px solid #111; border-radius: .45rem; padding: .55rem .6rem; background: #fff; margin-bottom: .6rem; }
  .section-title { font-size: .8rem; font-weight: 900; margin-bottom: .35rem; }
  .kv { display: grid; grid-template-columns: 1fr auto; row-gap: .35rem; column-gap: .6rem; align-items: center; }
  .kv .k { opacity: .9; }
  .kv .v { font-variant-numeric: tabular-nums; text-align: right; }
  .kv .v.strong { font-weight: 900; }
  .unit { opacity: .85; font-weight: 700; margin-left: .15rem; }

  .draws { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: .6rem; }
  .card { border: 1.5px solid #111; border-radius: .45rem; padding: .6rem .65rem; background: #f9f9f9; }
  .card-title { font-weight: 900; font-size: .85rem; margin-bottom: .25rem; }
  .big { font-variant-numeric: tabular-nums; font-weight: 900; font-size: 1.05rem; margin-bottom: .2rem; }
  .detail { font-variant-numeric: tabular-nums; }

  @media (max-width: 720px) {
    .draws { grid-template-columns: 1fr; }
  }
</style>
