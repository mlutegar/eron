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
