import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    rolldownOptions: {
      // three.js is the bulk of the code and rarely changes: its own file stays in the browser cache between releases
      output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]build[\\/]/ }] } },
    },
    // the three.js core alone is ~650 kB (165 kB gzip); it is meant to be one cached file, so the default 500 kB warning is noise
    chunkSizeWarningLimit: 700,
  },
  test: {
    environment: 'jsdom',
  },
});
