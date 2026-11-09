/**
 * Helpers purs du protocole UDP/GPIO (trames INP/OUT, masque, bits 1–32).
 * Source unique pour les actions, le NetworkManager et le simulateur.
 *
 * Modules requis :
 * - Buffer (natif de Node.js)
 *
 * Créé le 2026-09-10. Licence MIT. Compatible module 0.1.0.
 */

/** En-tête des trames de commande (3 caractères). La trame INP fait 13 octets. */
const INP_HEADER = 'INP'

/** En-tête des trames de statut (3 caractères). La trame OUT fait 7 octets. */
const OUT_HEADER = 'OUT'

/** Délai Impulse entre UP et DOWN, en millisecondes. */
const IMPULSE_DELAY_MS = 100

/** Intervalle d'envoi du ping GPIO, en millisecondes. */
const PING_INTERVAL_MS = 500

/** Délai sans réponse OUT avant noResponse, en millisecondes. */
const RECEPTION_TIMEOUT_MS = 3000

/** Longueur du champ GPIO et du champ masque, en octets. */
const GPIO_LENGTH = 4

/** Longueur des octets réservés en fin de trame INP. */
const RESERVED_LENGTH = 2

/**
 * Calcule l'index d'octet (0–3) pour le bit opérateur N (1–32).
 *
 * bit : numéro de bit opérateur (1–32).
 * @returns {number} Index d'octet dans le buffer GPIO.
 */
function bitByteIndex (bit) {
  return Math.floor((bit - 1) / 8)
}

/**
 * Calcule le masque de bit dans l'octet pour le bit opérateur N (1–32).
 *
 * bit : numéro de bit opérateur (1–32).
 * @returns {number} Valeur `1 << ((N-1) % 8)`.
 */
function bitBitMask (bit) {
  return 1 << ((bit - 1) % 8)
}

/**
 * Construit un buffer GPIO de 4 octets avec uniquement le bit N positionné.
 *
 * bit : numéro de bit opérateur (1–32).
 * @returns {Buffer} Buffer de 4 octets.
 */
function encodeBit (bit) {
  const bytes = Buffer.alloc(GPIO_LENGTH)
  bytes[bitByteIndex(bit)] = bitBitMask(bit)
  return bytes
}

/**
 * Construit une trame INP de 13 octets : en-tête + GPIO + masque + 2 réservés.
 *
 * gpioBytes : 4 octets de valeurs GPIO.
 * maskBytes : 4 octets de masque.
 * @returns {Buffer} Trame INP complète.
 */
function buildInpFrame (gpioBytes, maskBytes) {
  return Buffer.concat([
    Buffer.from(INP_HEADER),
    gpioBytes,
    maskBytes,
    Buffer.alloc(RESERVED_LENGTH)
  ])
}

/**
 * Construit la trame de ping : INP, GPIO et masque à 0, 2 octets réservés.
 *
 * @returns {Buffer} Trame INP de ping.
 */
function buildPingFrame () {
  return buildInpFrame(Buffer.alloc(GPIO_LENGTH), Buffer.alloc(GPIO_LENGTH))
}

/**
 * Construit les deux trames Impulse (UP puis DOWN) pour le bit N, même masque.
 *
 * bit : numéro de bit opérateur (1–32).
 * @returns {{up: Buffer, down: Buffer}} Trames INP UP et DOWN.
 */
function buildImpulseFrames (bit) {
  const maskBytes = encodeBit(bit)
  return {
    up: buildInpFrame(encodeBit(bit), maskBytes),
    down: buildInpFrame(Buffer.alloc(GPIO_LENGTH), maskBytes)
  }
}

/**
 * Applique le masque bit à bit : `(ancien & ~masque) | (nouveau & masque)`.
 * Les bits non masqués restent inchangés. Ne mute pas les buffers d'entrée.
 *
 * etat : état GPIO actuel (4 octets).
 * gpio : nouvelles valeurs GPIO (4 octets).
 * masque : masque à appliquer (4 octets).
 * @returns {Buffer} Nouvel état GPIO de 4 octets.
 */
function applyMask (etat, gpio, masque) {
  const result = Buffer.alloc(GPIO_LENGTH)
  for (let i = 0; i < GPIO_LENGTH; i++) {
    result[i] = (etat[i] & ~masque[i]) | (gpio[i] & masque[i])
  }
  return result
}

/**
 * Analyse une trame OUT. Retourne les 4 octets GPIO si l'en-tête est valide.
 *
 * msg : datagramme reçu.
 * @returns {Buffer|null} Octets GPIO, ou null si l'en-tête n'est pas OUT.
 */
function parseOutFrame (msg) {
  if (!msg || msg.length < 3) {
    return null
  }
  const header = msg.subarray(0, 3).toString()
  if (header !== OUT_HEADER) {
    return null
  }
  return msg.subarray(3, 7)
}

/**
 * Analyse une trame INP. Retourne GPIO et masque si l'en-tête est valide.
 *
 * msg : datagramme reçu.
 * @returns {{gpioBytes: Buffer, maskBytes: Buffer}|null} Champs extraits, ou null.
 */
function parseInpFrame (msg) {
  if (!msg || msg.length < 3) {
    return null
  }
  const header = msg.subarray(0, 3).toString()
  if (header !== INP_HEADER) {
    return null
  }
  return {
    gpioBytes: msg.subarray(3, 7),
    maskBytes: msg.subarray(7, 11)
  }
}

/**
 * Construit une trame OUT de 7 octets : en-tête + 4 octets GPIO.
 *
 * gpioBytes : état GPIO à renvoyer.
 * @returns {Buffer} Trame OUT complète.
 */
function buildOutFrame (gpioBytes) {
  return Buffer.concat([Buffer.from(OUT_HEADER), gpioBytes])
}

export {
  INP_HEADER,
  OUT_HEADER,
  IMPULSE_DELAY_MS,
  PING_INTERVAL_MS,
  RECEPTION_TIMEOUT_MS,
  bitByteIndex,
  bitBitMask,
  encodeBit,
  buildInpFrame,
  buildPingFrame,
  buildImpulseFrames,
  applyMask,
  parseOutFrame,
  parseInpFrame,
  buildOutFrame
}
