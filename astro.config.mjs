// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import vercel from '@astrojs/vercel';

import { unified } from '@astrojs/markdown-remark';

import { rehypeFaqCollapsible } from './src/lib/markdown/rehypeFaqCollapsible.ts';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  adapter: vercel(),
  markdown: {
    processor: unified({ rehypePlugins: [rehypeFaqCollapsible] }),
  },
  vite: {
    build: {
      cssMinify: false
    }
  }
});