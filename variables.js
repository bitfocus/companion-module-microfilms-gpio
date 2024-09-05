module.exports = async function () {
  const variableDefinitions = []

  // Générer les 32 variables correspondant aux 32 bits GPIO
  for (let i = 0; i < 32; i++) {
    variableDefinitions.push({
      variableId: `state${i + 1}`, // Créer un ID unique pour chaque bit (de state1 à state32)
      name: `GPIO bit ${i + 1} state` // Nommer chaque variable en fonction du bit
    })
  }

  variableDefinitions.push({
    variableId: 'gpio',
    name: 'GPIO Bytes (Little Endian)'
  })

  // Définir toutes les variables générées
  this.setVariableDefinitions(variableDefinitions)
}
