#!/usr/bin/env bash
# Deploy do IAZAN Sync (painel + API) na VPS via SSH, a partir do Mac/Linux.
# Empacota o projeto (sem segredos nem lixo), envia por scp, limpa fontes antigos
# na VPS e sobe com docker compose. So toca no projeto "eron" (containers eron e eron-api).
# Uso: ./deploy.sh
set -euo pipefail

VPS="${VPS:-179.198.98.180}"
USER_="${VPS_USER:-root}"
REMOTE="/root/eron"
SSH=(ssh -o StrictHostKeyChecking=accept-new "$USER_@$VPS")
TAR="$(mktemp -t eron).tar.gz"

echo "==> Empacotando ($TAR)..."
export COPYFILE_DISABLE=1 # sem arquivos ._ do macOS no pacote
tar --exclude=node_modules --exclude=.git --exclude=dist --exclude=tsconfig.tsbuildinfo \
    --exclude='.env' --exclude='.env.*' --exclude='*.db' --exclude='*.db-wal' --exclude='*.db-shm' \
    --exclude='.tokens.json' --exclude='server/node_modules' --exclude='server/dist' \
    --exclude='.DS_Store' --exclude='._*' -czf "$TAR" .

echo "==> Enviando para $USER_@$VPS:$REMOTE ..."
"${SSH[@]}" "mkdir -p $REMOTE"
scp -o StrictHostKeyChecking=accept-new "$TAR" "$USER_@$VPS:$REMOTE/eron.tar.gz"

echo "==> Extraindo (limpando fontes antigos), buildando e subindo..."
"${SSH[@]}" "cd $REMOTE \
  && rm -rf src server/src server/scripts public obsidian-eron \
  && tar -xzf eron.tar.gz && rm eron.tar.gz \
  && docker compose up -d --build \
  && docker compose ps"

rm -f "$TAR"
echo "==> Concluido. Front: 127.0.0.1:3007 | API: 127.0.0.1:3008 (internos a VPS) | https://eron.mlutegar.com"
