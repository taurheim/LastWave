import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://savas.ca/lastwave',
  base: '/lastwave/',
  integrations: [react(), tailwind(), sitemap()],
  vite: {
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
