/**
 * Ce fichier définit les actions pour contrôler les bits GPIO d'un périphérique via UDP.
 * Il permet d'envoyer des impulsions, d'activer (UP) ou de désactiver (DOWN) des bits GPIO spécifiques.
 *
 * Modules requis :
 * - Buffer (natif de Node.js)
 * - ./protocol (helpers purs du protocole UDP/GPIO)
 */

import { buildImpulseFrames, buildInpFrame, bytesToBinaryString, encodeBit, IMPULSE_DELAY_MS } from './protocol.js'

/**
 * Fonction principale qui définit et configure les actions pour le contrôle des GPIO.
 * Cette fonction est exportée et sera appelée lors de l'initialisation du module.
 * Les DOWN différés des impulsions sont suivis dans `this.impulseTimers` pour être annulés à l'arrêt.
 *
 * @returns {void}
 */
export default function () {
	const actionDefinitions = {}

	for (let i = 0; i < 32; i++) {
		const bit = i + 1
		const label = `GPIO ${String(bit).padStart(2, '0')}`

		/**
		 * Action pour envoyer une impulsion à un bit GPIO spécifique.
		 * Cette action envoie d'abord un signal UP, attend IMPULSE_DELAY_MS, puis envoie un signal DOWN.
		 *
		 * @type {Object}
		 * @property {string} name - Le nom de l'action
		 * @property {string} description - La description de l'action
		 * @property {Array} options - Les options de l'action (vide dans ce cas)
		 * @property {Function} callback - La fonction de rappel asynchrone exécutée lors de l'appel de l'action
		 */
		actionDefinitions[`impulse${bit}`] = {
			name: `${label} pulse (${IMPULSE_DELAY_MS} ms)`,
			description: `Sets GPIO ${bit} on, then off after ${IMPULSE_DELAY_MS} ms. Other GPIOs are left unchanged.`,
			options: [],
			callback: async () => {
				const { up, down } = buildImpulseFrames(bit)
				const gpioBytesUp = up.subarray(3, 7)

				this.networkManager.sendGpioCommand(up)
				const timer = setTimeout(() => {
					this.impulseTimers.delete(timer)
					this.networkManager.sendGpioCommand(down)
				}, IMPULSE_DELAY_MS)
				this.impulseTimers.add(timer)
				this.log(
					'info',
					`"Set GPIO bit ${bit} UP" sent to ${this.config.host}:${this.config.port} (GPIO=${bytesToBinaryString(gpioBytesUp)})`,
				)
			},
		}

		/**
		 * Action pour activer (mettre à l'état haut) un bit GPIO spécifique.
		 *
		 * @type {Object}
		 * @property {string} name - Le nom de l'action
		 * @property {string} description - La description de l'action
		 * @property {Array} options - Les options de l'action (vide dans ce cas)
		 * @property {Function} callback - La fonction de rappel asynchrone exécutée lors de l'appel de l'action
		 */
		actionDefinitions[`up${bit}`] = {
			name: `${label} set on`,
			description: `Sets GPIO ${bit} on and keeps it on. Other GPIOs are left unchanged.`,
			options: [],
			callback: async () => {
				const gpioBytesUp = encodeBit(bit)
				const msgUp = buildInpFrame(gpioBytesUp, encodeBit(bit))

				this.networkManager.sendGpioCommand(msgUp)
				this.log(
					'info',
					`"Set GPIO bit ${bit} UP" sent to ${this.config.host}:${this.config.port} (GPIO=${bytesToBinaryString(gpioBytesUp)})`,
				)
			},
		}

		/**
		 * Action pour désactiver (mettre à l'état bas) un bit GPIO spécifique.
		 *
		 * @type {Object}
		 * @property {string} name - Le nom de l'action
		 * @property {string} description - La description de l'action
		 * @property {Array} options - Les options de l'action (vide dans ce cas)
		 * @property {Function} callback - La fonction de rappel asynchrone exécutée lors de l'appel de l'action
		 */
		actionDefinitions[`down${bit}`] = {
			name: `${label} set off`,
			description: `Sets GPIO ${bit} off. Other GPIOs are left unchanged.`,
			options: [],
			callback: async () => {
				const gpioBytesDown = Buffer.alloc(4)
				const msgDown = buildInpFrame(gpioBytesDown, encodeBit(bit))

				this.networkManager.sendGpioCommand(msgDown)
				this.log(
					'info',
					`"Set GPIO bit ${bit} DOWN" sent to ${this.config.host}:${this.config.port} (GPIO=${bytesToBinaryString(gpioBytesDown)})`,
				)
			},
		}
	}

	/**
	 * Définit les actions configurées pour être utilisées par le système.
	 */
	this.setActionDefinitions(actionDefinitions)
}
