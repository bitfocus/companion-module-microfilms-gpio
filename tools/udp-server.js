/**
 * UDP simulator of a Microfilms robot with 32 GPIOs.
 * It receives the commands, updates the GPIO state and sends "Status" responses back.
 *
 * Required modules:
 * - dgram (Node.js built-in UDP module)
 * - ../src/protocol (pure helpers of the UDP/GPIO protocol)
 */

import dgram from 'node:dgram'
import { applyMask, parseInpFrame, buildOutFrame } from '../src/protocol.js'

/**
 * UDP socket of the server.
 */
const server = dgram.createSocket('udp4')

/**
 * Current state of the 32 GPIOs (4 bytes, all off at start).
 */
const gpio = Buffer.alloc(4)

/**
 * Applies the mask and updates the GPIO state.
 *
 * For each bit:
 * - if the mask bit is 1, the new value (gpioBytes) is applied;
 * - if the mask bit is 0, the current GPIO state is kept.
 * This changes only the selected GPIOs and leaves the others untouched.
 *
 * @param {Buffer} gpioBytes - The new GPIO values.
 * @param {Buffer} maskBytes - The mask to apply.
 */
function applyMaskAndUpdateGPIO(gpioBytes, maskBytes) {
	const next = applyMask(gpio, gpioBytes, maskBytes)
	next.copy(gpio)
}

/**
 * Sends a "Status" message to the client.
 *
 * The message is the 'OUT' header followed by the current GPIO state.
 *
 * @param {Object} rinfo - The client information (address and port).
 */
function sendStatus(rinfo) {
	const statusMessage = buildOutFrame(gpio)
	server.send(statusMessage, rinfo.port, rinfo.address, (err) => {
		if (err) {
			console.error('Error while sending the message:', err)
		} else {
			console.log(`"Status" message sent to ${rinfo.address}:${rinfo.port}`)
		}
	})
}

/**
 * Handles an incoming message: checks it, updates the GPIO state and sends a "Status" response.
 *
 * @param {Buffer} msg - The received message.
 * @param {Object} rinfo - The sender information (address and port).
 */
server.on('message', (msg, rinfo) => {
	console.log(`Message received from ${rinfo.address}:${rinfo.port}`)

	const parsed = parseInpFrame(msg)
	if (!parsed) {
		console.error('Invalid command, incorrect header')
		return
	}

	applyMaskAndUpdateGPIO(parsed.gpioBytes, parsed.maskBytes)

	sendStatus(rinfo)
})

/**
 * Handles a server error: prints it and closes the server.
 *
 * @param {Error} err - The error.
 */
server.on('error', (err) => {
	console.error(`Server error: ${err.stack}`)
	server.close()
})

/**
 * Starts the UDP server on the simulator port.
 */
const PORT = 7770
server.bind(PORT, () => {
	console.log(`UDP server listening on port ${PORT}`)
})
