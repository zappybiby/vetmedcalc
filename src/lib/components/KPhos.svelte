<script lang="ts">
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

<section class="kphos-tool ui-tool-stack text-slate-200" aria-label="KPhos/KCl calculator">
  <article class="ui-card min-w-0 overflow-hidden" data-testid="kphos-input-card">
    <header class="kphos-input-header">
      <div class="kphos-mode-picker">
        <span id="kphos-mode-label" class="ui-label">Give KPhos in</span>
        <div class="kphos-choice-group kphos-mode-control" role="radiogroup" aria-labelledby="kphos-mode-label">
          <label><input type="radio" name="kphos-preparation-mode" value="bag" bind:group={mode} />Fluid bag</label>
          <label><input type="radio" name="kphos-preparation-mode" value="cri" bind:group={mode} />Separate CRI</label>
        </div>
      </div>
    </header>

    <div class="kphos-form" class:kphos-cri-form={mode === 'cri'} data-testid="kphos-statements">
      <section class="kphos-form-section kphos-target-section" aria-label="Medication targets">
        <div class="kphos-field-grid kphos-target-fields">
          <fieldset class="kphos-target-column phosphate">
            <legend class="ui-section-title">Phosphate target</legend>
            <div class="kphos-target-controls">
              <div class="kphos-choice-group" role="radiogroup" aria-label="Phosphate calculation mode" aria-describedby="kphos-phos-basis-note">
                <label><input type="radio" name="kphos-phosphate-basis" value="added" bind:group={phosTargetBasis} />Added phosphate</label>
                <label><input type="radio" name="kphos-phosphate-basis" value="total" bind:group={phosTargetBasis} />Total phosphate</label>
              </div>
              <div class="ui-field kphos-field">
                <label class="ui-label" for="kphos-phos-target">Phosphate delivery <span class="ui-unit">(mmol/kg/hr)</span></label>
                <input id="kphos-phos-target" class="field-control kphos-inline-number" type="number" min="0" step="0.001" inputmode="decimal" placeholder="optional" aria-label="Phosphate target (mmol/kg/hr)" bind:value={phosTargetMmolKgHr} />
              </div>
              <p class="kphos-basis-note" id="kphos-phos-basis-note">{phosTargetBasis === 'added' ? 'Counts phosphate from KPhos only.' : 'Counts phosphate from KPhos and fluids.'}</p>
            </div>
          </fieldset>
          <fieldset class="kphos-target-column potassium">
            <legend class="ui-section-title">Potassium target</legend>
            <div class="kphos-target-controls">
              <div class="kphos-choice-group" role="radiogroup" aria-label="Potassium calculation mode" aria-describedby="kphos-k-basis-note">
                <label><input type="radio" name="kphos-potassium-basis" value="added" bind:group={kTargetBasis} />Added potassium</label>
                <label><input type="radio" name="kphos-potassium-basis" value="total" bind:group={kTargetBasis} />Total potassium</label>
              </div>
              <div class="ui-field kphos-field">
                <label class="ui-label" for="kphos-k-target">Potassium concentration <span class="ui-unit">(mEq/L)</span></label>
                <input id="kphos-k-target" class="field-control kphos-inline-number" type="number" min="0" step="1" inputmode="decimal" placeholder="optional" aria-label={`${kBasisLabel} potassium target (mEq/L)`} bind:value={kTargetMeqPerL} />
              </div>
              <p class="kphos-basis-note" id="kphos-k-basis-note">{kTargetBasis === 'added' ? 'Counts potassium from KPhos and KCl.' : 'Counts potassium from KPhos, KCl and fluids.'}</p>
            </div>
          </fieldset>
        </div>
      </section>

      <section class="kphos-form-section" aria-label="Main fluid settings">
        {#if mode === 'cri'}<h3 class="ui-section-title kphos-settings-title">Main fluid</h3>{/if}
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
              <span id="kphos-rate-hint" class="kphos-rate-hint">Enter patient weight to convert the fluid rate.</span>
            {:else if fluidRateUnit !== 'mL/hr' && isPositive(mainRateValue)}
              <span class="kphos-rate-hint">Equivalent to {fmtDose(mainRateValue)} mL/hr</span>
            {/if}
          </div>
        </div>
      </section>

      {#if mode === 'cri'}
        <section class="kphos-form-section" aria-label="CRI preparation settings">
          <h3 class="ui-section-title kphos-settings-title">Separate CRI</h3>
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
    <article class="ui-card min-w-0 overflow-hidden" data-testid="kphos-results">
    {#if issues.length}
      <div class="ui-alert m-3 border-amber-300/30 bg-amber-950/40 text-amber-100">
        <span class="font-black">Needed:</span> {issues.join(' ')}
      </div>
    {:else}
      <section class="ui-card-padding kphos-results-body" aria-label="Preparation and delivery">
        {#if alerts.length}
          <div class="ui-alert border-amber-300/30 bg-amber-950/40 text-amber-100">{alerts.join(' ')}</div>
        {/if}
        <div class="kphos-source-summary" data-testid="kphos-source-summary">
          <div class="kphos-destinations">
            <section class="kphos-destination" aria-label="Main fluid">
              <div>
                {#if mode === 'bag' || plan.hasKTarget}
                  <h3 class="kphos-prep-title">Add to the {mode === 'cri' ? 'separate ' : ''}{fmtCompact(bagVolumeValue)} mL {mainFluid.label} bag</h3>
                  <div class="kphos-draws">
                    {#if mode === 'bag' && plan.hasPhosTarget}
                      {@render additive('KPhos', plan.kPhosStockMl, 'bag')}
                    {/if}
                    {#if plan.hasKTarget}
                      {@render additive('KCl', plan.kClStockMl, 'bag')}
                    {/if}
                  </div>
                {:else}
                  <h3 class="kphos-prep-title">Running main fluid</h3>
                  <p>{mainFluid.label} at <strong>{fmtCompact(mainRateValue)} mL/hr</strong></p>
                  <span class="sr-only" data-testid="kcl-stock-volume">No KCl requested</span>
                {/if}
              </div>
              {@render composition(mode === 'bag' ? 'Fluid bag' : 'Main fluid', bagRows, false)}
            </section>
            {#if mode === 'cri' && plan.hasPhosTarget}
              <section class="kphos-destination" aria-label="Separate KPhos CRI">
                <div>
                  <h3 class="kphos-prep-title">Prepare the separate KPhos CRI</h3>
                  {@render additive('KPhos', plan.kPhosStockMl, 'CRI')}
                  {#if plan.criTotalVolumeMl != null && plan.criTotalVolumeMl > 0}
                    <div class="kphos-pump">
                      <p>Diluent <strong data-testid="cri-diluent-volume">{fmtStock(plan.criDiluentVolumeMl)} mL {criDiluentFluid.label}</strong></p>
                      <p>CRI pump <strong data-testid="cri-pump-rate">{fmt(plan.criPumpRateMlHr, 3)} mL/hr</strong> for {fmtCompact(plan.criActualRuntimeHr)} hr</p>
                    </div>
                  {/if}
                </div>
                {@render composition('KPhos CRI', criRows, true)}
              </section>
            {/if}
          </div>
          {#if mode === 'cri' && plan.hasPhosTarget}
            <section class="kphos-combined" aria-label="Total delivery from all sources" data-testid="kphos-delivery-summary">
              <h4 class="ui-section-title">Total delivery from all sources</h4>
              <p>Phosphate <strong data-testid="total-phos-delivery">{fmtDose(plan.totalPhosDeliveryMmolKgHr)} mmol/kg/hr</strong></p>
              <p>Potassium <strong data-testid="total-k-delivery">{fmtDose(plan.totalKDeliveryMeqKgHr)} mEq/kg/hr</strong></p>
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

{#snippet additive(drug: 'KPhos' | 'KCl', volume: number | null, destination: 'bag' | 'CRI')}
  {@const chloride = drug === 'KCl'}
  <section class="kphos-draw" class:potassium={chloride} class:phosphate={!chloride} aria-labelledby={`prep-${drug}`}>
    <h4 id={`prep-${drug}`}>{chloride ? 'Potassium chloride (KCl)' : 'Potassium phosphate (KPhos)'}</h4>
    <div class="kphos-draw-body">
      <div class="kphos-draw-volume">
        <span class="kphos-detail-label">{volume === 0 ? 'No draw needed' : 'Draw'}</span>
        <strong class="ui-statement-value" data-testid={chloride ? 'kcl-stock-volume' : 'kphos-stock-volume'}>{fmtStock(volume)} mL</strong>
      </div>
      <div class="kphos-added">
        <span class="kphos-detail-label">Adds to {destination}</span>
        {#if chloride}
          <span>{fmt(plan.kClTotalMeq)} mEq potassium</span>
        {:else}
          <span>{fmt(kPhosAddedPhosMmol, 3)} mmol phosphate</span>
          <span>{fmt(kPhosAddedKMeq, 3)} mEq potassium</span>
        {/if}
      </div>
    </div>
  </section>
{/snippet}

{#snippet columnHeadings(phosUnit: string, kUnit: string)}
  <thead>
    <tr>
      <th scope="col">Source</th>
      <th scope="col" class="phosphate">Phosphate<span class="sr-only">{' '}{phosUnit}</span></th>
      <th scope="col" class="potassium">Potassium<span class="sr-only">{' '}{kUnit}</span></th>
    </tr>
  </thead>
{/snippet}

{#snippet sourceLabel(row: SourceRow)}
  <th scope="row" class:phosphate={row.id === 'kphos'} class:potassium={row.id === 'kcl'}>{row.label}{#if row.detail}<small>{row.detail}</small>{/if}</th>
{/snippet}

{#snippet composition(title: string, rows: SourceRow[], cri: boolean)}
  <div class="kphos-vessel">
    <table class="kphos-table">
      <caption>{title} delivery to patient</caption>
      {@render columnHeadings('mmol/kg/hr', 'mEq/kg/hr')}
      <tbody class="ui-table-rows">
        {#each rows as row}
          {@const finalBag = row.id === 'final-bag'}
          {@const showTotal = finalBag && (mode === 'bag' || !plan.hasPhosTarget)}
          <tr class:kphos-total={finalBag || row.id === 'final-cri'} data-testid={`${row.id}-component`}>
            {@render sourceLabel(row)}
            <td data-testid={showTotal ? 'total-phos-delivery' : undefined}>
              {fmtDose(row.phosRate)}{#if row.phosRate != null}{' '}<span class="kphos-cell-unit">mmol/kg/hr</span>{/if}
            </td>
            <td data-testid={showTotal ? 'total-k-delivery' : undefined}>
              {fmtDose(row.kRate)}{#if row.kRate != null}{' '}<span class="kphos-cell-unit">mEq/kg/hr</span>{/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    <details class="kphos-composition-details" open={plan.mainFluidRateMlKgHr == null}>
      <summary>{cri ? 'CRI amounts and concentrations' : 'Bag concentrations'}</summary>
      <table class="kphos-table" aria-label={cri ? 'Electrolyte amounts in CRI' : 'Electrolyte concentrations in fluid bag'}>
        {@render columnHeadings(cri ? 'mmol' : 'mmol/L', cri ? 'mEq' : 'mEq/L')}
        <tbody class="ui-table-rows">
          {#each rows as row}
            <tr class:kphos-total={row.id === 'final-bag' || row.id === 'final-cri'}>
              {@render sourceLabel(row)}
              <td>{fmtConcentration(row.phos)} <span class="kphos-cell-unit">{cri ? 'mmol' : 'mmol/L'}</span></td>
              <td data-testid={row.id === 'final-bag' ? 'final-main-bag-k' : undefined}>{fmtConcentration(row.k)} <span class="kphos-cell-unit">{cri ? 'mEq' : 'mEq/L'}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
      {#if cri && plan.criTotalVolumeMl != null && plan.criTotalVolumeMl > 0}
        <p class="kphos-cri-concentration">
          <strong>Prepared CRI concentration</strong>
          <span>{fmtConcentration((kPhosAddedPhosMmol + criDiluentPhosMmol) / plan.criTotalVolumeMl)} mmol/mL phosphate</span>
          <span>{fmtConcentration((kPhosAddedKMeq + criDiluentKMeq) / plan.criTotalVolumeMl)} mEq/mL potassium</span>
        </p>
      {/if}
    </details>
  </div>
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
  .kphos-choice-group { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.375rem; }
  .kphos-choice-group label {
    display: flex;
    min-height: 2.125rem;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.3rem 0.25rem;
    border: 1px solid var(--ui-field-border);
    border-radius: 0.5rem;
    color: var(--ui-text-200);
    background: var(--ui-field-bg);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    line-height: 1.2;
  }
  .kphos-choice-group input {
    flex: none;
    width: 1rem;
    height: 1rem;
    margin: 0;
    accent-color: var(--electrolyte-accent, var(--ui-accent-border));
  }
  .kphos-choice-group label:has(input:checked) {
    border-color: var(--electrolyte-accent, var(--ui-accent-border));
    background: var(--electrolyte-surface, var(--ui-accent-surface));
    color: var(--ui-text-100);
    box-shadow: inset 0 0 0 1px var(--electrolyte-accent, var(--ui-accent-border));
  }
  .kphos-choice-group label:has(input:focus-visible) {
    outline: 2px solid var(--ui-text-100);
    outline-offset: 2px;
  }
  .kphos-target-column {
    container-type: inline-size;
    min-width: 0;
    padding: 0.35rem 0.85rem 0.85rem;
    border: 1px solid var(--electrolyte-accent, var(--ui-panel-border));
    border-radius: 0.75rem;
  }

  .kphos-target-column legend { padding-inline: 0.35rem; font-size: 0.875rem; color: var(--electrolyte-accent, var(--ui-text-100)); }
  .kphos-target-controls { display: grid; gap: 0.375rem; }
  .kphos-basis-note { color: var(--ui-text-300); font-size: 0.8125rem; line-height: 1.25; }
  @container (max-width: 18.5rem) {
    .kphos-target-controls .kphos-choice-group label { min-height: 2.875rem; }
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
  .kphos-settings-title { color: var(--ui-text-100); }

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
  }

  @media (min-width: 640px) {
    .kphos-input-header { padding-block: 0.375rem; }
    .kphos-form-section { padding: 0.625rem 0.75rem; }
  }

  .kphos-rate-controls { display: grid; grid-template-columns: minmax(0, 1fr) 7.6rem; gap: 0.5rem; }
  .kphos-rate-hint { color: var(--ui-text-300); font-size: 0.875rem; }
  .kphos-inline-number { font-variant-numeric: tabular-nums; }

  .phosphate {
    --electrolyte-accent: #cfb5ff;
    --electrolyte-surface: #272438;
  }
  .potassium {
    --electrolyte-accent: #76e1da;
    --electrolyte-surface: #142f34;
  }
  :global(:root[data-theme='light']) .phosphate {
    --electrolyte-accent: #693c9d;
    --electrolyte-surface: #f6f1fc;
  }
  :global(:root[data-theme='light']) .potassium {
    --electrolyte-accent: #086766;
    --electrolyte-surface: #edf8f5;
  }
  .kphos-results-body { display: grid; gap: 0.75rem; }
  .kphos-destinations { display: grid; gap: 1rem; }
  .kphos-destination { display: grid; min-width: 0; align-content: start; gap: 0.75rem; }
  .kphos-destination + .kphos-destination { border-top: 2px solid var(--ui-border); padding-top: 0.75rem; }
  .kphos-prep-title {
    margin-bottom: 0.5rem;
    color: var(--ui-text-100);
    font-size: 1.0625rem;
    font-weight: 750;
  }
  .kphos-draws { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 19rem), 1fr)); gap: 0.75rem; }
  .kphos-draw {
    min-width: 0;
    padding: 0.55rem 0.8rem;
    border: 1px solid var(--ui-divider);
    border-inline-start: 0.3rem solid var(--electrolyte-accent);
    border-radius: 0.375rem;
    background: var(--electrolyte-surface);
  }
  .kphos-draw h4 { color: var(--electrolyte-accent); font-size: 1rem; line-height: 1.25; font-weight: 750; }
  .kphos-draw-body { display: grid; grid-template-columns: minmax(5rem, auto) 1fr; align-items: start; gap: 0.8rem; margin-top: 0.35rem; }
  .kphos-draw-volume, .kphos-added { display: grid; gap: 0.1rem; }
  .kphos-added { border-inline-start: 1px solid var(--ui-border); padding-inline-start: 0.8rem; color: var(--ui-text-100); font-size: 0.9375rem; line-height: 1.3; }
  .kphos-detail-label { font-size: 0.8125rem; line-height: 1.35; font-weight: 600; color: var(--ui-text-300); }
  .kphos-pump { display: flex; flex-wrap: wrap; gap: 0.15rem 1rem; margin-top: 0.35rem; color: var(--ui-text-100); font-size: 0.875rem; }
  .kphos-vessel { min-width: 0; }
  .kphos-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    color: var(--ui-text-100);
    font-size: 0.9375rem;
    text-align: left;
    font-variant-numeric: tabular-nums;
  }
  .kphos-table caption { padding-bottom: 0.45rem; text-align: left; color: var(--ui-text-100); font-size: 1.0625rem; font-weight: 750; }
  .kphos-table :is(th, td) { padding: 0.32rem 0.65rem; vertical-align: middle; }
  .kphos-table thead { border-bottom: 1px solid var(--ui-border); background: var(--ui-surface-3); }
  .kphos-table thead th { color: var(--ui-text-200); font-size: 0.9375rem; }
  .kphos-table thead :is(.phosphate, .potassium) { color: var(--electrolyte-accent); background: var(--electrolyte-surface); }
  .kphos-cell-unit, .kphos-table small {
    color: var(--ui-text-300);
    font-size: 0.8125rem;
    font-weight: 500;
  }
  .kphos-cell-unit { white-space: nowrap; }
  .kphos-table small { display: block; }
  .kphos-table tbody th:is(.phosphate, .potassium) { color: var(--electrolyte-accent); }
  .kphos-table th { font-weight: 600; }
  .kphos-table :is(th, td) + :is(th, td) { border-inline-start: 1px solid var(--ui-divider); }
  .kphos-table .kphos-total { border-top: 2px solid var(--ui-border-strong); background: var(--ui-surface-3); }
  .kphos-total > :is(td, th) { font-weight: 750; }
  .kphos-composition-details { margin-top: 0.375rem; }
  .kphos-composition-details summary { width: fit-content; padding: 0.25rem 0.1rem; color: var(--ui-link); cursor: pointer; font-size: 0.875rem; font-weight: 650; }
  .kphos-composition-details summary:focus-visible { outline: 2px solid var(--ui-accent-border); outline-offset: 2px; }
  .kphos-composition-details[open] .kphos-table { margin-top: 0.25rem; }
  .kphos-cri-concentration { display: flex; flex-wrap: wrap; gap: 0.125rem 0.85rem; margin-top: 0.375rem; font-size: 0.875rem; }
  .kphos-combined {
    margin-top: 0.75rem;
    border-top: 1px solid var(--ui-border);
    padding-top: 0.6rem;
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.25rem 1.25rem;
    font-size: 0.9375rem;
  }
  .kphos-combined strong { color: var(--ui-text-100); white-space: nowrap; }
  .kphos-rate-note { margin-top: 0.5rem; font-size: 0.875rem; color: var(--ui-text-200); }

  @media (min-width: 900px) {
    .kphos-destinations:has(> section + section) { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.75rem; }
    .kphos-destination { grid-row: span 2; grid-template-rows: subgrid; }
    .kphos-destination + .kphos-destination { border-top: 0; border-inline-start: 2px solid var(--ui-border); padding: 0 0 0 0.75rem; }
  }

  @media (max-width: 639px) {
    .kphos-table :is(th, td) { padding-inline: 0.4rem; }
    .kphos-cell-unit { display: block; }
    .kphos-input-header {
      flex-direction: column;
      align-items: center;
      padding: 10px;
    }


    .kphos-choice-group label { min-height: 2.75rem; }

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
