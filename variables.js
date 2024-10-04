/**
 * Ce fichier définit les variables d'état pour 32 bits GPIO et une variable pour l'état global des GPIO.
 * Il génère dynamiquement les définitions de variables pour chaque bit GPIO et une variable supplémentaire
 * pour représenter l'état complet des GPIO en format Little Endian.
 */

/**
 * Fonction asynchrone qui définit les variables d'état pour les GPIO.
 * Cette fonction est exportée et sera probablement appelée lors de l'initialisation du module.
 *
 * @returns {Promise<void>}
 */
module.exports = async function () {
  const variableDefinitions = []

  /**
   * Génère les 32 variables correspondant aux 32 bits GPIO
   */
  for (let i = 0; i < 32; i++) {
    /**
     * Définition d'une variable pour un bit GPIO spécifique
     *
     * @type {Object}
     * @property {string} variableId - L'identifiant unique de la variable
     * @property {string} name - Le nom descriptif de la variable
     */
    variableDefinitions.push({
      variableId: `${String(i + 1).padStart(2, '0')}`, // Créer un ID unique pour chaque bit (de state1 à state32)
      name: `Gpio${String(i + 1).padStart(2, '0')}` // Nommer chaque variable en fonction du bit
    })
  }

  /**
   * Définition de la variable représentant l'état complet des GPIO
   *
   * @type {Object}
   * @property {string} variableId - L'identifiant unique de la variable
   * @property {string} name - Le nom descriptif de la variable
   */
  variableDefinitions.push({
    variableId: 'Full',
    name: 'GPIO Full (Little Endian)'
  })

  /**
   * Définit toutes les variables générées pour être utilisées par le système
   */
  this.setVariableDefinitions(variableDefinitions)
}
