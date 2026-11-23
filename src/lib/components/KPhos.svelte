<script lang="ts">
  import ToolDisclosure from './ToolDisclosure.svelte';
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
  $: fluidRateLabel = mode === 'cri' ? 'Main fluid rate' : 'Fluid rate';
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

<section class="kphos-tool ui-tool-stack text-slate-200" class:kphos-separate={mode === 'cri'} aria-label="KPhos/KCl calculator">
  <article class="ui-card min-w-0 overflow-hidden" data-testid="kphos-input-card">
    <header class="kphos-input-header">
      <div class="kphos-mode-picker">
        <span id="kphos-mode-label" class="ui-label">Give KPhos in</span>
        <div class="ui-segmented kphos-mode-control" role="radiogroup" aria-labelledby="kphos-mode-label">
          <label class="ui-choice" class:is-selected={mode === 'bag'}><input type="radio" name="kphos-preparation-mode" value="bag" bind:group={mode} />Fluid bag</label>
          <label class="ui-choice" class:is-selected={mode === 'cri'}><input type="radio" name="kphos-preparation-mode" value="cri" bind:group={mode} />Separate CRI</label>
        </div>
      </div>
    </header>

    <div class="kphos-form" class:kphos-cri-form={mode === 'cri'} data-testid="kphos-statements">
      <section class="kphos-form-section kphos-target-section" aria-label="Medication targets">
        <div class="kphos-field-grid kphos-target-fields">
          <fieldset class="kphos-target-column min-w-0 border-b ui-rule pb-3 sm:border-b-0 sm:border-r sm:pr-3 sm:pb-0">
            <legend class="ui-section-title mb-1.5">Phosphate target</legend>
            <div class="ui-field">
              <div class="ui-segmented" role="radiogroup" aria-label="Phosphate calculation mode" aria-describedby="kphos-phos-basis-note">
                <label class="ui-choice" class:is-selected={phosTargetBasis === 'added'}><input type="radio" name="kphos-phosphate-basis" value="added" bind:group={phosTargetBasis} />Added phosphate</label>
                <label class="ui-choice" class:is-selected={phosTargetBasis === 'total'}><input type="radio" name="kphos-phosphate-basis" value="total" bind:group={phosTargetBasis} />Total phosphate</label>
              </div>
              <div class="ui-field kphos-field">
                <label class="ui-label" for="kphos-phos-target">Phosphate delivery <span class="ui-unit">(mmol/kg/hr)</span></label>
                <input id="kphos-phos-target" class="field-control kphos-inline-number" type="number" min="0" step="0.001" inputmode="decimal" placeholder="optional" aria-label="Phosphate target (mmol/kg/hr)" bind:value={phosTargetMmolKgHr} />
              </div>
              <p class="ui-note" id="kphos-phos-basis-note">{phosTargetBasis === 'added' ? 'Counts phosphate from KPhos only.' : 'Counts phosphate from KPhos and fluids.'}</p>
            </div>
          </fieldset>
          <fieldset class="kphos-target-column min-w-0 sm:pl-3">
            <legend class="ui-section-title mb-1.5">Potassium target</legend>
            <div class="ui-field">
              <div class="ui-segmented" role="radiogroup" aria-label="Potassium calculation mode" aria-describedby="kphos-k-basis-note">
                <label class="ui-choice" class:is-selected={kTargetBasis === 'added'}><input type="radio" name="kphos-potassium-basis" value="added" bind:group={kTargetBasis} />Added potassium</label>
                <label class="ui-choice" class:is-selected={kTargetBasis === 'total'}><input type="radio" name="kphos-potassium-basis" value="total" bind:group={kTargetBasis} />Total potassium</label>
              </div>
              <div class="ui-field kphos-field">
                <label class="ui-label" for="kphos-k-target">Potassium concentration <span class="ui-unit">(mEq/L)</span></label>
                <input id="kphos-k-target" class="field-control kphos-inline-number" type="number" min="0" step="1" inputmode="decimal" placeholder="optional" aria-label={`${kBasisLabel} potassium target (mEq/L)`} bind:value={kTargetMeqPerL} />
              </div>
              <p class="ui-note" id="kphos-k-basis-note">{kTargetBasis === 'added' ? 'Counts potassium from KPhos and KCl.' : 'Counts potassium from KPhos, KCl and fluids.'}</p>
            </div>
          </fieldset>
        </div>
      </section>

      <section class="kphos-form-section" aria-label="Main fluid settings">
        {#if mode === 'cri'}<h3 class="ui-section-title">Main fluid</h3>{/if}
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
            <div class="ui-field-heading"><label class="ui-label" for="kphos-main-fluid-rate">{fluidRateLabel}</label></div>
            <div class="kphos-rate-controls">
              <input id="kphos-main-fluid-rate" class="field-control kphos-inline-number" type="number" min="0" step="any" inputmode="decimal" aria-label={`${fluidRateLabel} (${fluidRateUnit})`} aria-describedby={rateNeedsWeight ? 'kphos-rate-hint' : undefined} bind:value={mainFluidRate} on:input={event => enterFluidRate(event.currentTarget.valueAsNumber)} />
              <select class="field-select" aria-label="Fluid rate unit" aria-describedby={rateNeedsWeight ? 'kphos-rate-hint' : undefined} value={fluidRateUnit} on:change={event => changeFluidRateUnit(event.currentTarget.value as FluidRateUnit)}>
                {#each fluidRateUnits as unit}
                  <option value={unit} disabled={rateNeedsWeight && (unit === 'mL/hr') !== (fluidRateUnit === 'mL/hr')}>{unit}</option>
                {/each}
              </select>
            </div>
            {#if rateNeedsWeight}
              <span id="kphos-rate-hint" class="ui-note">Enter patient weight to convert the fluid rate.</span>
            {:else if fluidRateUnit !== 'mL/hr' && isPositive(mainRateValue)}
              <span class="ui-note">Equivalent to {fmtDose(mainRateValue)} mL/hr</span>
            {/if}
          </div>
        </div>
      </section>

      {#if mode === 'cri'}
        <section class="kphos-form-section" aria-label="CRI preparation settings">
          <h3 class="ui-section-title">Separate CRI</h3>
          <div class="kphos-field-grid kphos-cri-setup-fields">
            <div class="ui-field kphos-field">
              <label class="ui-label" for="kphos-cri-duration">Duration <span class="ui-unit">(hr)</span></label>
              <input id="kphos-cri-duration" class="field-control kphos-inline-number" type="number" min="0" step="0.1" inputmode="decimal" aria-label="Duration (hr)" bind:value={criDurationHr} />
            </div>
            <div class="ui-field kphos-field">
              <label class="ui-label" for="kphos-cri-rate">CRI pump rate <span class="ui-unit">(mL/hr)</span></label>
              <input id="kphos-cri-rate" class="field-control kphos-inline-number" type="number" min="0" step="0.1" inputmode="decimal" placeholder="optional" aria-label="CRI pump rate (mL/hr)" bind:value={criRateMlHr} />
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
    <section class="ui-tool-stack" data-testid="kphos-results" aria-label="Preparation and delivery">
      {#if issues.length}
        <div class="ui-alert border-amber-300/30 bg-amber-950/40 text-amber-100">
          <strong>Needed:</strong> {issues.join(' ')}
        </div>
      {:else}
        {#if alerts.length}
          <div class="ui-alert border-amber-300/30 bg-amber-950/40 text-amber-100">{alerts.join(' ')}</div>
        {/if}
        <div class="ui-tool-stack" data-testid="kphos-source-summary">
          <div class="kphos-destinations">
            {@render vessel(false, bagRows)}
            {#if mode === 'cri' && plan.hasPhosTarget}
              {@render vessel(true, criRows)}
            {/if}
          </div>
          {#if mode === 'cri' && plan.hasPhosTarget}
            <section class="ui-card ui-card-padding kphos-combined" aria-label="Total delivery from all sources" data-testid="kphos-delivery-summary">
              <h4 class="ui-section-title">Total delivery from all sources</h4>
              <p class="ui-instruction">Phosphate <strong class="ui-row-value" data-testid="total-phos-delivery">{fmtDose(plan.totalPhosDeliveryMmolKgHr)} mmol/kg/hr</strong></p>
              <p class="ui-instruction">Potassium <strong class="ui-row-value" data-testid="total-k-delivery">{fmtDose(plan.totalKDeliveryMeqKgHr)} mEq/kg/hr</strong></p>
            </section>
          {/if}
        </div>
      {/if}
    </section>
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

{#snippet vessel(cri: boolean, rows: SourceRow[])}
  {@const title = cri ? 'KPhos CRI' : mode === 'bag' ? 'Fluid bag' : 'Main fluid'}
  {@const hasDraws = cri || mode === 'bag' || plan.hasKTarget}
  {@const prepTitle = cri ? 'CRI preparation' : hasDraws ? 'Bag preparation' : 'Running main fluid'}
  <section class="ui-tool-stack kphos-destination" aria-label={cri ? 'Separate KPhos CRI' : 'Main fluid'}>
    <article class="ui-card overflow-hidden">
      <div class="ui-card-padding">
        <h3 class="ui-section-title">{cri ? 'Separate CRI preparation' : prepTitle}</h3>
        {#if hasDraws}
          {#if !cri}
            <p class="ui-instruction mt-1">
              Add to the {mode === 'cri' ? 'separate ' : ''}<strong class="text-slate-100">{fmtCompact(bagVolumeValue)} mL {mainFluid.label} bag</strong>.
            </p>
          {/if}
          <div class="kphos-table-frame mt-2">
            <table class="kphos-table kphos-prep-table" aria-label={prepTitle}>
              <thead class="ui-label"><tr>
                <th scope="col">Medication</th>
                <th scope="col">Adds to {cri ? 'CRI' : 'bag'}</th>
                <th scope="col" class="draw-volume">Draw</th>
              </tr></thead>
              <tbody class="ui-table-rows">
                {#if cri || (mode === 'bag' && plan.hasPhosTarget)}
                  {@render additive('KPhos', plan.kPhosStockMl, cri)}
                {/if}
                {#if !cri && plan.hasKTarget}
                  {@render additive('KCl', plan.kClStockMl, false)}
                {/if}
              </tbody>
            </table>
          </div>
          {#if cri && plan.criTotalVolumeMl != null && plan.criTotalVolumeMl > 0}
            <div class="ui-instruction kphos-pump">
              <p>Diluent <strong class="ui-row-value" data-testid="cri-diluent-volume">{fmtStock(plan.criDiluentVolumeMl)} mL {criDiluentFluid.label}</strong></p>
              <p>CRI pump <strong class="ui-row-value" data-testid="cri-pump-rate">{fmt(plan.criPumpRateMlHr, 3)} mL/hr</strong> for {fmtCompact(plan.criActualRuntimeHr)} hr</p>
            </div>
          {/if}
        {:else}
          <p class="ui-instruction mt-1">{mainFluid.label} at <strong class="ui-statement-value">{fmtCompact(mainRateValue)} mL/hr</strong></p>
        {/if}
        {#if !cri && mode === 'cri' && !plan.hasKTarget}
          <span class="sr-only" data-testid="kcl-stock-volume">No KCl requested</span>
        {/if}
      </div>
      <div class="ui-card-padding border-t ui-rule">
        <h4 class="ui-section-title" id={`delivery-${cri ? 'cri' : 'bag'}`}>{title} delivery to patient</h4>
        <table class="kphos-table kphos-delivery-table mt-2" aria-labelledby={`delivery-${cri ? 'cri' : 'bag'}`}>
          {@render columnHeadings('mmol/kg/hr', 'mEq/kg/hr')}
          <tbody class="ui-table-rows">
            {#each rows as row}
              {@const finalBag = row.id === 'final-bag'}
              {@const showTotal = finalBag && (mode === 'bag' || !plan.hasPhosTarget)}
              <tr class:kphos-total={finalBag || row.id === 'final-cri'} data-testid={`${row.id}-component`}>
                {@render sourceLabel(row)}
                <td data-testid={showTotal ? 'total-phos-delivery' : undefined}>
                  {fmtDose(row.phosRate)}{#if row.phosRate != null}{' '}<span class="ui-unit">mmol/kg/hr</span>{/if}
                </td>
                <td data-testid={showTotal ? 'total-k-delivery' : undefined}>
                  {fmtDose(row.kRate)}{#if row.kRate != null}{' '}<span class="ui-unit">mEq/kg/hr</span>{/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if !cri && plan.mainFluidRateMlKgHr == null}
          <p class="ui-meta mt-2">Enter patient weight and fluid rate to see delivery rates.</p>
        {/if}
      </div>
    </article>
    <ToolDisclosure title={cri ? 'CRI amounts and concentrations' : 'Bag concentrations'} open={plan.mainFluidRateMlKgHr == null}>
      <table class="kphos-table kphos-delivery-table" aria-label={cri ? 'Electrolyte amounts in CRI' : 'Electrolyte concentrations in fluid bag'}>
        {@render columnHeadings(cri ? 'mmol' : 'mmol/L', cri ? 'mEq' : 'mEq/L')}
        <tbody class="ui-table-rows">
          {#each rows as row}
            <tr class:kphos-total={row.id === 'final-bag' || row.id === 'final-cri'}>
              {@render sourceLabel(row)}
              <td>{fmtConcentration(row.phos)} <span class="ui-unit">{cri ? 'mmol' : 'mmol/L'}</span></td>
              <td data-testid={row.id === 'final-bag' ? 'final-main-bag-k' : undefined}>{fmtConcentration(row.k)} <span class="ui-unit">{cri ? 'mEq' : 'mEq/L'}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if cri && plan.criTotalVolumeMl != null && plan.criTotalVolumeMl > 0}
        <p class="ui-instruction kphos-cri-concentration">
          <strong>Prepared CRI concentration</strong>
          <span>{fmtConcentration((kPhosAddedPhosMmol + criDiluentPhosMmol) / plan.criTotalVolumeMl)} mmol/mL phosphate</span>
          <span>{fmtConcentration((kPhosAddedKMeq + criDiluentKMeq) / plan.criTotalVolumeMl)} mEq/mL potassium</span>
        </p>
      {/if}
    </ToolDisclosure>
  </section>
{/snippet}

{#snippet additive(drug: 'KPhos' | 'KCl', volume: number | null, cri: boolean)}
  {@const chloride = drug === 'KCl'}
  <tr>
    <th scope="row" class="font-semibold text-slate-100">{chloride ? 'Potassium chloride (KCl)' : 'Potassium phosphate (KPhos)'}</th>
    <td class="kphos-added">
      <span class="ui-unit kphos-mobile-label">Adds to {cri ? 'CRI' : 'bag'}</span>
      {#if chloride}
        <span>{fmt(plan.kClTotalMeq)} mEq potassium</span>
      {:else}
        <span>{fmt(kPhosAddedPhosMmol, 3)} mmol phosphate and {fmt(kPhosAddedKMeq, 3)} mEq potassium</span>
      {/if}
    </td>
    <td class="draw-volume">
      <span class="ui-unit kphos-mobile-label">Draw</span>
      <strong class="ui-statement-value" data-testid={chloride ? 'kcl-stock-volume' : 'kphos-stock-volume'}>{fmtStock(volume)} <span class="ui-unit">mL</span></strong>
      {#if volume === 0}<span class="ui-meta block">No draw needed</span>{/if}
    </td>
  </tr>
{/snippet}

{#snippet columnHeadings(phosUnit: string, kUnit: string)}
  <thead class="ui-label">
    <tr class="border-b ui-rule">
      <th scope="col">Source</th>
      <th scope="col">Phosphate<span class="sr-only">{' '}{phosUnit}</span></th>
      <th scope="col">Potassium<span class="sr-only">{' '}{kUnit}</span></th>
    </tr>
  </thead>
{/snippet}

{#snippet sourceLabel(row: SourceRow)}
  <th scope="row" class="font-semibold text-slate-100">{row.label}{#if row.detail}<small class="ui-meta block">{row.detail}</small>{/if}</th>
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
  .kphos-mode-control { width: min(16rem, 100%); }
  .ui-choice { position: relative; font-size: 0.75rem; line-height: 1rem; }
  .ui-choice input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    cursor: pointer;
    opacity: 0;
  }
  .ui-choice:has(input:focus-visible) {
    outline: 2px solid var(--ui-accent-border);
    outline-offset: 2px;
  }
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
  .kphos-cri-form .kphos-form-section { gap: 0.5rem; }

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

  @media (min-width: 1100px) {
    .kphos-input-header { min-height: 0; }
    .kphos-mode-picker { position: relative; width: 16rem; }
    .kphos-mode-picker > .ui-label {
      position: absolute;
      right: calc(100% + 0.75rem);
      align-self: center;
      white-space: nowrap;
    }
    .kphos-cri-form { grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); }
    .kphos-cri-form .kphos-target-section { grid-column: 1 / -1; }
    .kphos-cri-form .kphos-form-section:last-child { border-left: 1px solid var(--ui-divider); }
    .kphos-cri-form .kphos-form-section { align-content: start; }
    .kphos-cri-form .kphos-bag-fields, .kphos-cri-form .kphos-cri-setup-fields { gap: 0.625rem; }
    .kphos-cri-form :is(.kphos-bag-fields, .kphos-cri-setup-fields) .kphos-field > :is(.ui-field-heading, .ui-label) { min-height: 1.75rem; }
    .kphos-cri-form .kphos-bag-fields:not(.kphos-main-no-bag) {
      grid-template-columns: minmax(0, 1fr) minmax(4.75rem, 0.65fr) minmax(13.5rem, 1.65fr);
    }
  }

  @media (min-width: 640px) {
    .kphos-input-header { padding-block: 0.375rem; }
    .kphos-form-section { padding: 0.625rem 0.75rem; }
  }

  .kphos-rate-controls { display: grid; grid-template-columns: minmax(0, 1fr) 7.6rem; gap: 0.5rem; }
  .kphos-inline-number { font-variant-numeric: tabular-nums; }

  .kphos-destinations { display: grid; gap: 0.75rem; }
  .kphos-destination { min-width: 0; align-content: start; }
  .kphos-table-frame { overflow: hidden; border: 1px solid var(--ui-inset-border); border-radius: 6px; }
  .kphos-table { width: 100%; table-layout: fixed; text-align: left; font-size: 0.875rem; font-variant-numeric: tabular-nums; }
  .kphos-table :is(th, td) { padding: 0.375rem 0.625rem; vertical-align: middle; }
  .kphos-table .ui-unit { white-space: nowrap; }
  .kphos-prep-table thead { background: var(--ui-surface); }
  .kphos-prep-table tbody tr { border-top: 1px solid var(--ui-result-divider); background: var(--ui-surface-3); }
  .kphos-prep-table tbody tr:nth-child(even) { background: var(--ui-surface-2); }
  .kphos-prep-table :is(th, td):first-child { width: 40%; }
  .kphos-prep-table .draw-volume { width: 20%; text-align: right; }
  .draw-volume strong { font-size: 1.125rem; white-space: nowrap; }
  .kphos-added > span { display: block; }
  .kphos-prep-table .kphos-mobile-label { display: none; }
  .kphos-delivery-table :is(td, th):not(:first-child) { text-align: right; }
  .kphos-delivery-table :is(td, th):first-child { padding-inline-start: 0; }
  .kphos-delivery-table :is(td, th):last-child { padding-inline-end: 0; }
  .kphos-delivery-table .kphos-total { border-top: 1px solid var(--ui-border-strong); font-weight: 750; color: var(--ui-text-100); }
  .kphos-pump, .kphos-cri-concentration, .kphos-combined { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0.25rem 1rem; }
  .kphos-pump, .kphos-cri-concentration { margin-top: 0.375rem; }

  @media (min-width: 900px) {
    .kphos-destinations:has(> section + section) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  @media (min-width: 1440px) {
    .kphos-tool:not(.kphos-separate) .kphos-destination { grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); align-items: start; }
    .kphos-separate { grid-template-columns: 26.5rem minmax(0, 1fr); align-items: start; }
    .kphos-separate .kphos-mode-picker { width: 100%; }
    .kphos-separate .kphos-mode-picker > .ui-label { position: static; }
    .kphos-cri-form { grid-template-columns: minmax(0, 1fr); }
    .kphos-cri-form .kphos-target-fields { gap: 0.75rem; }
    .kphos-cri-form .kphos-target-column:last-child { padding-left: 0; }
    .kphos-cri-form .kphos-target-column .ui-choice { white-space: normal; text-align: center; }
    .kphos-cri-form .kphos-target-column .ui-label { min-height: 2rem; }
    .kphos-cri-form .kphos-form-section:last-child { border-left: 0; }
    .kphos-cri-form .kphos-bag-fields:not(.kphos-main-no-bag) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .kphos-cri-form .kphos-bag-fields .kphos-rate-field { grid-column: 1 / -1; }
    .kphos-cri-form .kphos-main-no-bag { grid-template-columns: minmax(0, 1fr); }
    .kphos-cri-form .kphos-bag-fields .kphos-field > :is(.ui-field-heading, .ui-label) { min-height: 1.125rem; }
  }

  @media (max-width: 639px) {
    .kphos-table :is(th, td) { padding-inline: 0.375rem; }
    .kphos-prep-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    .kphos-prep-table, .kphos-prep-table tbody { display: block; }
    .kphos-prep-table tbody tr { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 0.25rem 0.5rem; padding: 0.5rem 0.625rem; }
    .kphos-prep-table tbody tr:first-child { border-top: 0; }
    .kphos-prep-table tbody :is(th, td) { padding: 0; }
    .kphos-prep-table tbody th:first-child, .kphos-prep-table .draw-volume { width: auto; }
    .kphos-prep-table .draw-volume { grid-column: 2; grid-row: 1; }
    .kphos-prep-table .kphos-mobile-label { display: inline; margin-inline-end: 0.25rem; }
    .kphos-added { grid-column: 1 / -1; }
    .kphos-added > span { display: inline; }
    .kphos-delivery-table .ui-unit { display: block; }
    .kphos-input-header {
      flex-direction: column;
      align-items: center;
      padding: 10px;
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
