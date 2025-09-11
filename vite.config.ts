import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  // ⬅️ if this is a project site, set to '/vetmedcalc/' (replace with your repo name)
  base: '/vetmedcalc/',

  plugins: [svelte()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@defs': fileURLToPath(new URL('./src/lib/definitions', import.meta.url)),
    }
  }
});
