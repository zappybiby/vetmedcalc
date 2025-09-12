<script lang="ts">
  import PatientPanel from './lib/components/PatientPanel.svelte';
  import TabShell from './lib/components/TabShell.svelte';
</script>

<main class="page">
  <div class="layout">
    <PatientPanel />

    <div class="center">
      <TabShell />
    </div>
  </div>
</main>

<style>
  .page {
    min-height: 100vh;
    /* Inherit global dark styles */
    background: transparent;
    color: inherit;
  }
  .layout {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem;
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 1rem;
    width: 100%;
    min-width: 0;
    overflow-x: hidden;
  }
  .center {
    display: grid;
    place-items: start center;
    min-width: 0;
  }

  /* Responsive: collapse to single column on narrow screens */
  @media (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
</style>
