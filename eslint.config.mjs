import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.claude/**',
      'coverage/**',
      'dist/**',
      'export/**',
      'main.js',
      'node_modules/**',
      'templates/**',
      'test-vault/**',
      'docs/project-vault/.obsidian/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { arguments: false } },
      ],
      '@typescript-eslint/require-await': 'off',
    },
  },
  {
    files: ['*.mjs', 'scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'Buffer',
        'process',
        'require',
        '__dirname',
        '__filename',
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            'child_process',
            'crypto',
            'electron',
            'fs',
            'path',
            'worker_threads',
          ],
          patterns: ['node:*'],
        },
      ],
    },
  },
);
