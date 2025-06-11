# Companion Module - Microfilms GPIO

## Description

Ce module Companion permet de contrôler les robots Microfilms (machineries) via des commandes UDP pour activer ou désactiver les bits GPIO du robot. Les GPIO peuvent être activés ou désactivés en fonction des actions de l'utilisateur dans Companion (comme les actions "impulse" ou "tow states"), et le robot renvoie des informations sur l'état actuel des GPIO via des réponses "Status".

Le module gère 32 bits GPIO (répartis sur 4 octets) et envoie des commandes au robot pour définir l'état des GPIO et recevoir les retours de statut.

## Fonctionnalités

- **Impulse** : Envoie une impulsion rapide pour activer un GPIO, puis le désactive après un court délai (50-100ms).
- **Tow States** : Active un GPIO lorsque l'utilisateur appuie sur un bouton et le désactive lorsque l'utilisateur relâche le bouton.
- **Feedbacks** : Le module surveille les états des GPIO et modifie dynamiquement l'apparence des boutons dans Companion en fonction de ces états (couleur verte lorsque le GPIO est activé, rouge sinon).
- **Communication UDP** : Les échanges entre Companion et le robot se font via UDP. Le module envoie des messages "Set GPIO" et le robot répond avec des messages "Status".

## Prérequis

- Companion installé et configuré.
- Adresse IP et port du robot Microfilms (configurable dans l'interface du module Companion).
- Simulateur UDP du robot (inclus dans le projet pour tester les fonctionnalités).

## Configuration

1. Ajoutez l'IP et le port du robot Microfilms dans la configuration du module.
2. Configurez les actions et feedbacks dans l'interface Companion.
3. Utilisez le simulateur UDP fourni pour tester la communication avec le robot.

## Structure des commandes

### Commande `Set GPIO`
La commande `Set GPIO` est envoyée par le module Companion pour définir l'état des GPIO. Elle contient les informations suivantes :
- **En-tête** : `INP` (3 octets) pour identifier la commande.
- **GPIO Bytes** : 4 octets représentant l'état des 32 GPIO.
- **Mask Bytes** : 4 octets pour appliquer un masque sur les GPIO à modifier.

### Réponse `Status`
Le robot répond avec un message `Status`, contenant :
- **En-tête** : `OUT` (3 octets).
- **GPIO Bytes** : 4 octets représentant l'état actuel des 32 GPIO.

### Exemple de Message UDP
#### Envoi `Set GPIO` (Activer GPIO bit 1)
``` bash
INP 00000000 00000000 00000000 00000001 00000000 00000000 00000000 00000001
```
- En-tête : `INP`
- GPIO Bytes : `[00000000 00000000 00000000 00000001]` (bit 1 activé)
- Mask Bytes : `[00000000 00000000 00000000 00000001]` (le premier octet est pris en compte, les autres sont ignorés)

#### Réponse `Status`
``` bash
INP 00000000 00000000 00000000 00000001
```
- En-tête : `OUT`
- GPIO Bytes : `[00000000 00000000 00000000 00000001]` (bit 1 activé)

## Fonctionnement du module

1. **Configuration UDP** : Le module initialise une connexion UDP avec le robot (ou le simulateur) lors de l'initialisation.
2. **Actions** : Lorsqu'un utilisateur active une action (par exemple, impulse ou tow states), le module envoie une commande UDP "Set GPIO" pour changer l'état du GPIO correspondant.
3. **Réception des Statuts** : Le robot envoie un message "Status" en réponse, et le module met à jour les feedbacks en fonction de l'état actuel des GPIO.

## Simulateur UDP du Robot
Un simulateur de robot est inclus pour tester le module Companion sans avoir accès à un robot physique. Le simulateur écoute sur un port UDP et réagit aux commandes Set GPIO en renvoyant une réponse Status avec les GPIO mis à jour.

### Utilisation du simulateur
1. Lancez le simulateur de robot UDP :
``` bash
node udp-server.js
```
2. Configurez l'IP et le port du simulateur dans le module Companion.
3. Utilisez l'interface Companion pour envoyer des commandes et observer les réponses.

## Structure des fichiers

- **main.js** : Point d'entrée principal du module Companion, gère la configuration et les communications UDP.
- **network.js** : Gère la connexion et la communication avec le robot via UDP.
- **actions.js** : Définit les actions impulse et tow states pour les 32 bits GPIO.
- **feedbacks.js** : Gère les feedbacks en fonction de l'état des bits GPIO.
- **presets.js** : Crée les presets de boutons pour contrôler les GPIO.
- **udp-server.js** : Simulateur de robot qui reçoit les commandes Set GPIO et renvoie des statuts.

## Installation
Clonez le dépôt dans votre dossier de modules Companion.
Installer les dépendances :
``` bash
npm install
```
Configurez l'IP et le port du robot dans Companion.
Lancez Companion et sélectionnez le module "Microfilms: GPIO".

## Packaging pour le déploiement

Ce module inclut un script pour créer un package de production qui peut être facilement déployé par un client sans avoir besoin d'installer `npm` ou d'autres dépendances.

Pour créer le package :
1. Assurez-vous que le script est exécutable (à faire une seule fois) :
```bash
chmod +x package.sh
```
2. Lancez le script de packaging via npm :
```bash
npm run custom-package
```
Cette commande générera une archive `microfilms-gpio-vX.X.X.tar.gz` dans le dossier `pkg`. C'est cette archive que vous devez fournir à votre client.

## Déploiement pour le client final

Pour installer ce module sur un ordinateur Windows ou macOS :

1.  **Téléchargez** l'archive du module (`microfilms-gpio-vX.X.X.tar.gz`) fournie par le développeur.
2.  **Décompressez** l'archive. Sur Windows, vous pouvez faire un clic droit et "Extraire tout...". Sur macOS, un double-clic suffit.
3.  Un dossier sera créé (par exemple `microfilms-gpio-v0.1.0`). **Renommez ce dossier** pour qu'il s'appelle exactement `microfilms-gpio`.
4.  **Copiez** ce dossier `microfilms-gpio` dans le répertoire des modules de votre installation Companion. Vous trouverez ce répertoire dans les réglages de l'application Companion.
5.  **Redémarrez** Companion. Le module "Microfilms: GPIO" devrait maintenant être disponible.
