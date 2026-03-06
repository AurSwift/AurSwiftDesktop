import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: {
      name: 'node-runtime',
      environment: 'node',
      include: [
        'tests/unit/main/**/*.test.ts',
        'tests/unit/main/**/*.test.tsx',
        'tests/unit/preload/**/*.test.ts',
        'tests/unit/preload/**/*.test.tsx',
        'tests/integration/main/**/*.test.ts',
        'tests/integration/main/**/*.test.tsx',
        'tests/integration/preload/**/*.test.ts',
        'tests/integration/preload/**/*.test.tsx',
      ],
      exclude: ['tests/unit/renderer/**', 'tests/component/**', 'tests/integration/renderer/**'],
    },
  },
  {
    extends: './vitest.config.ts',
    test: {
      name: 'dom-runtime',
      environment: 'jsdom',
      include: [
        'tests/unit/renderer/**/*.test.ts',
        'tests/unit/renderer/**/*.test.tsx',
        'tests/component/**/*.test.ts',
        'tests/component/**/*.test.tsx',
        'tests/integration/renderer/**/*.test.ts',
        'tests/integration/renderer/**/*.test.tsx',
      ],
      exclude: [
        'tests/unit/main/**',
        'tests/unit/preload/**',
        'tests/integration/main/**',
        'tests/integration/preload/**',
      ],
    },
  },
])
