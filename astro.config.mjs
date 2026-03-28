import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';

function devOnlyPages() {
  return {
    name: 'dev-only-pages',
    hooks: {
      'astro:config:setup'({ command, injectRoute }) {
        if (command === 'dev') {
          injectRoute({
            pattern: '/lab',
            entrypoint: './src/pages-dev/lab.astro',
          });
        }
      },
    },
  };
}

export default defineConfig({
  integrations: [react(), tailwind(), devOnlyPages()],
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
