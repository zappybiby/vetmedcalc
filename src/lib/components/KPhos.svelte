<script lang="ts">
  import {
    KCL_K_MEQ_PER_ML,
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

  function fmtContribution(value: number, digits = 1): string {
    const formatted = fmt(value, digits);
    return value > 0 ? `+${formatted}` : formatted;
  }

  const selectedClass = 'border-sky-400/70 bg-sky-400/15 text-slate-100 shadow-sm';
  const unselectedClass = 'border-transparent bg-transparent text-slate-300 hover:border-slate-600/60 hover:bg-surface-raised';

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
      if (phosTargetValue == null || phosTargetValue < 0) next.push('Phos target must be 0 or greater.');
      if (!isPositive(weightKg)) next.push('Enter patient weight.');
      if (!isPositive(mainRateValue)) next.push('Enter the fluid rate.');
      if (mode === 'bag' && !isPositive(bagVolumeValue)) next.push('Enter bag volume.');
      if (mode === 'cri' && !isPositive(criDurationValue)) next.push('Enter the CRI duration.');
      if (mode === 'cri' && isPresent(criRateMlHr) && !isPositive(criRateValue)) {
        next.push('CRI rate must be greater than 0 or blank.');
      }
    }

    if (isPresent(kTargetMeqPerL)) {
      if (kTargetValue == null || kTargetValue < 0) next.push(`${kBasisLabel} K target must be greater than 0 or blank.`);
      if (plan.hasKTarget && !isPositive(bagVolumeValue)) next.push('Enter bag volume.');
    }

    issues = [...new Set(next)];
  }

  let alerts: string[] = [];
  $: {
    const next: string[] = [];
    if (plan.fluidsMeetPhosTarget && plan.hasPhosTarget) {
      next.push('The selected fluids already meet the Phos target.');
    }
    if (phosTargetValue != null && plan.totalPhosDeliveryMmolKgHr != null) {
      const excessFraction = getKPhosExcessFraction(phosTargetValue, plan.totalPhosDeliveryMmolKgHr);
      if (excessFraction != null && excessFraction >= KPHOS_EXCESS_WARNING_FRACTION) {
        next.push(Number.isFinite(excessFraction)
          ? `Fluid Phos exceeds the target by ${fmt(excessFraction * 100, 0)}%.`
          : `Fluid Phos exceeds the zero target by ${fmt(plan.phosTargetExcessMmolKgHr, 4)} mmol/kg/hr.`);
      }
    }
    if (plan.kTargetExcessMeqPerL != null) {
      next.push(`${kBasisLabel} K already exceeds the target by ${fmt(plan.kTargetExcessMeqPerL, 2)} mEq/L; no KCl is needed.`);
    }
    if (mode === 'cri' && plan.criRequestedRateFeasible === false) {
      next.push(plan.criRateIssue === 'diluent-exceeds-phos-target'
        ? `${criDiluentFluid.label} exceeds the Phos target at that rate. Use a lower rate or Phos-free diluent; stock-only rate is ${fmt(plan.criPumpRateMlHr, 3)} mL/hr.`
        : `The entered CRI rate is too low. Use ${fmt(plan.criPumpRateMlHr, 3)} mL/hr or higher.`);
    }
    alerts = next;
  }

  let kPhosAddedKMeq = 0;
  let kPhosAddedPhosMmol = 0;
  let kClAddedKMeq = 0;
  let mainBagNativeKMeq = 0;
  let mainBagNativePhosMmol = 0;
  let finalMainBagKMeq = 0;
  let finalMainBagPhosMmol = 0;
  let criDiluentKMeq = 0;
  let criDiluentPhosMmol = 0;
  let finalCriKMeq = 0;
  let finalCriPhosMmol = 0;
  $: kPhosAddedKMeq = (plan.kPhosStockMl ?? 0) * KPHOS_K_MEQ_PER_ML;
  $: kPhosAddedPhosMmol = (plan.kPhosStockMl ?? 0) * KPHOS_PHOS_MMOL_PER_ML;
  $: kClAddedKMeq = (plan.kClStockMl ?? 0) * KCL_K_MEQ_PER_ML;
  $: mainBagNativeKMeq = mainFluid.nativeKMeqPerL * (bagVolumeValue ?? 0) / 1000;
  $: mainBagNativePhosMmol = mainFluid.nativePhosMmolPerL * (bagVolumeValue ?? 0) / 1000;
  $: finalMainBagKMeq = (plan.finalMainBagKMeqPerL ?? 0) * (bagVolumeValue ?? 0) / 1000;
  $: finalMainBagPhosMmol = (plan.finalMainBagPhosMmolPerL ?? 0) * (bagVolumeValue ?? 0) / 1000;
  $: criDiluentKMeq = criDiluentFluid.nativeKMeqPerL * (plan.criDiluentVolumeMl ?? 0) / 1000;
  $: criDiluentPhosMmol = criDiluentFluid.nativePhosMmolPerL * (plan.criDiluentVolumeMl ?? 0) / 1000;
  $: finalCriKMeq = kPhosAddedKMeq + criDiluentKMeq;
  $: finalCriPhosMmol = kPhosAddedPhosMmol + criDiluentPhosMmol;
