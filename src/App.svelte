<script lang="ts">
  import { onMount } from 'svelte';
  import PatientPanel from './lib/components/PatientPanel.svelte';
  import TabShell from './lib/components/TabShell.svelte';
  import { cprBatchMode } from './lib/stores/cprUi';

  type Theme = 'dark' | 'light';

  const THEME_STORAGE_KEY = 'vetmedcalc.theme';
  const DEFAULT_THEME: Theme = 'dark';

  let theme: Theme = DEFAULT_THEME;

  const isTheme = (value: string | null): value is Theme => value === 'dark' || value === 'light';

  const applyTheme = (value: Theme): void => {
    if (typeof document === 'undefined') return;

    document.documentElement.dataset.theme = value;
    document.documentElement.classList.toggle('dark', value === 'dark');
  };

  const readStoredTheme = (): Theme | null => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return isTheme(stored) ? stored : null;
    } catch {
      return null;
    }
  };

  const writeStoredTheme = (value: Theme): void => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // Ignore storage errors (private mode, blocked storage, etc.).
    }
  };

  const toggleTheme = (): void => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    writeStoredTheme(theme);
  };

  onMount(() => {
    theme = readStoredTheme() ?? DEFAULT_THEME;
    applyTheme(theme);
  });
</script>

<main class="min-h-screen py-6 md:pb-14">
  <div
    class={`mx-auto grid min-w-0 max-w-5xl items-start gap-4 px-4 sm:px-6 ${$cprBatchMode ? 'md:grid-cols-1' : 'md:grid-cols-[320px_1fr]'}`}
  >
    {#if !$cprBatchMode}
      <PatientPanel />
    {/if}

    <div class={`flex min-w-0 justify-center ${$cprBatchMode ? 'md:justify-center' : 'md:justify-start'}`}>
      <TabShell />
    </div>
  </div>
</main>

<div class="pointer-events-none hidden md:fixed md:inset-x-0 md:top-4 md:z-40 md:flex">
  <div class="mx-auto flex w-full max-w-5xl justify-end px-4 sm:px-6">
    <button
      type="button"
      class="theme-toggle ui-button pointer-events-auto gap-2 text-xs font-black uppercase tracking-wide"
      on:click={toggleTheme}
      aria-pressed={theme === 'light'}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
      <span class="theme-toggle-track" aria-hidden="true">
        <span class={`theme-toggle-thumb ${theme === 'light' ? 'is-light' : ''}`}></span>
      </span>
    </button>
  </div>
</div>

<footer class="app-footer hidden md:fixed md:inset-x-0 md:bottom-0 md:flex">
  <div class="mx-auto flex w-full max-w-5xl items-center justify-center gap-3 px-4 py-2 text-xs">
    <span>VetMedCalc made by Brian L. aka zappybiby.</span>
    <a
      class="app-footer-link inline-flex items-center"
      href="https://github.com/zappybiby/vetmedcalc"
      target="_blank"
      rel="noreferrer"
      aria-label="View the VetMedCalc GitHub repository"
      title="VetMedCalc on GitHub"
    >
      <svg class="h-4 w-4" viewBox="0 0 24 24" role="img" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 2C6.477 2 2 6.486 2 12.02c0 4.427 2.865 8.184 6.84 9.51.5.092.682-.218.682-.486 0-.237-.009-.868-.014-1.703-2.782.605-3.369-1.344-3.369-1.344-.454-1.158-1.11-1.467-1.11-1.467-.908-.622.069-.61.069-.61 1.004.071 1.532 1.034 1.532 1.034.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.114-4.555-4.958 0-1.095.39-1.99 1.029-2.69-.103-.253-.446-1.27.098-2.646 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.748-1.026 2.748-1.026.546 1.376.202 2.393.1 2.646.64.7 1.028 1.595 1.028 2.69 0 3.854-2.338 4.702-4.566 4.95.359.31.678.923.678 1.86 0 1.343-.012 2.425-.012 2.756 0 .27.18.583.688.484A10.02 10.02 0 0 0 22 12.02C22 6.486 17.523 2 12 2Z"
        />
      </svg>
    </a>
  </div>
</footer>
