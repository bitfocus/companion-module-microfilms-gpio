/**
 * @file udp-server.js
 * @description Ce fichier implémente un serveur UDP pour gérer les états des GPIO et envoyer des messages de statut aux clients.
 *
 * @requires dgram
 *
 * @constant {Buffer} gpio - Buffer de 4 octets représentant les 32 GPIO, initialisés à 0.
 *
 * @function applyMaskAndUpdateGPIO
 * @description Applique un masque aux octets GPIO et met à jour les états des GPIO en conséquence.
 * @param {Buffer} gpioBytes - Nouveaux états des GPIO.
 * @param {Buffer} maskBytes - Masque pour appliquer les nouveaux états.
 *
 * @function sendStatus
 * @description Envoie un message de statut au client spécifié.
 * @param {Object} rinfo - Informations sur le client (adresse et port).
 *
 * @callback sendStatusCallback
 * @description Fonction de rappel pour gérer les erreurs lors de l'envoi du message de statut.
 * @param {Error} err - Erreur éventuelle lors de l'envoi du message.
 *
 * @function setStatusInterval
 * @description Modifie la fréquence d'envoi des messages de statut.
 * @param {number} seconds - Fréquence en secondes.
 * @param {Object} rinfo - Informations sur le client (adresse et port).
 *
 * @function startStatusEmitter
 * @description Démarre l'émission périodique des messages de statut.
 * @param {Object} rinfo - Informations sur le client (adresse et port).
 *
 * @constant {number} sendStatusInterval - Intervalle par défaut pour l'envoi des messages de statut (5 secondes).
 * @constant {NodeJS.Timeout} statusIntervalId - Identifiant de l'intervalle pour l'envoi périodique des messages de statut.
 */

const dgram = require('dgram')

// Création d'un socket UDP
const server = dgram.createSocket('udp4')

// Variables internes
const gpio = Buffer.alloc(4) // 4 octets pour les 32 GPIO (initialisés à 0)
// const sendStatusInterval = 5000 // Par défaut, envoie un statut toutes les 5 secondes
// const statusIntervalId = null

// Fonction pour appliquer le masque et mettre à jour les GPIO
function applyMaskAndUpdateGPIO (gpioBytes, maskBytes) {
  for (let i = 0; i < 4; i++) {
    // Met à jour l'état des GPIO en appliquant un masque bit à bit.
    // Pour chaque bit :
    // - Si le bit du masque est à 1, la nouvelle valeur (gpioBytes) est appliquée.
    // - Si le bit du masque est à 0, l'état actuel du GPIO est conservé.
    // Cela permet de modifier sélectivement certains GPIO sans affecter les autres.
    gpio[i] = (gpio[i] & ~maskBytes[i]) | (gpioBytes[i] & maskBytes[i])
  }
}

// Fonction pour envoyer un message "Status" au client
function sendStatus (rinfo) {
  const statusMessage = Buffer.concat([Buffer.from('OUT'), gpio]) // Crée un message avec l'en-tête 'O', 'U', 'T'
  server.send(statusMessage, rinfo.port, rinfo.address, (err) => {
    if (err) {
      console.error('Erreur lors de l\'envoi du message :', err)
    } else {
      console.log(`Message "Status" envoyé à ${rinfo.address}:${rinfo.port}`)
    }
  })
}

// // Exemple de modification de la fréquence d'envoi du statut (X secondes)
// function setStatusInterval (seconds, rinfo) {
//   sendStatusInterval = seconds * 1000 // Conversion en millisecondes
//   startStatusEmitter(rinfo)
// }

// // Fonction pour émettre le statut périodiquement
// function startStatusEmitter (rinfo) {
//   if (statusIntervalId) clearInterval(statusIntervalId) // Stopper l'ancien intervalle si nécessaire

//   statusIntervalId = setInterval(() => {
//     sendStatus(rinfo)
//   }, sendStatusInterval)
// }

// Événement lorsqu'un message est reçu
server.on('message', (msg, rinfo) => {
  console.log(`Message reçu de ${rinfo.address}:${rinfo.port}`)

  // Vérification de l'en-tête 'INP' en utilisant subarray()
  const header = msg.subarray(0, 3).toString() // Utilisation de subarray pour remplacer slice
  if (header !== 'INP') {
    console.error('Commande invalide, en-tête incorrect')
    return
  }

  // Récupération des 4 octets pour les GPIO et les 4 octets pour le masque en utilisant subarray()
  const gpioBytes = msg.subarray(3, 7) // Utilisation de subarray pour remplacer slice
  const maskBytes = msg.subarray(7, 11) // Utilisation de subarray pour remplacer slice

  // Appliquer le masque et mettre à jour l'état interne des GPIO
  applyMaskAndUpdateGPIO(gpioBytes, maskBytes)

  // Envoyer une réponse "Status" immédiatement après la commande reçue
  sendStatus(rinfo)
})

// Événement lorsqu'une erreur se produit
server.on('error', (err) => {
  console.error(`Erreur du serveur : ${err.stack}`)
  server.close()
})

// Lancement du serveur UDP
const PORT = 5000
server.bind(PORT, () => {
  console.log(`Serveur UDP en écoute sur le port ${PORT}`)
})
