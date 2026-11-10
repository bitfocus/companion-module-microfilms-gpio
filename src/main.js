/**
 * @fileoverview Defines the ModuleInstance class,
 * the Companion module instance that drives the GPIOs of a Microfilms robot through a NetworkManager.
 *
 * @module ModuleInstance
 * @requires @companion-module/base
 * @requires ./upgrades
 * @requires ./actions
 * @requires ./feedbacks
 * @requires ./presets
 * @requires ./variables
 * @requires ./network
 * @requires ./protocol
 *
 * @description
 * This module sets up and manages the UDP connection to the robot,
 * listens to its events and updates the connection status, the variables and the feedback accordingly.
 */

import { InstanceBase, Regex, InstanceStatus, combineRgb } from '@companion-module/base'

import { UpgradeScripts } from './upgrades.js'
import initActions from './actions.js'
import initFeedbacks from './feedbacks.js'
import initPresets from './presets.js'
import initVariables from './variables.js'
import NetworkManager from './network.js'
import { bytesToBinaryString, GPIO_COUNT, readBit } from './protocol.js'

/** Robot IP address used when the configuration field is empty. */
const DEFAULT_HOST = '192.168.10.10'

/** Robot UDP port used when the configuration field is empty. */
const DEFAULT_PORT = 7770

/**
 * Companion module instance.
 * @extends InstanceBase
 */
class ModuleInstance extends InstanceBase {
	/**
	 * Creates a ModuleInstance.
	 * @param {Object} internal - The internal object passed by Companion.
	 */
	constructor(internal) {
		super(internal)
	}

	/**
	 * Initializes the module with the given configuration.
	 * API 2.x signature: Companion also passes isFirstInit (first start of the instance)
	 * and secrets (instance secrets), both unused here.
	 * @param {Object} config - The module configuration.
	 * @returns {Promise<void>}
	 */
	// eslint-disable-next-line no-unused-vars
	async init(config, isFirstInit, secrets) {
		this.colors = {
			white: combineRgb(255, 255, 255),
			black: combineRgb(0, 0, 0),
			green: combineRgb(0, 200, 0),
		}

		this.gpioBytes = Buffer.alloc(4) // Last known GPIO state (read by the feedback)
		this.lastGpioBytes = null // Last state published to the variables and the feedback
		this.connectionStatus = null // Last status sent to Companion ({ status, message })
		this.impulseTimers = new Map() // Delayed DOWN frames of the pending pulses (timer → DOWN frame)

		initActions.call(this)
		initFeedbacks.call(this)
		initPresets.call(this)
		initVariables.call(this)

		this.createNetworkManager(config)

		this.log('info', 'Microfilms GPIO started!')
	}

	/**
	 * Replaces the current NetworkManager by a new one built on the given configuration
	 * (defaults applied to empty fields), and attaches the event handlers to it.
	 * The published state is forgotten so that the first status received is published again.
	 * @param {Object} config - The module configuration.
	 * @returns {void}
	 */
	createNetworkManager(config) {
		if (this.networkManager) {
			this.networkManager.removeAllListeners()
			this.networkManager.destroy()
		}

		this.config = {
			...config,
			host: config?.host || DEFAULT_HOST,
			port: Number(config?.port) || DEFAULT_PORT,
		}
		this.lastGpioBytes = null
		this.setConnectionStatus(InstanceStatus.Connecting)

		const networkManager = new NetworkManager(this.config, this.log.bind(this))

		networkManager.on('gpioStatus', (gpioBytes) => {
			this.handleGpioStatus(gpioBytes)
		})

		networkManager.on('connectionFailure', (reason) => {
			this.reportConnectionProblem(InstanceStatus.ConnectionFailure, reason)
		})

		networkManager.on('pingError', (error) => {
			this.reportConnectionProblem(InstanceStatus.ConnectionFailure, `Error sending ping: ${error.message}`)
		})

		networkManager.on('noResponse', (message) => {
			this.reportConnectionProblem(InstanceStatus.Disconnected, message)
		})

		networkManager.on('sendError', (error) => {
			this.log('error', `Error sending "Set GPIO" command: ${error.message}`)
		})

		this.networkManager = networkManager
	}

