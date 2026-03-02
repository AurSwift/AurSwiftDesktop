import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/views/**/types/*', '**/features/**/types/*'],
              message: 'Import from @/types instead. Old type locations are deprecated.',
            },
            {
              group: ['@/shared/types/*'],
              message:
                'Import from @/types instead. Use @/types/domain, @/types/api, or @/types/features as appropriate.',
            },
            {
              group: ['@/types/printer', '@/types/officePrinter'],
              message: 'Import from @/types/features/printer instead.',
            },
          ],
        },
      ],
    },
  },
])
