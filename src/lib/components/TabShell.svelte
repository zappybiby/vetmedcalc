<script lang="ts">
  import BloodTransfusion from './BloodTransfusion.svelte';
  import CPRLabelsTool from './CPRLabelsTool.svelte';
  import CRICalculator from './CRICalculator.svelte';
  import DrugInBag from './DrugInBag.svelte';
  import InsOuts from './InsOuts.svelte';
  import RERCalculator from './RERCalculator.svelte';
  import VenousBloodGas from './VenousBloodGas.svelte';
  import { cprBatchMode } from '../stores/cprUi';

  type Tab = { id: string; label: string };
  const tabs: Tab[] = [
    { id: 'cri',     label: 'CRI calculator' },
    { id: 'drugbag', label: 'Drug in bag' },
    { id: 'insouts', label: 'Ins / outs' },
    { id: 'rer',     label: 'RER calculator' },
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
  <div class="flex min-w-0 max-w-full justify-center sm:-mx-1 sm:px-1 sm:pb-0.5 sm:overflow-x-auto">
    <div class="ui-tablist" role="tablist" aria-label="Tool tabs">
    {#each tabs as t}
      <button
        class={`${tabBase} ${active === t.id ? tabActive : tabInactive} shrink-0`}
        role="tab"
        aria-selected={active === t.id}
        on:click={() => selectTab(t.id)}
      >
        {t.label}
      </button>
    {/each}
    </div>
  </div>

  <div
    class="ui-panel max-w-full min-w-0 overflow-x-auto p-1.5 text-slate-200 sm:p-2.5"
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
