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
 *
 * @class ModuleInstance
 * @extends InstanceBase
 *
 * @function gpioBytesToBinaryString
 * @description Convertit un tableau d'octets GPIO en une chaîne binaire.
 *
 * @function ModuleInstance#init
 * @description Initialise le module avec la configuration donnée, configure les actions, feedbacks, presets et la connexion UDP.
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

function gpioBytesToBinaryString (gpioBytes) {
  // Fonction pour convertir un octet en une chaîne binaire de 8 bits
  function byteToBinaryString (byte) {
    return byte.toString(2).padStart(8, '0') // Conversion en binaire et ajout de zéros à gauche si nécessaire
  }

  // Inversion des octets de gpioBytes, puis conversion de chaque octet en binaire
  return Array.from(gpioBytes)
    .reverse() // Inverser les octets
    .map(byteToBinaryString) // Convertir chaque octet en binaire
    .join(' ') // Joindre les résultats en une seule chaîne
}

class ModuleInstance extends InstanceBase {
  constructor (internal) {
    super(internal)
  }

  async init (config) {
    this.config = config
    this.updateStatus(InstanceStatus.Ok)
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
    this.config.port = this.config.port || 5000 // Port par défaut
    this.config.host = this.config.host || '127.0.0.1' // Adresse IP par défaut
    this.configureUdp() // on configure la connexion UDP
    this.setGpioHeader = Buffer.from('INP') // En-tête pour la commande "Set GPIO"
    this.gpioBytes = Buffer.from([0, 0, 0, 0]) // Valeur GPIO à envoyer
    this.sendGpioPing() // Envoie une commande "Set GPIO" pour obtenir l'état actuel
    // Fonction pour convertir un octet en une chaîne binaire de 8 bits
    this.byteToBinaryString = gpioBytesToBinaryString
    this.log('info', 'Microfilms GPIO started!') // Ajout du message "hello, world!" dans les logs
  }

  configureUdp () {
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
        for (let i = 0; i < 32; i++) {
          this.checkFeedbacks(`gpio_state_bit_${i + 1}`)
        }
        this.log('info', `"Status" response from ${rinfo.address}:${rinfo.port} (GPIO=${this.byteToBinaryString(this.gpioBytes)})`)
      } else {
        this.log('error', 'Incorrect header in "Status" response')
      }
    })
  }

  sendGpioPing () {
    // Données pour la commande "Set GPIO"
    const gpioBytes = Buffer.from([0, 0, 0, 0]) // Valeur GPIO à envoyer
    const maskBytes = Buffer.from([0, 0, 0, 0]) // Masque pour modifier tous les GPIO
    // Crée le message "Set GPIO" avec l'en-tête, les GPIO et le masque
    const message = Buffer.concat([this.setGpioHeader, gpioBytes, maskBytes])
    // Envoie le message "Set GPIO" au simulateur de robot
    this.udpClient.send(message, this.config.port, this.config.host, (err) => {
      if (err) {
        this.log('error', `Error sending "Set GPIO" command: ${err}`)
      } else {
        this.log('info', 'Command "Set GPIO PING" sent successfully.')
      }
    })
  }

  // Lorsque le module est supprimé
  async destroy () {
    this.log('debug', 'destroy')
  }

  async configUpdated (config) {
    this.config = config
    this.configureUdp()
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
