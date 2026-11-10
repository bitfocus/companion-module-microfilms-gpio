/**
 * Tests ModuleInstance without Companion: publication of the GPIO state (variables, feedback),
 * connection status and its log lines, rebuild of the NetworkManager by configUpdated (ephemeral ports)
 * and flush of the pending pulses.
 * The Companion context (#context) is replaced by spy methods.
 */

import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import dgram from 'node:dgram'
import { InstanceStatus } from '@companion-module/base'
import ModuleInstance from '../src/main.js'
import { buildOutFrame, IMPULSE_DELAY_MS, parseInpFrame } from '../src/protocol.js'

/**
 * Creates a module instance without going through the Companion constructor.
 */
function createModule() {
	const calls = { status: [], logs: [], variables: [], feedbacks: [], definitions: {} }
	const instance = Object.create(ModuleInstance.prototype)
	Object.assign(instance, {
		log(level, message) {
			calls.logs.push({ level, message })
		},
		updateStatus(status, message) {
			calls.status.push({ status, message })
		},
		setVariableValues(values) {
			calls.variables.push(values)
		},
		checkFeedbacks(...ids) {
			calls.feedbacks.push(ids)
		},
		setActionDefinitions(defs) {
			calls.definitions.actions = defs
		},
		setFeedbackDefinitions(defs) {
			calls.definitions.feedbacks = defs
		},
		setPresetDefinitions() {},
		setVariableDefinitions(defs) {
			calls.definitions.variables = defs
		},
	})
	return { instance, calls }
}

/**
 * Log lines of a given level.
 */
function logsOf(calls, level) {
	return calls.logs.filter((entry) => entry.level === level)
}

/**
 * Minimal simulator on an ephemeral port: answers OUT with a fixed state (unless silent),
 * records the INP frames received.
 */
function startServer(gpioBytes, { silent = false } = {}) {
	const server = dgram.createSocket('udp4')
	const received = []
	server.on('message', (msg, rinfo) => {
		const parsed = parseInpFrame(msg)
		if (parsed) {
			received.push({ ...parsed, at: Date.now() })
		}
		if (!silent) {
			server.send(buildOutFrame(gpioBytes), rinfo.port, rinfo.address)
		}
	})
	return new Promise((resolve, reject) => {
		server.once('error', reject)
		server.bind(0, '127.0.0.1', () => {
			const { port } = server.address()
			assert.notEqual(port, 7770)
			resolve({ server, port, received, close: () => new Promise((done) => server.close(done)) })
		})
	})
}

/**
 * Waits for a predicate to be true, or fails after timeoutMs.
 */
async function waitFor(predicate, timeoutMs, label) {
	const started = Date.now()
	while (!predicate()) {
		if (Date.now() - started > timeoutMs) {
			throw new Error(`Timeout: ${label}`)
		}
		await new Promise((resolve) => setTimeout(resolve, 10))
	}
}

const NOMINAL = Buffer.from([0x10, 0x00, 0x00, 0x80])

