<script lang="ts" context="module">
  let nextId = 0;
</script>

<script lang="ts">
  const descriptionId = `segmented-toggle-${nextId++}`;
  export let label: string;
  export let first: string;
  export let second: string;
  export let secondSelected: boolean | null;
  export let onToggle: (secondSelected: boolean) => void;
  export let testId: string | undefined = undefined;

  function toggle(event: MouseEvent): void {
    const initialSecond = (event.target as HTMLElement).closest('[data-side]')?.getAttribute('data-side') === 'second';
    onToggle(secondSelected == null ? initialSecond : !secondSelected);
  }
</script>

<button
  type="button"
  role={secondSelected == null ? 'button' : 'switch'}
  aria-label={label}
  aria-checked={secondSelected == null ? undefined : secondSelected}
  aria-describedby={descriptionId}
  data-testid={testId}
  class="ui-segmented segmented-toggle"
  on:click={toggle}
>
  <span class="ui-choice" class:is-selected={secondSelected === false} data-side="first">{first}</span>
  <span class="ui-choice" class:is-selected={secondSelected === true} data-side="second">{second}</span>
  <span class="sr-only" id={descriptionId}>{secondSelected == null ? `Choose ${first} or ${second}` : `${secondSelected ? second : first} selected`}</span>
</button>

<style>
  .segmented-toggle { width: 100%; cursor: pointer; font-size: 12px; }
  .segmented-toggle:focus-visible { outline: 2px solid var(--ui-accent-border); outline-offset: 2px; }
  .segmented-toggle :global(.ui-choice) { font-size: 12px; line-height: 16px; }
</style>
