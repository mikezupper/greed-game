import parser from '@typescript-eslint/parser';
import gyral from '@gyral/core/eslint';

export default [
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: { parser, parserOptions: { sourceType: 'module', ecmaVersion: 'latest' } },
    ...gyral.configs.recommended,
  },
];
