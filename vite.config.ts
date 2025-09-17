import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // ⬅️ keep this if deploying under /vetmedcalc/
  base: '/vetmedcalc/',
  plugins: [svelte(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@defs': fileURLToPath(new URL('./src/lib/definitions', import.meta.url)),
    }
  }
});
