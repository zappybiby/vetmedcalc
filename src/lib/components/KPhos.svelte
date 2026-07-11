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
  $: kPhosAddedKMeq = (plan.kPhosStockMl ?? 0) * KPHOS_K_MEQ_PER_ML;
  $: kPhosAddedPhosMmol = (plan.kPhosStockMl ?? 0) * KPHOS_PHOS_MMOL_PER_ML;
  $: kClAddedKMeq = (plan.kClStockMl ?? 0) * KCL_K_MEQ_PER_ML;
  $: mainBagNativeKMeq = mainFluid.nativeKMeqPerL * (bagVolumeValue ?? 0) / 1000;
  $: mainBagNativePhosMmol = mainFluid.nativePhosMmolPerL * (bagVolumeValue ?? 0) / 1000;
  $: finalMainBagKMeq = (plan.finalMainBagKMeqPerL ?? 0) * (bagVolumeValue ?? 0) / 1000;
  $: finalMainBagPhosMmol = (plan.finalMainBagPhosMmolPerL ?? 0) * (bagVolumeValue ?? 0) / 1000;
  $: criDiluentKMeq = criDiluentFluid.nativeKMeqPerL * (plan.criDiluentVolumeMl ?? 0) / 1000;
  $: criDiluentPhosMmol = criDiluentFluid.nativePhosMmolPerL * (plan.criDiluentVolumeMl ?? 0) / 1000;
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

        <div class="mt-2 text-sm leading-relaxed text-slate-300">
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

          <div class="kphos-source-summary ui-inset overflow-hidden text-sm leading-relaxed text-slate-300" data-testid="kphos-source-summary">
            {#if mode === 'bag' || plan.hasKTarget}
              <p>
                The fluid bag contains {fmt(mainBagNativePhosMmol, 1)} mmol Phos and {fmt(mainBagNativeKMeq, 1)} mEq K before additives.
              </p>
            {/if}

            {#if plan.mainNativePhosDeliveryMmolKgHr != null && plan.mainNativeKDeliveryMeqKgHr != null}
              <p data-testid="native-fluid-delivery">
                At {fmtCompact(mainRateValue)} mL/hr, the fluid contributes <strong class="font-black tabular-nums text-slate-100">{fmt(plan.mainNativePhosDeliveryMmolKgHr, 4)} mmol/kg/hr Phos</strong> and <strong class="font-black tabular-nums text-slate-100">{fmt(plan.mainNativeKDeliveryMeqKgHr, 4)} mEq/kg/hr potassium</strong>.
              </p>
            {/if}

            {#if plan.hasPhosTarget}
              <p>
                {fmtStock(plan.kPhosStockMl)} mL of KPhos adds <strong class="font-black tabular-nums text-slate-100">{fmt(kPhosAddedKMeq, 1)} mEq K</strong> and <strong class="font-black tabular-nums text-slate-100">{fmt(kPhosAddedPhosMmol, 1)} mmol Phos</strong>{mode === 'cri' ? ' to the CRI' : ''}.
              </p>
            {/if}

            {#if mode === 'cri' && plan.hasPhosTarget && (criDiluentKMeq > 0 || criDiluentPhosMmol > 0)}
              <p>
                {fmtStock(plan.criDiluentVolumeMl)} mL of {criDiluentFluid.label} diluent contributes {fmt(criDiluentKMeq, 2)} mEq K and {fmt(criDiluentPhosMmol, 2)} mmol Phos to the CRI.
              </p>
            {/if}

            {#if plan.hasKTarget}
              <p>
                {fmtStock(plan.kClStockMl)} mL of KCl adds <strong class="font-black tabular-nums text-slate-100">{fmt(kClAddedKMeq, 1)} mEq K</strong> to the fluid bag.
              </p>
            {/if}

            {#if mode === 'bag' || plan.hasKTarget}
              <p>
                The bag contains a total of <strong class="font-black tabular-nums text-slate-100" data-testid="final-main-bag-k">{fmt(finalMainBagKMeq, 1)} mEq K</strong> and <strong class="font-black tabular-nums text-slate-100">{fmt(finalMainBagPhosMmol, 1)} mmol Phos</strong>.
              </p>
            {/if}

            {#if plan.hasKTarget}
              <p class="text-slate-400">
                Actual {kBasisLabel} K is <strong class="font-black tabular-nums text-slate-200" data-testid="selected-k-actual">{fmt(plan.selectedKActualMeqPerL, 1)} mEq/L</strong> for a {fmt(kTargetValue, 1)} mEq/L target.
              </p>
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

  .kphos-source-summary > p {
    padding: 0.625rem 0.75rem;
  }

  .kphos-source-summary > p + p {
    border-top: 1px solid var(--ui-divider);
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

  @media (min-width: 1024px) {
    .kphos-statements {
      height: 7.25rem;
    }
  }
</style>
