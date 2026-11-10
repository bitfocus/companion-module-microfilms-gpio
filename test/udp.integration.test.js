/**
 * Local UDP integration tests (ephemeral port) of the NetworkManager.
 * Never imports tools/udp-server.js (binds 7770 on import).
 */

import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import dgram from 'node:dgram'
import NetworkManager from '../src/network.js'
import {
	applyMask,
	parseInpFrame,
	buildOutFrame,
	buildInpFrame,
	encodeBit,
	PING_INTERVAL_MS,
	RECEPTION_TIMEOUT_MS,
} from '../src/protocol.js'

/**
 * Waits for a single event, or fails after timeoutMs.
 */
function onceEvent(emitter, eventName, timeoutMs) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			emitter.off(eventName, onEvent)
			reject(new Error(`Timeout waiting for ${eventName}`))
		}, timeoutMs)
		function onEvent(...args) {
			clearTimeout(timer)
			resolve(args)
		}
		emitter.once(eventName, onEvent)
	})
}

/**
 * Opens a UDP socket on an ephemeral port (never 7770).
 */
function bindEphemeral() {
	const server = dgram.createSocket('udp4')
	return new Promise((resolve, reject) => {
		server.once('error', reject)
		server.bind(0, '127.0.0.1', () => {
			const { port } = server.address()
			if (port === 7770) {
				server.close()
				reject(new Error('The ephemeral port must not be 7770'))
				return
			}
			resolve({ server, port })
		})
	})
}

/**
 * Logging function that records the log lines.
 */
function recordingLog() {
	const lines = []
	const log = (level, message) => lines.push({ level, message })
	return { lines, log }
}

