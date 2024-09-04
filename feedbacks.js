/**
 * @file feedbacks.js
 * @description Ce fichier définit les feedbacks pour les états des bits GPIO via UDP, permettant de changer la couleur de fond en fonction de l'état du bit.
 *
 * @function
 * @description Génère 32 feedbacks pour les états des bits GPIO, changeant la couleur de fond en vert si le bit est activé et en rouge si le bit est désactivé.
 *
 * @typedef {Object} FeedbackDefinition
 * @property {string} type - Type de feedback (par exemple, 'advanced').
 * @property {string} name - Nom du feedback.
 * @property {string} description - Description du feedback.
 * @property {Array} options - Options du feedback.
 * @property {string} options.type - Type de l'option (par exemple, 'colorpicker').
 * @property {string} options.label - Étiquette de l'option.
 * @property {string} options.id - Identifiant de l'option.
 * @property {string} options.default - Valeur par défaut de l'option.
 * @property {Function} callback - Fonction de rappel exécutée pour déterminer la couleur de fond en fonction de l'état du bit GPIO.
 *
 * @callback FeedbackCallback
 * @description Fonction de rappel pour vérifier l'état d'un bit GPIO et retourner la couleur de fond appropriée.
 *
 * @requires this.colors
 * @requires this.gpioBytes
 * @requires this.setFeedbackDefinitions
 */

module.exports = async function () {
  const feedbackDefinitions = {}

  for (let i = 0; i < 32; i++) {
    feedbackDefinitions[`gpio_state_bit_${i + 1}`] = {
      type: 'advanced',
      name: `GPIO state bit ${i + 1}`,
      description: `If GPIO state bit ${i + 1} is on, change the background color to green, else change to red`,
      options: [
        {
          type: 'colorpicker',
          label: 'Background color red (off)',
          id: 'colorRed',
          default: this.colors.red
        },
        {
          type: 'colorpicker',
          label: 'Background color green (on)',
          id: 'colorGreen',
          default: this.colors.green
        }
      ],
      callback: (event) => {
        // Récupérer l'octet correspondant et le bit dans this.gpioBytes
        const byteIndex = Math.floor(i / 8) // Index de l'octet dans gpioBytes (0 à 3)
        const bitIndex = i % 8 // Position du bit dans l'octet (0 à 7)

        // Vérifier si le bit est activé (1) ou désactivé (0)
        const isBitOn = (this.gpioBytes[byteIndex] & (1 << bitIndex)) !== 0

        if (isBitOn) {
          return { bgcolor: event.options.colorGreen } // Si le bit est à 1, couleur verte
        } else {
          return { bgcolor: event.options.colorRed } // Si le bit est à 0, couleur rouge
        }
      }
    }
  }

  // Définir tous les feedbacks générés
  this.setFeedbackDefinitions(feedbackDefinitions)
}
