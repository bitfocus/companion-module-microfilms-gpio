/**
 * Runs the pulse / set on / set off callbacks through a fake sendGpioCommand.
 */

import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import initActions from '../src/actions.js'
import { IMPULSE_DELAY_MS, INP_HEADER } from '../src/protocol.js'

/**
 * Binds actions.js to a minimal Companion context.
 */
function bindActions() {
	const sent = []
	const logs = []
	const defs = {}
	const ctx = {
		config: { host: '127.0.0.1', port: 1 },
		networkManager: {
			sendGpioCommand(frame) {
				sent.push({ frame: Buffer.from(frame), at: Date.now() })
				return Promise.resolve()
			},
		},
		log(level, message) {
			logs.push({ level, message })
		},
		impulseTimers: new Map(),
		setActionDefinitions(definitions) {
			Object.assign(defs, definitions)
		},
	}
	initActions.call(ctx)
	return { sent, logs, defs, ctx }
}

/**
 * Checks a 13-byte INP frame (GPIO, mask, reserved bytes).
 */
function assertInpFrame(frame, gpio, mask) {
	assert.equal(frame.length, 13)
	assert.equal(frame.subarray(0, 3).toString(), INP_HEADER)
	assert.deepEqual([...frame.subarray(3, 7)], gpio)
	assert.deepEqual([...frame.subarray(7, 11)], mask)
	assert.deepEqual([...frame.subarray(11, 13)], [0, 0])
}

nodeTest.describe('actions.js callbacks', () => {
	nodeTest('pulse GPIO 1: UP right away, then DOWN after IMPULSE_DELAY_MS', { timeout: 2000 }, async () => {
		const { sent, defs } = bindActions()
		await defs.pulse.callback({ options: { gpio: 1 } })
		assert.equal(sent.length, 1)
		assertInpFrame(sent[0].frame, [0x01, 0x00, 0x00, 0x00], [0x01, 0x00, 0x00, 0x00])

		await new Promise((resolve) => setTimeout(resolve, IMPULSE_DELAY_MS + 40))
		assert.equal(sent.length, 2)
		assertInpFrame(sent[1].frame, [0x00, 0x00, 0x00, 0x00], [0x01, 0x00, 0x00, 0x00])
		assert.ok(sent[1].at - sent[0].at >= IMPULSE_DELAY_MS - 20, `DOWN too early (${sent[1].at - sent[0].at} ms)`)
	})

	nodeTest('pulse: the delayed DOWN is tracked, then removed from impulseTimers', { timeout: 2000 }, async () => {
		const { defs, ctx } = bindActions()
		await defs.pulse.callback({ options: { gpio: 5 } })
		assert.equal(ctx.impulseTimers.size, 1)
		await new Promise((resolve) => setTimeout(resolve, IMPULSE_DELAY_MS + 40))
		assert.equal(ctx.impulseTimers.size, 0)
	})

	nodeTest('set_on GPIO 1: INP frame GPIO 1 UP', async () => {
		const { sent, defs } = bindActions()
		await defs.set_on.callback({ options: { gpio: 1 } })
		assert.equal(sent.length, 1)
		assertInpFrame(sent[0].frame, [0x01, 0x00, 0x00, 0x00], [0x01, 0x00, 0x00, 0x00])
	})

	nodeTest('set_off GPIO 32: INP frame GPIO 32 DOWN', async () => {
		const { sent, defs } = bindActions()
		await defs.set_off.callback({ options: { gpio: 32 } })
		assert.equal(sent.length, 1)
		assertInpFrame(sent[0].frame, [0x00, 0x00, 0x00, 0x00], [0x00, 0x00, 0x00, 0x80])
	})

	nodeTest('changing the gpio option of the same action from 3 to 4 targets GPIO 4', async () => {
		const { sent, defs } = bindActions()
		const action = { options: { gpio: 3 } }
		await defs.set_on.callback(action)
		action.options.gpio = 4
		await defs.set_on.callback(action)
		assert.equal(sent.length, 2)
		assertInpFrame(sent[0].frame, [0x04, 0x00, 0x00, 0x00], [0x04, 0x00, 0x00, 0x00])
		assertInpFrame(sent[1].frame, [0x08, 0x00, 0x00, 0x00], [0x08, 0x00, 0x00, 0x00])
	})

	nodeTest('invalid GPIO (0, 33, 2.5, non-numeric, missing): no frame, one warn per call', async () => {
		const invalid = [0, 33, 2.5, 'abc', '5', null, undefined]
		for (const actionId of ['pulse', 'set_on', 'set_off']) {
			for (const gpio of invalid) {
				const { sent, logs, defs, ctx } = bindActions()
				await defs[actionId].callback({ options: { gpio } })
				assert.equal(sent.length, 0, `${actionId} ${gpio}: frame sent`)
				assert.equal(ctx.impulseTimers.size, 0, `${actionId} ${gpio}: timer armed`)
				const warns = logs.filter((entry) => entry.level === 'warn')
				assert.equal(warns.length, 1, `${actionId} ${gpio}: warn count`)
				assert.equal(logs.length, 1, `${actionId} ${gpio}: other log lines`)
			}
		}
	})

	nodeTest('the callbacks wait for the UDP send to finish', async () => {
		for (const actionId of ['pulse', 'set_on', 'set_off']) {
			const { defs, ctx } = bindActions()
			let finishSend
			ctx.networkManager.sendGpioCommand = () => new Promise((resolve) => (finishSend = resolve))
			let settled = false
			const running = defs[actionId].callback({ options: { gpio: 2 } }).then(() => (settled = true))
			await new Promise((resolve) => setImmediate(resolve))
			assert.equal(settled, false, `${actionId}: resolved before the send`)
			finishSend()
			await running
			assert.equal(settled, true)
			for (const timer of ctx.impulseTimers.keys()) clearTimeout(timer)
		}
	})
})