nodeTest.describe('ModuleInstance.handleGpioStatus', () => {
	nodeTest('nominal status: 05 and 32 on, Full = 2147483664, gpio_state rechecked, Ok status', () => {
		const { instance, calls } = createModule()
		instance.config = { host: '127.0.0.1', port: 7770 }
		instance.handleGpioStatus(NOMINAL)

		assert.deepEqual(calls.status, [{ status: InstanceStatus.Ok, message: null }])
		assert.equal(calls.variables.length, 1)
		const values = calls.variables[0]
		assert.equal(values.Full, 2147483664)
		for (let bit = 1; bit <= 32; bit++) {
			const id = String(bit).padStart(2, '0')
			assert.equal(values[id], bit === 5 || bit === 32 ? 1 : 0, `variable ${id}`)
		}
		assert.deepEqual(calls.feedbacks, [['gpio_state']])
	})

	nodeTest('unchanged status: nothing published on the 2nd response, Ok sent once', () => {
		const { instance, calls } = createModule()
		instance.config = { host: '127.0.0.1', port: 7770 }
		instance.handleGpioStatus(NOMINAL)
		instance.handleGpioStatus(Buffer.from(NOMINAL))

		assert.deepEqual(calls.status, [{ status: InstanceStatus.Ok, message: null }])
		assert.equal(calls.variables.length, 1)
		assert.equal(calls.feedbacks.length, 1)
	})

	nodeTest('copies the received state: mutating the source buffer does not skew the comparison', () => {
		const { instance, calls } = createModule()
		instance.config = { host: '127.0.0.1', port: 7770 }
		const source = Buffer.from(NOMINAL)
		instance.handleGpioStatus(source)
		source[0] = 0x00
		instance.handleGpioStatus(source)
		assert.equal(calls.variables.length, 2)
		assert.equal(calls.variables[1]['05'], 0)
	})

	nodeTest('written IDs are declared IDs, declared IDs = 01..32 + Full', async () => {
		const { instance, calls } = createModule()
		const { port, close } = await startServer(NOMINAL)
		try {
			await instance.init({ host: '127.0.0.1', port: String(port) }, true, {})
			const declared = Object.keys(calls.definitions.variables).sort()
			const expected = ['Full', ...Array.from({ length: 32 }, (_, i) => String(i + 1).padStart(2, '0'))].sort()
			assert.deepEqual(declared, expected)

			instance.handleGpioStatus(NOMINAL)
			instance.handleGpioStatus(Buffer.from([0xff, 0xff, 0xff, 0xff]))
			for (const values of calls.variables) {
				for (const id of Object.keys(values)) {
					assert.ok(declared.includes(id), `variable written but not declared: ${id}`)
				}
			}
			const feedbackIds = Object.keys(calls.definitions.feedbacks)
			for (const ids of calls.feedbacks) {
				for (const id of ids) {
					assert.ok(feedbackIds.includes(id), `feedback rechecked but not declared: ${id}`)
				}
			}
		} finally {
			await instance.destroy()
			await close()
		}
	})

	nodeTest('feedback: the callback follows the last published state, false on invalid GPIO', async () => {
		const { instance, calls } = createModule()
		const { port, close } = await startServer(Buffer.alloc(4))
		try {
			await instance.init({ host: '127.0.0.1', port: String(port) }, true, {})
			instance.handleGpioStatus(NOMINAL)
			const { callback } = calls.definitions.feedbacks.gpio_state
			assert.equal(callback({ options: { gpio: 5 } }), true)
			assert.equal(callback({ options: { gpio: 32 } }), true)
			assert.equal(callback({ options: { gpio: 6 } }), false)

			for (const gpio of [0, 33, 2.5, 'abc']) {
				const warnsBefore = logsOf(calls, 'warn').length
				assert.equal(callback({ options: { gpio } }), false, `gpio ${gpio}`)
				assert.equal(logsOf(calls, 'warn').length, warnsBefore + 1, `gpio ${gpio}: one warn`)
			}
		} finally {
			await instance.destroy()
			await close()
		}
	})
})

