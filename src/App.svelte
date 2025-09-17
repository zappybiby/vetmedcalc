<script lang="ts">
  import PatientPanel from './lib/components/PatientPanel.svelte';
  import TabShell from './lib/components/TabShell.svelte';
</script>

<main class="min-h-screen py-6">
  <div class="mx-auto grid min-w-0 max-w-5xl gap-4 px-4 sm:px-6 md:grid-cols-[320px_1fr]">
    <PatientPanel />

    <div class="flex min-w-0 justify-center md:justify-start">
      <TabShell />
    </div>
  </div>
</main>
