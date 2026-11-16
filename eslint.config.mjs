import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';
import memberRegions from './rules/member-regions.mjs';

export default defineConfig(
  globalIgnores(['dist/', 'coverage/', 'migrations/', 'docs/', '.claude/', '.codex/']),
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      // NestJS modules are classes that only carry a decorator.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ExportAllDeclaration',
          message: 'Use explicit named exports: a barrel hides what a module exposes.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { jsdoc, cadenway: { rules: { 'member-regions': memberRegions } } },
    linterOptions: { noInlineConfig: true },
    rules: {
      'cadenway/member-regions': 'error',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/prefer-as-const': 'off',
      '@typescript-eslint/explicit-member-accessibility': ['error', { accessibility: 'explicit' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: { FunctionDeclaration: true, ClassDeclaration: true },
          contexts: ['TSInterfaceDeclaration', 'TSTypeAliasDeclaration', 'TSEnumDeclaration'],
          publicOnly: true,
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'nats', message: 'NATS is reached only through @cadenway/nest-messaging.' },
            // Dependencies rejected for every Cadenway backend; the message names the replacement.
            { name: 'axios', message: 'Rejected dependency: use the native fetch.' },
            {
              name: '@nestjs/schedule',
              message: 'Rejected dependency: it has no durability. Use @cadenway/nest-jobs.',
            },
            {
              name: '@nestjs/throttler',
              message: 'Rejected dependency: rate limiting belongs to the API gateway.',
            },
            {
              name: 'bullmq',
              message: 'Rejected dependency: jobs run on pg-boss through @cadenway/nest-jobs.',
            },
            {
              name: 'date-fns',
              message: 'Rejected dependency: use Temporal (temporal-polyfill).',
            },
            {
              name: 'ua-parser-js',
              message: 'Rejected dependency: bowser reads the User-Agent.',
            },
            {
              name: 'octokit',
              message: 'Rejected dependency: use the scoped @octokit/* packages.',
            },
            {
              name: '@gitbeaker/rest',
              message: 'Rejected dependency: GitLab is called with a typed fetch client.',
            },
            {
              name: 'samlify',
              message: 'Rejected dependency: SAML goes through @node-saml/node-saml.',
            },
          ],
          patterns: [
            {
              group: [
                'axios/*',
                '@nestjs/schedule/*',
                '@nestjs/throttler/*',
                'bullmq/*',
                'date-fns/*',
                'ua-parser-js/*',
                'octokit/*',
                '@gitbeaker/rest/*',
                'samlify/*',
              ],
              message: 'Rejected dependency: see the entry of the same package above.',
            },
            {
              group: ['@nats-io/*'],
              message: 'NATS is reached only through @cadenway/nest-messaging.',
            },
            {
              regex: '\\.\\./cadenway-',
              message: 'Never import sibling sources: use the published @cadenway/* packages.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
