/**
 * Ce fichier définit les préréglages (presets) pour les actions "impulse" et "two states" sur 32 bits GPIO.
 * Il génère des boutons pour chaque bit, avec des styles et des actions prédéfinis.
 */

/**
 * Fonction principale qui génère et définit les préréglages pour les actions GPIO.
 * Cette fonction est exportée et sera probablement appelée lors de l'initialisation du module.
 *
 * @returns {void}
 */
module.exports = function () {
  const presetDefinitions = {}

  /**
   * Génère 32 préréglages pour les actions "impulse"
   */
  for (let i = 0; i < 32; i++) {
    /**
     * Définition d'un préréglage pour une action "impulse" sur un bit GPIO spécifique
     *
     * @type {Object}
     * @property {string} type - Le type de préréglage (bouton dans ce cas)
     * @property {string} category - La catégorie du préréglage
     * @property {string} name - Le nom du préréglage
     * @property {Object} style - Le style visuel du bouton
     * @property {Array} steps - Les étapes d'action du bouton (appui et relâchement)
     * @property {Array} feedbacks - Les retours visuels basés sur l'état du GPIO
     */
    presetDefinitions[`impulse${i + 1}`] = {
      type: 'button',
      category: 'Divers',
      name: `Impulse ${i + 1} button`,
      style: {
        text: `IMP ${i + 1}`,
        size: 12,
        color: this.colors.white,
        bgcolor: this.colors.black
      },
      steps: [
        {
          down: [
            {
              actionId: `impulse${i + 1}`
            }
          ],
          up: []
        }
      ],
      feedbacks: [
        {
          feedbackId: `gpio_state_bit_${i + 1}`,
          options: {
            colorOff: this.colors.black,
            colorOn: this.colors.green
          }
        }
      ]
    }
  }

  /**
   * Génère 32 préréglages pour les actions "Two states"
   */
  for (let i = 0; i < 32; i++) {
    /**
     * Définition d'un préréglage pour une action "Two states" sur un bit GPIO spécifique
     *
     * @type {Object}
     * @property {string} type - Le type de préréglage (bouton dans ce cas)
     * @property {string} category - La catégorie du préréglage
     * @property {string} name - Le nom du préréglage
     * @property {Object} style - Le style visuel du bouton
     * @property {Array} steps - Les étapes d'action du bouton (appui et relâchement)
     * @property {Array} feedbacks - Les retours visuels basés sur l'état du GPIO
     */
    presetDefinitions[`towStates${i + 1}`] = {
      type: 'button',
      category: 'Divers',
      name: `Tow states ${i + 1} button`,
      style: {
        text: `TS ${i + 1}`,
        size: 12,
        color: this.colors.white,
        bgcolor: this.colors.black
      },
      steps: [
        {
          down: [
            {
              actionId: `up${i + 1}`
            }
          ],
          up: [
            {
              actionId: `down${i + 1}`
            }
          ]
        }
      ],
      feedbacks: [
        {
          feedbackId: `gpio_state_bit_${i + 1}`,
          options: {
            colorOff: this.colors.black,
            colorOn: this.colors.green
          }
        }
      ]
    }
  }

  /**
   * Définit tous les préréglages générés pour être utilisés par le système
   */
  this.setPresetDefinitions(presetDefinitions)
}
