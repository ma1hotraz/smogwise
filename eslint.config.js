import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const restrict = (patterns) => ({ 'no-restricted-imports': ['error', { patterns }] });

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      eqeqeq: 'error',
      curly: 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-param-reassign': ['error', { props: true }],
      complexity: ['error', 10],
      'max-depth': ['error', 3],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
    },
  },
  {
    // Size limits from docs/09 §1; data tables are exempt.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/engine/data/**'],
    rules: {
      'no-console': 'error',
      'max-lines': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/**/*.tsx'],
    rules: {
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ['src/shared/**/*.ts', 'src/server/**/*.ts'],
    rules: { '@typescript-eslint/explicit-module-boundary-types': 'error' },
  },
  {
    files: ['src/shared/**/*.ts'],
    rules: restrict([
      { group: ['**/client/**', '**/server/**'], message: 'shared must stay isomorphic.' },
      { group: ['preact', 'preact/*', 'express', 'node:*'], message: 'shared must stay pure.' },
    ]),
  },
  {
    // The engine is deterministic: time and randomness are injected (docs/09 §2).
    files: ['src/shared/engine/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', 'fetch', 'localStorage', 'window', 'document'],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Pass `now` in.' },
        { object: 'Math', property: 'random', message: 'The engine must be deterministic.' },
      ],
    },
  },
  {
    files: ['src/client/**/*.{ts,tsx}'],
    rules: restrict([{ group: ['**/server/**'], message: 'client must not import server code.' }]),
  },
  {
    files: ['src/server/**/*.ts'],
    rules: restrict([{ group: ['**/client/**'], message: 'server must not import client code.' }]),
  },
  {
    files: ['src/client/**/*.{ts,tsx}', 'tests/components/**/*.tsx'],
    languageOptions: { globals: globals.browser },
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    settings: { react: { version: '18.3', pragma: 'h' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      // The classic hook rules. The React Compiler rules in v7 do not recognise preact/hooks
      // (they treat `useRef` values as plain locals), so they are not enabled.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      ...jsxA11y.flatConfigs.strict.rules,
      // Preact uses the standard HTML attribute names (`for`, `class`) as well as React's.
      'react/no-unknown-property': 'off',
      'react/prop-types': 'off',
      // WAI-ARIA tabs: the tabpanel itself is focusable (docs/06 §2).
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: [], roles: ['tabpanel'] }],
      'react/no-danger': 'error',
      'react/jsx-no-target-blank': 'error',
    },
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['scripts/**/*.mjs', '*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      // Tests assert on known fixtures and untyped JSON bodies; each test checks the shape itself.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
    },
  },
);
