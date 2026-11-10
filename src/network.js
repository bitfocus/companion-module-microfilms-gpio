/**
 * @fileoverview Defines the NetworkManager class,
 * which handles the UDP connection used to send GPIO commands and receive the GPIO state.
 *
 * @module NetworkManager
 * @requires dgram
 * @requires events
 * @requires ./protocol
 *
 * @description
 * This module sends GPIO commands and pings over UDP and listens to the "Status" responses of the robot.
 * It reports the responses and the errors as events; logging and connection status belong to the module instance.
 */

import dgram from 'node:dgram'
import EventEmitter from 'node:events'
import {
	buildPingFrame,
	bytesToBinaryString,
	parseOutFrame,
	PING_INTERVAL_MS,
	RECEPTION_TIMEOUT_MS,
} from './protocol.js'

/**
 * Network manager of the GPIO commands.
 * @extends EventEmitter
 */
class NetworkManager extends EventEmitter {
	/**
	 * Creates a NetworkManager and starts the ping.
	 * @param {Object} config - The network configuration (`host`, `port`).
	 * @param {Function} log - The logging function.
	 */
	constructor(config, log) {
		super()
		this.config = config
		this.log = log
		this.pingInterval = PING_INTERVAL_MS
		this.receptionWatcherInterval = RECEPTION_TIMEOUT_MS
		this.waitingForStatusResponse = false
		this.pingMessage = buildPingFrame()
		this.sendGpioPingId = null
		this.receptionWatcherId = null
		this.configureReception()
		this.sendGpioPing()
	}

	/**
	 * Creates the UDP socket and listens to its messages and errors.
	 * @fires NetworkManager#gpioStatus
	 * @fires NetworkManager#connectionFailure
	 * @returns {void}
	 */
	configureReception() {
		this.udpClient = dgram.createSocket('udp4')

		this.udpClient.on('error', (err) => {
			this.emit('connectionFailure', `UDP socket error: ${err.message}`)
		})

		this.udpClient.on('message', (msg, rinfo) => {
			const gpioBytes = parseOutFrame(msg)
			clearTimeout(this.receptionWatcherId)
			this.waitingForStatusResponse = false
			if (!gpioBytes) {
				this.emit('connectionFailure', 'Incorrect header or length in "Status" response')
				return
			}
			this.emit('gpioStatus', gpioBytes)
			this.log(
				'debug',
				`"Status" response from ${rinfo.address}:${rinfo.port} (GPIO=${bytesToBinaryString(gpioBytes)})`,
			)
		})
	}

	/**
	 * Watches for the server response to the last ping.
	 * @fires NetworkManager#noResponse
	 * @returns {void}
	 */
	receptionWatcher() {
		this.receptionWatcherId = setTimeout(() => {
			if (this.waitingForStatusResponse) {
				this.waitingForStatusResponse = false
				this.emit('noResponse', `No response from server after '${this.receptionWatcherInterval / 1000}' seconds`)
			}
		}, this.receptionWatcherInterval)
	}

	/**
	 * Sends a GPIO ping to the server, then schedules the next one after the ping interval.
	 * @fires NetworkManager#pingError
	 * @returns {void}
	 */
	sendGpioPing() {
		if (!this.udpClient) {
			return
		}
		if (!this.waitingForStatusResponse) {
			this.udpClient.send(this.pingMessage, this.config.port, this.config.host, (err) => {
				if (!this.udpClient) {
					return
				}
				if (err) {
					this.emit('pingError', err)
				} else {
					this.waitingForStatusResponse = true
					this.receptionWatcher()
					this.log('debug', 'Command "Set GPIO PING" sent successfully.')
				}
			})
		}
		this.sendGpioPingId = setTimeout(() => {
			this.sendGpioPing()
		}, this.pingInterval)
	}

	/**
	 * Sends an INP frame to the server. Does nothing once the manager is destroyed.
	 * @param {Buffer} frame - The complete INP frame to send.
	 * @fires NetworkManager#sendError
	 * @returns {Promise<void>} Resolved when the send is over, on success as on error.
	 */
	sendGpioCommand(frame) {
		if (!this.udpClient) {
			this.log('debug', 'NetworkManager destroyed: "Set GPIO" command dropped')
			return Promise.resolve()
		}
		return new Promise((resolve) => {
			this.udpClient.send(frame, this.config.port, this.config.host, (err) => {
				if (err) {
					this.emit('sendError', err)
				} else {
					this.log('debug', 'Command "Set GPIO Command" sent successfully.')
				}
				resolve()
			})
		})
	}

	/**
	 * Destroys the network manager: stops the ping and the watcher, then closes the socket.
	 * @returns {void}
	 */
	destroy() {
		if (this.sendGpioPingId) clearTimeout(this.sendGpioPingId)
		if (this.receptionWatcherId) clearTimeout(this.receptionWatcherId)
		if (this.udpClient) {
			this.udpClient.close()
			delete this.udpClient
		}
	}
}

/**
 * A valid "Status" response was received.
 * @event NetworkManager#gpioStatus
 * @type {Buffer} The 4 GPIO bytes (Little Endian).
 */

/**
 * An invalid "Status" response was received, or the UDP socket raised an error.
 * @event NetworkManager#connectionFailure
 * @type {string} The reason.
 */

/**
 * No "Status" response arrived within the reception timeout after a ping.
 * @event NetworkManager#noResponse
 * @type {string} The reason.
 */

/**
 * A ping could not be sent (for example `EHOSTUNREACH`).
 * @event NetworkManager#pingError
 * @type {Error} The send error.
 */

/**
 * A GPIO command could not be sent.
 * @event NetworkManager#sendError
 * @type {Error} The send error.
 */

export default NetworkManager
