/**
 * Ce fichier définit les actions pour contrôler les bits GPIO d'un périphérique via UDP.
 * Il permet d'envoyer des impulsions, d'activer (UP) ou de désactiver (DOWN) des bits GPIO spécifiques.
 *
 * Modules requis :
 * - Buffer (natif de Node.js)
 * - UDP (supposé être importé ailleurs dans le code)
 * - ./protocol (helpers purs du protocole UDP/GPIO)
 */

const { buildImpulseFrames, buildInpFrame, encodeBit, IMPULSE_DELAY_MS } = require('./protocol')

/**
 * Fonction principale qui définit et configure les actions pour le contrôle des GPIO.
 * Cette fonction est exportée et sera appelée lors de l'initialisation du module.
 *
 * @returns {void}
 */
module.exports = function () {
  const actionDefinitions = {}

  for (let i = 0; i < 32; i++) {
    /**
     * Action pour envoyer une impulsion à un bit GPIO spécifique.
     * Cette action envoie d'abord un signal UP, attend un court délai, puis envoie un signal DOWN.
     *
     * @type {Object}
     * @property {string} name - Le nom de l'action
     * @property {Array} options - Les options de l'action (vide dans ce cas)
     * @property {Function} callback - La fonction de rappel asynchrone exécutée lors de l'appel de l'action
     */
    actionDefinitions[`impulse${i + 1}`] = {
      name: `Imp${String(i + 1).padStart(2, '0')}`,
      options: [],
      callback: async () => {
        const { up, down } = buildImpulseFrames(i + 1)
        const gpioBytesUp = up.subarray(3, 7)

        this.networkManager.sendGpioCommand(up)
        setTimeout(() => {
          this.networkManager.sendGpioCommand(down)
        }, IMPULSE_DELAY_MS)
        this.log(
          'info',
          `"Set GPIO bit ${i + 1} UP" sent to ${this.config.host}:${this.config.port} (GPIO=${this.byteToBinaryString(gpioBytesUp)})`
        )
      }
    }

    /**
     * Action pour activer (mettre à l'état haut) un bit GPIO spécifique.
     *
     * @type {Object}
     * @property {string} name - Le nom de l'action
     * @property {Array} options - Les options de l'action (vide dans ce cas)
     * @property {Function} callback - La fonction de rappel asynchrone exécutée lors de l'appel de l'action
     */
    actionDefinitions[`up${i + 1}`] = {
      name: `Set${String(i + 1).padStart(2, '0')}`,
      options: [],
      callback: async () => {
        const gpioBytesUp = encodeBit(i + 1)
        const msgUp = buildInpFrame(gpioBytesUp, encodeBit(i + 1))

        this.networkManager.sendGpioCommand(msgUp)
        this.log(
          'info',
          `"Set GPIO bit ${i + 1} UP" sent to ${this.config.host}:${this.config.port} (GPIO=${this.byteToBinaryString(gpioBytesUp)})`
        )
      }
    }

    /**
     * Action pour désactiver (mettre à l'état bas) un bit GPIO spécifique.
     *
     * @type {Object}
     * @property {string} name - Le nom de l'action
     * @property {Array} options - Les options de l'action (vide dans ce cas)
     * @property {Function} callback - La fonction de rappel asynchrone exécutée lors de l'appel de l'action
     */
    actionDefinitions[`down${i + 1}`] = {
      name: `Raz${String(i + 1).padStart(2, '0')}`,
      options: [],
      callback: async () => {
        const gpioBytesDown = Buffer.alloc(4)
        const msgDown = buildInpFrame(gpioBytesDown, encodeBit(i + 1))

        this.networkManager.sendGpioCommand(msgDown)
        this.log(
          'info',
          `"Set GPIO bit ${i + 1} DOWN" sent to ${this.config.host}:${this.config.port} (GPIO=${this.byteToBinaryString(gpioBytesDown)})`
        )
      }
    }
  }

  /**
   * Définit les actions configurées pour être utilisées par le système.
   */
  this.setActionDefinitions(actionDefinitions)
}

