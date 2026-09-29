# 🛠️ Melhorias implementadas

Rodada de melhorias sobre o projeto. Voltar ao [[Painel]] · relacionado:
[[Arquitetura]] · [[Frontend]] · [[Deploy]] · [[Pendencias]] · [[Credenciais]]

## 0. Robustez do integrador OAuth CA (rodada 29/09)
Endurecimento da integração real com a Conta Azul (`server/src/`):
- **HTTP com timeout + retry/backoff** (`http.ts`): retenta 5xx/429 (respeita
  `Retry-After`), não retenta 4xx. Usado no token endpoint e nas chamadas de API.
- **Refresh com singleflight** (`contaazul.ts`): um único refresh concorrente —
  evita invalidar o refresh_token por corrida.
- **Tokens cifrados em repouso** (`tokenStore.ts`): AES-256-GCM via `TOKEN_ENC_KEY`
  (fallback texto puro só em dev, com aviso).
- **PKCE (S256)** no fluxo authorize/callback; `state` com verifier e expiração (10 min).
- **/health reflete o OAuth real**: serviço `auth-ca` mostra OK/ATENÇÃO/FALHA
  conforme conectado/expirado (`store.setAuthState`).
- **Alertas ativos** (`notify.ts`): webhook opcional (`ALERT_WEBHOOK_URL`) em falha
  de refresh/sync, com cooldown anti-spam.
- **Rota `POST /oauth/contaazul/disconnect`** (limpa tokens) + páginas HTML no callback.
- **Validação Zod** das respostas de token e da API (schemas permissivos p/ não quebrar).
- **Logs estruturados** (JSON, `logger.ts`) e **dedup por idCobranca** no scheduler.
- **Testes**: `contaazul.test.ts` (5) — authorize/PKCE, exchange, refresh, erro 4xx.
  Total do backend: 9/9 verdes.

## 1. Backend integrador (Node) — `server/`
API Express + TypeScript que serve exatamente o contrato consumido pelo front
(`src/api/client.ts`). Fase atual: store em memoria (`server/src/store.ts`) +
agendador stub (`server/src/scheduler.ts`), pronta para trocar por PostgreSQL e
pela integracao real CA→Zen.
- Endpoints: `/overview`, `/sync-logs`, `/boletos/:id/logs`, `/quarantine`,
  `/quarantine/:id/reprocess`, `/clients`, `/health`, `/healthz`.
- Auth Bearer opcional (`API_TOKEN`), CORS configuravel (`ALLOWED_ORIGIN`).
- `/health` reflete o estado real do agendador (ultima/proxima sync).
- Testes: `server/src/store.test.ts` (4/4 verdes). Build e smoke test OK.

## 2. Validacao de contrato com Zod (front)
`src/types/api.ts` reescrito com schemas Zod; os tipos sao derivados via
`z.infer` (fonte unica: contrato + validacao). Em modo HTTP, `src/api/client.ts`
valida toda resposta com `safeParse` — payload divergente falha cedo e legivel.
Suporte a `VITE_API_TOKEN` (Bearer) no client.

## 3. Correcao de valores magicos no Overview
`getOverview` (mock) nao usa mais data fixa `"2026-09-28"` nem somas magicas
(`+12`, `+225_000`). Agora deriva hoje/semana/mes de uma **data de referencia**
(a mais recente do log) e soma `valorMes` apenas dos boletos sincronizados do mes.
Mesma logica no backend (`store.getOverview`).

## 4. Deploy e operacao
- `docker-compose.yml`: adicionado servico `eron-api` (porta interna 3008 no VPS)
  + `healthcheck` em ambos os servicos.
- `Dockerfile` (front) e `server/Dockerfile` com `HEALTHCHECK`.
- `deploy.ps1`: empacota (tar sem lixo) + scp + `docker compose up -d --build`
  em um comando.

## Portas no VPS
- Front: `127.0.0.1:3007` · API: `127.0.0.1:3008` (ambas internas, so via tunnel).

## Ja existentes (rodada anterior, commit ff6fb2a)
Login/auth, ErrorBoundary, testes (Vitest), CI (`.github/workflows/ci.yml`),
export CSV, drawer de boleto, auto-refresh, filtros — nao refeitos.

## Pendencia conhecida
Ha um redesign mobile em andamento (Toast/BottomNav/Skeleton/theme). O teste
`src/pages/SyncLog.test.tsx` precisa passar a envolver o `ToastProvider` no
`render` para voltar ao verde — ajuste do lado do redesign, nao destas melhorias.
