import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [preact()],
  build: { outDir: 'dist/client', target: 'es2022', cssCodeSplit: true, sourcemap: false },
  server: { proxy: { '/api': 'http://localhost:8080' } },
});
