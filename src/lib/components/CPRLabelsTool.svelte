<script lang="ts">
  import BatchCPRLabels from './BatchCPRLabels.svelte';
  import CPRCard from './CPRCard.svelte';
  import SegmentedToggle from './SegmentedToggle.svelte';
  import { cprBatchMode } from '../stores/cprUi';
</script>

<section class="ui-tool-stack" aria-label="CPR labels">
  {#if $cprBatchMode}
    <div class="w-44 max-w-full print:hidden">
      <SegmentedToggle label="Batch mode" first="Single" second="Batch" secondSelected={$cprBatchMode} onToggle={batch => $cprBatchMode = batch} />
    </div>
  {/if}

  <div hidden={!$cprBatchMode}>
    <BatchCPRLabels />
  </div>

  <div hidden={$cprBatchMode}>
    <CPRCard />
  </div>
</section>
