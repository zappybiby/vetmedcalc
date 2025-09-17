<script lang="ts">
  import CPRCard from './CPRCard.svelte';
  import CRICalculator from './CRICalculator.svelte';
  import ReglanInBag from './ReglanInBag.svelte';

  type Tab = { id: string; label: string };
  const tabs: Tab[] = [
    { id: 'cpr',    label: 'CPR CARD' },
    { id: 'cri',    label: 'CRI CALCULATOR' },
    { id: 'reglan', label: 'REGLAN IN BAG' },
    { id: 'blood',  label: 'BLOOD TRANSFUSION' }
  ];

  let active: Tab['id'] = 'cpr'; // default

  const tabBase = 'rounded-md border-2 border-slate-200 px-3 py-1 text-sm font-semibold tracking-wide text-slate-200 shadow-card transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-400';
  const tabActive = 'bg-slate-700';
  const tabInactive = 'bg-surface-raised';
</script>

<section class="grid min-w-0 gap-3" aria-label="Main tools">
  <div class="flex flex-wrap gap-2" role="tablist" aria-label="Tool tabs">
    {#each tabs as t}
      <button
        class={`${tabBase} ${active === t.id ? tabActive : tabInactive}`}
        role="tab"
        aria-selected={active === t.id}
        on:click={() => (active = t.id)}
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
      <CPRCard />
    {:else if active === 'cri'}
      <CRICalculator />
    {:else if active === 'reglan'}
      <ReglanInBag />
    {:else}
      <div class="text-slate-300">Blood Transfusion tool will appear here.</div>
    {/if}
  </div>
</section>
