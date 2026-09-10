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
    type KPhosMode,
    type KPhosPlan,
  } from '../helpers/kphos';
  import { patient, type Patient } from '../stores/patient';

  type NumberInput = number | '' | null | undefined;

  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  let mode: KPhosMode = 'bag';
  let kTargetBasis: KPhosKTargetBasis = 'added';
  let mainFluidId: KPhosBaseFluidId = 'norm-r';
  let criDiluentFluidId: KPhosBaseFluidId = 'normal-saline';
  let mainBagVolumeMl: number | '' = 1000;
  let mainFluidRateMlHr: number | '' = '';
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

  function fmtDose(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    const magnitude = Math.abs(value);
    return fmt(value, magnitude > 0 && magnitude < 0.01 ? 4 : magnitude < 0.1 ? 3 : 2);
  }

  function fmtConcentration(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '—';
    return fmt(value, Math.abs(value) > 0 && Math.abs(value) < 0.1 ? 3 : 2);
  }

  function fmtContribution(value: number, digits = 1): string {
    const formatted = fmt(value, digits);
    return value > 0 ? `+${formatted}` : formatted;
  }

  function fmtConcentrationContribution(value: number): string {
    const formatted = fmtConcentration(value);
    return value > 0 ? `+${formatted}` : formatted;
  }


  function selectMode(nextMode: KPhosMode): void {
    mode = nextMode;
  }

  function toggleKTargetBasis(): void {
    kTargetBasis = kTargetBasis === 'added' ? 'total' : 'added';
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
  $: mainRateValue = numeric(mainFluidRateMlHr);
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
    kTargetMeqPerL: isPresent(kTargetMeqPerL) ? kTargetValue : null,
    criDurationHr: criDurationValue,
    criRateMlHr: isPresent(criRateMlHr) ? criRateValue : null,
  });

  let hasAnyTarget = false;
  let kBasisLabel = 'Added';
  let kBasisSwitchLabel = '';
  $: hasAnyTarget = plan.hasPhosTarget || plan.hasKTarget;
  $: kBasisLabel = kTargetBasis === 'added' ? 'Added' : 'Total';
  $: kBasisSwitchLabel = kTargetBasis === 'added'
    ? 'Potassium target uses added potassium; switch to total potassium'
    : 'Potassium target uses total potassium; switch to added potassium';

  let issues: string[] = [];
  $: {
    const next: string[] = [];

    if (plan.hasPhosTarget) {
      if (phosTargetValue == null || phosTargetValue < 0) next.push('Phosphate target must be 0 or greater.');
      if (!isPositive(weightKg)) next.push('Enter patient weight.');
      if (!isPositive(mainRateValue)) next.push('Enter the fluid rate.');
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
    if (phosTargetValue != null && plan.totalPhosDeliveryMmolKgHr != null) {
      const excessFraction = getKPhosExcessFraction(phosTargetValue, plan.totalPhosDeliveryMmolKgHr);
      if (excessFraction != null && excessFraction >= KPHOS_EXCESS_WARNING_FRACTION) {
        next.push(Number.isFinite(excessFraction)
          ? `Fluid phosphate exceeds the target by ${fmt(excessFraction * 100, 0)}%.`
          : `Fluid phosphate exceeds the zero target by ${fmt(plan.phosTargetExcessMmolKgHr, 4)} mmol/kg/hr.`);
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

  let kPhosAddedKMeq = 0;
  let kPhosAddedPhosMmol = 0;
  let kPhosAddedKMeqPerL = 0;
  let kPhosAddedPhosMmolPerL = 0;
  let criDiluentKMeq = 0;
  let criDiluentPhosMmol = 0;
  let finalCriKMeq = 0;
  let finalCriPhosMmol = 0;
  let finalCriKMeqPerMl = 0;
  let finalCriPhosMmolPerMl = 0;
  $: kPhosAddedKMeq = (plan.kPhosStockMl ?? 0) * KPHOS_K_MEQ_PER_ML;
  $: kPhosAddedPhosMmol = (plan.kPhosStockMl ?? 0) * KPHOS_PHOS_MMOL_PER_ML;
  $: kPhosAddedKMeqPerL = bagVolumeValue != null && bagVolumeValue > 0
    ? kPhosAddedKMeq * 1000 / bagVolumeValue
    : 0;
  $: kPhosAddedPhosMmolPerL = bagVolumeValue != null && bagVolumeValue > 0
    ? kPhosAddedPhosMmol * 1000 / bagVolumeValue
    : 0;
  $: criDiluentKMeq = criDiluentFluid.nativeKMeqPerL * (plan.criDiluentVolumeMl ?? 0) / 1000;
  $: criDiluentPhosMmol = criDiluentFluid.nativePhosMmolPerL * (plan.criDiluentVolumeMl ?? 0) / 1000;
  $: finalCriKMeq = kPhosAddedKMeq + criDiluentKMeq;
  $: finalCriPhosMmol = kPhosAddedPhosMmol + criDiluentPhosMmol;
  $: finalCriKMeqPerMl = plan.criTotalVolumeMl != null && plan.criTotalVolumeMl > 0
    ? finalCriKMeq / plan.criTotalVolumeMl
    : 0;
  $: finalCriPhosMmolPerMl = plan.criTotalVolumeMl != null && plan.criTotalVolumeMl > 0
    ? finalCriPhosMmol / plan.criTotalVolumeMl
    : 0;
</script>

<section class="ui-tool-stack text-slate-200" aria-label="KPhos/KCl calculator">
  <article class="ui-card min-w-0 overflow-hidden" data-testid="kphos-input-card">
    <header class="kphos-input-header">
      <div class="kphos-mode-picker">
        <span class="ui-label kphos-mode-label">Mode:</span>
        <div class="ui-inset kphos-mode-control" role="group" aria-label="Add KPhos to">
          <button
            type="button"
            class="ui-choice"
            aria-pressed={mode === 'bag'}
            on:click={() => selectMode('bag')}
          >
            Bag
          </button>
          <button
            type="button"
            class="ui-choice"
            aria-pressed={mode === 'cri'}
            on:click={() => selectMode('cri')}
          >
            CRI
          </button>
        </div>
      </div>
    </header>

    <div class="kphos-form" data-testid="kphos-statements">
      <section class="kphos-form-section kphos-target-section" aria-label="Medication targets">
        <div class="kphos-field-grid kphos-target-fields">
          <div class="kphos-field">
            <div class="kphos-field-heading">
              <label class="ui-label" for="kphos-phos-target">Phosphate target</label>
            </div>
            <div class="kphos-control-row">
            <input
              id="kphos-phos-target"
              class="field-control kphos-inline-number"
              type="number"
              min="0"
              step="0.001"
              inputmode="decimal"
              placeholder="optional"
              aria-label="Phosphate target (mmol/kg/hr)"
              bind:value={phosTargetMmolKgHr}
            />
            <span class="ui-unit kphos-field-unit">mmol/kg/hr</span>
            </div>
          </div>
          <div class="kphos-field kphos-potassium-field">
            <div class="kphos-field-heading">
              <label class="ui-label" for="kphos-k-target">Potassium target</label>
              <button
                type="button"
                role="switch"
                aria-checked={kTargetBasis === 'total'}
                aria-label={kBasisSwitchLabel}
                class="kphos-basis-button"
                data-testid="k-target-basis"
                on:click={toggleKTargetBasis}
              >
                {kBasisLabel}
              </button>
            </div>
            <div class="kphos-control-row">
            <input
              id="kphos-k-target"
              class="field-control kphos-inline-number"
              type="number"
              min="0"
              step="1"
              inputmode="decimal"
              placeholder="optional"
              aria-label={`${kBasisLabel} potassium target (mEq/L)`}
              bind:value={kTargetMeqPerL}
            />
            <span class="ui-unit kphos-field-unit">mEq/L</span>
            </div>
          </div>
        </div>
      </section>

      <section class="kphos-form-section" aria-label={mode === 'bag' ? 'Fluid bag settings' : 'CRI settings'}>
        {#if mode === 'bag'}
          <div class="kphos-field-grid kphos-bag-fields">
            <div class="kphos-field">
              <div class="kphos-field-heading"><label class="ui-label" for="kphos-main-bag-volume">Bag volume</label></div>
              <div class="kphos-control-row">
            <input
              id="kphos-main-bag-volume"
              class="field-control kphos-inline-number"
              type="number"
              min="0"
              step="1"
              inputmode="decimal"
              aria-label="Bag volume (mL)"
              bind:value={mainBagVolumeMl}
            />
            <span class="ui-unit kphos-field-unit">mL</span>
              </div>
          </div>
            <div class="kphos-field">
              <div class="kphos-field-heading"><label class="ui-label" for="kphos-main-fluid">Fluid Type</label></div>
            <select id="kphos-main-fluid" class="field-select" aria-label="Fluid Type" bind:value={mainFluidId}>
              {#each KPHOS_BASE_FLUIDS as fluid}
                <option value={fluid.id}>{fluid.label}</option>
              {/each}
            </select>
          </div>
            <div class="kphos-field">
              <div class="kphos-field-heading"><label class="ui-label" for="kphos-main-fluid-rate">Fluid rate</label></div>
              <div class="kphos-control-row">
            <input
              id="kphos-main-fluid-rate"
              class="field-control kphos-inline-number"
              type="number"
              min="0"
              step="0.1"
              inputmode="decimal"
              aria-label="Fluid rate (mL/hr)"
              bind:value={mainFluidRateMlHr}
            />
            <span class="ui-unit kphos-field-unit">mL/hr</span>
              </div>
          </div>
        </div>
        {:else}
          <div class="kphos-field-grid kphos-cri-fields">
            <div class="kphos-field">
              <div class="kphos-field-heading"><label class="ui-label" for="kphos-cri-duration">Duration</label></div>
              <div class="kphos-control-row">
            <input
              id="kphos-cri-duration"
              class="field-control kphos-inline-number"
              type="number"
              min="0"
              step="0.1"
              inputmode="decimal"
              aria-label="Duration (hr)"
              bind:value={criDurationHr}
            />
            <span class="ui-unit kphos-field-unit">hr</span>
              </div>
          </div>
            <div class="kphos-field">
              <div class="kphos-field-heading"><label class="ui-label" for="kphos-cri-rate">CRI rate</label></div>
              <div class="kphos-control-row">
            <input
              id="kphos-cri-rate"
              class="field-control kphos-inline-number"
              type="number"
              min="0"
              step="0.1"
              inputmode="decimal"
              placeholder="optional"
              aria-label="CRI rate (mL/hr)"
              bind:value={criRateMlHr}
            />
            <span class="ui-unit kphos-field-unit">mL/hr</span>
              </div>
          </div>
            <div class="kphos-field">
              <div class="kphos-field-heading"><label class="ui-label" for="kphos-cri-diluent">Diluent</label></div>
            <select id="kphos-cri-diluent" class="field-select" aria-label="CRI diluent" bind:value={criDiluentFluidId}>
              {#each KPHOS_BASE_FLUIDS as fluid}
                <option value={fluid.id}>{fluid.label}</option>
              {/each}
            </select>
          </div>
            <div class="kphos-field">
              <div class="kphos-field-heading"><label class="ui-label" for="kphos-main-fluid">Fluid Type</label></div>
            <select id="kphos-main-fluid" class="field-select" aria-label="Fluid Type" bind:value={mainFluidId}>
              {#each KPHOS_BASE_FLUIDS as fluid}
                <option value={fluid.id}>{fluid.label}</option>
              {/each}
            </select>
          </div>
            <div class="kphos-field">
              <div class="kphos-field-heading"><label class="ui-label" for="kphos-main-fluid-rate">Fluid rate</label></div>
              <div class="kphos-control-row">
            <input
              id="kphos-main-fluid-rate"
              class="field-control kphos-inline-number"
              type="number"
              min="0"
              step="0.1"
              inputmode="decimal"
              aria-label="Fluid rate (mL/hr)"
              bind:value={mainFluidRateMlHr}
            />
            <span class="ui-unit kphos-field-unit">mL/hr</span>
              </div>
          </div>
          {#if plan.hasKTarget}
              <div class="kphos-field">
                <div class="kphos-field-heading"><label class="ui-label" for="kphos-main-bag-volume">Bag volume</label></div>
                <div class="kphos-control-row">
              <input
                id="kphos-main-bag-volume"
                class="field-control kphos-inline-number"
                type="number"
                min="0"
                step="1"
                inputmode="decimal"
                aria-label="Bag volume (mL)"
                bind:value={mainBagVolumeMl}
              />
              <span class="ui-unit kphos-field-unit">mL</span>
                </div>
            </div>
          {/if}
        </div>
      {/if}
      </section>
    </div>
  </article>

  {#if hasAnyTarget}
    <article class="ui-card min-w-0 overflow-hidden" data-testid="kphos-results">
    {#if issues.length}
      <div class="ui-alert m-3 border-amber-300/30 bg-amber-950/40 text-amber-100">
        <span class="font-black">Needed:</span> {issues.join(' ')}
      </div>
    {:else}
      <section class="px-3 py-3 sm:px-4" aria-label="Preparation and delivery">
        {#if mode === 'bag'}
          <p class="ui-instruction">
            <span>In the {fmtCompact(bagVolumeValue)} mL {mainFluid.label} bag,</span>
            {#if plan.hasPhosTarget && plan.hasKTarget}
              <span>add</span>
              <strong class="kphos-instruction-value" data-testid="kphos-stock-volume">{fmtStock(plan.kPhosStockMl)}&nbsp;mL KPhos</strong>
              <span>and</span>
              <strong class="kphos-instruction-value" data-testid="kcl-stock-volume">{fmtStock(plan.kClStockMl)}&nbsp;mL KCl</strong><span>.</span>
            {:else if plan.hasPhosTarget}
              <span>add</span>
              <strong class="kphos-instruction-value" data-testid="kphos-stock-volume">{fmtStock(plan.kPhosStockMl)}&nbsp;mL KPhos</strong><span>.</span>
            {:else}
              <span>add</span>
              <strong class="kphos-instruction-value" data-testid="kcl-stock-volume">{fmtStock(plan.kClStockMl)}&nbsp;mL KCl</strong><span>.</span>
            {/if}
          </p>
        {:else}
          {#if plan.hasPhosTarget}
            <div class="kphos-cri-instructions">
            <p class="ui-instruction">
              <span>Mix</span>
              <strong class="kphos-instruction-value" data-testid="kphos-stock-volume">{fmtStock(plan.kPhosStockMl)}&nbsp;mL KPhos</strong>
              <span>+</span>
              <strong class="kphos-instruction-value" data-testid="cri-diluent-volume">{fmtStock(plan.criDiluentVolumeMl)}&nbsp;mL {criDiluentFluid.label}</strong><span>.</span>
            </p>
            <p class="ui-instruction">
              <span>Run at</span>
              <strong class="kphos-instruction-value" data-testid="cri-pump-rate">{fmt(plan.criPumpRateMlHr, 3)}&nbsp;mL/hr</strong>
              <span>for {fmtCompact(plan.criActualRuntimeHr)} hr.</span>
            </p>
            </div>
          {/if}

          {#if plan.hasKTarget}
            <p class={`${plan.hasPhosTarget ? 'mt-2 border-t ui-rule pt-2' : ''} ui-instruction`}>
              <span>In the separate {fmtCompact(bagVolumeValue)} mL {mainFluid.label} bag, add</span>
              <strong class="kphos-instruction-value" data-testid="kcl-stock-volume">{fmtStock(plan.kClStockMl)}&nbsp;mL KCl</strong><span>.</span>
            </p>
          {:else}
            <span class="sr-only" data-testid="kcl-stock-volume">No KCl requested</span>
          {/if}
        {/if}

        <div class="mt-3 border-t ui-rule pt-2.5">
          {#if alerts.length}
            <div class="ui-alert mb-2 border-amber-300/30 bg-amber-950/40 text-amber-100">
              {alerts.join(' ')}
            </div>
          {/if}

          <div class="kphos-source-summary text-sm text-slate-300" data-testid="kphos-source-summary">
            {#if mode === 'bag'}
              <section class="kphos-mixture-group" aria-label="Fluid bag composition">
                <div
                  class:kphos-flow-four={plan.hasPhosTarget && plan.hasKTarget}
                  class:kphos-flow-three={plan.hasPhosTarget !== plan.hasKTarget}
                  class="kphos-mixture-flow"
                >
                  <article class="ui-inset kphos-mixture-card" data-testid="starting-fluid-component">
                    <span class="ui-label kphos-component-kind">Starting bag</span>
                    <strong>{fmtCompact(bagVolumeValue)} mL {mainFluid.label}</strong>
                    <dl class="kphos-component-values">
                      <div><dt>K</dt><dd>{fmtConcentration(mainFluid.nativeKMeqPerL)} mEq/L</dd></div>
                      <div><dt>Phos</dt><dd>{fmtConcentration(mainFluid.nativePhosMmolPerL)} mmol/L</dd></div>
                    </dl>
                  </article>

                  {#if plan.hasPhosTarget}
                    <article class="ui-inset kphos-mixture-card" data-operator="+" data-testid="kphos-component">
                      <span class="ui-label kphos-component-kind">KPhos additive</span>
                      <strong>{fmtStock(plan.kPhosStockMl)}&nbsp;mL KPhos</strong>
                      <dl class="kphos-component-values">
                        <div><dt>K</dt><dd>{fmtConcentrationContribution(kPhosAddedKMeqPerL)} mEq/L</dd></div>
                        <div><dt>Phos</dt><dd>{fmtConcentrationContribution(kPhosAddedPhosMmolPerL)} mmol/L</dd></div>
                      </dl>
                    </article>
                  {/if}

                  {#if plan.hasKTarget}
                    <article class="ui-inset kphos-mixture-card" data-operator="+" data-testid="kcl-component">
                      <span class="ui-label kphos-component-kind">KCl additive</span>
                      <strong>{fmtStock(plan.kClStockMl)}&nbsp;mL KCl</strong>
                      <dl class="kphos-component-values">
                        <div><dt>K</dt><dd>{fmtConcentrationContribution(plan.kClAddedMeqPerL ?? 0)} mEq/L</dd></div>
                        <div><dt>Phos</dt><dd>0 mmol/L</dd></div>
                      </dl>
                    </article>
                  {/if}

                  <article class="ui-inset kphos-mixture-card kphos-mixture-total" data-operator="=" data-testid="final-bag-component">
                    <span class="ui-label kphos-component-kind">Final bag</span>
                    <strong>Combined</strong>
                    <dl class="kphos-component-values">
                      <div><dt>K</dt><dd data-testid="final-main-bag-k">{fmtConcentration(plan.finalMainBagKMeqPerL)} mEq/L</dd></div>
                      <div><dt>Phos</dt><dd>{fmtConcentration(plan.finalMainBagPhosMmolPerL)} mmol/L</dd></div>
                    </dl>
                  </article>
                </div>
              </section>
            {:else}
              <div class="kphos-cri-groups">
                <section class="kphos-mixture-group" aria-label={plan.hasKTarget ? 'Main fluid bag composition' : 'Main fluid source'}>
                    <h4 class="ui-section-title">{plan.hasKTarget ? 'Main fluid bag' : 'Main fluid source'}</h4>
                    <div class:kphos-flow-three={plan.hasKTarget} class="kphos-mixture-flow">
                      <article class="ui-inset kphos-mixture-card" data-testid="starting-fluid-component">
                        {#if plan.hasKTarget}
                          <span class="ui-label kphos-component-kind">Starting bag</span>
                          <strong>{fmtCompact(bagVolumeValue)} mL {mainFluid.label}</strong>
                          <dl class="kphos-component-values">
                            <div><dt>K</dt><dd>{fmtConcentration(mainFluid.nativeKMeqPerL)} mEq/L</dd></div>
                            <div><dt>Phos</dt><dd>{fmtConcentration(mainFluid.nativePhosMmolPerL)} mmol/L</dd></div>
                          </dl>
                        {:else}
                          <span class="ui-label kphos-component-kind">Running fluid</span>
                          <strong>{mainFluid.label} at {fmtCompact(mainRateValue)}&nbsp;mL/hr</strong>
                          <dl class="kphos-component-values">
                            <div><dt>K</dt><dd>{fmtDose(plan.mainNativeKDeliveryMeqKgHr)} mEq/kg/hr</dd></div>
                            <div><dt>Phos</dt><dd>{fmtDose(plan.mainNativePhosDeliveryMmolKgHr)} mmol/kg/hr</dd></div>
                          </dl>
                        {/if}
                      </article>
                      {#if plan.hasKTarget}
                        <article class="ui-inset kphos-mixture-card" data-operator="+" data-testid="kcl-component">
                          <span class="ui-label kphos-component-kind">KCl additive</span>
                          <strong>{fmtStock(plan.kClStockMl)}&nbsp;mL KCl</strong>
                          <dl class="kphos-component-values">
                            <div><dt>K</dt><dd>{fmtConcentrationContribution(plan.kClAddedMeqPerL ?? 0)} mEq/L</dd></div>
                            <div><dt>Phos</dt><dd>0 mmol/L</dd></div>
                          </dl>
                        </article>
                        <article class="ui-inset kphos-mixture-card kphos-mixture-total" data-operator="=" data-testid="final-bag-component">
                          <span class="ui-label kphos-component-kind">Final main bag</span>
                          <strong>Combined</strong>
                          <dl class="kphos-component-values">
                            <div><dt>K</dt><dd data-testid="final-main-bag-k">{fmtConcentration(plan.finalMainBagKMeqPerL)} mEq/L</dd></div>
                            <div><dt>Phos</dt><dd>{fmtConcentration(plan.finalMainBagPhosMmolPerL)} mmol/L</dd></div>
                          </dl>
                        </article>
                      {/if}
                    </div>
                  </section>

                {#if plan.hasPhosTarget}
                  <section class="kphos-mixture-group" aria-label="KPhos CRI composition">
                    <h4 class="ui-section-title">KPhos CRI</h4>
                    <div class="kphos-mixture-flow kphos-flow-three">
                      <article class="ui-inset kphos-mixture-card" data-testid="kphos-component">
                        <span class="ui-label kphos-component-kind">Stock</span>
                        <strong>{fmtStock(plan.kPhosStockMl)}&nbsp;mL KPhos</strong>
                        <dl class="kphos-component-values">
                          <div><dt>K</dt><dd>{fmt(kPhosAddedKMeq, 1)} mEq</dd></div>
                          <div><dt>Phos</dt><dd>{fmt(kPhosAddedPhosMmol, 1)} mmol</dd></div>
                        </dl>
                      </article>
                      <article class="ui-inset kphos-mixture-card" data-operator="+" data-testid="cri-diluent-component">
                        <span class="ui-label kphos-component-kind">Diluent</span>
                        <strong>{fmtStock(plan.criDiluentVolumeMl)}&nbsp;mL {criDiluentFluid.label}</strong>
                        <dl class="kphos-component-values">
                          <div><dt>K</dt><dd>{fmtContribution(criDiluentKMeq, 2)} mEq</dd></div>
                          <div><dt>Phos</dt><dd>{fmtContribution(criDiluentPhosMmol, 2)} mmol</dd></div>
                        </dl>
                      </article>
                      <article class="ui-inset kphos-mixture-card kphos-mixture-total" data-operator="=" data-testid="final-cri-component">
                        <span class="ui-label kphos-component-kind">Prepared CRI</span>
                        <strong>{fmtStock(plan.criTotalVolumeMl)} mL total</strong>
                        <dl class="kphos-component-values">
                          <div><dt>K</dt><dd>{fmt(finalCriKMeq, 2)} mEq</dd></div>
                          <div><dt>Phos</dt><dd>{fmt(finalCriPhosMmol, 2)} mmol</dd></div>
                        </dl>
                        <div class="kphos-component-concentration">
                          {fmtConcentration(finalCriKMeqPerMl)} mEq/mL K · {fmtConcentration(finalCriPhosMmolPerMl)} mmol/mL Phos
                        </div>
                      </article>
                    </div>
                  </section>
                {/if}
              </div>
            {/if}

            <section class="kphos-delivery-summary ui-instruction" aria-label="Total delivery from all sources" data-testid="kphos-delivery-summary">
              <h4 class="ui-section-title">Total delivery · all sources</h4>
              {#if plan.totalKDeliveryMeqKgHr != null && plan.totalPhosDeliveryMmolKgHr != null}
                <dl class="kphos-delivery-values">
                  <div>
                    <dt class="ui-label">Phosphate</dt>
                    <dd data-testid="total-phos-delivery"><strong class="kphos-instruction-value">{fmtDose(plan.totalPhosDeliveryMmolKgHr)}</strong> <span class="ui-unit">mmol/kg/hr</span></dd>
                  </div>
                  <div>
                    <dt class="ui-label">Potassium</dt>
                    <dd data-testid="total-k-delivery"><strong class="kphos-instruction-value">{fmtDose(plan.totalKDeliveryMeqKgHr)}</strong> <span class="ui-unit">mEq/kg/hr</span></dd>
                  </div>
                </dl>
              {:else}
                <p class="mt-2 ui-meta">
                  Enter patient weight and fluid rate to see delivery.
                  <span class="sr-only" data-testid="total-phos-delivery">—</span>
                  <span class="sr-only" data-testid="total-k-delivery">—</span>
                </p>
              {/if}
            </section>
          </div>
        </div>
      </section>
    {/if}
    </article>
  {/if}

  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {#if issues.length}
      KPhos/KCl setup needs more information.
    {:else if hasAnyTarget}
      KPhos/KCl calculation updated. KPhos {plan.hasPhosTarget ? `${fmtStock(plan.kPhosStockMl)} mL` : 'not requested'}. KCl {plan.hasKTarget ? `${fmtStock(plan.kClStockMl)} mL` : 'not requested'}. Total potassium {fmt(plan.totalKDeliveryMeqKgHr, 4)} mEq/kg/hr. Total phosphate {fmt(plan.totalPhosDeliveryMmolKgHr, 4)} mmol/kg/hr.
    {/if}
  </div>
</section>

<style>
  .kphos-input-header {
    display: flex;
    min-height: 3.75rem;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    border-bottom: 1px solid var(--ui-divider);
    padding: 0.625rem 0.75rem;
  }

  .kphos-mode-picker {
    display: grid;
    align-items: center;
    justify-items: center;
    gap: 0.375rem;
  }

  .kphos-mode-label {
    font-size: 0.875rem;
    font-weight: 900;
  }

  .kphos-mode-control {
    display: grid;
    width: 11rem;
    flex: 0 0 11rem;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem;
    padding: 0.25rem;
  }

  .kphos-form {
    display: grid;
  }

  .kphos-form-section {
    display: grid;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
    padding: 0.75rem;
  }

  .kphos-form-section + .kphos-form-section {
    border-top: 1px solid var(--ui-divider);
  }

  .kphos-field-grid {
    display: grid;
    min-width: 0;
    gap: 0.75rem;
  }

  .kphos-target-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.25rem;
  }

  .kphos-bag-fields {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .kphos-cri-fields {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }

  .kphos-field {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.375rem;
  }

  .kphos-field-heading {
    display: flex;
    min-height: 1.5rem;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .kphos-target-fields .kphos-field-heading {
    min-height: 2.25rem;
  }

  .kphos-instruction-value {
    color: var(--ui-text-100);
    font-size: 1rem;
    font-weight: 700;
    line-height: 1.5;
    font-variant-numeric: tabular-nums;
  }

  .kphos-cri-instructions {
    display: grid;
    gap: 0.25rem 1.5rem;
  }

  @media (min-width: 640px) {
    .kphos-instruction-value {
      font-size: 1.125rem;
    }

    .kphos-mode-picker {
      position: relative;
    }

    .kphos-mode-label {
      position: absolute;
      top: 50%;
      right: calc(100% + 0.75rem);
      transform: translateY(-50%);
      white-space: nowrap;
    }

    .kphos-delivery-values > div {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.25rem 0.5rem;
    }

    .kphos-delivery-values > div > dd {
      margin-top: 0;
    }
  }

  .kphos-control-row {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
  }

  .kphos-field-unit {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .kphos-inline-number {
    flex: 1 1 auto;
    font-variant-numeric: tabular-nums;
  }

  .kphos-mixture-group {
    padding: 0;
  }

  .kphos-delivery-summary {
    margin-top: 0.75rem;
    border-top: 1px solid var(--ui-divider);
    padding-top: 0.75rem;
  }

  .kphos-delivery-values {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    margin-top: 0.5rem;
  }

  .kphos-delivery-values dd {
    margin-top: 0.25rem;
  }

  .kphos-mixture-group + .kphos-mixture-group {
    border-top: 1px solid var(--ui-divider);
    margin-top: 0.75rem;
    padding-top: 0.75rem;
  }

  .kphos-mixture-group h4 {
    margin-bottom: 0.5rem;
  }

  .kphos-mixture-flow {
    display: grid;
    gap: 1.8rem;
  }

  .kphos-flow-three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .kphos-flow-four {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .kphos-mixture-card {
    position: relative;
    min-width: 0;
    padding: 0.6rem;
  }

  .kphos-mixture-card[data-operator]::before {
    position: absolute;
    top: 50%;
    left: -1.34rem;
    display: grid;
    width: 0.875rem;
    height: 0.875rem;
    place-items: center;
    color: var(--ui-text-400);
    content: attr(data-operator);
    font-size: 1rem;
    font-weight: 900;
    line-height: 1;
    transform: translateY(-50%);
  }

  .kphos-mixture-total {
    border-color: var(--ui-accent-border);
    background: var(--ui-accent-surface);
  }

  .kphos-mixture-total .kphos-component-kind,
  .kphos-mixture-total .kphos-component-values dt {
    color: var(--ui-text-300);
  }

  .kphos-component-kind {
    display: block;
    line-height: 1.2;
  }

  .kphos-mixture-card > strong {
    display: block;
    overflow-wrap: anywhere;
    margin-top: 0.15rem;
    color: var(--ui-text-100);
    font-size: 0.875rem;
    font-weight: 700;
    line-height: 1.4;
  }

  .kphos-component-values {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.35rem;
    margin-top: 0.55rem;
    font-variant-numeric: tabular-nums;
  }

  .kphos-component-values > div {
    min-width: 0;
    border-top: 1px solid var(--ui-divider);
    padding-top: 0.35rem;
  }

  .kphos-component-values dt {
    color: var(--ui-text-400);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .kphos-component-values dd {
    overflow-wrap: anywhere;
    margin-top: 0.08rem;
    color: var(--ui-text-100);
    font-size: 0.8125rem;
    font-weight: 600;
    line-height: 1.4;
  }

  .kphos-component-concentration {
    border-top: 1px solid var(--ui-divider);
    margin-top: 0.55rem;
    padding-top: 0.35rem;
    color: var(--ui-text-300);
    font-size: 0.75rem;
    font-weight: 600;
    line-height: 1.3;
    font-variant-numeric: tabular-nums;
  }

  .kphos-basis-button {
    display: inline-flex;
    min-width: 3.5rem;
    height: 2.25rem;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    border: 1px solid var(--ui-accent-border);
    background: var(--ui-accent-surface);
    padding: 0 0.4rem;
    color: var(--ui-link);
    font-size: 0.875rem;
    font-weight: 800;
    transition: background-color 150ms, border-color 150ms;
  }

  .kphos-basis-button:hover {
    border-color: var(--ui-field-border-strong);
    background: var(--ui-hover-surface);
  }

  @media (max-width: 1365px) {
    .kphos-cri-fields {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 639px) {
    .kphos-input-header {
      align-items: flex-start;
      padding: 0.75rem;
    }

    .kphos-mode-control {
      width: 9.5rem;
      flex-basis: 9.5rem;
    }

    .kphos-form-section {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.65rem;
      padding: 0.75rem;
    }

    .kphos-target-fields,
    .kphos-bag-fields,
    .kphos-cri-fields {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .kphos-control-row {
      display: grid;
      align-items: start;
      gap: 0.25rem;
    }

    .kphos-field-unit {
      min-height: 0.9rem;
      color: var(--ui-text-400);
      font-size: 0.75rem;
    }
  }

  @media (max-width: 767px) {
    .kphos-flow-three,
    .kphos-flow-four {
      grid-template-columns: minmax(0, 1fr);
    }

    .kphos-mixture-card[data-operator]::before {
      top: -1.38rem;
      left: 50%;
      transform: translateX(-50%);
    }
  }

  @media (min-width: 1024px) {
    .kphos-cri-instructions {
      grid-template-columns: 1.25fr 1fr;
    }

    .kphos-cri-groups {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr));
      column-gap: 0.75rem;
    }

    .kphos-cri-groups > .kphos-mixture-group + .kphos-mixture-group {
      border-top: 0;
      border-left: 1px solid var(--ui-divider);
      margin-top: 0;
      padding-top: 0;
      padding-left: 0.75rem;
    }
  }
</style>
