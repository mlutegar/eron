# 🚀 Deploy — VPS + Cloudflare Tunnel

Deploy do dashboard estático (Vite + React + nginx) no VPS Hostinger, exposto via
Cloudflare Tunnel "emme" (domínio `mlutegar.com`).

Voltar ao [[Painel]] · relacionado: [[Arquitetura]] · [[Frontend]]

## Infra
- **VPS:** `179.198.98.180` (srv1858777.hstgr.cloud), user `root`
- **Diretório no VPS:** `/root/eron`
- **Container:** `eron` (imagem multi-stage: `node:20-alpine` build → `nginx:alpine`)
- **Porta interna:** 80 (nginx, com fallback SPA para React Router)

## Porta alocada
- Desejada: **3000** → ❌ ocupada pelo `taskor`.
- Faixa 3000–3006 e 3024–3042 estavam todas ocupadas por outros projetos.
- **Porta final:** **3007** (primeira livre a partir de 3001).
- Bind em `127.0.0.1:3007:80` — **não** exposta publicamente por IP; acesso só via túnel.
- Remapeamento: `3000 → 3007`.

## Cloudflare Tunnel (colar no dashboard, túnel "emme" → Public Hostnames)
- **Subdomain:** `eron.mlutegar.com`
- **Service:** `http://localhost:3007`
- URL final após adicionar o hostname: **https://eron.mlutegar.com**
- Até adicionar o hostname no painel, o app só responde internamente no VPS.

## Comandos úteis (em `/root/eron`)
```bash
docker compose logs -f      # logs
docker compose restart      # reiniciar
docker compose down         # parar
docker compose up -d --build  # rebuild + subir
```

## Verificações feitas
- `docker compose ps` → `eron` Up, `127.0.0.1:3007->80/tcp`
- `curl http://127.0.0.1:3007` → HTTP 200
- `curl http://127.0.0.1:3007/quarantine` → HTTP 200 (fallback SPA OK)

## Atualização 28/09 — front (ativador) + API
- Enviado via `tar + scp` (Windows, sem rsync); `.env`/`node_modules`/`.git`/`dist` excluídos.
- **Não havia `.env` no VPS** — nenhum secret a preservar; compose usa defaults `${VAR:-}`.
- ⚠️ `tar -x` **não apaga** arquivos removidos localmente: foi preciso `rm src/pages/Overview.tsx`
  obsoleto no VPS (quebrava o build por importar `OverviewSkeleton`). Lição: apagar no VPS
  os arquivos deletados localmente antes de rebuildar.
- Agora sobem **2 serviços**: `eron` (front, 3007→80) e `eron-api` (API Node, 3008→3001).
- Volume `eron_eron-api-data` (`/data/.tokens.json`) para tokens OAuth da Conta Azul.
- Rebuild: `docker compose up -d --build` (só o projeto eron; nenhum outro container tocado).
- Healthy: front HTTP 200; API `/healthz` `{"status":"ok"}`; `cloudflared` active.
- URLs mantidas (portas inalteradas): **https://eron.mlutegar.com** (túnel "emme" → `localhost:3007`).


## Atualização 29/09 (noite) — robô real no ar, travado
- Deploy pelo **`deploy.sh`** (Mac/Linux; tar + scp; apaga `src/`, `server/src/`, `server/scripts/`, `public/`, `obsidian-eron/` na VPS antes de extrair, para não sobrar arquivo morto).
- **`/root/eron/.env`** criado (600): credenciais da CA, `SESSION_SECRET`, `TOKEN_ENC_KEY`, `ALLOWED_ORIGIN`, `VITE_API_URL=/api`. **`ZEN_API_TOKEN` vazio de propósito**: sem ele nenhuma rodada começa (`ZEN_NAO_CONFIGURADO`). Entra só na ativação.
- Front buildado com `VITE_API_URL=/api`; nginx encaminha `/api/` → `eron-api:3001/` (mesma origem, sem CORS). `/oauth/contaazul/*` continua exposto.
- Imagens em Node 24 (`node:sqlite`). Volume `eron_eron-api-data` = `/data` com `eron.db` + `.tokens.json`.
- Conexão da Conta Azul copiada para o volume (`docker cp` → `/data/.tokens.json`, chmod 600). **A cópia local foi apagada**: a CA troca o refresh_token a cada renovação, só um lugar pode renovar.
- Usuário do painel `admin` criado (`docker compose exec eron-api node scripts/usuario.mjs criar admin`). Credenciais em `~/Documents/ChatGPT/heron/acessos-painel.txt` (fora do repo).
- Verificado: front 200, `/api/healthz` ok, `/api/settings` 401 sem login, login ok, settings tudo `false`, detecção rodou (14 boletos aguardando), containers healthy.
- **Ativação (01/10):** colocar `ZEN_API_TOKEN` no `.env` da VPS → `docker compose up -d eron-api` → no painel: data de corte 2026-10-01, chave geral, modo automático.
