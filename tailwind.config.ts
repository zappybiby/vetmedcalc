import type { Config } from 'tailwindcss';

const config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,svelte}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#111827',
          raised: '#1f2937',
          sunken: '#0b1220'
        }
      },
      boxShadow: {
        card: '2px 2px 0 #0b0b0b',
        panel: '3px 3px 0 #0b0b0b'
      }
    }
  },
  plugins: []
} satisfies Config;

export default config;
