/**
 * Defines the state variables of the 32 GPIOs and a variable holding all GPIO states at once.
 *
 * Required modules:
 * - ./protocol (GPIO count)
 */

import { GPIO_COUNT } from './protocol.js'

/**
 * Defines the GPIO state variables.
 * This function is called with the module instance as `this` at initialization.
 * API 2.x: the definitions form an object indexed by variable ID.
 * The values are set by `ModuleInstance#handleGpioStatus` (`01`…`32` = 0/1, `Full` = 32-bit integer).
 *
 * @returns {void}
 */
export default function () {
	const variableDefinitions = {}

	for (let gpio = 1; gpio <= GPIO_COUNT; gpio++) {
		const id = String(gpio).padStart(2, '0')
		/**
		 * State of one GPIO, indexed by its ID (`01`…`32`).
		 * @type {Object}
		 */
		variableDefinitions[id] = {
			name: `GPIO ${id} state (0 = off, 1 = on)`,
		}
	}

	/**
	 * All GPIO states as an unsigned 32-bit integer (Little Endian, GPIO 1 = 1).
	 * @type {Object}
	 */
	variableDefinitions.Full = {
		name: 'All GPIO states (32-bit integer, GPIO 1 = 1)',
	}

	this.setVariableDefinitions(variableDefinitions)
}
