/**
 * Ce fichier implémente un serveur UDP pour contrôler 32 GPIO.
 * Il gère la réception de commandes, la mise à jour de l'état des GPIO et l'envoi de statuts.
 *
 * Modules requis :
 * - dgram (module natif de Node.js pour UDP)
 * - ./protocol (helpers purs du protocole UDP/GPIO)
 */

import dgram from 'node:dgram'
import { applyMask, parseInpFrame, buildOutFrame } from './protocol.js'

/**
 * Création d'un socket UDP pour le serveur
 */
const server = dgram.createSocket('udp4')

/**
 * Variables internes pour stocker l'état des GPIO
 */
const gpio = Buffer.alloc(4) // 4 octets pour les 32 GPIO (initialisés à 0)
// const sendStatusInterval = 5000 // Par défaut, envoie un statut toutes les 5 secondes
// const statusIntervalId = null

/**
 * Fonction pour appliquer le masque et mettre à jour les GPIO
 *
 * Cette fonction met à jour l'état des GPIO en appliquant un masque bit à bit.
 * Pour chaque bit :
 * - Si le bit du masque est à 1, la nouvelle valeur (gpioBytes) est appliquée.
 * - Si le bit du masque est à 0, l'état actuel du GPIO est conservé.
 * Cela permet de modifier sélectivement certains GPIO sans affecter les autres.
 *
 * @param {Buffer} gpioBytes - Les nouvelles valeurs des GPIO
 * @param {Buffer} maskBytes - Le masque à appliquer
 */
function applyMaskAndUpdateGPIO (gpioBytes, maskBytes) {
  const next = applyMask(gpio, gpioBytes, maskBytes)
  next.copy(gpio)
}

/**
 * Fonction pour envoyer un message "Status" au client
 *
 * Cette fonction crée un message avec l'en-tête 'OUT' suivi de l'état actuel des GPIO,
 * puis l'envoie au client spécifié.
 *
 * @param {Object} rinfo - Informations sur le client (adresse et port)
 */
function sendStatus (rinfo) {
  const statusMessage = buildOutFrame(gpio)
  server.send(statusMessage, rinfo.port, rinfo.address, (err) => {
    if (err) {
      console.error('Erreur lors de l\'envoi du message :', err)
    } else {
      console.log(`Message "Status" envoyé à ${rinfo.address}:${rinfo.port}`)
    }
  })
}

/**
 * Événement déclenché lorsqu'un message est reçu par le serveur
 *
 * Ce gestionnaire d'événements traite les messages entrants, vérifie leur validité,
 * met à jour l'état des GPIO si nécessaire, et envoie une réponse de statut.
 *
 * @param {Buffer} msg - Le message reçu
 * @param {Object} rinfo - Informations sur l'expéditeur (adresse et port)
 */
server.on('message', (msg, rinfo) => {
  console.log(`Message reçu de ${rinfo.address}:${rinfo.port}`)

  const parsed = parseInpFrame(msg)
  if (!parsed) {
    console.error('Commande invalide, en-tête incorrect')
    return
  }

  applyMaskAndUpdateGPIO(parsed.gpioBytes, parsed.maskBytes)

  // Envoyer une réponse "Status" immédiatement après la commande reçue
  sendStatus(rinfo)
})

/**
 * Événement déclenché en cas d'erreur du serveur
 *
 * Ce gestionnaire d'événements affiche l'erreur et ferme le serveur.
 *
 * @param {Error} err - L'erreur survenue
 */
server.on('error', (err) => {
  console.error(`Erreur du serveur : ${err.stack}`)
  server.close()
})

/**
 * Lancement du serveur UDP
 *
 * Cette section configure le port d'écoute du serveur et affiche un message de confirmation.
 */
const PORT = 7770
server.bind(PORT, () => {
  console.log(`Serveur UDP en écoute sur le port ${PORT}`)
})
