/**
 * @file presets.js
 * @description Ce fichier génère et définit les presets pour les actions "impulse" et "tow states" pour les bits GPIO via UDP.
 *
 * @function
 * @description Génère 32 presets pour les actions "impulse" et 32 presets pour les actions "tow states", puis les enregistre dans le module.
 *
 * @typedef {Object} PresetDefinition
 * @property {string} type - Type de l'élément de preset (par exemple, 'button').
 * @property {string} category - Catégorie du preset.
 * @property {string} name - Nom du preset.
 * @property {Object} style - Style du bouton de preset.
 * @property {string} style.text - Texte affiché sur le bouton.
 * @property {number} style.size - Taille du texte.
 * @property {string} style.color - Couleur du texte.
 * @property {string} style.bgcolor - Couleur de fond du bouton.
 * @property {Array} steps - Étapes de l'action du bouton.
 * @property {Array} steps.down - Actions à exécuter lors de l'appui sur le bouton.
 * @property {Array} steps.up - Actions à exécuter lors du relâchement du bouton.
 * @property {Array} feedbacks - Feedbacks associés au bouton.
 * @property {string} feedbacks.feedbackId - Identifiant du feedback.
 * @property {Object} feedbacks.options - Options de feedback.
 * @property {string} feedbacks.options.colorRed - Couleur rouge pour le feedback.
 * @property {string} feedbacks.options.colorGreen - Couleur verte pour le feedback.
 *
 * @requires this.setPresetDefinitions
 * @requires this.colors
 */

module.exports = function () {
  const presetDefinitions = {}

  // Générer 32 presets pour les actions "impulse"
  for (let i = 0; i < 32; i++) {
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
            colorRed: this.colors.red,
            colorGreen: this.colors.green
          }
        }
      ]
    }
  }

  // Générer 32 presets pour les actions "Tow states"
  for (let i = 0; i < 32; i++) {
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
            colorRed: this.colors.red,
            colorGreen: this.colors.green
          }
        }
      ]
    }
  }

  // Définir tous les presets générés
  this.setPresetDefinitions(presetDefinitions)
}