</script>

<section class="grid min-w-0 gap-2 text-slate-200" aria-label="KPhos calculator">
  <article class="ui-card min-w-0 overflow-hidden" data-testid="kphos-input-card">
    <div class="flex min-h-11 items-center gap-2 px-3 py-1.5 sm:px-3.5">
      <span class="whitespace-nowrap text-sm font-bold text-slate-300">Add to:</span>
      <div class="ui-inset grid w-[11rem] min-w-0 grid-cols-2 gap-1 p-1" role="group" aria-label="Add KPhos to">
        <button
          type="button"
          class={`min-h-8 rounded-md border px-3 py-1 text-xs font-black uppercase tracking-wide transition-colors ${mode === 'bag' ? selectedClass : unselectedClass}`}
          aria-pressed={mode === 'bag'}
          on:click={() => selectMode('bag')}
        >
          Bag
        </button>
        <button
          type="button"
          class={`min-h-8 rounded-md border px-3 py-1 text-xs font-black uppercase tracking-wide transition-colors ${mode === 'cri' ? selectedClass : unselectedClass}`}
          aria-pressed={mode === 'cri'}
          on:click={() => selectMode('cri')}
        >
          CRI
        </button>
      </div>
    </div>

    <div class="kphos-statements border-t border-slate-700/40" data-testid="kphos-statements">
      {#if mode === 'bag'}
        <div class="kphos-statement-row">
          <span>I want to deliver <strong class="font-black text-slate-100">Phos</strong> of</span>
          <input
            id="kphos-phos-target"
            class="field-control kphos-inline-number"
            type="number"
            min="0"
            step="0.001"
            inputmode="decimal"
            placeholder="optional"
            aria-label="Phos target (mmol/kg/hr)"
            bind:value={phosTargetMmolKgHr}
          />
          <span>mmol/kg/hr, with</span>
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
          <span><strong class="font-black text-slate-100">K</strong> of</span>
          <input
            id="kphos-k-target"
            class="field-control kphos-inline-number"
            type="number"
            min="0"
            step="1"
            inputmode="decimal"
            placeholder="optional"
            aria-label={`${kBasisLabel} K target (mEq/L)`}
            bind:value={kTargetMeqPerL}
          />
          <span>mEq/L.</span>
        </div>

        <div class="kphos-statement-row border-t border-slate-700/35">
          <span>Add this to a</span>
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
          <span>mL bag of</span>
          <select id="kphos-main-fluid" class="field-select kphos-inline-select" aria-label="Main bag fluid" bind:value={mainFluidId}>
            {#each KPHOS_BASE_FLUIDS as fluid}
              <option value={fluid.id}>{fluid.label}</option>
            {/each}
          </select>
          <span>running at</span>
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
          <span>mL/hr.</span>
        </div>
      {:else}
        <div class="kphos-statement-row">
          <span>Deliver <strong class="font-black text-slate-100">Phos</strong> of</span>
          <input
            id="kphos-phos-target"
            class="field-control kphos-inline-number"
            type="number"
            min="0"
            step="0.001"
            inputmode="decimal"
            placeholder="optional"
            aria-label="Phos target (mmol/kg/hr)"
            bind:value={phosTargetMmolKgHr}
          />
          <span>mmol/kg/hr for</span>
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
          <span>hr at</span>
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
          <span>mL/hr, using</span>
          <select id="kphos-cri-diluent" class="field-select kphos-inline-select" aria-label="CRI diluent" bind:value={criDiluentFluidId}>
            {#each KPHOS_BASE_FLUIDS as fluid}
              <option value={fluid.id}>{fluid.label}</option>
            {/each}
          </select>
          <span>as diluent.</span>
        </div>

        <div class="kphos-statement-row border-t border-slate-700/35">
          <span>The patient is receiving</span>
          <select id="kphos-main-fluid" class="field-select kphos-inline-select" aria-label="Main bag fluid" bind:value={mainFluidId}>
            {#each KPHOS_BASE_FLUIDS as fluid}
              <option value={fluid.id}>{fluid.label}</option>
            {/each}
          </select>
          <span>at</span>
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
          <span>mL/hr, with</span>
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
          <span><strong class="font-black text-slate-100">K</strong> of</span>
          <input
            id="kphos-k-target"
            class="field-control kphos-inline-number"
            type="number"
            min="0"
            step="1"
            inputmode="decimal"
            placeholder="optional"
            aria-label={`${kBasisLabel} K target (mEq/L)`}
            bind:value={kTargetMeqPerL}
          />
          <span>mEq/L{plan.hasKTarget ? ' in a' : '.'}</span>
          {#if plan.hasKTarget}
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
            <span>mL bag.</span>
          {/if}
        </div>
      {/if}
    </div>
  </article>

  <article class="ui-card min-w-0 overflow-hidden" data-testid="kphos-results">
    {#if !hasAnyTarget}
      <div class="px-3 py-3 text-sm text-slate-400">Enter a Phos or potassium target.</div>
    {:else if issues.length}
      <div class="bg-amber-950/40 px-3 py-2.5 text-sm text-amber-100">
        <span class="font-black">Needed:</span> {issues.join(' ')}
      </div>
    {:else}
      <section class="px-3 py-3 sm:px-4" aria-label="Preparation and delivery">
        {#if mode === 'bag'}
          <p class="kphos-primary-result flex flex-wrap items-baseline gap-x-1.5 gap-y-1 leading-relaxed text-slate-300">
            <span>In the {fmtCompact(bagVolumeValue)} mL {mainFluid.label} bag,</span>
            {#if plan.hasPhosTarget && plan.hasKTarget}
              <span>add</span>
              <strong class="ui-statement-value" data-testid="kphos-stock-volume">{fmtStock(plan.kPhosStockMl)} mL KPhos</strong>
              <span>and</span>
              <strong class="ui-statement-value" data-testid="kcl-stock-volume">{fmtStock(plan.kClStockMl)} mL KCl</strong><span>.</span>
            {:else if plan.hasPhosTarget}
              <span>add</span>
              <strong class="ui-statement-value" data-testid="kphos-stock-volume">{fmtStock(plan.kPhosStockMl)} mL KPhos</strong><span>.</span>
            {:else}
              <span>add</span>
              <strong class="ui-statement-value" data-testid="kcl-stock-volume">{fmtStock(plan.kClStockMl)} mL KCl</strong><span>.</span>
            {/if}
          </p>
        {:else}
          {#if plan.hasPhosTarget}
            <p class="kphos-primary-result flex flex-wrap items-baseline gap-x-1.5 gap-y-1 leading-relaxed text-slate-300">
              <span>Prepare the KPhos CRI with</span>
              <strong class="ui-statement-value" data-testid="kphos-stock-volume">{fmtStock(plan.kPhosStockMl)} mL KPhos</strong>
              <span>+</span>
              <strong class="ui-statement-value" data-testid="cri-diluent-volume">{fmtStock(plan.criDiluentVolumeMl)} mL {criDiluentFluid.label}</strong><span>.</span>
              <span>Run at</span>
              <strong class="ui-statement-value" data-testid="cri-pump-rate">{fmt(plan.criPumpRateMlHr, 3)} mL/hr</strong>
              <span>for {fmtCompact(plan.criActualRuntimeHr)} hr.</span>
            </p>
          {/if}

          {#if plan.hasKTarget}
            <p class={`${plan.hasPhosTarget ? 'mt-2 border-t border-slate-700/35 pt-2' : ''} kphos-primary-result flex flex-wrap items-baseline gap-x-1.5 gap-y-1 leading-relaxed text-slate-300`}>
              <span>In the separate {fmtCompact(bagVolumeValue)} mL {mainFluid.label} bag, add</span>
              <strong class="ui-statement-value" data-testid="kcl-stock-volume">{fmtStock(plan.kClStockMl)} mL KCl</strong><span>.</span>
            </p>
          {:else}
            <span class="sr-only" data-testid="kcl-stock-volume">No KCl requested</span>
          {/if}
        {/if}

        <div class="mt-2 text-[0.9375rem] leading-relaxed text-slate-300" data-testid="kphos-delivery-summary">
          {#if plan.totalKDeliveryMeqKgHr != null && plan.totalPhosDeliveryMmolKgHr != null}
            <p>
              This delivers <strong class="font-black tabular-nums text-slate-100" data-testid="total-phos-delivery">{fmt(plan.totalPhosDeliveryMmolKgHr, 2)} mmol/kg/hr Phos</strong> and <strong class="font-black tabular-nums text-slate-100" data-testid="total-k-delivery">{fmt(plan.totalKDeliveryMeqKgHr, 2)} mEq/kg/hr potassium</strong>.
            </p>
          {:else}
            <p class="text-slate-400">
              Enter patient weight and fluid rate to see delivery.
              <span class="sr-only" data-testid="total-phos-delivery">—</span>
              <span class="sr-only" data-testid="total-k-delivery">—</span>
            </p>
          {/if}
        </div>

        <div class="mt-3 border-t border-slate-700/45 pt-2.5">
          {#if alerts.length}
            <div class="mb-2 border-l-2 border-amber-400/60 bg-amber-950/35 px-2.5 py-1.5 text-xs font-semibold text-amber-100">
              {alerts.join(' ')}
            </div>
          {/if}

          <div class="kphos-source-summary ui-inset overflow-hidden text-sm text-slate-300" data-testid="kphos-source-summary">
            {#if mode === 'bag'}
              <section class="kphos-mixture-group" aria-label="Fluid bag composition">
                <div
                  class:kphos-flow-four={plan.hasPhosTarget && plan.hasKTarget}
                  class:kphos-flow-three={plan.hasPhosTarget !== plan.hasKTarget}
                  class="kphos-mixture-flow"
                >
                  <article class="kphos-mixture-card" data-testid="starting-fluid-component">
                    <span class="kphos-component-kind">Starting bag</span>
                    <strong>{fmtCompact(bagVolumeValue)} mL {mainFluid.label}</strong>
                    <dl class="kphos-component-values">
                      <div><dt>K</dt><dd>{fmt(mainBagNativeKMeq, 1)} mEq</dd></div>
                      <div><dt>Phos</dt><dd>{fmt(mainBagNativePhosMmol, 1)} mmol</dd></div>
                    </dl>
                  </article>

                  {#if plan.hasPhosTarget}
                    <article class="kphos-mixture-card" data-operator="+" data-testid="kphos-component">
                      <span class="kphos-component-kind">KPhos additive</span>
                      <strong>{fmtStock(plan.kPhosStockMl)} mL KPhos</strong>
                      <dl class="kphos-component-values">
                        <div><dt>K</dt><dd>{fmtContribution(kPhosAddedKMeq)} mEq</dd></div>
                        <div><dt>Phos</dt><dd>{fmtContribution(kPhosAddedPhosMmol)} mmol</dd></div>
                      </dl>
                    </article>
                  {/if}

                  {#if plan.hasKTarget}
                    <article class="kphos-mixture-card" data-operator="+" data-testid="kcl-component">
                      <span class="kphos-component-kind">KCl additive</span>
                      <strong>{fmtStock(plan.kClStockMl)} mL KCl</strong>
                      <dl class="kphos-component-values">
                        <div><dt>K</dt><dd>{fmtContribution(kClAddedKMeq)} mEq</dd></div>
                        <div><dt>Phos</dt><dd>0 mmol</dd></div>
                      </dl>
                    </article>
                  {/if}

                  <article class="kphos-mixture-card kphos-mixture-total" data-operator="=" data-testid="final-bag-component">
                    <span class="kphos-component-kind">Final bag</span>
                    <strong>Combined</strong>
                    <dl class="kphos-component-values">
                      <div><dt>K</dt><dd data-testid="final-main-bag-k">{fmt(finalMainBagKMeq, 1)} mEq</dd></div>
                      <div><dt>Phos</dt><dd>{fmt(finalMainBagPhosMmol, 1)} mmol</dd></div>
                    </dl>
                  </article>
                </div>
              </section>
            {:else}
              <div class="kphos-cri-groups">
                {#if plan.hasKTarget}
                  <section class="kphos-mixture-group" aria-label="Main fluid bag composition">
                    <h4>Main fluid bag</h4>
                    <div class="kphos-mixture-flow kphos-flow-three">
                      <article class="kphos-mixture-card" data-testid="starting-fluid-component">
                        <span class="kphos-component-kind">Starting bag</span>
                        <strong>{fmtCompact(bagVolumeValue)} mL {mainFluid.label}</strong>
                        <dl class="kphos-component-values">
                          <div><dt>K</dt><dd>{fmt(mainBagNativeKMeq, 1)} mEq</dd></div>
                          <div><dt>Phos</dt><dd>{fmt(mainBagNativePhosMmol, 1)} mmol</dd></div>
                        </dl>
                      </article>
                      <article class="kphos-mixture-card" data-operator="+" data-testid="kcl-component">
                        <span class="kphos-component-kind">KCl additive</span>
                        <strong>{fmtStock(plan.kClStockMl)} mL KCl</strong>
                        <dl class="kphos-component-values">
                          <div><dt>K</dt><dd>{fmtContribution(kClAddedKMeq)} mEq</dd></div>
                          <div><dt>Phos</dt><dd>0 mmol</dd></div>
                        </dl>
                      </article>
                      <article class="kphos-mixture-card kphos-mixture-total" data-operator="=" data-testid="final-bag-component">
                        <span class="kphos-component-kind">Final main bag</span>
                        <strong>Combined</strong>
                        <dl class="kphos-component-values">
                          <div><dt>K</dt><dd data-testid="final-main-bag-k">{fmt(finalMainBagKMeq, 1)} mEq</dd></div>
                          <div><dt>Phos</dt><dd>{fmt(finalMainBagPhosMmol, 1)} mmol</dd></div>
                        </dl>
                      </article>
                    </div>
                  </section>
                {/if}

                {#if plan.hasPhosTarget}
                  <section class="kphos-mixture-group" aria-label="KPhos CRI composition">
                    <h4>KPhos CRI</h4>
                    <div class="kphos-mixture-flow kphos-flow-three">
                      <article class="kphos-mixture-card" data-testid="kphos-component">
                        <span class="kphos-component-kind">Stock</span>
                        <strong>{fmtStock(plan.kPhosStockMl)} mL KPhos</strong>
                        <dl class="kphos-component-values">
                          <div><dt>K</dt><dd>{fmt(kPhosAddedKMeq, 1)} mEq</dd></div>
                          <div><dt>Phos</dt><dd>{fmt(kPhosAddedPhosMmol, 1)} mmol</dd></div>
                        </dl>
                      </article>
                      <article class="kphos-mixture-card" data-operator="+" data-testid="cri-diluent-component">
                        <span class="kphos-component-kind">Diluent</span>
                        <strong>{fmtStock(plan.criDiluentVolumeMl)} mL {criDiluentFluid.label}</strong>
                        <dl class="kphos-component-values">
                          <div><dt>K</dt><dd>{fmtContribution(criDiluentKMeq, 2)} mEq</dd></div>
                          <div><dt>Phos</dt><dd>{fmtContribution(criDiluentPhosMmol, 2)} mmol</dd></div>
                        </dl>
                      </article>
                      <article class="kphos-mixture-card kphos-mixture-total" data-operator="=" data-testid="final-cri-component">
                        <span class="kphos-component-kind">Prepared CRI</span>
                        <strong>{fmtStock(plan.criTotalVolumeMl)} mL total</strong>
                        <dl class="kphos-component-values">
                          <div><dt>K</dt><dd>{fmt(finalCriKMeq, 2)} mEq</dd></div>
                          <div><dt>Phos</dt><dd>{fmt(finalCriPhosMmol, 2)} mmol</dd></div>
                        </dl>
                      </article>
                    </div>
                  </section>
                {/if}
              </div>
            {/if}

            {#if plan.mainNativePhosDeliveryMmolKgHr != null && plan.mainNativeKDeliveryMeqKgHr != null}
              <div class="kphos-delivery-note" data-testid="native-fluid-delivery">
                <span>K / Phos from maintenance fluids</span>
                <p>
                  <strong>{mainFluid.label} at {fmtCompact(mainRateValue)} mL/hr</strong> contributes <strong>{fmt(plan.mainNativePhosDeliveryMmolKgHr, 4)} mmol/kg/hr Phos</strong> and <strong>{fmt(plan.mainNativeKDeliveryMeqKgHr, 4)} mEq/kg/hr potassium</strong> toward the total delivery shown above.
                </p>
              </div>
            {/if}
          </div>
        </div>
      </section>
    {/if}
  </article>

  <div class="sr-only" aria-live="polite" aria-atomic="true">
    {#if issues.length}
      KPhos setup needs more information.
    {:else if hasAnyTarget}
      KPhos calculation updated. KPhos {plan.hasPhosTarget ? `${fmtStock(plan.kPhosStockMl)} mL` : 'not requested'}. KCl {plan.hasKTarget ? `${fmtStock(plan.kClStockMl)} mL` : 'not requested'}. Total potassium {fmt(plan.totalKDeliveryMeqKgHr, 4)} mEq/kg/hr. Total Phos {fmt(plan.totalPhosDeliveryMmolKgHr, 4)} mmol/kg/hr.
    {/if}
  </div>
</section>

<style>
  .kphos-statements {
    display: grid;
    grid-template-rows: repeat(2, minmax(0, 1fr));
    height: 19rem;
  }

  .kphos-statement-row {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-content: center;
    align-items: center;
    column-gap: 0.375rem;
    row-gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.9375rem;
    line-height: 1.35;
    color: var(--ui-text-300);
  }

  .kphos-inline-number {
    width: 5.4rem;
    height: 2rem;
    flex: 0 0 5.4rem;
    padding: 0.2rem 0.4rem;
    text-align: center;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .kphos-inline-number:placeholder-shown {
    text-align: start;
    font-weight: 400;
  }

  .kphos-primary-result {
    font-size: 0.9375rem;
  }

  .kphos-delivery-note > span {
    display: block;
    color: var(--ui-link);
    font-size: 0.6875rem;
    font-weight: 900;
    letter-spacing: 0.09em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .kphos-mixture-group {
    padding: 0.75rem;
  }

  .kphos-mixture-group + .kphos-mixture-group {
    border-top: 1px solid var(--ui-divider);
  }

  .kphos-mixture-group h4 {
    margin-bottom: 0.55rem;
    color: var(--ui-text-200);
    font-size: 0.75rem;
    font-weight: 900;
    letter-spacing: 0.06em;
    text-transform: uppercase;
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
    border: 1px solid var(--ui-divider);
    border-radius: 0.5rem;
    background: color-mix(in srgb, var(--ui-surface-2) 68%, transparent);
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
    color: var(--ui-text-400);
    font-size: 0.625rem;
    font-weight: 900;
    letter-spacing: 0.08em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .kphos-mixture-card > strong {
    display: block;
    overflow-wrap: anywhere;
    margin-top: 0.15rem;
    color: var(--ui-text-100);
    font-size: 0.8125rem;
    font-weight: 900;
    line-height: 1.25;
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
    font-size: 0.625rem;
    font-weight: 800;
    line-height: 1.2;
  }

  .kphos-component-values dd {
    overflow-wrap: anywhere;
    margin-top: 0.08rem;
    color: var(--ui-text-100);
    font-size: 0.75rem;
    font-weight: 900;
    line-height: 1.2;
  }

  .kphos-delivery-note {
    border-top: 1px solid var(--ui-divider);
    padding: 0.65rem 0.75rem;
  }

  .kphos-delivery-note p {
    margin-top: 0.2rem;
    color: var(--ui-text-300);
    line-height: 1.45;
  }

  .kphos-delivery-note p strong {
    color: var(--ui-text-100);
    font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  .kphos-inline-select {
    width: 9.5rem;
    height: 2rem;
    flex: 0 0 9.5rem;
    padding-top: 0.2rem;
    padding-bottom: 0.2rem;
    font-weight: 700;
    line-height: 1;
  }

  .kphos-basis-button {
    display: inline-flex;
    width: 4.7rem;
    height: 2rem;
    flex: 0 0 4.7rem;
    align-items: center;
    justify-content: center;
    border-radius: 0.375rem;
    border: 1px solid var(--ui-accent-border);
    background: var(--ui-accent-surface);
    padding: 0 0.5rem;
    color: var(--ui-link);
    font-size: 0.8125rem;
    font-weight: 800;
    text-decoration-line: underline;
    text-decoration-style: dotted;
    text-underline-offset: 0.22rem;
    transition: background-color 150ms, border-color 150ms;
  }

  .kphos-basis-button:hover {
    border-color: rgb(125 211 252 / 0.85);
    background: rgb(56 189 248 / 0.22);
  }

  @media (min-width: 640px) {
    .kphos-statements {
      height: 12rem;
    }

    .kphos-statement-row {
      padding-right: 0.875rem;
      padding-left: 0.875rem;
      font-size: 1rem;
    }

    .kphos-primary-result {
      font-size: 1.0625rem;
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
    .kphos-statements {
      height: 7.25rem;
    }

    .kphos-cri-groups {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr));
    }

    .kphos-cri-groups > .kphos-mixture-group + .kphos-mixture-group {
      border-top: 0;
      border-left: 1px solid var(--ui-divider);
    }
  }
</style>
