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

  let p: Patient = { weightKg: null, species: '', name: '' };
  $: p = $patient;

  let mode: KPhosMode = 'bag';
  let kTargetBasis: KPhosKTargetBasis = 'added';
  let phosTargetBasis: KPhosPhosTargetBasis = 'total';
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
        <div class="kphos-mode-control">
          <SegmentedToggle label="Add KPhos to" first="Bag" second="CRI" secondSelected={mode === 'cri'} onToggle={cri => mode = cri ? 'cri' : 'bag'} />
        </div>
      </div>
    </header>

    <div class="kphos-form" data-testid="kphos-statements">
      <section class="kphos-form-section kphos-target-section" aria-label="Medication targets">
        <div class="kphos-field-grid kphos-target-fields">
          <div class="kphos-target-column">
            <div class="kphos-calculation-mode">
              <span class="ui-label">Phosphate Calculation Mode</span>
              <SegmentedToggle label="Phosphate Calculation Mode" first="Added to Bag" second="Total in Bag" secondSelected={phosTargetBasis === 'total'} testId="phos-target-basis" onToggle={total => phosTargetBasis = total ? 'total' : 'added'} />
            </div>
            <div class="ui-field kphos-field">
              <div class="ui-field-heading"><label class="ui-label" for="kphos-phos-target">Phosphate target</label></div>
              <div class="kphos-control-row">
                <input id="kphos-phos-target" class="field-control kphos-inline-number" type="number" min="0" step="0.001" inputmode="decimal" placeholder="optional" aria-label="Phosphate target (mmol/kg/hr)" bind:value={phosTargetMmolKgHr} />
                <span class="ui-unit kphos-field-unit">mmol/kg/hr</span>
              </div>
            </div>
          </div>
          <div class="kphos-target-column">
            <div class="kphos-calculation-mode">
              <span class="ui-label">Potassium Calculation Mode</span>
              <SegmentedToggle label="Potassium Calculation Mode" first="Added to Bag" second="Total in Bag" secondSelected={kTargetBasis === 'total'} testId="k-target-basis" onToggle={total => kTargetBasis = total ? 'total' : 'added'} />
            </div>
            <div class="ui-field kphos-field">
              <div class="ui-field-heading"><label class="ui-label" for="kphos-k-target">Potassium target</label></div>
              <div class="kphos-control-row">
                <input id="kphos-k-target" class="field-control kphos-inline-number" type="number" min="0" step="1" inputmode="decimal" placeholder="optional" aria-label={`${kBasisLabel} potassium target (mEq/L)`} bind:value={kTargetMeqPerL} />
                <span class="ui-unit kphos-field-unit">mEq/L</span>
              </div>
            </div>
          </div>
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
              <div class="ui-field-heading"><label class="ui-label" for="kphos-main-bag-volume">Bag volume</label></div>
              <div class="kphos-control-row">
                <input id="kphos-main-bag-volume" class="field-control kphos-inline-number" type="number" min="0" step="1" inputmode="decimal" aria-label="Bag volume (mL)" bind:value={mainBagVolumeMl} />
                <span class="ui-unit kphos-field-unit">mL</span>
              </div>
            </div>
          {/if}
          <div class="ui-field kphos-field">
            <div class="ui-field-heading"><label class="ui-label" for="kphos-main-fluid-rate">Fluid rate</label></div>
            <div class="kphos-control-row">
              <input id="kphos-main-fluid-rate" class="field-control kphos-inline-number" type="number" min="0" step="0.1" inputmode="decimal" aria-label="Fluid rate (mL/hr)" bind:value={mainFluidRateMlHr} />
              <span class="ui-unit kphos-field-unit">mL/hr</span>
            </div>
          </div>
        </div>
      </section>

      {#if mode === 'cri'}
        <section class="kphos-form-section" aria-label="CRI preparation settings">
          <div class="kphos-field-grid kphos-cri-setup-fields">
            <div class="ui-field kphos-field">
              <div class="ui-field-heading"><label class="ui-label" for="kphos-cri-duration">Duration</label></div>
              <div class="kphos-control-row">
                <input id="kphos-cri-duration" class="field-control kphos-inline-number" type="number" min="0" step="0.1" inputmode="decimal" aria-label="Duration (hr)" bind:value={criDurationHr} />
                <span class="ui-unit kphos-field-unit">hr</span>
              </div>
            </div>
            <div class="ui-field kphos-field">
              <div class="ui-field-heading"><label class="ui-label" for="kphos-cri-rate">CRI rate</label></div>
              <div class="kphos-control-row">
                <input id="kphos-cri-rate" class="field-control kphos-inline-number" type="number" min="0" step="0.1" inputmode="decimal" placeholder="optional" aria-label="CRI rate (mL/hr)" bind:value={criRateMlHr} />
                <span class="ui-unit kphos-field-unit">mL/hr</span>
              </div>
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
      <section class="ui-card-padding" aria-label="Preparation and delivery">
        {#if mode === 'bag'}
          <p class="ui-instruction">
            <span>In the {fmtCompact(bagVolumeValue)} mL {mainFluid.label} bag,</span>
            {#if plan.hasPhosTarget && plan.hasKTarget}
              <span>add</span>
              <strong class="kphos-instruction-value ui-statement-value" data-testid="kphos-stock-volume">{fmtStock(plan.kPhosStockMl)}&nbsp;mL KPhos</strong>
              <span>and</span>
              <strong class="kphos-instruction-value ui-statement-value" data-testid="kcl-stock-volume">{fmtStock(plan.kClStockMl)}&nbsp;mL KCl</strong><span>.</span>
            {:else if plan.hasPhosTarget}
              <span>add</span>
              <strong class="kphos-instruction-value ui-statement-value" data-testid="kphos-stock-volume">{fmtStock(plan.kPhosStockMl)}&nbsp;mL KPhos</strong><span>.</span>
            {:else}
              <span>add</span>
              <strong class="kphos-instruction-value ui-statement-value" data-testid="kcl-stock-volume">{fmtStock(plan.kClStockMl)}&nbsp;mL KCl</strong><span>.</span>
            {/if}
          </p>
        {:else}
          {#if plan.hasPhosTarget}
            <div class="kphos-cri-instructions">
            <p class="ui-instruction">
              <span>Mix</span>
              <strong class="kphos-instruction-value ui-statement-value" data-testid="kphos-stock-volume">{fmtStock(plan.kPhosStockMl)}&nbsp;mL KPhos</strong>
              <span class="kphos-diluent-line"><span>+</span>
              <strong class="kphos-instruction-value ui-statement-value" data-testid="cri-diluent-volume"><span class="kphos-diluent-amount">{fmtStock(plan.criDiluentVolumeMl)}&nbsp;mL</span> <span class="kphos-diluent-name">{criDiluentFluid.label}</span></strong><span>.</span></span>
            </p>
            <p class="ui-instruction">
              <span>Run at</span>
              <strong class="kphos-instruction-value ui-statement-value" data-testid="cri-pump-rate">{fmt(plan.criPumpRateMlHr, 3)}&nbsp;mL/hr</strong>
              <span>for {fmtCompact(plan.criActualRuntimeHr)} hr.</span>
            </p>
            </div>
          {/if}

          {#if plan.hasKTarget}
            <p class={`${plan.hasPhosTarget ? 'mt-2 border-t ui-rule pt-2' : ''} ui-instruction`}>
              <span>In the separate {fmtCompact(bagVolumeValue)} mL {mainFluid.label} bag, add</span>
              <strong class="kphos-instruction-value ui-statement-value" data-testid="kcl-stock-volume">{fmtStock(plan.kClStockMl)}&nbsp;mL KCl</strong><span>.</span>
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
            <section class="kphos-delivery-summary ui-instruction" aria-label="Total delivery from all sources" data-testid="kphos-delivery-summary">
              <h4 class="ui-section-title">Total delivery · all sources</h4>
              {#if plan.totalKDeliveryMeqKgHr != null && plan.totalPhosDeliveryMmolKgHr != null}
                <dl class="kphos-delivery-values">
                  <div>
                    <dt class="ui-label">Phosphate</dt>
                    <dd data-testid="total-phos-delivery"><strong class="ui-result-value">{fmtDose(plan.totalPhosDeliveryMmolKgHr)}</strong> <span class="ui-unit">mmol/kg/hr</span></dd>
                  </div>
                  <div>
                    <dt class="ui-label">Potassium</dt>
                    <dd data-testid="total-k-delivery"><strong class="ui-result-value">{fmtDose(plan.totalKDeliveryMeqKgHr)}</strong> <span class="ui-unit">mEq/kg/hr</span></dd>
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
                      <strong>{fmtStock(plan.kPhosStockMl)} mL KPhos</strong>
                      <dl class="kphos-component-values">
                        <div><dt>K</dt><dd>{fmtConcentrationContribution(kPhosAddedKMeqPerL)} mEq/L</dd></div>
                        <div><dt>Phos</dt><dd>{fmtConcentrationContribution(kPhosAddedPhosMmolPerL)} mmol/L</dd></div>
                      </dl>
                    </article>
                  {/if}

                  {#if plan.hasKTarget}
                    <article class="ui-inset kphos-mixture-card" data-operator="+" data-testid="kcl-component">
                      <span class="ui-label kphos-component-kind">KCl additive</span>
                      <strong>{fmtStock(plan.kClStockMl)} mL KCl</strong>
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
                          <strong>{mainFluid.label} at {fmtCompact(mainRateValue)} mL/hr</strong>
                          <dl class="kphos-component-values">
                            <div><dt>K</dt><dd>{fmtDose(plan.mainNativeKDeliveryMeqKgHr)} mEq/kg/hr</dd></div>
                            <div><dt>Phos</dt><dd>{fmtDose(plan.mainNativePhosDeliveryMmolKgHr)} mmol/kg/hr</dd></div>
                          </dl>
                        {/if}
                      </article>
                      {#if plan.hasKTarget}
                        <article class="ui-inset kphos-mixture-card" data-operator="+" data-testid="kcl-component">
                          <span class="ui-label kphos-component-kind">KCl additive</span>
                          <strong>{fmtStock(plan.kClStockMl)} mL KCl</strong>
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
                        <strong>{fmtStock(plan.kPhosStockMl)} mL KPhos</strong>
                        <dl class="kphos-component-values">
                          <div><dt>K</dt><dd>{fmt(kPhosAddedKMeq, 1)} mEq</dd></div>
                          <div><dt>Phos</dt><dd>{fmt(kPhosAddedPhosMmol, 1)} mmol</dd></div>
                        </dl>
                      </article>
                      <article class="ui-inset kphos-mixture-card" data-operator="+" data-testid="cri-diluent-component">
                        <span class="ui-label kphos-component-kind">Diluent</span>
                        <strong>{fmtStock(plan.criDiluentVolumeMl)} mL {criDiluentFluid.label}</strong>
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
  .kphos-target-column { display: grid; min-width: 0; gap: 12px; }
  .kphos-calculation-mode { display: grid; min-width: 0; gap: 6px; text-align: center; }
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
    align-items: end;
    min-width: 0;
    gap: 16px;
  }

  .kphos-target-fields, .kphos-main-no-bag { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .kphos-bag-fields, .kphos-cri-setup-fields { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .kphos-bag-fields.kphos-main-no-bag { grid-template-columns: repeat(2, minmax(0, 1fr)); }

  @media (min-width: 1024px) {
    .kphos-field-grid { width: 100%; max-width: 38rem; margin-inline: auto; }
    .kphos-target-fields { column-gap: 2rem; }
    .kphos-calculation-mode { width: 100%; }
    .kphos-inline-number { max-width: 12rem; }
    .kphos-bag-fields.kphos-main-no-bag { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }

  .kphos-cri-instructions {
    display: grid;
    gap: 0.25rem 1.5rem;
  }

  @media (min-width: 640px) {
    .kphos-form-section { padding: 12px; }
    .kphos-mode-picker {
      position: relative;
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
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--ui-result-divider);
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
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
    margin-top: 0.55rem;
    font-variant-numeric: tabular-nums;
  }

  .kphos-component-values > div {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 4px;
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


  @media (max-width: 639px) {
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

    .kphos-bag-fields:not(.kphos-main-no-bag) > .kphos-field:first-child {
      grid-column: 1 / -1;
    }

    .kphos-cri-setup-fields > .kphos-field:last-child {
      grid-column: 1 / -1;
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
    .kphos-source-summary > .kphos-mixture-group, .kphos-cri-groups { display: none; }
    .kphos-delivery-summary { margin-bottom: 0; padding-bottom: 0; border-bottom: 0; }
    .kphos-diluent-line { display: flex; align-items: baseline; gap: 6px; margin-top: 4px; }
    .kphos-diluent-line strong { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px; }
    .kphos-diluent-amount { white-space: nowrap; }
    .kphos-diluent-name { font-size: 14px; font-weight: 500; }
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
