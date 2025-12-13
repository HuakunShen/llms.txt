import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
// Note: Actual plugin import might be different depending on template version

// Template likely used @sveltejs/vite-plugin-svelte
// Let's check package.json to be sure, or just assume standard.
// Default template uses: import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  build: {
    outDir: '../llms-txt-generator/media',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name].js`,
        chunkFileNames: `assets/[name].js`,
        assetFileNames: `assets/[name].[ext]`,
      },
    },
  },
})