nodeTest.describe('ModuleInstance connection status and log lines', () => {
	nodeTest('ping send fails in a loop: ConnectionFailure with the reason, one log per distinct reason', async (t) => {
		const originalSend = dgram.Socket.prototype.send
		let failure = null
		t.mock.method(dgram.Socket.prototype, 'send', function (msg, port, host, callback) {
			if (failure && parseInpFrame(msg)) {
				process.nextTick(callback, failure)
				return
			}
			return originalSend.call(this, msg, port, host, callback)
		})
		const unreachable = Object.assign(new Error('send EHOSTUNREACH 10.0.0.1:7770'), { code: 'EHOSTUNREACH' })
		failure = unreachable

		const { instance, calls } = createModule()
		const server = await startServer(Buffer.alloc(4))
		try {
			await instance.init({ host: '127.0.0.1', port: String(server.port) }, true, {})
			await waitFor(() => calls.status.at(-1).status === InstanceStatus.ConnectionFailure, 1000, 'failure status')
			await new Promise((resolve) => setTimeout(resolve, 1200))

			const failures = calls.status.filter((s) => s.status === InstanceStatus.ConnectionFailure)
			assert.deepEqual(failures, [
				{ status: InstanceStatus.ConnectionFailure, message: 'Error sending ping: send EHOSTUNREACH 10.0.0.1:7770' },
			])
			assert.equal(logsOf(calls, 'error').length, 1)

			failure = new Error('send ENETUNREACH 10.0.0.1:7770')
			await waitFor(() => logsOf(calls, 'error').length === 2, 1000, 'log of the new reason')
			assert.equal(calls.status.at(-1).message, 'Error sending ping: send ENETUNREACH 10.0.0.1:7770')

			failure = null
			await waitFor(() => calls.status.at(-1).status === InstanceStatus.Ok, 1500, 'back to Ok')

			failure = unreachable
			await waitFor(() => logsOf(calls, 'error').length === 3, 1500, 'log again after Ok')
			assert.equal(calls.status.at(-1).status, InstanceStatus.ConnectionFailure)
		} finally {
			failure = null
			await instance.destroy()
			await server.close()
		}
	})

	nodeTest('robot off for a long time: Disconnected with the reason, logged once', { timeout: 5000 }, async () => {
		const { instance, calls } = createModule()
		const server = await startServer(Buffer.alloc(4), { silent: true })
		try {
			await instance.init({ host: '127.0.0.1', port: String(server.port) }, true, {})
			instance.networkManager.receptionWatcherInterval = 200
			const noResponses = []
			instance.networkManager.on('noResponse', (message) => noResponses.push(message))
			await waitFor(() => noResponses.length >= 3, 3000, '3 noResponse events')

			const disconnected = calls.status.filter((s) => s.status === InstanceStatus.Disconnected)
			assert.equal(disconnected.length, 1)
			assert.equal(disconnected[0].message, noResponses[0])
			assert.equal(logsOf(calls, 'error').length, 1)
		} finally {
			await instance.destroy()
			await server.close()
		}
	})

	nodeTest('UDP socket error: ConnectionFailure, no crash, logged once', async () => {
		const { instance, calls } = createModule()
		const server = await startServer(Buffer.alloc(4), { silent: true })
		try {
			await instance.init({ host: '127.0.0.1', port: String(server.port) }, true, {})
			assert.doesNotThrow(() => {
				instance.networkManager.udpClient.emit('error', new Error('boom'))
				instance.networkManager.udpClient.emit('error', new Error('boom'))
			})
			assert.deepEqual(calls.status.at(-1), {
				status: InstanceStatus.ConnectionFailure,
				message: 'UDP socket error: boom',
			})
			assert.deepEqual(logsOf(calls, 'error'), [{ level: 'error', message: 'UDP socket error: boom' }])
		} finally {
			await instance.destroy()
			await server.close()
		}
	})

	nodeTest('command send error: logged on each failed command', async () => {
		const { instance, calls } = createModule()
		const server = await startServer(Buffer.alloc(4))
		try {
			await instance.init({ host: '127.0.0.1', port: String(server.port) }, true, {})
			instance.networkManager.emit('sendError', new Error('send EPERM'))
			instance.networkManager.emit('sendError', new Error('send EPERM'))
			assert.equal(logsOf(calls, 'error').length, 2)
			assert.match(logsOf(calls, 'error')[0].message, /Error sending "Set GPIO" command: send EPERM/)
		} finally {
			await instance.destroy()
			await server.close()
		}
	})
})

