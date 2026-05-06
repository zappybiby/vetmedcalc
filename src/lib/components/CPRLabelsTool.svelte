<script lang="ts">
  import BatchCPRLabels from './BatchCPRLabels.svelte';
  import CPRCard from './CPRCard.svelte';
  import { cprBatchMode } from '../stores/cprUi';
</script>

<section class="grid gap-2 sm:gap-4" aria-label="CPR labels">
  <div class="flex flex-wrap items-center gap-2 sm:gap-3">
    <label class="ui-inset inline-flex items-center gap-2 px-2.5 py-2 text-sm font-semibold text-slate-200 sm:px-3" for="cpr-batch-toggle">
      <input
        id="cpr-batch-toggle"
        type="checkbox"
        class="field-checkbox h-4 w-4"
        bind:checked={$cprBatchMode}
      />
      Batch mode
    </label>
    <div class="hidden text-xs text-slate-400 sm:block">Print one label or batch-print multiple patients.</div>
  </div>

  <div hidden={!$cprBatchMode}>
    <BatchCPRLabels />
  </div>

  <div hidden={$cprBatchMode}>
    <CPRCard />
  </div>
</section>
