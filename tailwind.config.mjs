/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['Roboto', 'system-ui', 'sans-serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        lw: {
          bg: 'rgb(var(--lw-bg) / <alpha-value>)',
          surface: 'rgb(var(--lw-surface) / <alpha-value>)',
          border: 'rgb(var(--lw-border) / <alpha-value>)',
          accent: 'rgb(var(--lw-accent) / <alpha-value>)',
          'accent-dim': 'rgb(var(--lw-accent-dim) / <alpha-value>)',
          teal: 'rgb(var(--lw-teal) / <alpha-value>)',
          cyan: 'rgb(var(--lw-cyan) / <alpha-value>)',
          muted: 'rgb(var(--lw-muted) / <alpha-value>)',
          text: 'rgb(var(--lw-text) / <alpha-value>)',
          heading: 'rgb(var(--lw-heading) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
};
