/**
 * Teste ModuleInstance sans Companion : publication du statut GPIO (variables, feedbacks),
 * reconstruction du NetworkManager par configUpdated (ports éphémères) et annulation des impulsions.
 * Le contexte Companion (#context) est remplacé par des méthodes espionnes.
 */

import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import dgram from 'node:dgram'
import { InstanceStatus } from '@companion-module/base'
import ModuleInstance from '../src/main.js'
import { buildOutFrame, IMPULSE_DELAY_MS, parseInpFrame } from '../src/protocol.js'

/**
 * Crée une instance du module sans passer par le constructeur Companion.
 */
function createModule() {
	const calls = { status: [], variables: [], feedbacks: [], definitions: {} }
	const instance = Object.create(ModuleInstance.prototype)
	Object.assign(instance, {
		log() {},
		updateStatus(status) {
			calls.status.push(status)
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
 * Simulateur minimal sur port éphémère : répond OUT avec un état fixe, enregistre les INP reçus.
 */
function startServer(gpioBytes) {
	const server = dgram.createSocket('udp4')
	const received = []
	server.on('message', (msg, rinfo) => {
		const parsed = parseInpFrame(msg)
		if (parsed) {
			received.push({ ...parsed, at: Date.now() })
		}
		server.send(buildOutFrame(gpioBytes), rinfo.port, rinfo.address)
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
 * Attend qu'un prédicat soit vrai, ou échoue après timeoutMs.
 */
async function waitFor(predicate, timeoutMs, label) {
	const started = Date.now()
	while (!predicate()) {
		if (Date.now() - started > timeoutMs) {
			throw new Error(`Timeout : ${label}`)
		}
		await new Promise((resolve) => setTimeout(resolve, 10))
	}
}

const NOMINAL = Buffer.from([0x10, 0x00, 0x00, 0x80])

nodeTest.describe('ModuleInstance.handleGpioStatus', () => {
	nodeTest('statut nominal : 05 et 32 à 1, Full = 2147483664, feedbacks 1..32, statut Ok', () => {
		const { instance, calls } = createModule()
		instance.handleGpioStatus(NOMINAL)

		assert.deepEqual(calls.status, [InstanceStatus.Ok])
		assert.equal(calls.variables.length, 1)
		const values = calls.variables[0]
		assert.equal(values.Full, 2147483664)
		for (let bit = 1; bit <= 32; bit++) {
			const id = String(bit).padStart(2, '0')
			assert.equal(values[id], bit === 5 || bit === 32 ? 1 : 0, `variable ${id}`)
		}
		assert.equal(calls.feedbacks.length, 1)
		const expectedFeedbacks = Array.from({ length: 32 }, (_, i) => `gpio_state_bit_${i + 1}`)
		assert.deepEqual(calls.feedbacks[0], expectedFeedbacks)
	})

	nodeTest('statut inchangé : aucune publication à la 2e réception, statut Ok quand même', () => {
		const { instance, calls } = createModule()
		instance.handleGpioStatus(NOMINAL)
		instance.handleGpioStatus(Buffer.from(NOMINAL))

		assert.deepEqual(calls.status, [InstanceStatus.Ok, InstanceStatus.Ok])
		assert.equal(calls.variables.length, 1)
		assert.equal(calls.feedbacks.length, 1)
	})

	nodeTest('copie l’état reçu : une mutation du buffer source ne fausse pas la comparaison', () => {
		const { instance, calls } = createModule()
		const source = Buffer.from(NOMINAL)
		instance.handleGpioStatus(source)
		source[0] = 0x00
		instance.handleGpioStatus(source)
		assert.equal(calls.variables.length, 2)
		assert.equal(calls.variables[1]['05'], 0)
	})

	nodeTest('H2 : IDs écrits ⊂ IDs déclarés, IDs déclarés = 01..32 + Full', async () => {
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
					assert.ok(declared.includes(id), `variable écrite non déclarée : ${id}`)
				}
			}
			const feedbackIds = Object.keys(calls.definitions.feedbacks)
			for (const ids of calls.feedbacks) {
				for (const id of ids) {
					assert.ok(feedbackIds.includes(id), `feedback rechecké non déclaré : ${id}`)
				}
			}
		} finally {
			await instance.destroy()
			await close()
		}
	})

	nodeTest('feedback : le callback suit le dernier état publié', async () => {
		const { instance, calls } = createModule()
		const { port, close } = await startServer(Buffer.alloc(4))
		try {
			await instance.init({ host: '127.0.0.1', port: String(port) }, true, {})
			instance.handleGpioStatus(NOMINAL)
			const options = { colorOff: 1, colorOn: 2 }
			assert.deepEqual(calls.definitions.feedbacks.gpio_state_bit_5.callback({ options }), { bgcolor: 2 })
			assert.deepEqual(calls.definitions.feedbacks.gpio_state_bit_6.callback({ options }), { bgcolor: 1 })
		} finally {
			await instance.destroy()
			await close()
		}
	})
})

nodeTest.describe('ModuleInstance config et cycle de vie', () => {
	nodeTest('champs de config : défauts 192.168.10.10 / 7770', () => {
		const { instance } = createModule()
		const fields = instance.getConfigFields()
		assert.equal(fields.find((f) => f.id === 'host').default, '192.168.10.10')
		assert.equal(fields.find((f) => f.id === 'port').default, '7770')
	})

	nodeTest('port vide : repli sur 7770, port converti en nombre', async () => {
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
		'H1 : configUpdated vers un autre port puis retour, statut et variables suivent',
		{ timeout: 5000 },
		async () => {
			const { instance, calls } = createModule()
			const a = await startServer(NOMINAL)
			const b = await startServer(Buffer.from([0x00, 0x00, 0x00, 0x00]))
			try {
				await instance.init({ host: '127.0.0.1', port: String(a.port) }, true, {})
				await waitFor(() => calls.variables.length === 1, 2000, 'statut initial (A)')
				assert.equal(calls.variables[0]['05'], 1)
				assert.equal(calls.status.at(-1), InstanceStatus.Ok)

				const firstNetworkManager = instance.networkManager
				let statusCount = calls.status.length
				await instance.configUpdated({ host: '127.0.0.1', port: String(b.port) })
				assert.notEqual(instance.networkManager, firstNetworkManager)
				assert.equal(firstNetworkManager.listenerCount('gpioStatus'), 0)
				assert.equal(calls.status[statusCount], InstanceStatus.Connecting)
				await waitFor(() => calls.variables.length === 2, 2000, 'statut après changement de port (B)')
				assert.equal(calls.variables[1]['05'], 0)
				assert.equal(calls.variables[1].Full, 0)
				assert.equal(calls.status.at(-1), InstanceStatus.Ok)

				statusCount = calls.status.length
				await instance.configUpdated({ host: '127.0.0.1', port: String(a.port) })
				assert.equal(calls.status[statusCount], InstanceStatus.Connecting)
				await waitFor(() => calls.variables.length === 3, 2000, 'statut après retour au port A')
				assert.equal(calls.variables[2]['05'], 1)
				assert.equal(calls.status.at(-1), InstanceStatus.Ok)
			} finally {
				await instance.destroy()
				await a.close()
				await b.close()
			}
		},
	)

	nodeTest('hôte vide : repli sur 192.168.10.10 à init et à configUpdated', async () => {
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
	 * Lance une impulsion bit 1, appelle stop() avant les 100 ms, puis vérifie que le DOWN
	 * (GPIO 0, masque bit 1) arrive une seule fois, bien avant le délai d'impulsion.
	 */
	async function assertPulseDownFlushed(stop) {
		const { instance, calls } = createModule()
		const server = await startServer(Buffer.alloc(4))
		const isDown = (f) => f.maskBytes[0] === 0x01 && f.gpioBytes[0] === 0x00
		try {
			await instance.init({ host: '127.0.0.1', port: String(server.port) }, true, {})
			const pulsedAt = Date.now()
			await calls.definitions.actions.impulse1.callback()
			assert.equal(instance.impulseTimers.size, 1)
			await stop(instance, server.port)
			assert.equal(instance.impulseTimers.size, 0)
			await waitFor(() => server.received.some(isDown), 50, 'DOWN envoyé à l’arrêt')
			const [down] = server.received.filter(isDown)
			assert.ok(down.at - pulsedAt < IMPULSE_DELAY_MS / 2, `DOWN tardif (${down.at - pulsedAt} ms)`)
			await new Promise((resolve) => setTimeout(resolve, IMPULSE_DELAY_MS + 50))
			assert.equal(server.received.filter(isDown).length, 1)
		} finally {
			await instance.destroy()
			await server.close()
		}
	}

	nodeTest('Impulse puis destroy < 100 ms : DOWN envoyé une fois, sans attendre', { timeout: 3000 }, async () => {
		await assertPulseDownFlushed((instance) => instance.destroy())
	})

	nodeTest(
		'Impulse puis configUpdated < 100 ms : DOWN envoyé une fois à l’ancienne cible',
		{ timeout: 3000 },
		async () => {
			const { instance, calls } = createModule()
			const a = await startServer(Buffer.alloc(4))
			const b = await startServer(Buffer.alloc(4))
			const isDown = (f) => f.maskBytes[0] === 0x01 && f.gpioBytes[0] === 0x00
			try {
				await instance.init({ host: '127.0.0.1', port: String(a.port) }, true, {})
				const pulsedAt = Date.now()
				await calls.definitions.actions.impulse1.callback()
				await instance.configUpdated({ host: '127.0.0.1', port: String(b.port) })
				assert.equal(instance.impulseTimers.size, 0)
				await waitFor(() => a.received.some(isDown), 50, 'DOWN envoyé à l’ancienne cible')
				const [down] = a.received.filter(isDown)
				assert.ok(down.at - pulsedAt < IMPULSE_DELAY_MS / 2, `DOWN tardif (${down.at - pulsedAt} ms)`)
				await new Promise((resolve) => setTimeout(resolve, IMPULSE_DELAY_MS + 50))
				assert.equal(a.received.filter(isDown).length, 1)
				assert.equal(b.received.filter(isDown).length, 0)
			} finally {
				await instance.destroy()
				await a.close()
				await b.close()
			}
		},
	)
})
