<script lang="ts">
  import CPRLabelsTool from './CPRLabelsTool.svelte';
  import CRICalculator from './CRICalculator.svelte';
  import DrugInBag from './DrugInBag.svelte';
  import InsOuts from './InsOuts.svelte';
  import { cprBatchMode } from '../stores/cprUi';

  type Tab = { id: string; label: string };
  const tabs: Tab[] = [
    { id: 'cpr',     label: 'CPR LABELS' },
    { id: 'cri',     label: 'CRI CALCULATOR' },
    { id: 'drugbag', label: 'DRUG IN BAG' },
    { id: 'insouts', label: 'INS / OUTS' },
  ];

  let active: Tab['id'] = 'cpr'; // default

  function selectTab(id: Tab['id']) {
    active = id;
    if (id !== 'cpr') {
      cprBatchMode.set(false);
    }
  }

  const tabBase = 'rounded-md border-2 border-slate-200 px-3 py-1 text-sm font-semibold tracking-wide text-slate-200 shadow-card transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400';
  const tabActive = 'bg-slate-700';
  const tabInactive = 'bg-surface-raised';
</script>

<section class="grid min-w-0 w-full gap-3" aria-label="Main tools">
  <div class="flex flex-wrap gap-2" role="tablist" aria-label="Tool tabs">
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
  </div>

  <div
    class="min-h-[40vh] max-w-full min-w-0 overflow-x-auto rounded-lg border-2 border-slate-200 bg-surface p-4 text-slate-200 shadow-panel"
    role="tabpanel"
  >
    {#if active === 'cpr'}
      <CPRLabelsTool />
    {:else if active === 'cri'}
      <CRICalculator />
    {:else if active === 'drugbag'}
      <DrugInBag />
    {:else if active === 'insouts'}
      <InsOuts />
    {/if}
  </div>
</section>
