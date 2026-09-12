import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://robert-hoffman04.github.io',

  vite: {
    plugins: [tailwindcss()],
    //  CSS minification was causing visual bugs
    build: {
      cssMinify: 'esbuild',
    },
  },
});