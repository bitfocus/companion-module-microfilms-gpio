/**
 * Defines the actions that drive the GPIOs of the robot over UDP: pulse, set on and set off.
 * Each action targets the GPIO chosen in its `gpio` option (1–32).
 *
 * Required modules:
 * - ./protocol (pure helpers of the UDP/GPIO protocol)
 * - ./options (`gpio` option and its validation)
 */

import { buildImpulseFrames, buildInpFrame, bytesToBinaryString, encodeBit, IMPULSE_DELAY_MS } from './protocol.js'
import { gpioOption, readGpioOption } from './options.js'

/**
 * Defines the `pulse`, `set_on` and `set_off` actions.
 * This function is called with the module instance as `this` at initialization.
 * The delayed DOWN frames of the pulses are tracked in `this.impulseTimers` (timer → DOWN frame)
 * so that they can be sent right away when the module stops or its configuration changes.
 *
 * @returns {void}
 */
export default function () {
	const actionDefinitions = {
		/**
		 * Sets the GPIO on, then off after IMPULSE_DELAY_MS.
		 * @type {Object}
		 */
		pulse: {
			name: 'GPIO pulse',
			description: `Sets the GPIO on, then off after ${IMPULSE_DELAY_MS} ms. Other GPIOs are left unchanged.`,
			options: [gpioOption],
			callback: async (action) => {
				const bit = readGpioOption(action.options, this.log.bind(this), 'GPIO pulse')
				if (bit === null) {
					return
				}
				const { up, down } = buildImpulseFrames(bit)
				const sent = this.networkManager?.sendGpioCommand(up)
				const timer = setTimeout(() => {
					this.impulseTimers.delete(timer)
					this.networkManager?.sendGpioCommand(down)
				}, IMPULSE_DELAY_MS)
				this.impulseTimers.set(timer, down)
				this.log(
					'info',
					`"Set GPIO bit ${bit} UP" sent to ${this.config.host}:${this.config.port} (GPIO=${bytesToBinaryString(up.subarray(3, 7))})`,
				)
				await sent
			},
		},

		/**
		 * Sets the GPIO on and keeps it on.
		 * @type {Object}
		 */
		set_on: {
			name: 'GPIO set on',
			description: 'Sets the GPIO on and keeps it on. Other GPIOs are left unchanged.',
			options: [gpioOption],
			callback: async (action) => {
				const bit = readGpioOption(action.options, this.log.bind(this), 'GPIO set on')
				if (bit === null) {
					return
				}
				const gpioBytesUp = encodeBit(bit)
				const sent = this.networkManager?.sendGpioCommand(buildInpFrame(gpioBytesUp, encodeBit(bit)))
				this.log(
					'info',
					`"Set GPIO bit ${bit} UP" sent to ${this.config.host}:${this.config.port} (GPIO=${bytesToBinaryString(gpioBytesUp)})`,
				)
				await sent
			},
		},

		/**
		 * Sets the GPIO off.
		 * @type {Object}
		 */
		set_off: {
			name: 'GPIO set off',
			description: 'Sets the GPIO off. Other GPIOs are left unchanged.',
			options: [gpioOption],
			callback: async (action) => {
				const bit = readGpioOption(action.options, this.log.bind(this), 'GPIO set off')
				if (bit === null) {
					return
				}
				const gpioBytesDown = Buffer.alloc(4)
				const sent = this.networkManager?.sendGpioCommand(buildInpFrame(gpioBytesDown, encodeBit(bit)))
				this.log(
					'info',
					`"Set GPIO bit ${bit} DOWN" sent to ${this.config.host}:${this.config.port} (GPIO=${bytesToBinaryString(gpioBytesDown)})`,
				)
				await sent
			},
		},
	}

	this.setActionDefinitions(actionDefinitions)
}
