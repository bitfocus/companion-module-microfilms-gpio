/**
 * Pure helpers of the UDP/GPIO protocol (INP/OUT frames, mask, GPIO 1–32).
 * Single source for the actions, the feedback, the NetworkManager and the simulator.
 *
 * Required modules:
 * - Buffer (Node.js built-in)
 *
 * Created 2026-09-10.
 */

/** Header of command frames (3 characters). An INP frame is 13 bytes long. */
const INP_HEADER = 'INP'

/** Header of status frames (3 characters). An OUT frame is 7 bytes long. */
const OUT_HEADER = 'OUT'

/** Pulse delay between UP and DOWN, in milliseconds. */
const IMPULSE_DELAY_MS = 100

/** Interval between two GPIO pings, in milliseconds. */
const PING_INTERVAL_MS = 500

/** Delay without an OUT response before noResponse, in milliseconds. */
const RECEPTION_TIMEOUT_MS = 3000

/** Number of GPIOs handled by the module (GPIO 1 to 32). */
const GPIO_COUNT = 32

/** Length of the GPIO field and of the mask field, in bytes. */
const GPIO_LENGTH = 4

/** Length of the reserved bytes at the end of an INP frame. */
const RESERVED_LENGTH = 2

/** Minimum length of a usable OUT frame: header + GPIO. */
const OUT_MIN_LENGTH = OUT_HEADER.length + GPIO_LENGTH

/** Minimum length of a usable INP frame: header + GPIO + mask. */
const INP_MIN_LENGTH = INP_HEADER.length + 2 * GPIO_LENGTH

/**
 * Tells whether a value is a valid GPIO number: an integer from 1 to 32.
 *
 * value: any value (option value, expression result).
 * @returns {boolean} True for 1, 2, … 32; false for 0, 33, 2.5, strings, null or undefined.
 */
function isValidBit(value) {
	return Number.isInteger(value) && value >= 1 && value <= GPIO_COUNT
}

/**
 * Computes the byte index (0–3) of GPIO N (1–32).
 *
 * bit: GPIO number (1–32).
 * @returns {number} Byte index in the GPIO buffer.
 */
function bitByteIndex(bit) {
	return Math.floor((bit - 1) / 8)
}

/**
 * Computes the bit mask inside the byte of GPIO N (1–32).
 *
 * bit: GPIO number (1–32).
 * @returns {number} Value `1 << ((N-1) % 8)`.
 */
function bitBitMask(bit) {
	return 1 << ((bit - 1) % 8)
}

/**
 * Builds a 4-byte GPIO buffer with only GPIO N set.
 *
 * bit: GPIO number (1–32).
 * @returns {Buffer} 4-byte buffer.
 */
function encodeBit(bit) {
	const bytes = Buffer.alloc(GPIO_LENGTH)
	bytes[bitByteIndex(bit)] = bitBitMask(bit)
	return bytes
}

/**
 * Reads the state of GPIO N (1–32) in 4 GPIO bytes (Little Endian).
 *
 * gpioBytes: 4 GPIO bytes.
 * bit: GPIO number (1–32).
 * @returns {number} 1 if the GPIO is on, 0 otherwise.
 */
function readBit(gpioBytes, bit) {
	return (gpioBytes[bitByteIndex(bit)] & bitBitMask(bit)) !== 0 ? 1 : 0
}

/**
 * Builds a 13-byte INP frame: header + GPIO + mask + 2 reserved bytes.
 *
 * gpioBytes: 4 bytes of GPIO values.
 * maskBytes: 4 bytes of mask.
 * @returns {Buffer} Complete INP frame.
 */
function buildInpFrame(gpioBytes, maskBytes) {
	return Buffer.concat([Buffer.from(INP_HEADER), gpioBytes, maskBytes, Buffer.alloc(RESERVED_LENGTH)])
}

