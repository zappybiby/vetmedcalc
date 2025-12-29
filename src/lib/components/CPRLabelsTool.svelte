<script lang="ts">
  import BatchCPRLabels from './BatchCPRLabels.svelte';
  import CPRCard from './CPRCard.svelte';
  import { cprBatchMode } from '../stores/cprUi';

  const modeBase = 'rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors';
  const modeActive = 'bg-slate-900 text-slate-100 shadow-card';
  const modeInactive = 'text-slate-300 hover:text-slate-100';
</script>

<section class="grid gap-3" aria-label="CPR labels">
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="text-xs font-semibold uppercase tracking-wide text-slate-300">Label mode</div>
    <div
      class="inline-flex rounded-md border-2 border-slate-200 bg-surface-raised p-1 shadow-card"
      role="group"
      aria-label="CPR label mode"
    >
      <button
        type="button"
        class={`${modeBase} ${$cprBatchMode ? modeInactive : modeActive}`}
        aria-pressed={!$cprBatchMode}
        on:click={() => cprBatchMode.set(false)}
      >
        Single
      </button>
      <button
        type="button"
        class={`${modeBase} ${$cprBatchMode ? modeActive : modeInactive}`}
        aria-pressed={$cprBatchMode}
        on:click={() => cprBatchMode.set(true)}
      >
        Batch
      </button>
    </div>
  </div>

  {#if $cprBatchMode}
    <BatchCPRLabels />
  {:else}
    <CPRCard />
  {/if}
</section>