nodeTest.describe('NetworkManager over local UDP', () => {
	nodeTest('valid OUT → gpioStatus event', async () => {
		const { server, port } = await bindEphemeral()
		const expected = Buffer.from([0x11, 0x22, 0x33, 0x44])
		server.on('message', (msg, rinfo) => {
			server.send(buildOutFrame(expected), rinfo.port, rinfo.address)
		})

		const nm = new NetworkManager({ host: '127.0.0.1', port }, () => {})

		try {
			const [gpioBytes] = await onceEvent(nm, 'gpioStatus', 1000)
			assert.deepEqual([...gpioBytes], [...expected])
		} finally {
			nm.destroy()
			await new Promise((resolve) => server.close(resolve))
		}
	})

	nodeTest('invalid OUT → connectionFailure event, no error log of its own', async () => {
		const { server, port } = await bindEphemeral()
		server.on('message', (msg, rinfo) => {
			server.send(Buffer.from('XXX\x00\x00\x00\x00'), rinfo.port, rinfo.address)
		})

		const { lines, log } = recordingLog()
		const nm = new NetworkManager({ host: '127.0.0.1', port }, log)

		try {
			const [reason] = await onceEvent(nm, 'connectionFailure', 1000)
			assert.equal(reason, 'Incorrect header or length in "Status" response')
			assert.equal(lines.filter((line) => line.level === 'error').length, 0)
		} finally {
			nm.destroy()
			await new Promise((resolve) => server.close(resolve))
		}
	})

	nodeTest('short OUT → connectionFailure event, no throw', async () => {
		const { server, port } = await bindEphemeral()
		server.on('message', (msg, rinfo) => {
			server.send(Buffer.from([0x4f, 0x55, 0x54, 0x01, 0x02, 0x03]), rinfo.port, rinfo.address)
		})

		const nm = new NetworkManager({ host: '127.0.0.1', port }, () => {})

		try {
			const [reason] = await onceEvent(nm, 'connectionFailure', 1000)
			assert.equal(reason, 'Incorrect header or length in "Status" response')
		} finally {
			nm.destroy()
			await new Promise((resolve) => server.close(resolve))
		}
	})

	nodeTest('UDP socket error → connectionFailure event, no throw', async () => {
		const { server, port } = await bindEphemeral()
		const nm = new NetworkManager({ host: '127.0.0.1', port }, () => {})
		try {
			const failure = onceEvent(nm, 'connectionFailure', 1000)
			assert.doesNotThrow(() => nm.udpClient.emit('error', new Error('boom')))
			const [reason] = await failure
			assert.equal(reason, 'UDP socket error: boom')
		} finally {
			nm.destroy()
			await new Promise((resolve) => server.close(resolve))
		}
	})

	nodeTest('ping send fails → pingError on every ping, never sendError', { timeout: 3000 }, async (t) => {
		const { server, port } = await bindEphemeral()
		const unreachable = Object.assign(new Error('send EHOSTUNREACH'), { code: 'EHOSTUNREACH' })
		t.mock.method(dgram.Socket.prototype, 'send', (msg, targetPort, host, callback) => {
			process.nextTick(callback, unreachable)
		})
		const { lines, log } = recordingLog()
		const nm = new NetworkManager({ host: '127.0.0.1', port }, log)
		const pingErrors = []
		const sendErrors = []
		nm.on('pingError', (err) => pingErrors.push(err))
		nm.on('sendError', (err) => sendErrors.push(err))
		try {
			await new Promise((resolve) => setTimeout(resolve, PING_INTERVAL_MS * 2 + 200))
			assert.ok(pingErrors.length >= 2, `${pingErrors.length} pingError event(s)`)
			assert.ok(pingErrors.every((err) => err === unreachable))
			assert.equal(sendErrors.length, 0)
			assert.equal(nm.waitingForStatusResponse, false)
			assert.equal(lines.filter((line) => line.level === 'error').length, 0)
		} finally {
			nm.destroy()
			t.mock.restoreAll()
			await new Promise((resolve) => server.close(resolve))
		}
	})

	nodeTest('sendGpioCommand after destroy: ignored without exception', async () => {
		const { server, port } = await bindEphemeral()
		const nm = new NetworkManager({ host: '127.0.0.1', port }, () => {})
		nm.destroy()
		try {
			assert.doesNotThrow(() => nm.sendGpioCommand(buildInpFrame(encodeBit(1), encodeBit(1))))
			assert.doesNotThrow(() => nm.sendGpioPing())
		} finally {
			await new Promise((resolve) => server.close(resolve))
		}
	})

	nodeTest('sendGpioCommand: promise resolved and sendError emitted when the send fails', async () => {
		const { server, port } = await bindEphemeral()
		const nm = new NetworkManager({ host: '127.0.0.1', port }, () => {})
		try {
			const failure = new Error('send failed')
			nm.udpClient.send = (msg, targetPort, host, callback) => callback(failure)
			const sendError = onceEvent(nm, 'sendError', 1000)
			await nm.sendGpioCommand(buildInpFrame(encodeBit(1), encodeBit(1)))
			const [err] = await sendError
			assert.equal(err, failure)
		} finally {
			nm.destroy()
			await new Promise((resolve) => server.close(resolve))
		}
	})

	nodeTest('silence after a ping → noResponse after ~3 s', { timeout: 10000 }, async () => {
		const { server, port } = await bindEphemeral()
		const nm = new NetworkManager({ host: '127.0.0.1', port }, () => {})

		try {
			const started = Date.now()
			const [message] = await onceEvent(nm, 'noResponse', RECEPTION_TIMEOUT_MS + 1000)
			const elapsed = Date.now() - started
			assert.match(message, /No response from server after '3' seconds/)
			assert.ok(elapsed >= RECEPTION_TIMEOUT_MS - 100, `timeout too early (${elapsed} ms)`)
		} finally {
			nm.destroy()
			await new Promise((resolve) => server.close(resolve))
		}
	})

	nodeTest('ping every ~500 ms', { timeout: 3000 }, async () => {
		const { server, port } = await bindEphemeral()
		const receivedAt = []
		server.on('message', (msg, rinfo) => {
			receivedAt.push(Date.now())
			server.send(buildOutFrame(Buffer.alloc(4)), rinfo.port, rinfo.address)
		})

		const nm = new NetworkManager({ host: '127.0.0.1', port }, () => {})

		try {
			assert.equal(nm.pingInterval, PING_INTERVAL_MS)
			await new Promise((resolve, reject) => {
				const check = setInterval(() => {
					if (receivedAt.length >= 2) {
						clearInterval(check)
						resolve()
					}
				}, 20)
				setTimeout(() => {
					clearInterval(check)
					reject(new Error('fewer than 2 datagrams received'))
				}, 2000)
			})
			const gap = receivedAt[1] - receivedAt[0]
			assert.ok(Math.abs(gap - PING_INTERVAL_MS) <= 150, `ping gap ${gap} ms (expected ~${PING_INTERVAL_MS})`)
		} finally {
			nm.destroy()
			await new Promise((resolve) => server.close(resolve))
		}
	})

	nodeTest('selective mask: GPIO 32 kept, GPIO 1 added', async () => {
		const { server, port } = await bindEphemeral()
		let state = encodeBit(32)

		server.on('message', (msg, rinfo) => {
			const parsed = parseInpFrame(msg)
			if (!parsed) {
				return
			}
			state = applyMask(state, parsed.gpioBytes, parsed.maskBytes)
			server.send(buildOutFrame(state), rinfo.port, rinfo.address)
		})

		const nm = new NetworkManager({ host: '127.0.0.1', port }, () => {})

		try {
			await onceEvent(nm, 'gpioStatus', 1000)
			nm.sendGpioCommand(buildInpFrame(encodeBit(1), encodeBit(1)))
			const [gpioBytes] = await onceEvent(nm, 'gpioStatus', 1000)
			assert.deepEqual([...gpioBytes], [0x01, 0x00, 0x00, 0x80])
		} finally {
			nm.destroy()
			await new Promise((resolve) => server.close(resolve))
		}
	})
})
