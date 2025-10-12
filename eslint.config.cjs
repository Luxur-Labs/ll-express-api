// Flat ESLint config for ESLint v9+
// Minimal rules to unblock linting for a TypeScript Express API

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const importPlugin = require('eslint-plugin-import');

module.exports = [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '**/*.d.ts',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        project: null,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      import: importPlugin,
    },
    rules: {
      // General
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-undef': 'off',

      // Imports
      'import/order': ['warn', {
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      }],
    },
  },
];


