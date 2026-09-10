/**
 * Tests d'intégration UDP locaux (port éphémère) + NetworkManager.
 * N'importe jamais udp-server.js (bind 7770 à l'import).
 */

const nodeTest = require('node:test')
const assert = require('node:assert/strict')
const dgram = require('dgram')
const NetworkManager = require('../network')
const {
  applyMask,
  parseInpFrame,
  buildOutFrame,
  buildInpFrame,
  encodeBit,
  PING_INTERVAL_MS,
  RECEPTION_TIMEOUT_MS
} = require('../protocol')

/**
 * Attend un événement unique ou échoue après timeoutMs.
 */
function onceEvent (emitter, eventName, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off(eventName, onEvent)
      reject(new Error(`Timeout waiting for ${eventName}`))
    }, timeoutMs)
    function onEvent (...args) {
      clearTimeout(timer)
      resolve(args)
    }
    emitter.once(eventName, onEvent)
  })
}

/**
 * Ouvre un socket UDP sur un port éphémère (jamais 7770).
 */
function bindEphemeral () {
  const server = dgram.createSocket('udp4')
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.bind(0, '127.0.0.1', () => {
      const { port } = server.address()
      if (port === 7770) {
        server.close()
        reject(new Error('Le port éphémère ne doit pas être 7770'))
        return
      }
      resolve({ server, port })
    })
  })
}

function silentLog () {}

nodeTest.describe('NetworkManager UDP local', () => {
  nodeTest('OUT valide → événement gpioStatus', async () => {
    const { server, port } = await bindEphemeral()
    const expected = Buffer.from([0x11, 0x22, 0x33, 0x44])
    server.on('message', (msg, rinfo) => {
      server.send(buildOutFrame(expected), rinfo.port, rinfo.address)
    })

    const nm = new NetworkManager(
      { host: '127.0.0.1', port },
      silentLog,
      Buffer.from('INP'),
      Buffer.alloc(4)
    )

    try {
      const [gpioBytes] = await onceEvent(nm, 'gpioStatus', 1000)
      assert.deepEqual([...gpioBytes], [...expected])
    } finally {
      nm.destroy()
      await new Promise((resolve) => server.close(resolve))
    }
  })

  nodeTest('OUT invalide → événement connectionFailure', async () => {
    const { server, port } = await bindEphemeral()
    server.on('message', (msg, rinfo) => {
      server.send(Buffer.from('XXX\x00\x00\x00\x00'), rinfo.port, rinfo.address)
    })

    const nm = new NetworkManager(
      { host: '127.0.0.1', port },
      silentLog,
      Buffer.from('INP'),
      Buffer.alloc(4)
    )

    try {
      const [reason] = await onceEvent(nm, 'connectionFailure', 1000)
      assert.equal(reason, 'Incorrect header in "Status" response')
    } finally {
      nm.destroy()
      await new Promise((resolve) => server.close(resolve))
    }
  })

  nodeTest('silence après ping → noResponse au bout de ~3 s', { timeout: 10000 }, async () => {
    const { server, port } = await bindEphemeral()
    const nm = new NetworkManager(
      { host: '127.0.0.1', port },
      silentLog,
      Buffer.from('INP'),
      Buffer.alloc(4)
    )

    try {
      const started = Date.now()
      const [message] = await onceEvent(nm, 'noResponse', RECEPTION_TIMEOUT_MS + 1000)
      const elapsed = Date.now() - started
      assert.match(message, /No response from server after '3' seconds/)
      assert.ok(elapsed >= RECEPTION_TIMEOUT_MS - 100, `timeout trop tôt (${elapsed} ms)`)
    } finally {
      nm.destroy()
      await new Promise((resolve) => server.close(resolve))
    }
  })

  nodeTest('cadence ping ~500 ms', { timeout: 3000 }, async () => {
    const { server, port } = await bindEphemeral()
    const receivedAt = []
    server.on('message', (msg, rinfo) => {
      receivedAt.push(Date.now())
      server.send(buildOutFrame(Buffer.alloc(4)), rinfo.port, rinfo.address)
    })

    const nm = new NetworkManager(
      { host: '127.0.0.1', port },
      silentLog,
      Buffer.from('INP'),
      Buffer.alloc(4)
    )

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
          reject(new Error('moins de 2 datagrammes reçus'))
        }, 2000)
      })
      const gap = receivedAt[1] - receivedAt[0]
      assert.ok(
        Math.abs(gap - PING_INTERVAL_MS) <= 150,
        `écart ping ${gap} ms (attendu ~${PING_INTERVAL_MS})`
      )
    } finally {
      nm.destroy()
      await new Promise((resolve) => server.close(resolve))
    }
  })

  nodeTest('masque sélectif : bit 32 conservé, bit 1 ajouté', async () => {
    const { server, port } = await bindEphemeral()
    let etat = encodeBit(32)

    server.on('message', (msg, rinfo) => {
      const parsed = parseInpFrame(msg)
      if (!parsed) {
        return
      }
      etat = applyMask(etat, parsed.gpioBytes, parsed.maskBytes)
      server.send(buildOutFrame(etat), rinfo.port, rinfo.address)
    })

    const nm = new NetworkManager(
      { host: '127.0.0.1', port },
      silentLog,
      Buffer.from('INP'),
      Buffer.alloc(4)
    )

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
