/**
 * ESLint configuration of the module.
 *
 * Formatting (indentation, quotes, semicolons, spaces) belongs to Prettier
 * (`yarn format`, configuration of `@companion-module/tools`): ESLint only keeps quality rules.
 *
 * @module eslint.config
 * @see {@link https://eslint.org/docs/latest/use/configure/}
 *
 * @property {Array} files - Targeted file types.
 * @property {Object} languageOptions - Language options.
 * @property {Object} rules - ESLint rules.
 * @property {Array} rules.eqeqeq - Strict equality rule.
 * @property {Array} rules.camelcase - camelCase rule (Companion action and feedback IDs allowed).
 * @property {Array} rules['prefer-const'] - const for variables that are never reassigned.
 */

import globals from 'globals'
import js from '@eslint/js'

export default [
	{
		ignores: ['node_modules/', 'docs/', 'pkg/', '.yarn/'], // Dependencies, generated docs and `yarn package` bundle
	},
	js.configs.recommended,
	{
		files: ['**/*.js', '**/*.mjs'],
		languageOptions: {
			globals: {
				...globals.node,
			},
			ecmaVersion: 'latest',
			sourceType: 'module', // ESM modules (package.json "type": "module")
		},
		rules: {
			eqeqeq: ['error', 'always'], // Always === instead of ==
			camelcase: [
				'error',
				{ properties: 'always', allow: ['key-management', '^set_on$', '^set_off$', '^gpio_state$'] },
			], // camelCase except Companion IDs
			'prefer-const': ['error'], // const when the variable is never reassigned
		},
	},
]