nodeTest.describe('ModuleInstance config and life cycle', () => {
	nodeTest('config fields: defaults 192.168.10.10 / 7770', () => {
		const { instance } = createModule()
		const fields = instance.getConfigFields()
		assert.equal(fields.find((f) => f.id === 'host').default, '192.168.10.10')
		assert.equal(fields.find((f) => f.id === 'port').default, '7770')
	})

	nodeTest('empty port: falls back to 7770, port converted to a number', async () => {
		const { instance } = createModule()
		await instance.init({ host: '127.0.0.1', port: '' }, true, {})
		try {
			assert.equal(instance.config.port, 7770)
			assert.equal(instance.config.host, '127.0.0.1')
			await instance.configUpdated({ host: '127.0.0.1', port: '7771' })
			assert.equal(instance.config.port, 7771)
		} finally {
			await instance.destroy()
		}
	})

	nodeTest(
		'configUpdated to another port and back: status, variables and log lines follow',
		{ timeout: 5000 },
		async () => {
			const { instance, calls } = createModule()
			const a = await startServer(NOMINAL)
			const b = await startServer(Buffer.from([0x00, 0x00, 0x00, 0x00]))
			try {
				await instance.init({ host: '127.0.0.1', port: String(a.port) }, true, {})
				await waitFor(() => calls.variables.length === 1, 2000, 'initial status (A)')
				assert.equal(calls.variables[0]['05'], 1)
				assert.equal(calls.status.at(-1).status, InstanceStatus.Ok)

				const firstNetworkManager = instance.networkManager
				let statusCount = calls.status.length
				await instance.configUpdated({ host: '127.0.0.1', port: String(b.port) })
				assert.notEqual(instance.networkManager, firstNetworkManager)
				assert.equal(firstNetworkManager.listenerCount('gpioStatus'), 0)
				assert.equal(calls.status[statusCount].status, InstanceStatus.Connecting)
				await waitFor(() => calls.variables.length === 2, 2000, 'status after the port change (B)')
				assert.equal(calls.variables[1]['05'], 0)
				assert.equal(calls.variables[1].Full, 0)
				assert.equal(calls.status.at(-1).status, InstanceStatus.Ok)

				statusCount = calls.status.length
				await instance.configUpdated({ host: '127.0.0.1', port: String(a.port) })
				assert.equal(calls.status[statusCount].status, InstanceStatus.Connecting)
				await waitFor(() => calls.variables.length === 3, 2000, 'status after going back to port A')
				assert.equal(calls.variables[2]['05'], 1)
				assert.equal(calls.status.at(-1).status, InstanceStatus.Ok)

				const connected = calls.logs.filter((entry) => entry.message.startsWith('Connected to '))
				assert.equal(connected.length, 3)
				assert.equal(logsOf(calls, 'error').length, 0)
			} finally {
				await instance.destroy()
				await a.close()
				await b.close()
			}
		},
	)

	nodeTest('empty host: falls back to 192.168.10.10 at init and at configUpdated', async () => {
		const { instance } = createModule()
		const server = await startServer(Buffer.alloc(4))
		try {
			await instance.init({ host: '', port: String(server.port) }, true, {})
			assert.equal(instance.config.host, '192.168.10.10')
			await instance.configUpdated({ host: '', port: String(server.port) })
			assert.equal(instance.config.host, '192.168.10.10')
		} finally {
			await instance.destroy()
			await server.close()
		}
	})

	/**
	 * Starts a pulse on GPIO 1, calls stop() before 100 ms, then checks that the DOWN
	 * (GPIO 0, mask GPIO 1) arrives exactly once, well before the pulse delay.
	 */
	async function assertPulseDownFlushed(stop) {
		const { instance, calls } = createModule()
		const server = await startServer(Buffer.alloc(4))
		const isDown = (f) => f.maskBytes[0] === 0x01 && f.gpioBytes[0] === 0x00
		try {
			await instance.init({ host: '127.0.0.1', port: String(server.port) }, true, {})
			const pulsedAt = Date.now()
			await calls.definitions.actions.pulse.callback({ options: { gpio: 1 } })
			assert.equal(instance.impulseTimers.size, 1)
			await stop(instance, server.port)
			assert.equal(instance.impulseTimers.size, 0)
			await waitFor(() => server.received.some(isDown), 50, 'DOWN sent on stop')
			const [down] = server.received.filter(isDown)
			assert.ok(down.at - pulsedAt < IMPULSE_DELAY_MS / 2, `late DOWN (${down.at - pulsedAt} ms)`)
			await new Promise((resolve) => setTimeout(resolve, IMPULSE_DELAY_MS + 50))
			assert.equal(server.received.filter(isDown).length, 1)
		} finally {
			await instance.destroy()
			await server.close()
		}
	}

	nodeTest('pulse then destroy < 100 ms: DOWN sent once, right away', { timeout: 3000 }, async () => {
		await assertPulseDownFlushed((instance) => instance.destroy())
	})

	nodeTest('pulse then configUpdated < 100 ms: DOWN sent once to the old target', { timeout: 3000 }, async () => {
		const { instance, calls } = createModule()
		const a = await startServer(Buffer.alloc(4))
		const b = await startServer(Buffer.alloc(4))
		const isDown = (f) => f.maskBytes[0] === 0x01 && f.gpioBytes[0] === 0x00
		try {
			await instance.init({ host: '127.0.0.1', port: String(a.port) }, true, {})
			const pulsedAt = Date.now()
			await calls.definitions.actions.pulse.callback({ options: { gpio: 1 } })
			await instance.configUpdated({ host: '127.0.0.1', port: String(b.port) })
			assert.equal(instance.impulseTimers.size, 0)
			await waitFor(() => a.received.some(isDown), 50, 'DOWN sent to the old target')
			const [down] = a.received.filter(isDown)
			assert.ok(down.at - pulsedAt < IMPULSE_DELAY_MS / 2, `late DOWN (${down.at - pulsedAt} ms)`)
			await new Promise((resolve) => setTimeout(resolve, IMPULSE_DELAY_MS + 50))
			assert.equal(a.received.filter(isDown).length, 1)
			assert.equal(b.received.filter(isDown).length, 0)
		} finally {
			await instance.destroy()
			await a.close()
			await b.close()
		}
	})
})
