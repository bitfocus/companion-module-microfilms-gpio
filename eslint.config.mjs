/**
 * Configuration ESLint du module.
 *
 * La mise en forme (indentation, guillemets, points-virgules, espaces) relève de Prettier
 * (`yarn format`, configuration de `@companion-module/tools`) : ESLint ne garde que les règles de qualité.
 *
 * @module eslint.config
 * @see {@link https://eslint.org/docs/latest/use/configure/}
 *
 * @property {Array} files - Types de fichiers à cibler.
 * @property {Object} languageOptions - Options de langage.
 * @property {Object} rules - Règles ESLint.
 * @property {Array} rules.eqeqeq - Règle d'égalité stricte.
 * @property {Array} rules.camelcase - Règle de camelcase.
 * @property {Array} rules['prefer-const'] - Règle de const pour les variables non réaffectées.
 */

import globals from 'globals'
import js from '@eslint/js'

export default [
	{
		ignores: ['node_modules/', 'docs/', 'pkg/', '.yarn/'], // Dépendances, doc générée et bundle `yarn package`
	},
	js.configs.recommended,
	{
		files: ['**/*.js', '**/*.mjs'],
		languageOptions: {
			globals: {
				...globals.node,
			},
			ecmaVersion: 'latest',
			sourceType: 'module', // Modules ESM (package.json "type": "module")
		},
		rules: {
			eqeqeq: ['error', 'always'], // Toujours === au lieu de ==
			camelcase: ['error', { properties: 'always', allow: ['key-management'] }], // camelCase obligatoire
			'prefer-const': ['error'], // const si la variable n'est pas réaffectée
		},
	},
]
