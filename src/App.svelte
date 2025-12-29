<script lang="ts">
  import PatientPanel from './lib/components/PatientPanel.svelte';
  import TabShell from './lib/components/TabShell.svelte';
  import { cprBatchMode } from './lib/stores/cprUi';
</script>

<main class="min-h-screen py-6">
  <div
    class={`mx-auto grid min-w-0 max-w-5xl gap-4 px-4 sm:px-6 ${$cprBatchMode ? 'md:grid-cols-1' : 'md:grid-cols-[320px_1fr]'}`}
  >
    {#if !$cprBatchMode}
      <PatientPanel />
    {/if}

    <div class={`flex min-w-0 justify-center ${$cprBatchMode ? 'md:justify-center' : 'md:justify-start'}`}>
      <TabShell />
    </div>
  </div>
</main>
