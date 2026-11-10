/**
 * Freezes the ESM entrypoint, the manifest and the API 2.x shapes of the definitions
 * (actions, presets, feedback, variables) without starting Companion.
 */

import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { InstanceBase, combineRgb } from '@companion-module/base'
import initActions from '../src/actions.js'
import initFeedbacks from '../src/feedbacks.js'
import initPresets from '../src/presets.js'
import initVariables from '../src/variables.js'

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Reads a JSON file of the module.
 */
function readJson(relativePath) {
	return JSON.parse(fs.readFileSync(path.join(appDir, relativePath), 'utf8'))
}

/**
 * Same colors as in main.js.
 */
const colors = {
	white: combineRgb(255, 255, 255),
	black: combineRgb(0, 0, 0),
	green: combineRgb(0, 200, 0),
}

/**
 * Expected definition of the `gpio` option.
 */
const GPIO_OPTION = { type: 'number', id: 'gpio', label: 'GPIO', min: 1, max: 32, default: 1, asInteger: true }

/**
 * Binds actions.js to a fake context and captures the definitions.
 */
function captureActions() {
	const defs = {}
	initActions.call({
		setActionDefinitions(d) {
			Object.assign(defs, d)
		},
	})
	return defs
}

/**
 * Binds feedbacks.js to a fake context and captures the definitions.
 */
function captureFeedbacks() {
	const defs = {}
	initFeedbacks.call({
		colors,
		setFeedbackDefinitions(d) {
			Object.assign(defs, d)
		},
	})
	return defs
}

/**
 * Binds presets.js to a fake context and captures structure + presets.
 */
function capturePresets() {
	const calls = []
	initPresets.call({
		colors,
		setPresetDefinitions(...args) {
			calls.push(args)
		},
	})
	return calls
}

/**
 * Binds variables.js to a fake context and captures the argument passed.
 */
function captureVariables() {
	let received
	initVariables.call({
		setVariableDefinitions(d) {
			received = d
		},
	})
	return received
}

nodeTest.describe('ESM entrypoint main.js', () => {
	nodeTest('exports the module class as default, and UpgradeScripts', async () => {
		const mod = await import('../src/main.js')
		assert.equal(typeof mod.default, 'function')
		assert.ok(mod.default.prototype instanceof InstanceBase)
		assert.ok(Array.isArray(mod.UpgradeScripts))
		assert.equal(mod.UpgradeScripts.length, 1)
	})
})

nodeTest.describe('manifest companion/manifest.json', () => {
	const manifest = readJson('companion/manifest.json')

	nodeTest('declares an API 2.x connection on node26, entrypoint src/main.js', () => {
		assert.equal(manifest.type, 'connection')
		assert.equal(manifest.runtime.type, 'node26')
		assert.equal(manifest.runtime.api, 'nodejs-ipc')
		assert.equal(manifest.runtime.entrypoint, '../src/main.js')
		assert.equal(manifest.runtime.apiVersion, '0.0.0')
		assert.ok(fs.existsSync(path.join(appDir, 'companion', manifest.runtime.entrypoint)))
		assert.equal(readJson('package.json').main, 'src/main.js')
	})

	nodeTest('aligns version with package.json, lists products and keywords', () => {
		assert.equal(manifest.version, readJson('package.json').version)
		assert.deepEqual(manifest.products, ['GPIO'])
		assert.deepEqual(manifest.keywords, ['gpio', 'relay', 'udp', 'stage machinery'])
	})
})

nodeTest.describe('actions.js (API 2.x)', () => {
	nodeTest('3 actions pulse / set_on / set_off, each with the gpio option', () => {
		const defs = captureActions()
		assert.deepEqual(Object.keys(defs).sort(), ['pulse', 'set_off', 'set_on'])
		assert.equal(defs.pulse.name, 'GPIO pulse')
		assert.equal(defs.set_on.name, 'GPIO set on')
		assert.equal(defs.set_off.name, 'GPIO set off')
		for (const [id, def] of Object.entries(defs)) {
			assert.deepEqual(def.options, [GPIO_OPTION], `${id}: options`)
			assert.equal(typeof def.description, 'string', `${id}: description`)
			assert.ok(def.description.length > 0, `${id}: empty description`)
			assert.equal(typeof def.callback, 'function', `${id}: callback`)
		}
	})
})

