/**
 * Exécute les callbacks Impulse / UP / DOWN via un sendGpioCommand factice.
 */

import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import initActions from '../actions.js'
import { IMPULSE_DELAY_MS, INP_HEADER } from '../protocol.js'

/**
 * Lie actions.js à un contexte Companion minimal.
 */
function bindActions () {
  const sent = []
  const defs = {}
  const ctx = {
    config: { host: '127.0.0.1', port: 1 },
    networkManager: {
      sendGpioCommand (frame) {
        sent.push({ frame: Buffer.from(frame), at: Date.now() })
      }
    },
    log () {},
    byteToBinaryString () {
      return ''
    },
    setActionDefinitions (definitions) {
      Object.assign(defs, definitions)
    }
  }
  initActions.call(ctx)
  return { sent, defs }
}

/**
 * Vérifie une trame INP de 13 octets (GPIO, masque, réservés).
 */
function assertInpFrame (frame, gpio, mask) {
  assert.equal(frame.length, 13)
  assert.equal(frame.subarray(0, 3).toString(), INP_HEADER)
  assert.deepEqual([...frame.subarray(3, 7)], gpio)
  assert.deepEqual([...frame.subarray(7, 11)], mask)
  assert.deepEqual([...frame.subarray(11, 13)], [0, 0])
}

nodeTest.describe('callbacks actions.js', () => {
  nodeTest('Impulse01 : UP immédiat puis DOWN après IMPULSE_DELAY_MS', { timeout: 2000 }, async () => {
    const { sent, defs } = bindActions()
    await defs.impulse1.callback()
    assert.equal(sent.length, 1)
    assertInpFrame(sent[0].frame, [0x01, 0x00, 0x00, 0x00], [0x01, 0x00, 0x00, 0x00])

    await new Promise((resolve) => setTimeout(resolve, IMPULSE_DELAY_MS + 40))
    assert.equal(sent.length, 2)
    assertInpFrame(sent[1].frame, [0x00, 0x00, 0x00, 0x00], [0x01, 0x00, 0x00, 0x00])
    assert.ok(
      sent[1].at - sent[0].at >= IMPULSE_DELAY_MS - 20,
      `DOWN trop tôt (${sent[1].at - sent[0].at} ms)`
    )
  })

  nodeTest('Set01 : trame INP bit 1 UP', async () => {
    const { sent, defs } = bindActions()
    await defs.up1.callback()
    assert.equal(sent.length, 1)
    assertInpFrame(sent[0].frame, [0x01, 0x00, 0x00, 0x00], [0x01, 0x00, 0x00, 0x00])
  })

  nodeTest('Raz32 : trame INP bit 32 DOWN', async () => {
    const { sent, defs } = bindActions()
    await defs.down32.callback()
    assert.equal(sent.length, 1)
    assertInpFrame(sent[0].frame, [0x00, 0x00, 0x00, 0x00], [0x00, 0x00, 0x00, 0x80])
  })
})
