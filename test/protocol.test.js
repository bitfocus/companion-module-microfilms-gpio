/**
 * Unit tests of the UDP/GPIO protocol (I/O matrix).
 */

import nodeTest from 'node:test'
import assert from 'node:assert/strict'
import {
	INP_HEADER,
	OUT_HEADER,
	IMPULSE_DELAY_MS,
	PING_INTERVAL_MS,
	RECEPTION_TIMEOUT_MS,
	GPIO_COUNT,
	isValidBit,
	buildInpFrame,
	buildPingFrame,
	buildImpulseFrames,
	buildOutFrame,
	applyMask,
	parseOutFrame,
	parseInpFrame,
	encodeBit,
	readBit,
	bitByteIndex,
	bitBitMask,
	bytesToBinaryString,
} from '../src/protocol.js'

nodeTest.describe('GPIO 1–32 indexing', () => {
	nodeTest('puts GPIO 1 in byte 0, value 0x01', () => {
		assert.equal(bitByteIndex(1), 0)
		assert.equal(bitBitMask(1), 0x01)
		assert.deepEqual([...encodeBit(1)], [0x01, 0x00, 0x00, 0x00])
	})

	nodeTest('puts GPIO 32 in byte 3, value 0x80', () => {
		assert.equal(bitByteIndex(32), 3)
		assert.equal(bitBitMask(32), 0x80)
		assert.deepEqual([...encodeBit(32)], [0x00, 0x00, 0x00, 0x80])
	})

	nodeTest('readBit reads each GPIO of a Little Endian state', () => {
		const state = Buffer.from([0x10, 0x00, 0x00, 0x80])
		for (let bit = 1; bit <= GPIO_COUNT; bit++) {
			assert.equal(readBit(state, bit), bit === 5 || bit === 32 ? 1 : 0, `GPIO ${bit}`)
		}
	})

	nodeTest('isValidBit accepts the integers 1 to 32 only', () => {
		assert.equal(GPIO_COUNT, 32)
		for (const valid of [1, 16, 32]) assert.equal(isValidBit(valid), true, String(valid))
		for (const invalid of [0, 33, -1, 2.5, NaN, '5', 'abc', null, undefined, true]) {
			assert.equal(isValidBit(invalid), false, String(invalid))
		}
	})
})

nodeTest.describe('INP frames', () => {
	nodeTest('INP GPIO 1 UP: 13 bytes, GPIO and mask 01 00 00 00, reserved 00 00', () => {
		const frame = buildInpFrame(encodeBit(1), encodeBit(1))
		assert.equal(frame.length, 13)
		assert.equal(frame.subarray(0, 3).toString(), INP_HEADER)
		assert.deepEqual([...frame.subarray(3, 7)], [0x01, 0x00, 0x00, 0x00])
		assert.deepEqual([...frame.subarray(7, 11)], [0x01, 0x00, 0x00, 0x00])
		assert.deepEqual([...frame.subarray(11, 13)], [0x00, 0x00])
	})

	nodeTest('INP GPIO 32 DOWN: GPIO 0, mask 00 00 00 80', () => {
		const frame = buildInpFrame(Buffer.alloc(4), encodeBit(32))
		assert.equal(frame.length, 13)
		assert.equal(frame.subarray(0, 3).toString(), INP_HEADER)
		assert.deepEqual([...frame.subarray(3, 7)], [0x00, 0x00, 0x00, 0x00])
		assert.deepEqual([...frame.subarray(7, 11)], [0x00, 0x00, 0x00, 0x80])
		assert.deepEqual([...frame.subarray(11, 13)], [0x00, 0x00])
	})

	nodeTest('ping: INP + 8 zero bytes of GPIO/mask + 2 reserved bytes, every 500 ms, timeout 3 s', () => {
		const frame = buildPingFrame()
		assert.equal(frame.length, 13)
		assert.equal(frame.subarray(0, 3).toString(), INP_HEADER)
		assert.deepEqual([...frame.subarray(3, 11)], [0, 0, 0, 0, 0, 0, 0, 0])
		assert.deepEqual([...frame.subarray(11, 13)], [0, 0])
		assert.equal(PING_INTERVAL_MS, 500)
		assert.equal(RECEPTION_TIMEOUT_MS, 3000)
	})
})

nodeTest.describe('Pulse', () => {
	nodeTest('UP = GPIO on + mask N; DOWN = GPIO 0 + same mask; 100 ms delay', () => {
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
	nodeTest('selective mask: GPIO 32 already on, INP GPIO 1 masked alone → GPIOs 1 and 32 on', () => {
		const state = encodeBit(32)
		const result = applyMask(state, encodeBit(1), encodeBit(1))
		assert.deepEqual([...result], [0x01, 0x00, 0x00, 0x80])
		assert.notEqual(result, state)
	})

	nodeTest('empty mask: GPIO and mask at 0 → state unchanged', () => {
		const state = Buffer.from([0x12, 0x34, 0x56, 0x78])
		const result = applyMask(state, Buffer.alloc(4), Buffer.alloc(4))
		assert.deepEqual([...result], [0x12, 0x34, 0x56, 0x78])
	})
})

nodeTest.describe('OUT frames', () => {
	nodeTest('valid OUT: parse returns the 4 GPIO bytes', () => {
		const gpio = Buffer.from([0xaa, 0xbb, 0xcc, 0xdd])
		const frame = buildOutFrame(gpio)
		assert.equal(frame.length, 7)
		assert.equal(frame.subarray(0, 3).toString(), OUT_HEADER)
		const parsed = parseOutFrame(frame)
		assert.ok(parsed)
		assert.deepEqual([...parsed], [0xaa, 0xbb, 0xcc, 0xdd])
	})

	nodeTest('invalid OUT: header other than OUT → null', () => {
		const frame = Buffer.concat([Buffer.from('INP'), Buffer.from([1, 2, 3, 4])])
		assert.equal(parseOutFrame(frame), null)
	})

	nodeTest('short OUT: OUT header + fewer than 4 bytes → null', () => {
		assert.equal(parseOutFrame(Buffer.concat([Buffer.from(OUT_HEADER), Buffer.from([1, 2, 3])])), null)
		assert.equal(parseOutFrame(Buffer.from(OUT_HEADER)), null)
	})
})

nodeTest.describe('parseInpFrame', () => {
	nodeTest('extracts GPIO and mask from an INP frame', () => {
		const frame = buildInpFrame(encodeBit(1), encodeBit(32))
		const parsed = parseInpFrame(frame)
		assert.ok(parsed)
		assert.deepEqual([...parsed.gpioBytes], [0x01, 0x00, 0x00, 0x00])
		assert.deepEqual([...parsed.maskBytes], [0x00, 0x00, 0x00, 0x80])
	})

	nodeTest('rejects a header other than INP', () => {
		assert.equal(parseInpFrame(buildOutFrame(Buffer.alloc(4))), null)
	})

	nodeTest('short INP: INP header + fewer than 8 bytes → null', () => {
		assert.equal(parseInpFrame(Buffer.concat([Buffer.from(INP_HEADER), Buffer.alloc(7)])), null)
		assert.ok(parseInpFrame(Buffer.concat([Buffer.from(INP_HEADER), Buffer.alloc(8)])))
	})
})

nodeTest.describe('bytesToBinaryString', () => {
	nodeTest('most significant byte first: GPIO 32 on the left, GPIO 1 on the right', () => {
		assert.equal(bytesToBinaryString(Buffer.from([0x01, 0x00, 0x00, 0x80])), '10000000 00000000 00000000 00000001')
	})
})
