import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

const tsGlobs = ['**/src/**/*.ts', '**/test/**/*.ts'];

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts'],
  },
  {
    files: tsGlobs,
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  eslintConfigPrettier,
);
