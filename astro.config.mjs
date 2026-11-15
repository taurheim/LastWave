import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://savas.ca/lastwave',
  base: process.env.ASTRO_BASE ?? '/lastwave/',
  // Astro 7 defaults to 'jsx' whitespace rules, which drop the spaces around
  // Prettier-wrapped inline links (e.g. "Last.fmor"). Keep HTML-aware compression.
  compressHTML: true,
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      proxy: {
        '/api/wikidata': {
          target: 'https://www.wikidata.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/wikidata/, ''),
        },
        '/api/sparql': {
          target: 'https://query.wikidata.org',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/sparql/, ''),
        },
      },
    },
    ssr: {
      noExternal: ['d3', 'd3-*'],
    },
  },
});
