/**
 * Ce fichier définit les actions pour contrôler les bits GPIO d'un périphérique via UDP.
 * Il permet d'envoyer des impulsions, d'activer (UP) ou de désactiver (DOWN) des bits GPIO spécifiques.
 *
 * Modules requis :
 * - Buffer (natif de Node.js)
 * - UDP (supposé être importé ailleurs dans le code)
 */

const impulseDelay = 100 // Délai entre l'impulsion UP et l'impulsion DOWN

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
        // Calculer dans quel octet et quel bit se situe la commande
        const gpioBytesUp = Buffer.alloc(4) // 4 octets pour les GPIO (32 bits)
        gpioBytesUp[Math.floor(i / 8)] = 1 << (i % 8) // Positionner le bit correspondant à '1'

        const maskBytes = Buffer.alloc(4) // 4 octets pour le masque
        maskBytes[Math.floor(i / 8)] = 1 << (i % 8) // Masquer uniquement le bit correspondant

        const reservedBytes = Buffer.from([0, 0]) // Octets réservés

        // Crée le message "Set GPIO" avec l'en-tête, les GPIO et le masque
        const msgUp = Buffer.concat([this.setGpioHeader, gpioBytesUp, maskBytes, reservedBytes])

        // send UP
        this.udpClient.send(msgUp, this.config.port, this.config.host, (err) => {
          if (err) {
            this.log('error', `Error sending UDP message: ${err}`)
          } else {
            const gpioBytesDown = Buffer.alloc(4) // Tous les bits à '0' pour DOWN
            const msgDown = Buffer.concat([this.setGpioHeader, gpioBytesDown, maskBytes, reservedBytes])

            setTimeout(() => {
              // send DOWN
              this.udpClient.send(msgDown, this.config.port, this.config.host, (err) => {
                if (err) {
                  this.log('error', `Error sending UDP message: ${err}`)
                } else {
                  this.log(
                    'info',
                    `"Set GPIO bit ${i + 1} DOWN" sent to ${this.config.host}:${this.config.port} (GPIO=${this.byteToBinaryString(gpioBytesDown)})`
                  )
                }
              })
            }, impulseDelay)

            this.log(
              'info',
              `"Set GPIO bit ${i + 1} UP" sent to ${this.config.host}:${this.config.port} (GPIO=${this.byteToBinaryString(gpioBytesUp)})`
            )
          }
        })
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
        // Calculer dans quel octet et quel bit se situe la commande
        const gpioBytesUp = Buffer.alloc(4) // 4 octets pour les GPIO (32 bits)
        gpioBytesUp[Math.floor(i / 8)] = 1 << (i % 8) // Positionner le bit correspondant à '1'

        const maskBytes = Buffer.alloc(4) // 4 octets pour le masque
        maskBytes[Math.floor(i / 8)] = 1 << (i % 8) // Masquer uniquement le bit correspondant

        const reservedBytes = Buffer.from([0, 0]) // Octets réservés

        // Crée le message "Set GPIO" avec l'en-tête, les GPIO et le masque
        const msgUp = Buffer.concat([this.setGpioHeader, gpioBytesUp, maskBytes, reservedBytes])

        // send UP
        this.udpClient.send(msgUp, this.config.port, this.config.host, (err) => {
          if (err) {
            this.log('error', `Error sending UDP message: ${err}`)
          } else {
            // relance du ping
            this.log(
              'info',
              `"Set GPIO bit ${i + 1} UP" sent to ${this.config.host}:${this.config.port} (GPIO=${this.byteToBinaryString(gpioBytesUp)})`
            )
          }
        })
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
        // Calculer dans quel octet et quel bit se situe la commande
        const gpioBytesDown = Buffer.alloc(4) // 4 octets pour les GPIO (32 bits)

        const maskBytes = Buffer.alloc(4) // 4 octets pour le masque
        maskBytes[Math.floor(i / 8)] = 1 << (i % 8) // Masquer uniquement le bit correspondant

        const reservedBytes = Buffer.from([0, 0]) // Octets réservés

        // Crée le message "Set GPIO" avec l'en-tête, les GPIO et le masque
        const msgDown = Buffer.concat([this.setGpioHeader, gpioBytesDown, maskBytes, reservedBytes])

        // send DOWN
        this.udpClient.send(msgDown, this.config.port, this.config.host, (err) => {
          if (err) {
            this.log('error', `Error sending UDP message: ${err}`)
          } else {
            this.log(
              'info',
              `"Set GPIO bit ${i + 1} DOWN" sent to ${this.config.host}:${this.config.port} (GPIO=${this.byteToBinaryString(gpioBytesDown)})`
            )
          }
        })
      }
    }
  }

  /**
   * Définit les actions configurées pour être utilisées par le système.
   */
  this.setActionDefinitions(actionDefinitions)
}

