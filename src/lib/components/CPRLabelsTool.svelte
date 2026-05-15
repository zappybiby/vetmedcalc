<script lang="ts">
  import BatchCPRLabels from './BatchCPRLabels.svelte';
  import CPRCard from './CPRCard.svelte';
  import { cprBatchMode } from '../stores/cprUi';
</script>

<section class="grid gap-2 sm:gap-4" aria-label="CPR labels">
  {#if $cprBatchMode}
    <label class="ui-inset inline-flex w-fit items-center gap-2 px-2.5 py-2 text-sm font-semibold text-slate-200 sm:px-3" for="cpr-batch-toggle-active">
      <input
        id="cpr-batch-toggle-active"
        type="checkbox"
        class="field-checkbox h-4 w-4"
        bind:checked={$cprBatchMode}
      />
      Batch mode
    </label>
  {/if}

  <div hidden={!$cprBatchMode}>
    <BatchCPRLabels />
  </div>

  <div hidden={$cprBatchMode}>
    <CPRCard />
  </div>
</section>
