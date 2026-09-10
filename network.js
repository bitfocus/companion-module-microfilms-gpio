/**
 * @fileoverview Ce fichier contient la définition de la classe NetworkManager,
 * qui gère les connexions réseau pour envoyer et recevoir des commandes GPIO.
 *
 * @module NetworkManager
 * @requires dgram
 * @requires events
 * @requires ./protocol
 *
 * @description
 * Ce module utilise UDP pour envoyer des commandes GPIO et écouter les réponses du serveur.
 * Il émet des événements en fonction des réponses reçues et des erreurs de connexion.
 */

const dgram = require('dgram')
const EventEmitter = require('events')
const { buildPingFrame, parseOutFrame, PING_INTERVAL_MS, RECEPTION_TIMEOUT_MS } = require('./protocol')

/**
 * Classe représentant le gestionnaire de réseau pour les commandes GPIO.
 * @extends EventEmitter
 */
class NetworkManager extends EventEmitter {
  /**
   * Crée une instance de NetworkManager.
   * @param {Object} config - La configuration réseau.
   * @param {Function} log - La fonction de journalisation.
   */
  constructor (config, log, setGpioHeader, gpioBytes) {
    super()
    this.config = config
    this.log = log
    this.setGpioHeader = setGpioHeader
    this.gpioBytes = gpioBytes
    this.pingInterval = PING_INTERVAL_MS
    this.receptionWatcherInterval = RECEPTION_TIMEOUT_MS
    this.waitingForStatusResponse = false
    this.pingMessage = buildPingFrame()
    this.sendGpioPingId = null
    this.receptionWatcherId = null
    this.configureReception()
    this.sendGpioPing()
  }

  /**
   * Configure la réception des messages UDP.
   * @returns {void}
   */
  configureReception () {
    // Supprimer la connexion UDP existante
    if (this.udpClient) {
      this.udpClient.close()
      delete this.udpClient
    }

    // Créer une nouvelle connexion UDP
    this.udpClient = dgram.createSocket('udp4')

    // Écouter la réponse "Status" du serveur
    this.udpClient.on('message', (msg, rinfo) => {
      const gpioBytes = parseOutFrame(msg)
      if (gpioBytes) {
        this.gpioBytes = gpioBytes
        clearTimeout(this.receptionWatcherId)
        this.waitingForStatusResponse = false
        this.emit('gpioStatus', this.gpioBytes)
        this.log('info', `"Status" response from ${rinfo.address}:${rinfo.port} (GPIO=${this.byteToBinaryString(this.gpioBytes)})`)
      } else {
        this.emit('connectionFailure', 'Incorrect header in "Status" response')
        this.log('error', 'Incorrect header in "Status" response')
      }
    })
  }

  /**
   * Surveille la réception des réponses du serveur.
   * @returns {void}
   */
  receptionWatcher () {
    this.receptionWatcherId = setTimeout(() => {
      if (this.waitingForStatusResponse) {
        this.waitingForStatusResponse = false
        this.emit('noResponse', `No response from server after '${this.receptionWatcherInterval / 1000}' seconds`)
        this.log('error', `No response from server after '${this.receptionWatcherInterval / 1000}' seconds`)
      }
    }, this.receptionWatcherInterval)
  }

  /**
   * Envoie un ping GPIO au serveur.
   * @returns {void}
   */
  sendGpioPing () {
    if (!this.waitingForStatusResponse) {
      this.udpClient.send(this.pingMessage, this.config.port, this.config.host, (err) => {
        if (err) {
          this.emit('sendError', err)
          this.log('error', `Error sending "Set GPIO" command: ${err}`)
        } else {
          this.waitingForStatusResponse = true
          this.receptionWatcher()
          this.log('info', 'Command "Set GPIO PING" sent successfully.')
        }
      })
    }
    // Rappeler cette fonction après l'intervalle défini
    this.sendGpioPingId = setTimeout(() => {
      this.log('info', 'Sending ping')
      this.sendGpioPing()
    }, this.pingInterval)
  }

  /**
   * Convertit un octet en une chaîne binaire de 8 bits.
   * @param {Buffer} gpioBytes - Les octets GPIO à convertir.
   * @returns {string} La chaîne binaire.
   */
  byteToBinaryString (gpioBytes) {
    function byteToBinaryString (byte) {
      return byte.toString(2).padStart(8, '0') // Conversion en binaire et ajout de zéros à gauche si nécessaire
    }

    // Inversion des octets de gpioBytes, puis conversion de chaque octet en binaire
    return Array.from(gpioBytes)
      .reverse()
      .map(byteToBinaryString)
      .join(' ')
  }

  sendGpioCommand (gpioBytes) {
    this.udpClient.send(gpioBytes, this.config.port, this.config.host, (err) => {
      if (err) {
        this.emit('sendError', err)
        this.log('error', `Error sending "Set GPIO" command: ${err}`)
      } else {
        this.log('info', 'Command "Set GPIO Command" sent successfully.')
      }
    })
  }

  /**
   * Détruit le gestionnaire de réseau.
   * @returns {void}
   */
  destroy () {
    if (this.sendGpioPingId) clearTimeout(this.sendGpioPingId)
    if (this.receptionWatcherId) clearTimeout(this.receptionWatcherId)
    if (this.udpClient) {
      this.udpClient.close()
      delete this.udpClient
    }
  }
}

module.exports = NetworkManager
