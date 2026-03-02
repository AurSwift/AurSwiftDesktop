import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores([
    '**/dist/**',
    '**/node_modules/**',
    'coverage/**',
    'test-results/**',
    'packages/renderer/**',
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['tests/**/*.{ts,tsx,js,mjs,cjs}', 'tests/setup.{ts,tsx,js,mjs,cjs}'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.jest,
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: [
      'scripts/**/*.{ts,tsx,js,mjs,cjs}',
      '*.{config,conf}.{js,mjs,cjs,ts}',
      'drizzle.config.ts',
      'playwright.config.ts',
      'vitest.config.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
  {
    files: [
      'packages/preload/src/logger.ts',
      'packages/main/src/utils/logger.ts',
      'packages/main/src/database/seed.ts',
      'packages/main/src/ipc/loggerHandlers.ts',
    ],
    rules: {
      'no-console': 'off',
    },
  },
])
