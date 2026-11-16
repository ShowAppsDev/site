#!/bin/bash
# Déploiement de la vitrine showapp.fr sur le VPS.
# Usage : ./deploy_site.sh
#
# 1. construit le site (npm ci, build, vérification des liens) ;
# 2. l'envoie dans /opt/showapp2/site.new sur le VPS (rsync, ou tar par ssh si rsync est absent) ;
# 3. remplace /opt/showapp2/site d'un coup (renommage), l'ancienne version étant gardée dans site.old
#    jusqu'au déploiement suivant ;
# 4. redémarre le conteneur qui monte /opt/showapp2/site (nginx) : un montage Docker suit le dossier
#    d'origine, pas son nom, et continuerait sinon à servir l'ancienne version.
#
# Prérequis : alias SSH « showapp-vps » dans ~/.ssh/config (le même que deploy_vps.sh de ShowApp :
# debian@83.228.199.108, avec accès au groupe docker), Node.js 22.23 ou plus récent.
# Revenir à la version précédente : voir README.md, « Revenir en arrière ».

set -euo pipefail

REMOTE_HOST="showapp-vps"
REMOTE_BASE="/opt/showapp2"
SITE_DIR="$REMOTE_BASE/site"
NEW_DIR="$REMOTE_BASE/site.new"
OLD_DIR="$REMOTE_BASE/site.old"

cd "$(dirname "$0")"

if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "⚠️  Modifications non commitées : c'est l'état local qui sera déployé."
fi

echo "🔨 Construction du site..."
npm ci --no-audit --no-fund
npm run build
npm run check-links
[ -s dist/index.html ] || { echo "❌ dist/index.html absent : rien n'est envoyé."; exit 1; }

echo "📤 Envoi vers $REMOTE_HOST:$NEW_DIR ..."
ssh "$REMOTE_HOST" "rm -rf '$NEW_DIR' && mkdir -p '$NEW_DIR'"
if command -v rsync >/dev/null 2>&1; then
    rsync -rlz --delete --chmod=D755,F644 dist/ "$REMOTE_HOST:$NEW_DIR/"
else
    tar -C dist -cf - . | ssh "$REMOTE_HOST" "tar -C '$NEW_DIR' --no-same-owner -xf - \
        && find '$NEW_DIR' -type d -exec chmod 755 {} + && find '$NEW_DIR' -type f -exec chmod 644 {} +"
fi

echo "🔁 Remplacement de $SITE_DIR ..."
ssh "$REMOTE_HOST" bash -s -- "$SITE_DIR" "$NEW_DIR" "$OLD_DIR" << 'REMOTE_SCRIPT'
set -euo pipefail
SITE_DIR="$1"; NEW_DIR="$2"; OLD_DIR="$3"
[ -s "$NEW_DIR/index.html" ] || { echo "❌ $NEW_DIR/index.html absent : site en place inchangé."; exit 1; }
rm -rf "$OLD_DIR"
if [ -d "$SITE_DIR" ]; then
    mv "$SITE_DIR" "$OLD_DIR"
fi
mv "$NEW_DIR" "$SITE_DIR"
echo "✅ $SITE_DIR remplacé (version précédente dans $OLD_DIR)."

# Conteneurs qui montent le dossier du site : ils voient encore l'ancien dossier tant qu'ils ne
# sont pas redémarrés.
containers=""
for id in $(docker ps -q); do
    if docker inspect --format '{{range .Mounts}}{{.Source}}{{"\n"}}{{end}}' "$id" | grep -qx "$SITE_DIR"; then
        containers="$containers $id"
    fi
done
if [ -z "$containers" ]; then
    echo "ℹ️  Aucun conteneur ne monte $SITE_DIR pour l'instant : rien à redémarrer."
else
    for id in $containers; do
        name="$(docker inspect --format '{{.Name}}' "$id" | sed 's#^/##')"
        echo "♻️  Redémarrage de $name (quelques secondes de coupure)..."
        docker restart "$id" >/dev/null
    done
    sleep 3
    code="$(curl -sk -o /dev/null -w '%{http_code}' --resolve showapp.fr:443:127.0.0.1 https://showapp.fr/ || echo 000)"
    if [ "$code" = "200" ]; then
        echo "✅ https://showapp.fr répond (HTTP 200)."
    else
        echo "⚠️  https://showapp.fr répond HTTP $code : vérifier nginx (docker compose logs nginx)."
    fi
fi
REMOTE_SCRIPT

echo "✅ Déploiement du site terminé."
