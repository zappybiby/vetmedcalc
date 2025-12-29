<script lang="ts">
  import BatchCPRLabels from './BatchCPRLabels.svelte';
  import CPRCard from './CPRCard.svelte';
  import { cprBatchMode } from '../stores/cprUi';
</script>

<section class="grid gap-3" aria-label="CPR labels">
  <label class="inline-flex items-center gap-2 text-sm font-semibold text-slate-200" for="cpr-batch-toggle">
    <input
      id="cpr-batch-toggle"
      type="checkbox"
      class="field-checkbox h-4 w-4"
      bind:checked={$cprBatchMode}
    />
    Batch mode
  </label>

  {#if $cprBatchMode}
    <BatchCPRLabels />
  {:else}
    <CPRCard />
  {/if}
</section>
