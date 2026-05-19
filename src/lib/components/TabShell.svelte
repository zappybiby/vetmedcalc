<script lang="ts">
  import BloodTransfusion from './BloodTransfusion.svelte';
  import CPRLabelsTool from './CPRLabelsTool.svelte';
  import CRICalculator from './CRICalculator.svelte';
  import DrugInBag from './DrugInBag.svelte';
  import FoodCalc from './FoodCalc.svelte';
  import InsOuts from './InsOuts.svelte';
  import PatientPanel from './PatientPanel.svelte';
  import RERCalculator from './RERCalculator.svelte';
  import VenousBloodGas from './VenousBloodGas.svelte';
  import { cprBatchMode } from '../stores/cprUi';

  type Tab = { id: string; label: string };
  const tabs: Tab[] = [
    { id: 'cri',     label: 'CRI calculator' },
    { id: 'drugbag', label: 'Drug in bag' },
    { id: 'insouts', label: 'Ins / outs' },
    { id: 'rer',     label: 'RER calculator' },
    { id: 'food',    label: 'Food calc' },
    { id: 'venousbg', label: 'Venous blood gas' },
    { id: 'blood',   label: 'Blood transfusion' },
    { id: 'cpr',     label: 'CPR labels' },
  ];

  let active: Tab['id'] = 'cri';

  function selectTab(id: Tab['id']) {
    if (active === 'cpr' && id !== 'cpr' && $cprBatchMode) {
      cprBatchMode.set(false);
    }
    active = id;
  }

  const tabBase = 'ui-tab';
  const tabActive = 'ui-tab-active';
  const tabInactive = '';
</script>

<section class="grid min-w-0 w-full gap-2" aria-label="Main tools">
  <div class="tab-strip-outer">
    <div class="tab-strip-frame">
      <div class="ui-tablist" role="tablist" aria-label="Tool tabs">
        {#each tabs as t}
          <button
            class={`${tabBase} ${active === t.id ? tabActive : tabInactive}`}
            role="tab"
            aria-selected={active === t.id}
            on:click={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        {/each}
        <slot name="tab-extra" />
      </div>
    </div>
  </div>

  {#if !$cprBatchMode}
    <PatientPanel />
  {/if}

  <div
    class="mx-auto w-full max-w-[1040px] min-w-0 overflow-x-auto"
    role="tabpanel"
  >
    <div hidden={active !== 'cri'}>
      <CRICalculator />
    </div>
    <div hidden={active !== 'drugbag'}>
      <DrugInBag />
    </div>
    <div hidden={active !== 'insouts'}>
      <InsOuts />
    </div>
    <div hidden={active !== 'rer'}>
      <RERCalculator />
    </div>
    <div hidden={active !== 'food'}>
      <FoodCalc />
    </div>
    <div hidden={active !== 'venousbg'}>
      <VenousBloodGas />
    </div>
    <div hidden={active !== 'blood'}>
      <BloodTransfusion />
    </div>
    <div hidden={active !== 'cpr'}>
      <CPRLabelsTool />
    </div>
  </div>
</section>
