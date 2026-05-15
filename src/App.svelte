<script lang="ts">
  import { onMount } from 'svelte';
  import TabShell from './lib/components/TabShell.svelte';

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

<div class="flex min-h-dvh flex-col">
  <main class="flex-1 py-2 sm:py-3 md:py-4">
    <div class="mx-auto grid min-w-0 max-w-[1280px] gap-2 px-2 sm:px-3 md:px-4">
      <div class="flex min-w-0 justify-center">
        <TabShell>
          <button
            slot="tab-extra"
            type="button"
            class="theme-toggle tab-theme-toggle ui-button z-40 text-[10.5px] font-medium sm:text-xs"
            on:click={toggleTheme}
            aria-pressed={theme === 'light'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <span class="theme-toggle-track" aria-hidden="true">
              <span class={`theme-toggle-thumb ${theme === 'light' ? 'is-light' : ''}`} data-theme-icon={theme}>
                {#if theme === 'light'}
                  <svg class="theme-toggle-icon" viewBox="0 0 20 20" aria-hidden="true">
                    <circle cx="10" cy="10" r="3.25" fill="currentColor" />
                    <path
                      d="M10 2.25v2M10 15.75v2M4.5 4.5l1.4 1.4M14.1 14.1l1.4 1.4M2.25 10h2M15.75 10h2M4.5 15.5l1.4-1.4M14.1 5.9l1.4-1.4"
                      fill="none"
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-width="1.8"
                    />
                  </svg>
                {:else}
                  <svg class="theme-toggle-icon" viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      d="M15.35 12.55A6.9 6.9 0 0 1 7.45 4.65a6.7 6.7 0 1 0 7.9 7.9Z"
                      fill="currentColor"
                    />
                  </svg>
                {/if}
              </span>
            </span>
          </button>
        </TabShell>
      </div>
    </div>
  </main>

  <footer class="app-footer hidden md:flex opacity-70">
    <div class="mx-auto flex w-full max-w-[1040px] items-center justify-center gap-3 px-4 py-1.5 text-[11px]">
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
</div>
