import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', 'report/**'],
  },
  {
    files: ['src/**/*.ts', 'seeds/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
