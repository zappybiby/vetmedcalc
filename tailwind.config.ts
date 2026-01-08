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
        card: '0 1px 0 rgba(255,255,255,0.06) inset, 0 10px 24px rgba(0,0,0,0.35)',
        panel: '0 1px 0 rgba(255,255,255,0.07) inset, 0 16px 40px rgba(0,0,0,0.45)'
      }
    }
  },
  plugins: []
} satisfies Config;

export default config;
