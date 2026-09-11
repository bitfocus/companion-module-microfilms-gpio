/**
 * Tests unitaires du protocole UDP/GPIO (matrice I/O).
 */

import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import {
  INP_HEADER,
  OUT_HEADER,
  IMPULSE_DELAY_MS,
  PING_INTERVAL_MS,
  buildInpFrame,
  buildPingFrame,
  buildImpulseFrames,
  buildOutFrame,
  applyMask,
  parseOutFrame,
  parseInpFrame,
  encodeBit,
  bitByteIndex,
  bitBitMask
} from '../protocol.js'

nodeTest.describe('indexation bit 1–32', () => {
  nodeTest('place le bit 1 dans l’octet 0, valeur 0x01', () => {
    assert.equal(bitByteIndex(1), 0)
    assert.equal(bitBitMask(1), 0x01)
    assert.deepEqual([...encodeBit(1)], [0x01, 0x00, 0x00, 0x00])
  })

  nodeTest('place le bit 32 dans l’octet 3, valeur 0x80', () => {
    assert.equal(bitByteIndex(32), 3)
    assert.equal(bitBitMask(32), 0x80)
    assert.deepEqual([...encodeBit(32)], [0x00, 0x00, 0x00, 0x80])
  })
})

nodeTest.describe('trames INP', () => {
  nodeTest('INP bit 1 UP : 13 octets, GPIO et masque 01 00 00 00, réservés 00 00', () => {
    const frame = buildInpFrame(encodeBit(1), encodeBit(1))
    assert.equal(frame.length, 13)
    assert.equal(frame.subarray(0, 3).toString(), INP_HEADER)
    assert.deepEqual([...frame.subarray(3, 7)], [0x01, 0x00, 0x00, 0x00])
    assert.deepEqual([...frame.subarray(7, 11)], [0x01, 0x00, 0x00, 0x00])
    assert.deepEqual([...frame.subarray(11, 13)], [0x00, 0x00])
  })

  nodeTest('INP bit 32 DOWN : GPIO à 0, masque 00 00 00 80', () => {
    const frame = buildInpFrame(Buffer.alloc(4), encodeBit(32))
    assert.equal(frame.length, 13)
    assert.equal(frame.subarray(0, 3).toString(), INP_HEADER)
    assert.deepEqual([...frame.subarray(3, 7)], [0x00, 0x00, 0x00, 0x00])
    assert.deepEqual([...frame.subarray(7, 11)], [0x00, 0x00, 0x00, 0x80])
    assert.deepEqual([...frame.subarray(11, 13)], [0x00, 0x00])
  })

  nodeTest('ping : INP + 8 zéros GPIO/masque + 2 réservés', () => {
    const frame = buildPingFrame()
    assert.equal(frame.length, 13)
    assert.equal(frame.subarray(0, 3).toString(), INP_HEADER)
    assert.deepEqual([...frame.subarray(3, 11)], [0, 0, 0, 0, 0, 0, 0, 0])
    assert.deepEqual([...frame.subarray(11, 13)], [0, 0])
    assert.equal(PING_INTERVAL_MS, 500)
  })
})

nodeTest.describe('Impulse', () => {
  nodeTest('UP = bit à 1 + masque N ; DOWN = GPIO 0 + même masque ; délai 100 ms', () => {
    const bit = 5
    const { up, down } = buildImpulseFrames(bit)
    const mask = [...encodeBit(bit)]

    assert.deepEqual([...up.subarray(3, 7)], mask)
    assert.deepEqual([...up.subarray(7, 11)], mask)
    assert.deepEqual([...down.subarray(3, 7)], [0, 0, 0, 0])
    assert.deepEqual([...down.subarray(7, 11)], mask)
    assert.equal(IMPULSE_DELAY_MS, 100)
  })
})

nodeTest.describe('applyMask', () => {
  nodeTest('masque sélectif : bit 32 déjà à 1, INP bit 1 masqué seul → bits 1 et 32 à 1', () => {
    const etat = encodeBit(32)
    const result = applyMask(etat, encodeBit(1), encodeBit(1))
    assert.deepEqual([...result], [0x01, 0x00, 0x00, 0x80])
    assert.notEqual(result, etat)
  })

  nodeTest('masque nul : gpio et masque à 0 → état inchangé', () => {
    const etat = Buffer.from([0x12, 0x34, 0x56, 0x78])
    const result = applyMask(etat, Buffer.alloc(4), Buffer.alloc(4))
    assert.deepEqual([...result], [0x12, 0x34, 0x56, 0x78])
  })
})

nodeTest.describe('trames OUT', () => {
  nodeTest('OUT valide : parse retourne les 4 octets GPIO', () => {
    const gpio = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd])
    const frame = buildOutFrame(gpio)
    assert.equal(frame.length, 7)
    assert.equal(frame.subarray(0, 3).toString(), OUT_HEADER)
    const parsed = parseOutFrame(frame)
    assert.ok(parsed)
    assert.deepEqual([...parsed], [0xaa, 0xbb, 0xcc, 0xdd])
  })

  nodeTest('OUT invalide : en-tête ≠ OUT → null', () => {
    const frame = Buffer.concat([Buffer.from('INP'), Buffer.from([1, 2, 3, 4])])
    assert.equal(parseOutFrame(frame), null)
  })
})

nodeTest.describe('parseInpFrame', () => {
  nodeTest('extrait GPIO et masque d’une trame INP', () => {
    const frame = buildInpFrame(encodeBit(1), encodeBit(32))
    const parsed = parseInpFrame(frame)
    assert.ok(parsed)
    assert.deepEqual([...parsed.gpioBytes], [0x01, 0x00, 0x00, 0x00])
    assert.deepEqual([...parsed.maskBytes], [0x00, 0x00, 0x00, 0x80])
  })

  nodeTest('rejette un en-tête autre que INP', () => {
    assert.equal(parseInpFrame(buildOutFrame(Buffer.alloc(4))), null)
  })
})
