/**
 * Defines the `gpio_state` boolean feedback: true while the GPIO chosen in its `gpio` option is on.
 * The style applied when true defaults to a green background; Companion provides the inversion.
 *
 * Required modules:
 * - ./protocol (bit reading)
 * - ./options (`gpio` option and its validation)
 */

import { readBit } from './protocol.js'
import { gpioOption, readGpioOption } from './options.js'

/**
 * Defines the GPIO state feedback.
 * This function is called with the module instance as `this` at initialization.
 * The callback reads the last GPIO state received from the robot (`this.gpioBytes`).
 *
 * @returns {void}
 */
export default function () {
	const feedbackDefinitions = {
		/**
		 * True when the GPIO is on in the last Status response.
		 * @type {Object}
		 */
		gpio_state: {
			type: 'boolean',
			name: 'GPIO state',
			description: 'True while the GPIO is on, from the last Status response of the robot.',
			defaultStyle: {
				bgcolor: this.colors.green,
			},
			showInvert: true,
			options: [gpioOption],
			callback: (feedback) => {
				const bit = readGpioOption(feedback.options, this.log.bind(this), 'GPIO state')
				if (bit === null) {
					return false
				}
				return readBit(this.gpioBytes, bit) === 1
			},
		},
	}

	this.setFeedbackDefinitions(feedbackDefinitions)
}
