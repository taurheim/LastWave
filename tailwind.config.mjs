/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        lw: {
          bg: '#0c1117',
          surface: '#141b24',
          border: '#1e2a36',
          accent: '#27AAE1',
          'accent-dim': '#1a7faa',
          teal: '#2F4F4F',
          cyan: '#00CED1',
          muted: '#7a8fa0',
          text: '#e2e8f0',
        },
      },
    },
  },
  plugins: [],
};