	/**
	 * Sends the connection status and its reason to Companion, only when one of them changes.
	 * @param {string} status - The new InstanceStatus.
	 * @param {string|null} [message] - The reason shown next to the status.
	 * @returns {boolean} True if the status or the reason changed.
	 */
	setConnectionStatus(status, message = null) {
		if (this.connectionStatus?.status === status && this.connectionStatus?.message === message) {
			return false
		}
		this.connectionStatus = { status, message }
		this.updateStatus(status, message)
		return true
	}

	/**
	 * Reports a connection problem: status with its reason, and one `error` log line per new reason.
	 * The same reason is logged again only after the connection went back to Ok.
	 * @param {string} status - InstanceStatus.ConnectionFailure or InstanceStatus.Disconnected.
	 * @param {string} message - The reason.
	 * @returns {void}
	 */
	reportConnectionProblem(status, message) {
		if (this.setConnectionStatus(status, message)) {
			this.log('error', message)
		}
	}

	/**
	 * Handles a "Status" response: Ok status, then grouped publication of the `01`…`32` and `Full`
	 * variables and recheck of the feedback when the GPIO state changed.
	 * @param {Buffer} gpioBytes - The 4 received GPIO bytes (Little Endian).
	 * @returns {void}
	 */
	handleGpioStatus(gpioBytes) {
		if (this.setConnectionStatus(InstanceStatus.Ok)) {
			this.log('info', `Connected to ${this.config.host}:${this.config.port}`)
		}
		if (this.lastGpioBytes?.equals(gpioBytes)) {
			return
		}

		this.gpioBytes = Buffer.from(gpioBytes)
		this.lastGpioBytes = this.gpioBytes

		const values = { Full: this.gpioBytes.readUInt32LE(0) }
		for (let gpio = 1; gpio <= GPIO_COUNT; gpio++) {
			values[String(gpio).padStart(2, '0')] = readBit(this.gpioBytes, gpio)
		}
		this.setVariableValues(values)
		this.checkFeedbacks('gpio_state')
		this.log('info', `GPIO status changed (GPIO=${bytesToBinaryString(this.gpioBytes)})`)
	}

	/**
	 * Sends right away the delayed DOWN frames of the pending pulses, so that no GPIO is left on
	 * on the robot, then waits for them to be sent before the socket is closed.
	 * @returns {Promise<void>}
	 */
	async flushImpulseTimers() {
		if (!this.impulseTimers?.size) {
			return
		}
		const pending = []
		for (const [timer, down] of this.impulseTimers) {
			clearTimeout(timer)
			if (this.networkManager) {
				pending.push(this.networkManager.sendGpioCommand(down))
			}
		}
		this.impulseTimers.clear()
		if (pending.length > 0) {
			this.log('info', `Sent ${pending.length} pending pulse DOWN command(s) before stopping`)
		}
		await Promise.all(pending)
	}

	/**
	 * Destroys the module.
	 * @returns {Promise<void>}
	 */
	async destroy() {
		this.log('debug', 'destroy')
		await this.flushImpulseTimers()
		if (this.networkManager) {
			this.networkManager.removeAllListeners()
			this.networkManager.destroy()
			delete this.networkManager
		}
	}

	/**
	 * Updates the module configuration and rebuilds the NetworkManager.
	 * @param {Object} config - The new module configuration.
	 * @returns {Promise<void>}
	 */
	async configUpdated(config) {
		await this.flushImpulseTimers()
		this.createNetworkManager(config)
		this.log('info', 'Config updated')
	}

	/**
	 * Returns the configuration fields of the web configuration.
	 * @returns {Array<Object>} The configuration fields.
	 */
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 8,
				regex: Regex.IP,
				default: DEFAULT_HOST,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 4,
				regex: Regex.PORT,
				default: String(DEFAULT_PORT),
			},
		]
	}
}

// API 2.x entrypoint: Companion imports this file and reads `default` and `UpgradeScripts`.
export default ModuleInstance
export { UpgradeScripts }
