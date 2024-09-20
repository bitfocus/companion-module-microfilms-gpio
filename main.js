/**
 * @file main.js
 * @description Ce fichier contient la définition de la classe ModuleInstance ainsi que des fonctions utilitaires pour la gestion des GPIO via UDP.
 *
 * @requires @companion-module/base
 * @requires dgram
 * @requires ./upgrades
 * @requires ./actions
 * @requires ./feedbacks
 * @requires ./presets
 * @requires ./variables
 *
 * @class ModuleInstance
 * @extends InstanceBase
 *
 * @function gpioBytesToBinaryString
 * @description Convertit un tableau d'octets GPIO en une chaîne binaire.
 *
 * @function ModuleInstance#init
 * @description Initialise le module avec la configuration donnée, configure les actions, feedbacks, presets, variables et la connexion UDP.
 *
 * @function ModuleInstance#configureReception
 * @description Prépare la réception des données UDP et gère les messages entrants.
 *
 * @function ModuleInstance#receptionWatcher
 * @description Surveille la réception des réponses du serveur et met à jour le statut en conséquence.
 *
 * @function ModuleInstance#sendGpioPing
 * @description Envoie périodiquement des pings GPIO au serveur pour maintenir la connexion.
 *
 * @function ModuleInstance#destroy
 * @description Nettoie les ressources lors de la suppression du module.
 *
 * @function ModuleInstance#configUpdated
 * @description Met à jour la configuration du module et reconfigure la réception.
 *
 * @function ModuleInstance#getConfigFields
 * @description Retourne les champs de configuration pour l'interface web.
 */

const {
  InstanceBase,
  Regex,
  runEntrypoint,
  InstanceStatus,
  combineRgb
} = require('@companion-module/base')

const dgram = require('dgram')

const UpgradeScripts = require('./upgrades')
const initActions = require('./actions')
const initFeedbacks = require('./feedbacks')
const initPresets = require('./presets')
const initVariables = require('./variables')

const setGpioHeader = Buffer.from('INP') // En-tête pour la commande "Set GPIO"

// Données pour la commande "Set GPIO" (ping)
const ping = {
  message: Buffer.concat([
    setGpioHeader,
    Buffer.from([0, 0, 0, 0]),
    Buffer.from([0, 0, 0, 0]),
    Buffer.from([0, 0])
  ]),
  interval: 500
}

const receptionWatcherIntervall = 3000

// Fonction pour convertir un octet en une chaîne binaire de 8 bits
function gpioBytesToBinaryString (gpioBytes) {
  function byteToBinaryString (byte) {
    return byte.toString(2).padStart(8, '0') // Conversion en binaire et ajout de zéros à gauche si nécessaire
  }

  // Inversion des octets de gpioBytes, puis conversion de chaque octet en binaire
  return Array.from(gpioBytes)
    .reverse() // Inverser les octets
    .map(byteToBinaryString) // Convertir chaque octet en binaire
    .join(' ') // Joindre les résultats en une seule chaîne
}

// Définition de la classe ModuleInstance
class ModuleInstance extends InstanceBase {
  constructor (internal) {
    super(internal)
  }

  // Initialisation du module avec la configuration donnée
  async init (config) {
    this.updateStatus(InstanceStatus.Connecting)
    this.config = config
    // Couleurs prédéfinies pour les feedbacks
    this.colors = {
      white: combineRgb(255, 255, 255),
      black: combineRgb(0, 0, 0),
      green: combineRgb(0, 200, 0),
      red: combineRgb(200, 0, 0)
    }

    initActions.bind(this)() // export actions
    initFeedbacks.bind(this)() // export feedbacks
    initPresets.bind(this)() // export presets
    initVariables.bind(this)() // export variables

    this.setGpioHeader = setGpioHeader // En-tête pour la commande "Set GPIO"
    this.gpioBytes = Buffer.from([0, 0, 0, 0]) // Valeur GPIO à envoyer
    this.byteToBinaryString = gpioBytesToBinaryString // Fonction pour convertir un octet en une chaîne binaire de 8 bits

    // Configuration connexion par défaut
    this.config.port = this.config.port || 7770 // Port par défaut
    this.config.host = this.config.host || '192.168.10.10' // Adresse IP par défaut

    // Préparation à la réception des données
    this.configureReception()

    // Mise en place d'un ping pour vérifier la connexion
    this.sendGpioPingId = null // ID du ping en cours
    this.waitingForStatusResponse = false // Indique si on attend une réponse du serveur
    this.sendGpioPing() // départ des pings

    // Mise en place d’une surveillance de communication
    this.receptionWatcherId = null // ID du watcher en cours
    this.receptionWatcher()

    // Module initialisé
    this.log('info', 'Microfilms GPIO started!') // Ajout du message "hello, world!" dans les logs
  }

