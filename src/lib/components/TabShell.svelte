<script lang="ts">
  import CPRCard from './CPRCard.svelte';
  import CRICalculator from './CRICalculator.svelte';

  type Tab = { id: string; label: string };
  const tabs: Tab[] = [
    { id: 'cpr',   label: 'CPR CARD' },
    { id: 'cri',   label: 'CRI CALCULATOR' },
    { id: 'blood', label: 'BLOOD TRANSFUSION' }
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
    {:else}
      <div class="placeholder">Blood Transfusion tool will appear here.</div>
    {/if}
  </div>
</section>

<style>
  .shell { display: grid; gap: .75rem; }
  .tabs { display: flex; flex-wrap: wrap; gap: .5rem; }
  .tab {
    border: 2px solid #111; background: #fff; padding: .4rem .7rem;
    border-radius: .4rem; font-weight: 700; font-size: .85rem;
    box-shadow: 2px 2px 0 #111;
  }
  .tab.is-active { background: #f2f2f2; }
  .panel {
    min-height: 40vh;
    border: 2px solid #111; border-radius: .5rem; padding: 1rem;
    box-shadow: 3px 3px 0 #111; background: #fff;
  }
  .placeholder { color: #444; opacity: .9; }
  @media (max-width: 720px) {
    .tabs { gap: .4rem; }
  }
</style>
