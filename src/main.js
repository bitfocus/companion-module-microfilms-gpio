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
 * @requires ./protocol
 *
 * @description
 * Ce module initialise et gère les connexions réseau pour contrôler les GPIO,
 * en écoutant les événements et en mettant à jour les variables et les feedbacks en conséquence.
 */

import { InstanceBase, Regex, InstanceStatus, combineRgb } from '@companion-module/base'

import { UpgradeScripts } from './upgrades.js'
import initActions from './actions.js'
import initFeedbacks from './feedbacks.js'
import initPresets from './presets.js'
import initVariables from './variables.js'
import NetworkManager from './network.js'
import { bytesToBinaryString } from './protocol.js'

/** Adresse IP du robot utilisée si le champ de configuration est vide. */
const DEFAULT_HOST = '192.168.10.10'

/** Port UDP du robot utilisé si le champ de configuration est vide. */
const DEFAULT_PORT = 7770

/** Nombre de bits GPIO gérés par le module. */
const GPIO_COUNT = 32

/** Identifiants des feedbacks GPIO, rechargés à chaque changement d'état. */
const FEEDBACK_IDS = Array.from({ length: GPIO_COUNT }, (_, i) => `gpio_state_bit_${i + 1}`)

/**
 * Classe représentant une instance de module.
 * @extends InstanceBase
 */
class ModuleInstance extends InstanceBase {
	/**
	 * Crée une instance de ModuleInstance.
	 * @param {Object} internal - L'objet interne.
	 */
	constructor(internal) {
		super(internal)
	}

	/**
	 * Initialise le module avec la configuration donnée.
	 * Signature API 2.x : Companion passe aussi isFirstInit (premier démarrage de l'instance)
	 * et secrets (secrets de l'instance), non utilisés ici.
	 * @param {Object} config - La configuration du module.
	 * @returns {Promise<void>}
	 */
	// eslint-disable-next-line no-unused-vars
	async init(config, isFirstInit, secrets) {
		// Couleurs prédéfinies pour les feedbacks
		this.colors = {
			white: combineRgb(255, 255, 255),
			black: combineRgb(0, 0, 0),
			green: combineRgb(0, 200, 0),
			red: combineRgb(200, 0, 0),
		}

		this.setGpioHeader = Buffer.from('INP')
		this.gpioBytes = Buffer.alloc(4) // Dernier état GPIO connu (lu par les feedbacks)
		this.lastGpioBytes = null // Dernier état publié dans les variables et feedbacks
		this.impulseTimers = new Map() // DOWN différés des impulsions en attente (timer → trame DOWN)

		initActions.call(this) // export actions
		initFeedbacks.call(this) // export feedbacks
		initPresets.call(this) // export presets
		initVariables.call(this) // export variables

		this.createNetworkManager(config)

		// Module initialisé
		this.log('info', 'Microfilms GPIO started!')
	}

	/**
	 * Remplace le NetworkManager courant par un nouveau, construit sur la configuration donnée
	 * (défauts appliqués aux champs vides), et y branche les handlers d'événements.
	 * L'état publié est oublié pour que le premier statut reçu soit republié.
	 * @param {Object} config - La configuration du module.
	 * @returns {void}
	 */
	createNetworkManager(config) {
		if (this.networkManager) {
			this.networkManager.removeAllListeners()
			this.networkManager.destroy()
		}

		this.config = {
			...config,
			host: config?.host || DEFAULT_HOST,
			port: Number(config?.port) || DEFAULT_PORT,
		}
		this.lastGpioBytes = null
		this.updateStatus(InstanceStatus.Connecting)

		const networkManager = new NetworkManager(this.config, this.log.bind(this), this.setGpioHeader, this.gpioBytes)

		networkManager.on('gpioStatus', (gpioBytes) => {
			this.handleGpioStatus(gpioBytes)
		})

		networkManager.on('connectionFailure', (error) => {
			this.log('error', `Connection failure: ${error}`)
			this.updateStatus(InstanceStatus.ConnectionFailure)
		})

		networkManager.on('noResponse', (message) => {
			this.log('error', `No response: ${message}`)
			this.updateStatus(InstanceStatus.Disconnected)
		})

		networkManager.on('sendError', (error) => {
			this.log('error', `Error sending "Set GPIO" command: ${error}`)
		})

		this.networkManager = networkManager
	}

	/**
	 * Traite une réponse "Status" : statut Ok à chaque réponse, puis publication groupée
	 * des variables `01`…`32` et `Full` et recheck des feedbacks si l'état GPIO a changé.
	 * @param {Buffer} gpioBytes - Les 4 octets GPIO reçus (Little Endian).
	 * @returns {void}
	 */
	handleGpioStatus(gpioBytes) {
		this.updateStatus(InstanceStatus.Ok)
		if (this.lastGpioBytes?.equals(gpioBytes)) {
			return
		}

		this.gpioBytes = Buffer.from(gpioBytes)
		this.lastGpioBytes = this.gpioBytes

		const values = { Full: this.gpioBytes.readUInt32LE(0) }
		for (let i = 0; i < GPIO_COUNT; i++) {
			const bitValue = (this.gpioBytes[Math.floor(i / 8)] & (1 << (i % 8))) !== 0 ? 1 : 0
			values[String(i + 1).padStart(2, '0')] = bitValue
		}
		this.setVariableValues(values)
		this.checkFeedbacks(...FEEDBACK_IDS)
		this.log('info', `GPIO status changed (GPIO=${bytesToBinaryString(this.gpioBytes)})`)
	}

	/**
	 * Envoie sans attendre les DOWN différés des impulsions en attente, pour ne pas laisser
	 * un bit à 1 sur le robot, puis attend leur émission avant que le socket ne soit fermé.
	 * @returns {Promise<void>}
	 */
	async flushImpulseTimers() {
		if (!this.impulseTimers?.size) {
			return
		}
		const pending = []
		for (const [timer, down] of this.impulseTimers) {
			clearTimeout(timer)
			if (this.networkManager) {
				pending.push(this.networkManager.sendGpioCommand(down))
			}
		}
		this.impulseTimers.clear()
		if (pending.length > 0) {
			this.log('info', `Sent ${pending.length} pending pulse DOWN command(s) before stopping`)
		}
		await Promise.all(pending)
	}

	/**
	 * Détruit le module.
	 * @returns {Promise<void>}
	 */
	async destroy() {
		this.log('debug', 'destroy')
		await this.flushImpulseTimers()
		if (this.networkManager) {
			this.networkManager.removeAllListeners()
			this.networkManager.destroy()
			delete this.networkManager
		}
	}

	/**
	 * Met à jour la configuration du module et reconstruit le NetworkManager.
	 * @param {Object} config - La nouvelle configuration du module.
	 * @returns {Promise<void>}
	 */
	async configUpdated(config) {
		await this.flushImpulseTimers()
		this.createNetworkManager(config)
		this.log('info', 'Config updated')
	}

	/**
	 * Retourne les champs de configuration pour la configuration web.
	 * @returns {Array<Object>} Les champs de configuration.
	 */
	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Target IP',
				width: 8,
				regex: Regex.IP,
				default: DEFAULT_HOST,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Target Port',
				width: 4,
				regex: Regex.PORT,
				default: String(DEFAULT_PORT),
			},
		]
	}
}

// Entrypoint API 2.x : Companion importe ce fichier et lit `default` et `UpgradeScripts`.
export default ModuleInstance
export { UpgradeScripts }
