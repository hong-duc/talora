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
  // Enable Vercel Web Analytics so page views are tracked automatically.
  // The adapter injects the @vercel/analytics script into every page.
  adapter: vercel({
    webAnalytics: { enabled: true },
  }),
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