/**
 * Builds the ping frame: INP, GPIO and mask set to 0, 2 reserved bytes.
 *
 * @returns {Buffer} Ping INP frame.
 */
function buildPingFrame() {
	return buildInpFrame(Buffer.alloc(GPIO_LENGTH), Buffer.alloc(GPIO_LENGTH))
}

/**
 * Builds the two pulse frames (UP then DOWN) for GPIO N, with the same mask.
 *
 * bit: GPIO number (1–32).
 * @returns {{up: Buffer, down: Buffer}} UP and DOWN INP frames.
 */
function buildImpulseFrames(bit) {
	const maskBytes = encodeBit(bit)
	return {
		up: buildInpFrame(encodeBit(bit), maskBytes),
		down: buildInpFrame(Buffer.alloc(GPIO_LENGTH), maskBytes),
	}
}

/**
 * Applies the mask bitwise: `(state & ~mask) | (gpio & mask)`.
 * Unmasked bits are left unchanged. The input buffers are not mutated.
 *
 * state: current GPIO state (4 bytes).
 * gpio: new GPIO values (4 bytes).
 * mask: mask to apply (4 bytes).
 * @returns {Buffer} New 4-byte GPIO state.
 */
function applyMask(state, gpio, mask) {
	const result = Buffer.alloc(GPIO_LENGTH)
	for (let i = 0; i < GPIO_LENGTH; i++) {
		result[i] = (state[i] & ~mask[i]) | (gpio[i] & mask[i])
	}
	return result
}

/**
 * Parses an OUT frame. Returns the 4 GPIO bytes when the header is valid.
 *
 * msg: received datagram.
 * @returns {Buffer|null} GPIO bytes, or null if the frame is too short or the header is not OUT.
 */
function parseOutFrame(msg) {
	if (!msg || msg.length < OUT_MIN_LENGTH) {
		return null
	}
	const header = msg.subarray(0, 3).toString()
	if (header !== OUT_HEADER) {
		return null
	}
	return msg.subarray(3, 7)
}

/**
 * Parses an INP frame. Returns GPIO and mask when the header is valid.
 *
 * msg: received datagram.
 * @returns {{gpioBytes: Buffer, maskBytes: Buffer}|null} Extracted fields, or null if the frame is too short
 * or the header is not INP.
 */
function parseInpFrame(msg) {
	if (!msg || msg.length < INP_MIN_LENGTH) {
		return null
	}
	const header = msg.subarray(0, 3).toString()
	if (header !== INP_HEADER) {
		return null
	}
	return {
		gpioBytes: msg.subarray(3, 7),
		maskBytes: msg.subarray(7, 11),
	}
}

/**
 * Builds a 7-byte OUT frame: header + 4 GPIO bytes.
 *
 * gpioBytes: GPIO state to send back.
 * @returns {Buffer} Complete OUT frame.
 */
function buildOutFrame(gpioBytes) {
	return Buffer.concat([Buffer.from(OUT_HEADER), gpioBytes])
}

/**
 * Renders GPIO bytes in binary, most significant byte first (GPIO 32 on the left).
 *
 * gpioBytes: GPIO bytes in Little Endian.
 * @returns {string} Groups of 8 bits separated by spaces.
 */
function bytesToBinaryString(gpioBytes) {
	return Array.from(gpioBytes)
		.reverse()
		.map((byte) => byte.toString(2).padStart(8, '0'))
		.join(' ')
}

export {
	INP_HEADER,
	OUT_HEADER,
	IMPULSE_DELAY_MS,
	PING_INTERVAL_MS,
	RECEPTION_TIMEOUT_MS,
	GPIO_COUNT,
	isValidBit,
	bitByteIndex,
	bitBitMask,
	encodeBit,
	readBit,
	buildInpFrame,
	buildPingFrame,
	buildImpulseFrames,
	applyMask,
	parseOutFrame,
	parseInpFrame,
	buildOutFrame,
	bytesToBinaryString,
}
