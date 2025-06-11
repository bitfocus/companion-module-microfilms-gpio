#!/bin/bash

# Arrête le script si une commande échoue
set -e

# --- Configuration ---
# Lit le nom et la version du module depuis package.json
PACKAGE_NAME=$(node -p "require('./package.json').name")
PACKAGE_VERSION=$(node -p "require('./package.json').version")

# Définit les répertoires et les noms de fichiers
BUILD_DIR="./tmp/package_build"
# Le nom du dossier dans l'archive correspondra au nom du module
PACKAGE_FOLDER_NAME="${PACKAGE_NAME}"
FINAL_PACKAGE_DIR="${BUILD_DIR}/${PACKAGE_FOLDER_NAME}"
OUTPUT_DIR="./pkg"
ARCHIVE_NAME="${PACKAGE_NAME}-v${PACKAGE_VERSION}.tar.gz"

# --- Script ---

echo "--- Début du processus de packaging pour ${PACKAGE_NAME} v${PACKAGE_VERSION} ---"

# 1. Nettoyage des builds précédents
echo "Nettoyage des builds précédents..."
rm -rf ${BUILD_DIR}
rm -rf ${OUTPUT_DIR}
mkdir -p ${FINAL_PACKAGE_DIR}
mkdir -p ${OUTPUT_DIR}

# 2. Copie des fichiers sources vers le répertoire temporaire
# Utilisation de rsync pour exclure facilement les fichiers et dossiers de développement.
echo "Copie des fichiers sources..."
rsync -av --progress . ${FINAL_PACKAGE_DIR} \
    --exclude .git \
    --exclude .gitignore \
    --exclude node_modules \
    --exclude pkg \
    --exclude tmp \
    --exclude .vscode \
    --exclude '*.sh' \
    --exclude 'docs' \
    --exclude 'jsdoc.json' \
    --exclude 'eslint.config.mjs' \
    --exclude 'package-lock.json' \
    --exclude '.history'

# 3. Installation des dépendances de production
echo "Installation des dépendances de production..."
cd ${FINAL_PACKAGE_DIR}
npm install --omit=dev
cd - > /dev/null # Retour au répertoire précédent sans afficher le chemin

# 4. Création de l'archive compressée
echo "Création de l'archive : ${ARCHIVE_NAME}..."
# L'option -C fait en sorte que tar se place dans le répertoire des sources
# avant d'archiver. En archivant '.', on place tout le contenu à la racine
# de l'archive, ce qui évite le problème de dossier imbriqué à l'extraction.
tar -czhf "${OUTPUT_DIR}/${ARCHIVE_NAME}" -C "${FINAL_PACKAGE_DIR}" .

# 5. Nettoyage du répertoire temporaire
echo "Nettoyage des fichiers temporaires..."
rm -rf ${BUILD_DIR}

echo "--- Packaging terminé ! ---"
echo "Archive créée dans : ${OUTPUT_DIR}/${ARCHIVE_NAME}" 