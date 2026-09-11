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

- Companion **5.x** installé et configuré (le module utilise `@companion-module/base` 2.x et ne se charge plus sur Companion 4).
- Node **22** pour le développement, les tests et le packaging (`.node-version` = `22`, par exemple via `fnm use --install-if-missing`).
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
1. Lancez le simulateur de robot UDP (Node 22) :
``` bash
fnm use --install-if-missing
node udp-server.js
```
2. Configurez l'IP et le port du simulateur dans le module Companion.
3. Utilisez l'interface Companion pour envoyer des commandes et observer les réponses.

## Structure des fichiers

- **main.js** : Point d'entrée principal du module Companion, gère la configuration et les communications UDP.
- **network.js** : Gère la connexion et la communication avec le robot via UDP.
- **actions.js** : Définit les actions impulse et tow states pour les 32 bits GPIO.
- **feedbacks.js** : Gère les feedbacks en fonction de l'état des bits GPIO.
- **presets.js** : Crée les presets de boutons pour contrôler les GPIO (section « Divers »).
- **protocol.js** : Helpers purs du protocole UDP/GPIO (trames `INP` / `OUT`, masque, bits 1–32).
- **udp-server.js** : Simulateur de robot qui reçoit les commandes Set GPIO et renvoie des statuts.
- **test/** : Tests `node --test` du protocole, des actions et du NetworkManager (port éphémère).

## Installation (développement)

Clonez le dépôt dans un sous-dossier du chemin de modules développeur de Companion (option `--extra-module-path` ou réglage *Developer modules path*).
Installer les dépendances avec Node 22 :
``` bash
fnm use --install-if-missing
npm install
```
Configurez l'IP et le port du robot dans Companion.
Lancez Companion 5 et ajoutez la connexion "Microfilms: Gpio" (version **Dev**).

## Tests

``` bash
npm test
```

Les tests figent le protocole UDP (trames de 13 / 7 octets, masque, Impulse 100 ms, ping 500 ms, timeout 3 s) et n'ouvrent jamais le port 7770.

## Packaging pour le déploiement

### Créer le bundle pour Companion 5
```bash
npm run package
```
Cette commande (`companion-module-build`) génère le dossier `pkg/microfilms-gpio/` et l'archive `microfilms-gpio-<version>.tgz` à la racine du projet. C'est ce fichier que vous devez fournir à votre client.

### Installation par le client (Companion 5)
1. Ouvrir l'interface web de Companion
2. Aller dans **Modules**
3. Cliquer sur **Import offline module bundle**
4. Sélectionner le fichier `microfilms-gpio-<version>.tgz` fourni
5. Le module sera installé automatiquement
6. Aucun redémarrage nécessaire

✅ **Avantages** : Installation simple via l'interface web, pas besoin d'accéder aux fichiers système.

⚠️ **Note sur la version** : Pendant le développement, le module affichera "Dev" dans Companion. Une fois installé via le bundle offline, la version du `package.json` sera affichée.

⚠️ **Compatibilité** : depuis la version 1.0.0, le module cible l'API `@companion-module/base` 2.x (runtime `node22`) et ne se charge plus sur Companion 4.x ni 3.x.
