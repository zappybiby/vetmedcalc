<script lang="ts">
  export let title: string;
  export let open = false;
</script>

<details class="group ui-card overflow-hidden" bind:open>
  <summary class="ui-summary ui-card-padding flex cursor-pointer items-center justify-between gap-3">
    <span class="ui-section-title">{title}</span>
    <svg class="h-5 w-5 flex-none text-slate-400 transition group-open:rotate-180" viewBox="0 0 20 20" aria-hidden="true">
      <path fill="currentColor" fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.173l3.71-3.94a.75.75 0 011.08 1.04l-4.24 4.5a.75.75 0 01-1.08 0l-4.24-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
    </svg>
  </summary>
  <div class="border-t ui-rule ui-card-padding">
    <slot />
  </div>
</details>
