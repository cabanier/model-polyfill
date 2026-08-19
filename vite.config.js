import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    lib: {
      entry: 'src/index.js',
      formats: ['es'],
      fileName: 'model-element-polyfill',
    },
    rollupOptions: {
      external: (id) => id === 'three' || id.startsWith('three/'),
    },
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    restoreMocks: true,
  },
});
