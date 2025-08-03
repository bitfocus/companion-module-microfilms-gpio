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

Ce module peut être packagé de deux façons selon la version de Companion utilisée par votre client.

### Pour Companion v4 (recommandé)

Companion v4 permet d'importer directement des modules via l'interface web, ce qui simplifie grandement l'installation.

#### Créer le package pour Companion v4
```bash
npm run package
```
Cette commande génère un fichier `pkg.tgz` à la racine du projet. C'est ce fichier que vous devez fournir à votre client.

#### Installation par le client (Companion v4)
1. Ouvrir l'interface web de Companion
2. Aller dans "Manage Modules"
3. Cliquer sur "Import offline module bundle" (bouton bleu)
4. Sélectionner le fichier `pkg.tgz` fourni
5. Le module sera installé automatiquement
6. Aucun redémarrage nécessaire

✅ **Avantages** : Installation simple via l'interface web, pas besoin d'accéder aux fichiers système.

⚠️ **Note sur la version** : Pendant le développement, le module affichera "Dev version" dans Companion. Une fois installé via le bundle offline, la version correcte (0.1.0) sera affichée.

### Pour Companion v3

Si votre client utilise encore Companion v3, utilisez l'ancienne méthode :

#### Créer le package pour Companion v3
1. Assurez-vous que le script est exécutable (à faire une seule fois) :
```bash
chmod +x package.sh
```
2. Lancez le script de packaging :
```bash
npm run custom-package
```
Cette commande génère une archive `microfilms-gpio-vX.X.X.tar.gz` dans le dossier `pkg`.

#### Installation manuelle (Companion v3)
1. **Télécharger** l'archive du module (`microfilms-gpio-vX.X.X.tar.gz`)
2. **Décompresser** l'archive
3. **Renommer** le dossier extrait en `microfilms-gpio`
4. **Copier** ce dossier dans le répertoire des modules de Companion
5. **Redémarrer** Companion

⚠️ **Note** : Cette méthode nécessite l'accès aux fichiers système et est plus complexe.
