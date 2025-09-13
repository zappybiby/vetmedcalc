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
</script>

<section class="shell" aria-label="Main tools">
  <div class="tabs" role="tablist" aria-label="Tool tabs">
    {#each tabs as t}
      <button
        class="tab {active === t.id ? 'is-active' : ''}"
        role="tab"
        aria-selected={active === t.id}
        on:click={() => (active = t.id)}
      >
        {t.label}
      </button>
    {/each}
  </div>

  <div class="panel" role="tabpanel">
    {#if active === 'cpr'}
      <CPRCard />
    {:else if active === 'cri'}
      <CRICalculator />
    {:else if active === 'reglan'}
      <ReglanInBag />
    {:else}
      <div class="placeholder">Blood Transfusion tool will appear here.</div>
    {/if}
  </div>
</section>

<style>
  .shell { display: grid; gap: .75rem; min-width: 0; }
  .tabs { display: flex; flex-wrap: wrap; gap: .5rem; }
  .tab {
    border: 2px solid #e5e7eb; background: #1f2937; color: #e5e7eb; padding: .4rem .7rem;
    border-radius: .4rem; font-weight: 700; font-size: .85rem;
    box-shadow: 2px 2px 0 #0b0b0b;
  }
  .tab.is-active { background: #374151; }
  .panel {
    min-height: 40vh;
    border: 2px solid #e5e7eb; border-radius: .5rem; padding: 1rem;
    box-shadow: 3px 3px 0 #0b0b0b; background: #111827; color: #e5e7eb;
    max-width: 100%; min-width: 0; overflow-x: auto;
  }
  .placeholder { color: #cbd5e1; opacity: .9; }
  @media (max-width: 720px) {
    .tabs { gap: .4rem; }
  }
</style>
