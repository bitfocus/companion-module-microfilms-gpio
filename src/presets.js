/**
 * Defines the "Impulse" and "Two states" button presets for the 32 GPIOs.
 * Each preset uses the shared actions and feedback with its GPIO in the `gpio` option.
 *
 * Required modules:
 * - ./protocol (GPIO count)
 */

import { GPIO_COUNT } from './protocol.js'

/**
 * Builds and sets the button presets, in a single "GPIO" section.
 * This function is called with the module instance as `this` at initialization.
 * API 2.x: the presets are of type `simple`.
 *
 * @returns {void}
 */
export default function () {
	const presetDefinitions = {}

	/**
	 * Feedback of a preset: green background while the GPIO is on.
	 *
	 * gpio: GPIO number (1–32).
	 * @returns {Object} Preset feedback entry.
	 */
	const stateFeedback = (gpio) => ({
		feedbackId: 'gpio_state',
		options: { gpio },
		style: {
			bgcolor: this.colors.green,
		},
	})

	/**
	 * Base style of a preset: white text on a black background.
	 *
	 * text: button text.
	 * @returns {Object} Button style.
	 */
	const buttonStyle = (text) => ({
		text,
		size: 12,
		color: this.colors.white,
		bgcolor: this.colors.black,
	})

	for (let gpio = 1; gpio <= GPIO_COUNT; gpio++) {
		/**
		 * "Impulse" preset: a press runs a pulse on the GPIO.
		 * @type {Object}
		 */
		presetDefinitions[`impulse${gpio}`] = {
			type: 'simple',
			name: `Impulse ${gpio} button`,
			style: buttonStyle(`IMP ${gpio}`),
			steps: [
				{
					down: [{ actionId: 'pulse', options: { gpio } }],
					up: [],
				},
			],
			feedbacks: [stateFeedback(gpio)],
		}
	}

	for (let gpio = 1; gpio <= GPIO_COUNT; gpio++) {
		/**
		 * "Two states" preset: press = set on, release = set off.
		 * @type {Object}
		 */
		presetDefinitions[`towStates${gpio}`] = {
			type: 'simple',
			name: `Two states ${gpio} button`,
			style: buttonStyle(`TS ${gpio}`),
			steps: [
				{
					down: [{ actionId: 'set_on', options: { gpio } }],
					up: [{ actionId: 'set_off', options: { gpio } }],
				},
			],
			feedbacks: [stateFeedback(gpio)],
		}
	}

	/**
	 * Preset structure: a single "GPIO" section listing every preset ID.
	 */
	const presetStructure = [
		{
			id: 'gpio',
			name: 'GPIO',
			definitions: Object.keys(presetDefinitions),
		},
	]

	this.setPresetDefinitions(presetStructure, presetDefinitions)
}
