/**
 * @file actions.js
 * @description Ce fichier définit les actions pour contrôler les bits GPIO via UDP, y compris les impulsions, les états UP et DOWN.
 *
 * @constant {number} impulseDelay - Délai entre l'impulsion UP et l'impulsion DOWN.
 *
 * @function
 * @description Définit les actions pour chaque bit GPIO (de 1 à 32) et les enregistre dans le module.
 *
 * @typedef {Object} ActionDefinition
 * @property {string} name - Nom de l'action.
 * @property {Array} options - Options de l'action.
 * @property {Function} callback - Fonction de rappel exécutée lors de l'action.
 *
 * @property {Object} actionDefinitions - Contient les définitions des actions pour chaque bit GPIO.
 *
 * @callback ActionCallback
 * @description Fonction de rappel pour envoyer les commandes UDP pour les états UP et DOWN des bits GPIO.
 *
 * @requires Buffer
 * @requires setTimeout
 * @requires this.udpClient
 * @requires this.config
 * @requires this.setGpioHeader
 * @requires this.byteToBinaryString
 * @requires this.log
 */

const impulseDelay = 100 // Délai entre l'impulsion UP et l'impulsion DOWN

module.exports = function () {
  const actionDefinitions = {}

  for (let i = 0; i < 32; i++) {
    // Impulses to GPIO bits
    actionDefinitions[`impulse${i + 1}`] = {
      name: `Impulse to GPIO bit ${i + 1}`,
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

    // UP state to GPIO bits
    actionDefinitions[`up${i + 1}`] = {
      name: `Up state to GPIO bit ${i + 1}`,
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

    // DOWN state to GPIO bits
    actionDefinitions[`down${i + 1}`] = {
      name: `Down state to GPIO bit ${i + 1}`,
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

  this.setActionDefinitions(actionDefinitions)
}

