/**
 * @file udp-client.js
 * @description Ce fichier contient un script Node.js pour tester le simulateur de robot en envoyant une commande «Set GPIO» et en vérifiant la réponse «Status».
 *
 * @requires dgram
 *
 * @constant {string} SERVER_HOST - Adresse du simulateur de robot.
 * @constant {number} SERVER_PORT - Port du simulateur de robot.
 *
 * @constant {Buffer} setGpioHeader - En-tête pour la commande "Set GPIO".
 * @constant {Buffer} gpioBytes - Octets pour activer les 4 premiers GPIO.
 * @constant {Buffer} maskBytes - Masque pour modifier uniquement les 8 premiers GPIO.
 *
 * @constant {Buffer} message - Message "Set GPIO" combinant l'en-tête, les GPIO et le masque.
 *
 * @function client.send
 * @description Envoie le message "Set GPIO" au simulateur de robot.
 * @param {Buffer} message - Message à envoyer.
 * @param {number} SERVER_PORT - Port du serveur.
 * @param {string} SERVER_HOST - Adresse du serveur.
 * @param {Function} callback - Fonction de rappel exécutée après l'envoi du message.
 *
 * @event client#message
 * @description Événement déclenché lors de la réception d'un message du serveur.
 * @param {Buffer} msg - Message reçu du serveur.
 * @param {Object} rinfo - Informations sur le serveur (adresse et port).
 *
 * @function client.on('message')
 * @description Gère la réponse "Status" du serveur, vérifie l'en-tête et compare les valeurs GPIO.
 * @param {Buffer} msg - Message reçu du serveur.
 * @param {Object} rinfo - Informations sur le serveur (adresse et port).
 *
 * @constant {Buffer} receivedGpio - Octets GPIO extraits de la réponse "Status".
 *
 * @function Buffer.prototype.equals
 * @description Compare les octets GPIO reçus avec ceux envoyés initialement.
 * @param {Buffer} buffer - Buffer à comparer.
 * @returns {boolean} - Résultat de la comparaison.
 */

const dgram = require('dgram')
const client = dgram.createSocket('udp4')

// Adresse et port du simulateur de robot
const SERVER_HOST = 'localhost' // Modifier si nécessaire
const SERVER_PORT = 5000

// Données pour la commande "Set GPIO"
const setGpioHeader = Buffer.from('INP') // En-tête pour la commande "Set GPIO"
const gpioBytes = Buffer.from([0b00001111, 0, 0, 0]) // Exemple d'octets pour activer les 4 premiers GPIO
const maskBytes = Buffer.from([0b11111111, 0, 0, 0]) // Masque pour modifier uniquement les 8 premiers GPIO

// Crée le message "Set GPIO" avec l'en-tête, les GPIO et le masque
const message = Buffer.concat([setGpioHeader, gpioBytes, maskBytes])

// Envoie le message "Set GPIO" au simulateur de robot
client.send(message, SERVER_PORT, SERVER_HOST, (err) => {
  if (err) {
    console.error('Erreur lors de l\'envoi de la commande "Set GPIO" :', err)
    client.close()
  } else {
    console.log('Commande "Set GPIO" envoyée avec succès.')
  }
})

// Écoute la réponse "Status" du serveur
client.on('message', (msg, rinfo) => {
  console.log(`Réponse "Status" reçue de ${rinfo.address}:${rinfo.port} : ${msg.toString('hex')}`)

  // Vérification de l'en-tête 'OUT'
  const header = msg.subarray(0, 3).toString()
  if (header !== 'OUT') {
    console.error('Erreur : En-tête incorrect dans la réponse "Status"')
    client.close()
    return
  }

  // Extraction des 4 octets GPIO dans la réponse "Status"
  const receivedGpio = msg.subarray(3, 7)

  // Comparaison avec les GPIO envoyés initialement
  if (receivedGpio.equals(gpioBytes)) {
    console.log('Le test est réussi : la valeur GPIO du robot correspond à la valeur envoyée.')
  } else {
    console.error('Le test a échoué : la valeur GPIO du robot ne correspond pas à la valeur envoyée.')
  }

  // Fermeture du client après réception de la réponse
  client.close()
})

// Gestion des erreurs
client.on('error', (err) => {
  console.error(`Erreur du client : ${err.stack}`)
  client.close()
})
