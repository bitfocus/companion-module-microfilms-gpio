/**
 * Configuration upgrade scripts of the module, run by Companion in order.
 * Once released, a script must never be removed or reordered.
 *
 * Required modules:
 * - @companion-module/base (colors)
 * - ./protocol (GPIO validation)
 */

import { combineRgb } from '@companion-module/base'
import { isValidBit } from './protocol.js'

/** Background color of the `gpio_state` feedback when the old `colorOn` option cannot be reused. */
const DEFAULT_ON_COLOR = combineRgb(0, 200, 0)

/** Per-GPIO action IDs up to 1.1.0 (`impulseN`, `upN`, `downN`) and their 1.2.0 replacement. */
const ACTION_ID_MAP = {
	impulse: 'pulse',
	up: 'set_on',
	down: 'set_off',
}

/** Per-GPIO action ID up to 1.1.0: prefix, then the GPIO number without leading zero. */
const LEGACY_ACTION_ID = /^(impulse|up|down)([1-9]\d?)$/

/** Per-GPIO advanced feedback ID up to 1.1.0. */
const LEGACY_FEEDBACK_ID = /^gpio_state_bit_([1-9]\d?)$/

/**
 * Reads the GPIO number at the end of a legacy ID.
 *
 * digits: digits captured at the end of the ID.
 * @returns {number|null} The GPIO number (1–32), or null if it is out of range.
 */
function legacyBit(digits) {
	const bit = Number(digits)
	return isValidBit(bit) ? bit : null
}

/**
 * Returns the background color to keep from the old `colorOn` option.
 *
 * colorOn: stored value of the option (`{ isExpression, value }`), possibly missing.
 * @returns {number} The fixed `colorOn` value, or green if it is missing or an expression.
 */
function onColor(colorOn) {
	if (colorOn && colorOn.isExpression === false && typeof colorOn.value === 'number') {
		return colorOn.value
	}
	return DEFAULT_ON_COLOR
}

/**
 * 1.2.0: replaces the 96 per-GPIO actions and the 32 per-GPIO advanced feedbacks
 * by the `pulse` / `set_on` / `set_off` actions and the `gpio_state` boolean feedback,
 * with the GPIO in their `gpio` option.
 * The feedback keeps the old `colorOn` color as its style; `colorOff` is dropped.
 * Any other action or feedback is left untouched.
 *
 * props: actions and feedbacks to upgrade (the upgrade context is unused).
 * @returns {Object} The upgraded actions and feedbacks.
 */
function upgradeToGpioOption(_context, props) {
	const updatedActions = []
	for (const action of props.actions) {
		const match = LEGACY_ACTION_ID.exec(action.actionId)
		const bit = match ? legacyBit(match[2]) : null
		if (bit === null) {
			continue
		}
		action.actionId = ACTION_ID_MAP[match[1]]
		action.options = { gpio: { isExpression: false, value: bit } }
		updatedActions.push(action)
	}

	const updatedFeedbacks = []
	for (const feedback of props.feedbacks) {
		const match = LEGACY_FEEDBACK_ID.exec(feedback.feedbackId)
		const bit = match ? legacyBit(match[1]) : null
		if (bit === null) {
			continue
		}
		const bgcolor = onColor(feedback.options?.colorOn)
		feedback.feedbackId = 'gpio_state'
		feedback.options = { gpio: { isExpression: false, value: bit } }
		feedback.style = { bgcolor }
		updatedFeedbacks.push(feedback)
	}

	return {
		updatedConfig: null,
		updatedActions,
		updatedFeedbacks,
	}
}

export const UpgradeScripts = [upgradeToGpioOption]
