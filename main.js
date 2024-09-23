/**
 * @fileoverview Ce fichier contient la définition de la classe ModuleInstance,
 * qui représente une instance de module pour la gestion des GPIO via un NetworkManager.
 *
 * @module ModuleInstance
 * @requires @companion-module/base
 * @requires ./upgrades
 * @requires ./actions
 * @requires ./feedbacks
 * @requires ./presets
 * @requires ./variables
 * @requires ./network
 *
 * @description
 * Ce module initialise et gère les connexions réseau pour contrôler les GPIO,
 * en écoutant les événements et en mettant à jour les variables et les feedbacks en conséquence.
 */

const {
  InstanceBase,
  Regex,
  runEntrypoint,
  InstanceStatus,
  combineRgb
} = require('@companion-module/base')

const UpgradeScripts = require('./upgrades')
const initActions = require('./actions')
const initFeedbacks = require('./feedbacks')
const initPresets = require('./presets')
const initVariables = require('./variables')
const NetworkManager = require('./network')

/**
 * Classe représentant une instance de module.
 * @extends InstanceBase
 */
class ModuleInstance extends InstanceBase {
  /**
   * Crée une instance de ModuleInstance.
   * @param {Object} internal - L'objet interne.
   */
  constructor (internal) {
    super(internal)
  }

  /**
   * Initialise le module avec la configuration donnée.
   * @param {Object} config - La configuration du module.
   * @returns {Promise<void>}
   */
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
    this.gpioBytes = Buffer.from([0, 0, 0, 0]) // Valeur GPIO à envoyer
    this.config.port = this.config.port || 7770 // Port par défaut
    this.config.host = this.config.host || '192.168.10.10' // Adresse IP par défaut

    // Initialiser le NetworkManager
    this.networkManager = new NetworkManager(this.config, this.log.bind(this))

    // Écouter les événements émis par le NetworkManager
    this.networkManager.on('gpioStatus', (gpioBytes) => {
      this.gpioBytes = gpioBytes
      this.setVariableValues({ gpio: this.gpioBytes.readUInt32LE(0) })
      for (let i = 0; i < 32; i++) {
        const byteIndex = Math.floor(i / 8) // Indice de l'octet
        const bitIndex = i % 8 // Position du bit dans l'octet
        const bitValue = (this.gpioBytes[byteIndex] & (1 << bitIndex)) !== 0 ? 1 : 0

        // Mettre à jour la variable correspondante (state1, state2, ..., state32)
        this.setVariableValues({ [`state${i + 1}`]: bitValue })
        // Mettre à jour les feedbacks correspondants
        // (gpio_state_bit_1, gpio_state_bit_2, ..., gpio_state_bit_32)
        this.checkFeedbacks(`gpio_state_bit_${i + 1}`)
      }
      this.updateStatus(InstanceStatus.Ok)
    })

    this.networkManager.on('connectionFailure', (error) => {
      this.log('error', `Connection failure: ${error}`)
      this.updateStatus(InstanceStatus.ConnectionFailure)
    })

    this.networkManager.on('noResponse', (message) => {
      this.log('error', `No response: ${message}`)
      this.updateStatus(InstanceStatus.Disconnected)
    })

    this.networkManager.on('sendError', (error) => {
      this.log('error', `Error sending "Set GPIO" command: ${error}`)
    })

    // Module initialisé
    this.log('info', 'Microfilms GPIO started!')
  }

  /**
   * Détruit le module.
   * @returns {Promise<void>}
   */
  async destroy () {
    this.log('debug', 'destroy')
    if (this.networkManager) {
      this.networkManager.destroy()
    }
  }

  /**
   * Met à jour la configuration du module.
   * @param {Object} config - La nouvelle configuration du module.
   * @returns {Promise<void>}
   */
  async configUpdated (config) {
    this.config = config
    // Mettre à jour le NetworkManager avec la nouvelle configuration
    if (this.networkManager) {
      this.networkManager.destroy()
    }
    this.networkManager = new NetworkManager(this.config, this.log.bind(this))
    this.log('info', 'Config updated')
  }

  /**
   * Retourne les champs de configuration pour la configuration web.
   * @returns {Array<Object>} Les champs de configuration.
   */
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
