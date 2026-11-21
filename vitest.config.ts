import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [preact()],
  test: {
    include: ['tests/{unit,property,api,components}/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['tests/helpers/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/shared/**', 'src/server/**', 'src/client/**', 'api/**'],
      exclude: ['src/server/index.ts', 'src/client/main.tsx', '**/*.d.ts', '**/*.css'],
      thresholds: {
        statements: 95,
        lines: 95,
        functions: 95,
        branches: 90,
        'src/shared/engine/**': { lines: 100, statements: 100, functions: 100, branches: 98 },
      },
    },
  },
});
