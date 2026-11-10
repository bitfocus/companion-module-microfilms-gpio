/**
 * The `gpio` option shared by the actions and the feedback, and its validation.
 *
 * Required modules:
 * - ./protocol (GPIO count and validation)
 */

import { GPIO_COUNT, isValidBit } from './protocol.js'

/**
 * Definition of the `gpio` option: the GPIO number, an integer from 1 to 32.
 * @type {Object}
 */
export const gpioOption = {
	type: 'number',
	id: 'gpio',
	label: 'GPIO',
	min: 1,
	max: GPIO_COUNT,
	default: 1,
	asInteger: true,
}

/**
 * Reads the `gpio` option of an action or a feedback.
 * Logs a single `warn` line when the value is not an integer from 1 to 32
 * (for example 0, 33, 2.5 or a non-numeric expression result).
 *
 * options: resolved options of the action or feedback.
 * log: logging function of the module.
 * source: name of the action or feedback, used in the log line.
 * @returns {number|null} The GPIO number, or null if it is invalid.
 */
export function readGpioOption(options, log, source) {
	const gpio = options?.gpio
	if (isValidBit(gpio)) {
		return gpio
	}
	log(
		'warn',
		`${source}: invalid GPIO ${JSON.stringify(gpio) ?? 'undefined'}, expected an integer from 1 to ${GPIO_COUNT}`,
	)
	return null
}