nodeTest.describe('presets.js (API 2.x)', () => {
	nodeTest('calls setPresetDefinitions(structure, presets) with 64 simple presets', () => {
		const calls = capturePresets()
		assert.equal(calls.length, 1)
		assert.equal(calls[0].length, 2)
		const [structure, presets] = calls[0]

		const expectedIds = []
		for (let i = 1; i <= 32; i++) expectedIds.push(`impulse${i}`)
		for (let i = 1; i <= 32; i++) expectedIds.push(`towStates${i}`)
		assert.deepEqual(Object.keys(presets).sort(), expectedIds.sort())

		const actionIds = Object.keys(captureActions())
		const feedbackIds = Object.keys(captureFeedbacks())
		for (const [id, preset] of Object.entries(presets)) {
			assert.equal(preset.type, 'simple', `${id}: type`)
			for (const step of preset.steps) {
				for (const entry of [...step.down, ...step.up]) {
					assert.ok(actionIds.includes(entry.actionId), `${id}: actionId ${entry.actionId}`)
				}
			}
			for (const fb of preset.feedbacks) {
				assert.ok(feedbackIds.includes(fb.feedbackId), `${id}: feedbackId ${fb.feedbackId}`)
			}
		}

		assert.ok(Array.isArray(structure))
		assert.equal(structure.length, 1)
		assert.deepEqual([...structure[0].definitions].sort(), Object.keys(presets).sort())
	})

	nodeTest('"GPIO" section, texts, black background, gpio option and green feedback style', () => {
		const [[structure, presets]] = capturePresets()
		assert.equal(structure[0].id, 'gpio')
		assert.equal(structure[0].name, 'GPIO')
		for (let gpio = 1; gpio <= 32; gpio++) {
			const impulse = presets[`impulse${gpio}`]
			const twoStates = presets[`towStates${gpio}`]
			assert.equal(impulse.style.text, `IMP ${gpio}`)
			assert.equal(twoStates.style.text, `TS ${gpio}`)
			assert.equal(twoStates.name, `Two states ${gpio} button`)
			assert.deepEqual(impulse.steps, [{ down: [{ actionId: 'pulse', options: { gpio } }], up: [] }])
			assert.deepEqual(twoStates.steps, [
				{
					down: [{ actionId: 'set_on', options: { gpio } }],
					up: [{ actionId: 'set_off', options: { gpio } }],
				},
			])
			for (const preset of [impulse, twoStates]) {
				assert.equal(preset.style.bgcolor, colors.black)
				assert.deepEqual(preset.feedbacks, [
					{ feedbackId: 'gpio_state', options: { gpio }, style: { bgcolor: colors.green } },
				])
			}
		}
	})
})

nodeTest.describe('feedbacks.js (API 2.x)', () => {
	nodeTest('a single boolean feedback gpio_state, green by default, native inversion', () => {
		const defs = captureFeedbacks()
		assert.deepEqual(Object.keys(defs), ['gpio_state'])
		const def = defs.gpio_state
		assert.equal(def.type, 'boolean')
		assert.equal(def.name, 'GPIO state')
		assert.deepEqual(def.defaultStyle, { bgcolor: colors.green })
		assert.equal(def.showInvert, true)
		assert.deepEqual(def.options, [GPIO_OPTION])
		assert.equal(def.affectedProperties, undefined)
	})
})

nodeTest.describe('variables.js (API 2.x)', () => {
	nodeTest('passes an object of 33 named variables', () => {
		const defs = captureVariables()
		assert.equal(typeof defs, 'object')
		assert.ok(!Array.isArray(defs))
		const expected = ['Full']
		for (let i = 1; i <= 32; i++) expected.push(String(i).padStart(2, '0'))
		assert.deepEqual(Object.keys(defs).sort(), expected.sort())
		for (const [id, def] of Object.entries(defs)) {
			assert.equal(typeof def.name, 'string', `${id}: name`)
		}
		assert.equal(defs['05'].name, 'GPIO 05 state (0 = off, 1 = on)')
		assert.equal(defs.Full.name, 'All GPIO states (32-bit integer, GPIO 1 = 1)')
	})
})
