// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

import svelte from '@astrojs/svelte';

import tailwindcss from '@tailwindcss/vite';
import elm from 'vite-plugin-elm';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: "server",
  adapter: vercel(),
  integrations: [svelte()],

  vite: {
    plugins: [tailwindcss(), elm({
      debug: process.env.NODE_ENV !== 'production',
      nodeElmCompilerOptions: {
        cwd: process.cwd()
      }
    })]
  }
});