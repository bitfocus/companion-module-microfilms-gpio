## Module Microfilms GPIO

Ce module permet de contrôler les GPIO (entrées/sorties) des robots Microfilms via des commandes UDP.

### Configuration

1. **Adresse IP** : Entrez l'adresse IP du robot Microfilms (par défaut : 192.168.10.10)
2. **Port** : Entrez le port UDP du robot (par défaut : 7770)

### Actions disponibles

#### Impulse GPIO
Envoie une impulsion courte (50-100ms) sur un GPIO spécifique.
- **GPIO Bit** : Sélectionnez le bit GPIO à activer (1-32)
- **Durée** : Durée de l'impulsion en millisecondes

#### Two States GPIO
Active/désactive un GPIO selon l'état du bouton (appuyé/relâché).
- **GPIO Bit** : Sélectionnez le bit GPIO à contrôler (1-32)

### Feedbacks

Les feedbacks changent la couleur du bouton selon l'état du GPIO :
- **Vert** : GPIO activé
- **Rouge** : GPIO désactivé

### Variables

- `$(MFGpio:gpio)` : État complet des 32 GPIO (valeur décimale)
- `$(MFGpio:state1)` à `$(MFGpio:state32)` : État individuel de chaque GPIO (0 ou 1)

### Support

Pour toute question ou problème, contactez Microfilms ou consultez la documentation complète sur GitHub.