  // Préparation à la réception des données
  configureReception () {
    // on supprime la connexion UDP existante
    if (this.udpClient) {
      this.udpClient.close()
      delete this.udpClient
    }

    // on crée une nouvelle connexion UDP
    this.udpClient = dgram.createSocket('udp4')

    // Écoute la réponse "Status" du serveur
    this.udpClient.on('message', (msg, rinfo) => {
      // Vérification de l'en-tête 'OUT'
      const header = msg.subarray(0, 3).toString()
      if (header === 'OUT') {
        this.gpioBytes = msg.subarray(3, 7)
        this.setVariableValues({ gpio: this.gpioBytes.readUInt32LE(0) })
        for (let i = 0; i < 32; i++) {
          const byteIndex = Math.floor(i / 8) // Indice de l'octet
          const bitIndex = i % 8 // Position du bit dans l'octet
          const bitValue = (this.gpioBytes[byteIndex] & (1 << bitIndex)) !== 0 ? 1 : 0

          // Mettre à jour la variable correspondante (state1, state2, ..., state32)
          this.setVariableValues({ [`state${i + 1}`]: bitValue })
          // Mettre à jour les feedbacks correspondants (gpio_state_bit_1, gpio_state_bit_2, ..., gpio_state_bit_32)
          this.checkFeedbacks(`gpio_state_bit_${i + 1}`)
        }
        clearTimeout(this.receptionWatcherId) // on arrête le watcher
        this.waitingForStatusResponse = false
        this.updateStatus(InstanceStatus.Ok)
        this.log('info', `"Status" response from ${rinfo.address}:${rinfo.port} (GPIO=${this.byteToBinaryString(this.gpioBytes)})`)
      } else {
        this.updateStatus(InstanceStatus.ConnectionFailure)
        this.log('error', 'Incorrect header in "Status" response')
      }
    })
  }

  // Surveillance de la réception
  receptionWatcher () {
    this.receptionWatcherId = setTimeout(() => {
      if (this.waitingForStatusResponse) {
        this.updateStatus(InstanceStatus.Disconnected)
        this.waitingForStatusResponse = false
        this.log('error', `No response from server after '${receptionWatcherIntervall / 1000}' seconds`)
      }
    }, receptionWatcherIntervall)
  }

  // Fonction récursive pour envoyer des pings à intervalle régulier
  sendGpioPing () {
    // Envoie le message "Set GPIO" au simulateur de robot
    this.log('info', this.waitingForStatusResponse)
    if (!this.waitingForStatusResponse) {
      this.udpClient.send(ping.message, this.config.port, this.config.host, (err) => {
        if (err) {
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
    }, ping.interval)
  }

  // Lorsque le module est supprimé
  async destroy () {
    this.log('debug', 'destroy')
  }

  // Lorsque la configuration est mise à jour
  async configUpdated (config) {
    this.config = config
    this.configureReception()
    this.log('info', 'Config updated')
  }

  // Retourne les champs de configuration pour la configuration web
  getConfigFields () {
    return [
      {
        type: 'textinput',
        id: 'host',
        label: 'Target IP',
        width: 8,
        regex: Regex.IP
      },
      {
        type: 'textinput',
        id: 'port',
        label: 'Target Port',
        width: 4,
        regex: Regex.PORT
      }
    ]
  }
}

runEntrypoint(ModuleInstance, UpgradeScripts)
