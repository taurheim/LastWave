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
    ssr: {
      noExternal: ['d3', 'd3-*'],
    },
  },
});
