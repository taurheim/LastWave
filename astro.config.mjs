import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [react(), tailwind()],
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
