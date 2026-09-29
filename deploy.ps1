# Deploy do IAZAN Sync Dashboard (front + API) no VPS via SSH.
# Empacota o projeto (sem lixo), envia via scp e sobe com docker compose.
# Uso: .\deploy.ps1
$ErrorActionPreference = "Stop"

$VPS   = "179.198.98.180"
$USER  = "root"
$KEY   = "$env:USERPROFILE\.ssh\id_ed25519"
$NAME  = "eron"
$REMOTE = "/root/$NAME"
$SSHOPTS = @("-o", "StrictHostKeyChecking=no", "-i", $KEY)

$tar = Join-Path $env:TEMP "$NAME.tar.gz"
Write-Host "==> Empacotando ($tar)..."
tar --exclude=node_modules --exclude=.venv --exclude=__pycache__ `
    --exclude="*.pyc" --exclude=.git --exclude=downloads --exclude=dist `
    --exclude=tsconfig.tsbuildinfo -czf $tar .

Write-Host "==> Enviando para $USER@$VPS`:$REMOTE ..."
& ssh @SSHOPTS "$USER@$VPS" "mkdir -p $REMOTE"
& scp @SSHOPTS $tar "$USER@$VPS`:$REMOTE/"

Write-Host "==> Extraindo e subindo containers..."
& ssh @SSHOPTS "$USER@$VPS" "cd $REMOTE && tar -xzf $NAME.tar.gz && rm $NAME.tar.gz && docker compose up -d --build && docker compose ps"

Remove-Item $tar -Force
Write-Host "==> Concluido."
Write-Host "Front: http://127.0.0.1:3007  |  API: http://127.0.0.1:3008 (internos ao VPS)"
Write-Host "Cloudflare Tunnel 'emme' -> eron.mlutegar.com => http://localhost:3007"
