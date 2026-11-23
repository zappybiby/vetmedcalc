<script lang="ts">
  import SegmentedToggle from './SegmentedToggle.svelte';
  import {
    KPHOS_BASE_FLUIDS,
    KPHOS_K_MEQ_PER_ML,
    KPHOS_PHOS_MMOL_PER_ML,
    getKPhosBaseFluid,
    type KPhosBaseFluid,
    type KPhosBaseFluidId,
  } from '@defs';
  import {
    KPHOS_EXCESS_WARNING_FRACTION,
    calculateKPhosPlan,
    getKPhosExcessFraction,
    type KPhosKTargetBasis,
    type KPhosPhosTargetBasis,
    type KPhosMode,
    type KPhosPlan,
  } from '../helpers/kphos';
  import { patient, type Patient } from '../stores/patient';

  type NumberInput = number | '' | null | undefined;
  const fluidRateUnits = ['mL/hr', 'mL/kg/hr', 'mL/kg/day'] as const;
  type FluidRateUnit = typeof fluidRateUnits[number];

  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  let mode: KPhosMode = 'bag';
  let kTargetBasis: KPhosKTargetBasis = 'added';
  let phosTargetBasis: KPhosPhosTargetBasis = 'total';
  let mainFluidId: KPhosBaseFluidId = 'norm-r';
  let criDiluentFluidId: KPhosBaseFluidId = 'normal-saline';
  let mainBagVolumeMl: number | '' = 1000;
  let mainFluidRate: number | '' = '';
  let fluidRateUnit: FluidRateUnit = 'mL/hr';
  let hourlyRate: { ml: number; perWeightKg: number | null } | null = null;
  let phosTargetMmolKgHr: number | '' = '';
  let kTargetMeqPerL: number | '' = '';
  let criDurationHr: number | '' = 12;
  let criRateMlHr: number | '' = '';

  let mainFluid: KPhosBaseFluid = getKPhosBaseFluid(mainFluidId);
  let criDiluentFluid: KPhosBaseFluid = getKPhosBaseFluid(criDiluentFluidId);
  $: mainFluid = getKPhosBaseFluid(mainFluidId);
  $: criDiluentFluid = getKPhosBaseFluid(criDiluentFluidId);

  function numeric(value: NumberInput): number | null {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isPresent(value: NumberInput): boolean {
    return value != null && value !== '';
  }

  function isPositive(value: number | null): boolean {
    return value != null && value > 0;
  }

  function enterFluidRate(value: number) {
    hourlyRate = Number.isFinite(value)
      ? { ml: fluidRateUnit === 'mL/kg/day' ? value / 24 : value, perWeightKg: fluidRateUnit === 'mL/hr' ? null : 1 }
      : null;
  }

  function changeFluidRateUnit(next: FluidRateUnit) {
    if (hourlyRate != null) {
      if ((next === 'mL/hr') !== (fluidRateUnit === 'mL/hr')) {
        if (mainRateValue == null || weightKg == null || weightKg <= 0) return;
        // Keep the exact pump rate at this weight even if its per-kg equivalent repeats.
        hourlyRate = { ml: mainRateValue, perWeightKg: next === 'mL/hr' ? null : weightKg };
      }
      const hourly = hourlyRate.ml / (hourlyRate.perWeightKg ?? 1);
      mainFluidRate = Number((next === 'mL/kg/day' ? hourly * 24 : hourly).toPrecision(12));
    }
    fluidRateUnit = next;
  }

  function fmt(value: number | null | undefined, digits = 2): string {
    if (value == null || Number.isNaN(value)) return '—';
    const rounded = Number(value.toFixed(digits));
    return String(Object.is(rounded, -0) ? 0 : rounded);
  }

  function fmtCompact(value: number | null | undefined, maxDigits = 2): string {
    if (value == null || Number.isNaN(value)) return '—';
    const rounded = Number(value.toFixed(maxDigits));
    return (Object.is(rounded, -0) ? 0 : rounded).toLocaleString('en-US', { maximumFractionDigits: maxDigits });
  }

  function fmtStock(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return fmt(value, Math.abs(value) < 0.1 && value !== 0 ? 3 : 2);
  }

  function fmtDose(value: number | null): string {
    return value == null ? '—' : String(Number(value.toPrecision(3)));
  }

  function fmtConcentration(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return fmt(value, Math.abs(value) > 0 && Math.abs(value) < 0.1 ? 3 : 2);
  }

  let weightKg: number | null = null;
  let bagVolumeValue: number | null = null;
  let mainRateValue: number | null = null;
  let phosTargetValue: number | null = null;
  let kTargetValue: number | null = null;
  let criDurationValue: number | null = null;
  let criRateValue: number | null = null;
  $: weightKg = numeric(p.weightKg);
  $: bagVolumeValue = numeric(mainBagVolumeMl);
  $: {
    if (hourlyRate == null) mainRateValue = null;
    else if (hourlyRate.perWeightKg == null) mainRateValue = hourlyRate.ml;
    else mainRateValue = weightKg != null && weightKg > 0 ? hourlyRate.ml * (weightKg / hourlyRate.perWeightKg) : null;
  }
  $: rateNeedsWeight = isPresent(mainFluidRate) && !isPositive(weightKg);
  $: phosTargetValue = numeric(phosTargetMmolKgHr);
  $: kTargetValue = numeric(kTargetMeqPerL);
  $: criDurationValue = numeric(criDurationHr);
  $: criRateValue = numeric(criRateMlHr);

  let plan: KPhosPlan;
  $: plan = calculateKPhosPlan({
    mode,
    mainFluid,
    criDiluentFluid,
    weightKg,
    mainBagVolumeMl: bagVolumeValue,
    mainFluidRateMlHr: mainRateValue,
    phosTargetMmolKgHr: isPresent(phosTargetMmolKgHr) ? phosTargetValue : null,
    kTargetBasis,
    phosTargetBasis,
    kTargetMeqPerL: isPresent(kTargetMeqPerL) ? kTargetValue : null,
    criDurationHr: criDurationValue,
    criRateMlHr: isPresent(criRateMlHr) ? criRateValue : null,
  });

  let hasAnyTarget = false;
  let kBasisLabel = 'Added';
  $: hasAnyTarget = plan.hasPhosTarget || plan.hasKTarget;
  $: kBasisLabel = kTargetBasis === 'added' ? 'Added' : 'Total';

  let issues: string[] = [];
  $: {
    const next: string[] = [];

    if (plan.hasPhosTarget) {
      if (phosTargetValue == null || phosTargetValue < 0) next.push('Phosphate target must be 0 or greater.');
      if (!isPositive(weightKg)) next.push('Enter patient weight.');
      if (!isPositive(numeric(mainFluidRate))) next.push('Enter the fluid rate.');
      if (mode === 'bag' && !isPositive(bagVolumeValue)) next.push('Enter bag volume.');
      if (mode === 'cri' && !isPositive(criDurationValue)) next.push('Enter the CRI duration.');
      if (mode === 'cri' && isPresent(criRateMlHr) && !isPositive(criRateValue)) {
        next.push('CRI rate must be greater than 0 or blank.');
      }
    }

    if (isPresent(kTargetMeqPerL)) {
      if (kTargetValue == null || kTargetValue < 0) next.push(`${kBasisLabel} potassium target must be greater than 0 or blank.`);
      if (plan.hasKTarget && !isPositive(bagVolumeValue)) next.push('Enter bag volume.');
    }

    issues = [...new Set(next)];
  }

  let alerts: string[] = [];
  $: {
    const next: string[] = [];
    if (plan.fluidsMeetPhosTarget && plan.hasPhosTarget) {
      next.push('The selected fluids already meet the phosphate target.');
    }
    if (phosTargetValue != null && plan.selectedPhosDeliveryMmolKgHr != null) {
      const excessFraction = getKPhosExcessFraction(phosTargetValue, plan.selectedPhosDeliveryMmolKgHr);
      if (excessFraction != null && excessFraction >= KPHOS_EXCESS_WARNING_FRACTION) {
        next.push(Number.isFinite(excessFraction)
          ? `${phosTargetBasis === 'total' ? 'Total' : 'Added'} phosphate exceeds the target by ${fmt(excessFraction * 100, 0)}%.`
          : `${phosTargetBasis === 'total' ? 'Total' : 'Added'} phosphate exceeds the zero target by ${fmt(plan.phosTargetExcessMmolKgHr, 4)} mmol/kg/hr.`);
      }
    }
    if (plan.kTargetExcessMeqPerL != null) {
      next.push(`${kBasisLabel} potassium already exceeds the target by ${fmt(plan.kTargetExcessMeqPerL, 2)} mEq/L; no KCl is needed.`);
    }
    if (mode === 'cri' && plan.criRequestedRateFeasible === false) {
      next.push(plan.criRateIssue === 'diluent-exceeds-phos-target'
        ? `${criDiluentFluid.label} exceeds the phosphate target at that rate. Use a lower rate or phosphate-free diluent; stock-only rate is ${fmt(plan.criPumpRateMlHr, 3)} mL/hr.`
        : `The entered CRI rate is too low. Use ${fmt(plan.criPumpRateMlHr, 3)} mL/hr or higher.`);
    }
    alerts = next;
  }

  $: kPhosAddedKMeq = (plan.kPhosStockMl ?? 0) * KPHOS_K_MEQ_PER_ML;
  $: kPhosAddedPhosMmol = (plan.kPhosStockMl ?? 0) * KPHOS_PHOS_MMOL_PER_ML;
  $: criDiluentKMeq = criDiluentFluid.nativeKMeqPerL * (plan.criDiluentVolumeMl ?? 0) / 1000;
  $: criDiluentPhosMmol = criDiluentFluid.nativePhosMmolPerL * (plan.criDiluentVolumeMl ?? 0) / 1000;

  type SourceRow = {
    id: string;
    label: string;
    detail?: string;
    k: number | null;
    phos: number | null;
    kRate: number | null;
    phosRate: number | null;
  };

  let bagRows: SourceRow[];
  $: {
    const preparingBag = mode === 'bag' || plan.hasKTarget;
    const rows: SourceRow[] = [{
      id: 'starting-fluid', label: preparingBag ? 'Starting bag' : 'Running fluid',
      detail: preparingBag ? mainFluid.label : `${mainFluid.label} at ${fmtCompact(mainRateValue)} mL/hr`,
      k: mainFluid.nativeKMeqPerL, phos: mainFluid.nativePhosMmolPerL,
      kRate: plan.mainNativeKDeliveryMeqKgHr, phosRate: plan.mainNativePhosDeliveryMmolKgHr,
    }];
    if (mode === 'bag' && plan.hasPhosTarget) {
      rows.push({
        id: 'kphos', label: 'KPhos additive', k: plan.kPhosKCreditMeqPerL,
        phos: bagVolumeValue != null && bagVolumeValue > 0 ? kPhosAddedPhosMmol * 1000 / bagVolumeValue : null,
        kRate: plan.kPhosKDeliveryMeqKgHr, phosRate: plan.kPhosPhosDeliveryMmolKgHr,
      });
    }
    if (plan.hasKTarget) {
      rows.push({
        id: 'kcl', label: 'KCl additive', k: plan.kClAddedMeqPerL, phos: 0,
        kRate: plan.kClDeliveryMeqKgHr, phosRate: plan.mainFluidRateMlKgHr == null ? null : 0,
      });
    }
    if (preparingBag) {
      rows.push({
        id: 'final-bag', label: mode === 'bag' ? 'Final bag' : 'Final main bag',
        k: plan.finalMainBagKMeqPerL, phos: plan.finalMainBagPhosMmolPerL,
        kRate: plan.finalMainBagKDeliveryMeqKgHr, phosRate: plan.finalMainBagPhosDeliveryMmolKgHr,
      });
    }
    bagRows = rows;
  }

  let criRows: SourceRow[];
  $: criRows = [
    {
      id: 'kphos', label: 'KPhos stock', k: kPhosAddedKMeq, phos: kPhosAddedPhosMmol,
      kRate: plan.kPhosKDeliveryMeqKgHr, phosRate: plan.kPhosPhosDeliveryMmolKgHr,
    },
    {
      id: 'cri-diluent', label: 'Diluent', detail: criDiluentFluid.label, k: criDiluentKMeq, phos: criDiluentPhosMmol,
      kRate: plan.criDiluentKDeliveryMeqKgHr, phosRate: plan.criDiluentPhosDeliveryMmolKgHr,
    },
    {
      id: 'final-cri', label: 'Prepared CRI', detail: `${fmtStock(plan.criTotalVolumeMl)} mL total`,
      k: kPhosAddedKMeq + criDiluentKMeq, phos: kPhosAddedPhosMmol + criDiluentPhosMmol,
      kRate: plan.criKDeliveryMeqKgHr, phosRate: plan.criPhosDeliveryMmolKgHr,
    },
  ];
</script>

<section class="ui-tool-stack text-slate-200" aria-label="KPhos/KCl calculator">
  <article class="ui-card min-w-0 overflow-hidden" data-testid="kphos-input-card">
    <header class="kphos-input-header">
      <div class="kphos-mode-picker">
        <span class="ui-label kphos-mode-label">Mode:</span>
        <div class="kphos-mode-control">
          <SegmentedToggle label="Add KPhos to" first="Bag" second="CRI" secondSelected={mode === 'cri'} onToggle={cri => mode = cri ? 'cri' : 'bag'} />
        </div>
      </div>
    </header>

    <div class="kphos-form" data-testid="kphos-statements">
      <section class="kphos-form-section kphos-target-section" aria-label="Medication targets">
        <div class="kphos-field-grid kphos-target-fields">
          <fieldset class="kphos-target-column">
            <legend class="ui-section-title">Phosphate target</legend>
            <div class="kphos-target-controls">
              <SegmentedToggle label="Phosphate Calculation Mode" first="Added to Bag" second="Total in Bag" secondSelected={phosTargetBasis === 'total'} testId="phos-target-basis" onToggle={total => phosTargetBasis = total ? 'total' : 'added'} />
              <div class="ui-field kphos-field">
                <label class="ui-label" for="kphos-phos-target">Delivery <span class="ui-unit">(mmol/kg/hr)</span></label>
                <input id="kphos-phos-target" class="field-control kphos-inline-number" type="number" min="0" step="0.001" inputmode="decimal" placeholder="optional" aria-label="Phosphate target (mmol/kg/hr)" bind:value={phosTargetMmolKgHr} />
              </div>
            </div>
          </fieldset>
          <fieldset class="kphos-target-column">
            <legend class="ui-section-title">Potassium target</legend>
            <div class="kphos-target-controls">
              <SegmentedToggle label="Potassium Calculation Mode" first="Added to Bag" second="Total in Bag" secondSelected={kTargetBasis === 'total'} testId="k-target-basis" onToggle={total => kTargetBasis = total ? 'total' : 'added'} />
              <div class="ui-field kphos-field">
                <label class="ui-label" for="kphos-k-target">Concentration <span class="ui-unit">(mEq/L)</span></label>
                <input id="kphos-k-target" class="field-control kphos-inline-number" type="number" min="0" step="1" inputmode="decimal" placeholder="optional" aria-label={`${kBasisLabel} potassium target (mEq/L)`} bind:value={kTargetMeqPerL} />
              </div>
            </div>
          </fieldset>
        </div>
      </section>

      <section class="kphos-form-section" aria-label="Main fluid settings">
        <div class="kphos-field-grid kphos-bag-fields" class:kphos-main-no-bag={mode === 'cri' && !plan.hasKTarget}>
          <div class="ui-field kphos-field">
            <div class="ui-field-heading"><label class="ui-label" for="kphos-main-fluid">Fluid Type</label></div>
            <select id="kphos-main-fluid" class="field-select" aria-label="Fluid Type" bind:value={mainFluidId}>
              {#each KPHOS_BASE_FLUIDS as fluid}<option value={fluid.id}>{fluid.label}</option>{/each}
            </select>
          </div>
          {#if mode === 'bag' || plan.hasKTarget}
            <div class="ui-field kphos-field">
              <label class="ui-label" for="kphos-main-bag-volume">Bag volume <span class="ui-unit">(mL)</span></label>
              <input id="kphos-main-bag-volume" class="field-control kphos-inline-number" type="number" min="0" step="1" inputmode="decimal" aria-label="Bag volume (mL)" bind:value={mainBagVolumeMl} />
            </div>
          {/if}
          <div class="ui-field kphos-field kphos-rate-field">
            <div class="ui-field-heading"><label class="ui-label" for="kphos-main-fluid-rate">Fluid rate</label></div>
            <div class="kphos-rate-controls">
              <input id="kphos-main-fluid-rate" class="field-control kphos-inline-number" type="number" min="0" step="any" inputmode="decimal" aria-label={`Fluid rate (${fluidRateUnit})`} aria-describedby={rateNeedsWeight ? 'kphos-rate-hint' : undefined} bind:value={mainFluidRate} on:input={event => enterFluidRate(event.currentTarget.valueAsNumber)} />
              <select class="field-select" aria-label="Fluid rate unit" aria-describedby={rateNeedsWeight ? 'kphos-rate-hint' : undefined} value={fluidRateUnit} on:change={event => changeFluidRateUnit(event.currentTarget.value as FluidRateUnit)}>
                {#each fluidRateUnits as unit}
                  <option value={unit} disabled={rateNeedsWeight && (unit === 'mL/hr') !== (fluidRateUnit === 'mL/hr')}>{unit}</option>
                {/each}
              </select>
            </div>
            {#if rateNeedsWeight}
              <span id="kphos-rate-hint" class="kphos-rate-hint">Enter patient weight to convert the fluid rate.</span>
            {:else if fluidRateUnit !== 'mL/hr' && isPositive(mainRateValue)}
              <span class="kphos-rate-hint">Equivalent to {fmtDose(mainRateValue)} mL/hr</span>
            {/if}
          </div>
        </div>
      </section>

      {#if mode === 'cri'}
        <section class="kphos-form-section" aria-label="CRI preparation settings">
          <div class="kphos-field-grid kphos-cri-setup-fields">
            <div class="ui-field kphos-field">
              <label class="ui-label" for="kphos-cri-duration">Duration <span class="ui-unit">(hr)</span></label>
              <input id="kphos-cri-duration" class="field-control kphos-inline-number" type="number" min="0" step="0.1" inputmode="decimal" aria-label="Duration (hr)" bind:value={criDurationHr} />
            </div>
            <div class="ui-field kphos-field">
              <label class="ui-label" for="kphos-cri-rate">CRI rate <span class="ui-unit">(mL/hr)</span></label>
              <input id="kphos-cri-rate" class="field-control kphos-inline-number" type="number" min="0" step="0.1" inputmode="decimal" placeholder="optional" aria-label="CRI rate (mL/hr)" bind:value={criRateMlHr} />
            </div>
            <div class="ui-field kphos-field">
              <div class="ui-field-heading"><label class="ui-label" for="kphos-cri-diluent">Diluent</label></div>
              <select id="kphos-cri-diluent" class="field-select" aria-label="CRI diluent" bind:value={criDiluentFluidId}>
                {#each KPHOS_BASE_FLUIDS as fluid}<option value={fluid.id}>{fluid.label}</option>{/each}
              </select>
            </div>
          </div>
        </section>
      {/if}
    </div>
  </article>

  {#if hasAnyTarget}
    <article class="ui-card min-w-0 overflow-hidden" data-testid="kphos-results">
    {#if issues.length}
      <div class="ui-alert m-3 border-amber-300/30 bg-amber-950/40 text-amber-100">
        <span class="font-black">Needed:</span> {issues.join(' ')}
      </div>
    {:else}
      <section class="ui-card-padding kphos-results-body" aria-label="Preparation and delivery">
        <div class="kphos-prep-groups">
          {#if mode === 'cri' && plan.hasPhosTarget}
            <section aria-label="CRI preparation">
              <h3 class="kphos-prep-title">Prepare the KPhos CRI</h3>
              {@render additive('KPhos', plan.kPhosStockMl)}
              <p class="kphos-prep-line">
                <strong class="ui-statement-value" data-testid="cri-diluent-volume">{fmtStock(plan.criDiluentVolumeMl)} mL {criDiluentFluid.label}</strong>
                <span>Diluent</span>
              </p>
              <p class="kphos-pump-instruction">Run at <strong data-testid="cri-pump-rate">{fmt(plan.criPumpRateMlHr, 3)} mL/hr</strong> for {fmtCompact(plan.criActualRuntimeHr)} hr.</p>
            </section>
          {/if}
          {#if mode === 'bag' || plan.hasKTarget}
            <section aria-label="Bag preparation">
              <h3 class="kphos-prep-title">Add to the {mode === 'cri' ? 'separate ' : ''}{fmtCompact(bagVolumeValue)} mL {mainFluid.label} bag</h3>
              {#if mode === 'bag' && plan.hasPhosTarget}
                {@render additive('KPhos', plan.kPhosStockMl)}
              {/if}
              {#if plan.hasKTarget}
                {@render additive('KCl', plan.kClStockMl)}
              {/if}
            </section>
          {:else}
            <span class="sr-only" data-testid="kcl-stock-volume">No KCl requested</span>
          {/if}
        </div>
        {#if alerts.length}
          <div class="ui-alert border-amber-300/30 bg-amber-950/40 text-amber-100">{alerts.join(' ')}</div>
        {/if}
        <div class="kphos-source-summary" data-testid="kphos-source-summary">
          <div class="kphos-tables">
            {@render composition(mode === 'bag' ? 'Fluid bag' : 'Main fluid', bagRows, false)}
            {#if mode === 'cri' && plan.hasPhosTarget}
              {@render composition('KPhos CRI', criRows, true)}
            {/if}
          </div>
          {#if mode === 'cri' && plan.hasPhosTarget}
            <section class="kphos-combined" aria-label="Total delivery from all sources" data-testid="kphos-delivery-summary">
              <h4 class="ui-section-title">Total delivery from all sources</h4>
              <p>Potassium <strong data-testid="total-k-delivery">{fmtDose(plan.totalKDeliveryMeqKgHr)} mEq/kg/hr</strong></p>
              <p>Phosphate <strong data-testid="total-phos-delivery">{fmtDose(plan.totalPhosDeliveryMmolKgHr)} mmol/kg/hr</strong></p>
            </section>
          {/if}
          {#if plan.mainFluidRateMlKgHr == null}
            <p class="kphos-rate-note">Enter patient weight and fluid rate to see delivery rates.</p>
          {/if}
        </div>
      </section>
    {/if}
    </article>
  {/if}

  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {#if issues.length}
      KPhos/KCl setup needs more information.
    {:else if hasAnyTarget}
      KPhos/KCl calculation updated. KPhos {plan.hasPhosTarget ? `${fmtStock(plan.kPhosStockMl)} mL` : 'not requested'}. KCl {plan.hasKTarget ? `${fmtStock(plan.kClStockMl)} mL` : 'not requested'}.
      {#if plan.mainFluidRateMlKgHr != null}
        Total potassium {fmtDose(plan.totalKDeliveryMeqKgHr)} mEq/kg/hr. Total phosphate {fmtDose(plan.totalPhosDeliveryMmolKgHr)} mmol/kg/hr.
      {:else}
        Enter patient weight and fluid rate to see delivery rates.
      {/if}
    {/if}
  </div>
</section>

{#snippet additive(drug: 'KPhos' | 'KCl', volume: number | null)}
  <p class="kphos-prep-line">
    <strong class="ui-statement-value" data-testid={drug === 'KCl' ? 'kcl-stock-volume' : 'kphos-stock-volume'}>{fmtStock(volume)} mL {drug}</strong>
    {#if drug === 'KCl'}
      <span>Adds {fmt(plan.kClTotalMeq)} mEq K</span>
    {:else}
      <span>Adds {fmt(kPhosAddedKMeq, 3)} mEq K and {fmt(kPhosAddedPhosMmol, 3)} mmol Phos</span>
    {/if}
  </p>
{/snippet}

{#snippet composition(title: string, rows: SourceRow[], cri: boolean)}
  <table class="kphos-table">
    <caption class="ui-section-title">{title} composition</caption>
    <thead><tr><th scope="col">Source</th><th scope="col">Potassium</th><th scope="col">Phosphate</th></tr></thead>
    <tbody class="ui-table-rows">
      {#each rows as row}
        {@const finalBag = row.id === 'final-bag'}
        {@const finalCri = row.id === 'final-cri'}
        {@const showTotal = finalBag && (mode === 'bag' || !plan.hasPhosTarget)}
        <tr class:kphos-total={finalBag || finalCri} data-testid={`${row.id}-component`}>
          <th scope="row">{row.label}{#if row.detail}<small>{row.detail}</small>{/if}</th>
          <td>
            <span data-testid={showTotal ? 'total-k-delivery' : undefined}>{fmtDose(row.kRate)}{#if row.kRate != null}{' '}<span class="kphos-unit">mEq/kg/hr</span>{/if}</span>
            <small data-testid={finalBag ? 'final-main-bag-k' : undefined}>{fmtConcentration(row.k)} {cri ? 'mEq' : 'mEq/L'}</small>
            {#if finalCri && plan.criTotalVolumeMl && row.k != null}<small>{fmtConcentration(row.k / plan.criTotalVolumeMl)} mEq/mL</small>{/if}
          </td>
          <td>
            <span data-testid={showTotal ? 'total-phos-delivery' : undefined}>{fmtDose(row.phosRate)}{#if row.phosRate != null}{' '}<span class="kphos-unit">mmol/kg/hr</span>{/if}</span>
            <small>{fmtConcentration(row.phos)} {cri ? 'mmol' : 'mmol/L'}</small>
            {#if finalCri && plan.criTotalVolumeMl && row.phos != null}<small>{fmtConcentration(row.phos / plan.criTotalVolumeMl)} mmol/mL</small>{/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
{/snippet}

<style>
  .kphos-input-header {
    position: relative;
    display: flex;
    min-height: 3.75rem;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    border-bottom: 1px solid var(--ui-divider);
    padding: 0.625rem 0.75rem;
  }

  .kphos-mode-picker { display: grid; justify-items: center; gap: 6px; }
  .kphos-mode-label { font-size: 12px; font-weight: 900; }
  .kphos-mode-control { width: 176px; }
  .kphos-target-column {
    min-width: 0;
    padding: 0.35rem 0.85rem 0.85rem;
    border: 1px solid var(--ui-panel-border);
    border-radius: 0.75rem;
  }

  .kphos-target-column legend { padding-inline: 0.35rem; font-size: 0.875rem; }
  .kphos-target-controls { display: grid; gap: 0.65rem; }
  .kphos-field > .ui-field-heading, .kphos-field > .ui-label { min-height: 1.125rem; }
  .kphos-form {
    display: grid;
  }

  .kphos-form-section {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    padding: 10px;
  }

  .kphos-form-section + .kphos-form-section {
    border-top: 1px solid var(--ui-divider);
  }

  .kphos-field-grid {
    display: grid;
    align-items: start;
    min-width: 0;
    gap: 16px;
  }

  .kphos-target-fields { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .kphos-bag-fields { grid-template-columns: minmax(0, 1fr) minmax(0, 0.75fr) minmax(0, 1.4fr); }
  .kphos-cri-setup-fields { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .kphos-bag-fields.kphos-main-no-bag { grid-template-columns: repeat(2, minmax(0, 1fr)); }

  @media (min-width: 1024px) {
    .kphos-field-grid { width: 100%; max-width: 42rem; margin-inline: auto; }
  }

  @media (min-width: 640px) {
    .kphos-input-header { padding-block: 0.375rem; }
    .kphos-form-section { padding: 0.625rem 0.75rem; }
  }

  .kphos-rate-controls { display: grid; grid-template-columns: minmax(0, 1fr) 7.6rem; gap: 0.5rem; }
  .kphos-rate-hint { color: var(--ui-text-300); font-size: 0.875rem; }
  .kphos-inline-number { font-variant-numeric: tabular-nums; }

  .kphos-results-body { display: grid; gap: 0.75rem; }
  .kphos-prep-groups, .kphos-tables { display: grid; gap: 1rem; }
  .kphos-prep-title {
    margin-bottom: 0.3rem;
    color: var(--ui-text-100);
    font-size: 1rem;
    font-weight: 700;
  }
  .kphos-prep-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.125rem 1rem;
    padding-block: 0.2rem;
    color: var(--ui-text-200);
    font-size: 0.9375rem;
  }
  .kphos-prep-line strong { min-width: 8rem; }
  .kphos-pump-instruction { margin-top: 0.3rem; color: var(--ui-text-100); }
  .kphos-source-summary { border-top: 1px solid var(--ui-divider); padding-top: 0.75rem; }
  .kphos-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    align-self: start;
    color: var(--ui-text-100);
    font-size: 0.9375rem;
    text-align: left;
    font-variant-numeric: tabular-nums;
  }
  .kphos-table caption { padding-bottom: 0.5rem; text-align: left; }
  .kphos-table :is(th, td) { padding: 0.35rem 0.5rem; vertical-align: top; }
  .kphos-table :is(th, td):first-child { padding-left: 0; }
  .kphos-table :is(th, td):last-child { padding-right: 0; }
  .kphos-table thead { border-bottom: 1px solid var(--ui-border); }
  .kphos-table thead th { color: var(--ui-text-200); font-size: 0.875rem; }
  .kphos-table th { font-weight: 600; }
  .kphos-unit { white-space: nowrap; }
  .kphos-unit, .kphos-table small {
    color: var(--ui-text-300);
    font-size: 0.8125rem;
    font-weight: 500;
  }
  .kphos-table small { display: block; }
  .kphos-table .kphos-total { border-top: 1px solid var(--ui-border-strong); }
  .kphos-total > :is(td, th) { font-weight: 750; }
  .kphos-combined {
    margin-top: 0.75rem;
    border-top: 1px solid var(--ui-border);
    padding-top: 0.75rem;
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.25rem 1.25rem;
    font-size: 0.9375rem;
  }
  .kphos-combined strong { color: var(--ui-text-100); white-space: nowrap; }
  .kphos-rate-note { margin-top: 0.5rem; font-size: 0.875rem; color: var(--ui-text-200); }

  @media (min-width: 900px) {
    .kphos-prep-groups:has(> section + section),
    .kphos-tables:has(> table + table) { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.5rem; }
  }

  @media (max-width: 639px) {
    .kphos-prep-line { display: grid; gap: 0; }
    .kphos-unit { display: block; }
    .kphos-input-header {
      flex-direction: column;
      align-items: center;
      padding: 10px;
    }


    .kphos-mode-control {
      width: 9.5rem;
    }

    .kphos-form-section {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.65rem;
      padding: 10px;
    }

    .kphos-bag-fields,
    .kphos-cri-setup-fields {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .kphos-field-grid {
      gap: 1rem;
      align-items: start;
    }

    .kphos-target-fields { grid-template-columns: minmax(0, 1fr); }

    .kphos-bag-fields > .kphos-rate-field,
    .kphos-bag-fields.kphos-main-no-bag > .kphos-field {
      grid-column: 1 / -1;
    }

    .kphos-cri-setup-fields > .kphos-field:last-child {
      grid-column: 1 / -1;
    }

  }

</style>
