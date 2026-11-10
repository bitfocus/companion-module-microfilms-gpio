/**
 * Runs the upgrade script of 1.2.0 on saved 1.1.0 buttons (per-GPIO actions and advanced feedbacks).
 */

import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import { combineRgb } from '@companion-module/base'
import { UpgradeScripts } from '../src/upgrades.js'

const GREEN = combineRgb(0, 200, 0)
const RED = combineRgb(200, 0, 0)
const BLACK = combineRgb(0, 0, 0)

/**
 * Wraps a fixed value as stored by Companion.
 */
function fixed(value) {
	return { isExpression: false, value }
}

/**
 * Builds a saved action.
 */
function action(actionId, options = {}) {
	return { id: `a-${actionId}`, controlId: 'bank:1-0-0', actionId, options }
}

/**
 * Builds a saved feedback.
 */
function feedback(feedbackId, options = {}) {
	return { id: `f-${feedbackId}`, controlId: 'bank:1-0-0', feedbackId, options }
}

/**
 * Runs the first upgrade script on the given actions and feedbacks.
 */
function upgrade(actions, feedbacks) {
	const context = { currentConfig: { host: '127.0.0.1', port: '7770' } }
	return UpgradeScripts[0](context, { config: null, secrets: null, actions, feedbacks })
}

nodeTest.describe('1.2.0 upgrade script', () => {
	nodeTest('is the first upgrade script and leaves the config untouched', () => {
		assert.equal(typeof UpgradeScripts[0], 'function')
		assert.equal(upgrade([], []).updatedConfig, null)
	})

	nodeTest('impulseN / upN / downN become pulse / set_on / set_off with gpio = N', () => {
		const actions = [action('impulse5'), action('up1'), action('down32'), action('impulse12')]
		const result = upgrade(actions, [])
		assert.deepEqual(
			result.updatedActions.map((a) => [a.id, a.actionId, a.options]),
			[
				['a-impulse5', 'pulse', { gpio: fixed(5) }],
				['a-up1', 'set_on', { gpio: fixed(1) }],
				['a-down32', 'set_off', { gpio: fixed(32) }],
				['a-impulse12', 'pulse', { gpio: fixed(12) }],
			],
		)
	})

	nodeTest('gpio_state_bit_N becomes gpio_state with gpio = N and the colorOn background', () => {
		const feedbacks = [
			feedback('gpio_state_bit_5', { colorOff: fixed(BLACK), colorOn: fixed(GREEN) }),
			feedback('gpio_state_bit_6', { colorOff: fixed(RED), colorOn: fixed(RED) }),
		]
		const result = upgrade([], feedbacks)
		assert.deepEqual(
			result.updatedFeedbacks.map((f) => [f.feedbackId, f.options, f.style]),
			[
				['gpio_state', { gpio: fixed(5) }, { bgcolor: GREEN }],
				['gpio_state', { gpio: fixed(6) }, { bgcolor: RED }],
			],
		)
	})

	nodeTest('colorOn missing or set by an expression: green background; colorOff is dropped', () => {
		const feedbacks = [
			feedback('gpio_state_bit_1'),
			feedback('gpio_state_bit_2', { colorOn: { isExpression: true, value: '$(internal:x)' } }),
			feedback('gpio_state_bit_3', { colorOff: fixed(RED), colorOn: fixed('#ff0000') }),
		]
		const result = upgrade([], feedbacks)
		assert.equal(result.updatedFeedbacks.length, 3)
		for (const f of result.updatedFeedbacks) {
			assert.deepEqual(f.style, { bgcolor: GREEN })
			assert.deepEqual(Object.keys(f.options), ['gpio'])
		}
	})

	nodeTest('any other ID is left untouched', () => {
		const otherActions = [
			action('pulse', { gpio: fixed(3) }),
			action('impulse0'),
			action('impulse33'),
			action('impulse05'),
			action('up'),
			action('other_module_action'),
		]
		const otherFeedbacks = [
			feedback('gpio_state', { gpio: fixed(3) }),
			feedback('gpio_state_bit_0'),
			feedback('gpio_state_bit_33'),
			feedback('something_else', { colorOn: fixed(RED) }),
		]
		const before = structuredClone({ otherActions, otherFeedbacks })
		const result = upgrade(otherActions, otherFeedbacks)
		assert.deepEqual(result.updatedActions, [])
		assert.deepEqual(result.updatedFeedbacks, [])
		assert.deepEqual({ otherActions, otherFeedbacks }, before)
	})

	nodeTest('a 1.1.0 IMP 5 button: pulse gpio 5 and green gpio_state gpio 5', () => {
		const result = upgrade(
			[action('impulse5')],
			[feedback('gpio_state_bit_5', { colorOff: fixed(BLACK), colorOn: fixed(GREEN) })],
		)
		assert.equal(result.updatedActions[0].actionId, 'pulse')
		assert.deepEqual(result.updatedActions[0].options, { gpio: fixed(5) })
		assert.equal(result.updatedFeedbacks[0].feedbackId, 'gpio_state')
		assert.deepEqual(result.updatedFeedbacks[0].options, { gpio: fixed(5) })
		assert.deepEqual(result.updatedFeedbacks[0].style, { bgcolor: GREEN })
	})
})
