/**
 * Ce fichier définit les feedbacks pour 32 bits GPIO.
 * Il génère dynamiquement des définitions de feedback pour chaque bit GPIO,
 * permettant de changer la couleur de fond en fonction de l'état du bit.
 */

/**
 * Fonction asynchrone qui définit les feedbacks pour les états des GPIO.
 * Cette fonction est exportée et sera probablement appelée lors de l'initialisation du module.
 *
 * @returns {Promise<void>}
 */
export default async function () {
  const feedbackDefinitions = {}

  /**
   * Génère les définitions de feedback pour les 32 bits GPIO
   */
  for (let i = 0; i < 32; i++) {
    /**
     * Définition d'un feedback pour un bit GPIO spécifique
     *
     * @type {Object}
     * @property {string} type - Le type de feedback (avancé dans ce cas)
     * @property {string} name - Le nom descriptif du feedback
     * @property {string} description - La description du comportement du feedback
     * @property {Array<string>} affectedProperties - Les propriétés de style modifiées (API 2.x)
     * @property {Array} options - Les options configurables du feedback
     * @property {Function} callback - La fonction de rappel qui détermine l'état du feedback
     */
    feedbackDefinitions[`gpio_state_bit_${i + 1}`] = {
      type: 'advanced',
      name: `Gpio${String(i + 1).padStart(2, '0')}`,
      description: `indicates the state of output ${i + 1} (0 deactivated, 1 activated)`,
      affectedProperties: ['bgcolor'],
      options: [
        {
          type: 'colorpicker',
          label: 'Couleur de fond rouge (désactivé)',
          id: 'colorOff',
          default: this.colors.red
        },
        {
          type: 'colorpicker',
          label: 'Couleur de fond vert (activé)',
          id: 'colorOn',
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
          return { bgcolor: event.options.colorOn } // Si le bit est à 1, couleur verte
        } else {
          return { bgcolor: event.options.colorOff } // Si le bit est à 0, couleur rouge
        }
      }
    }
  }

  /**
   * Définit tous les feedbacks générés pour être utilisés par le système
   */
  this.setFeedbackDefinitions(feedbackDefinitions)
}
