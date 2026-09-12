import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'jquery-3.5.1.min.js'] },
  js.configs.recommended,
  {
    files: ['*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.webextensions, $: 'readonly' },
    },
  },
  {
    files: ['scripts/**', 'test/**', '*.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
