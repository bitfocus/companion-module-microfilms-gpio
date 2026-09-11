## Module Microfilms GPIO

⚠️ Ce module (1.0.0) requiert Companion 5.x. Pour Companion 4.x, utiliser une version 0.x du module.

Contrôle des 32 bits GPIO d’un robot Microfilms (machinerie) depuis Companion et un Stream Deck, via UDP.

### Configuration

- **Target IP** : adresse du robot. Pour le simulateur local : `127.0.0.1` (défaut robot : `192.168.10.10`).
- **Target Port** : port UDP, `7770` par défaut.

La connexion passe à **OK** dès qu’une réponse `Status` arrive. Un ping est envoyé toutes les 500 ms ; sans réponse pendant 3 s, le statut devient **Disconnected**.

### Actions (un bit = une action)

- **Imp01 … Imp32** : impulsion 100 ms (ON puis OFF) sur le bit.
- **Set01 … Set32** : met le bit à 1.
- **Raz01 … Raz32** : met le bit à 0.

Les autres bits ne sont pas modifiés.

### Presets (section Divers)

- **IMP n** : à l’appui, exécute `Imp` (flash).
- **TS n** (Two States) : appui = `Set`, relâchement = `Raz` (vert tant que la touche est maintenue).

### Feedbacks

**Gpio01 … Gpio32** : couleur du bouton selon le dernier état renvoyé par le robot / simulateur.

- Presets : noir = off, vert = on.
- Feedback nu : rouge = off, vert = on (couleurs réglables).

### Tester sans robot (simulateur)

Dans le dossier du module, avec Node 22 :

```bash
node udp-server.js
```

Pointer la connexion vers `127.0.0.1:7770`. Des messages doivent défiler dans le terminal (pings). Placer un preset **TS 1**, maintenir la touche : bouton vert ; relâcher : bouton noir. Arrêter le simulateur : la connexion passe à **Disconnected**.
