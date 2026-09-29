# IAZAN Sync — Backend integrador

API que serve o contrato consumido pelo dashboard (`src/api/client.ts`).
Fase atual: dados em memoria (`src/store.ts`) + agendador stub (`src/scheduler.ts`).

## Rodar
```bash
npm install
npm run dev     # tsx watch, porta 3001
npm run build   # compila para dist/
npm start       # roda dist/index.js
npm test        # vitest
```

## Endpoints
- `GET /overview` · `GET /sync-logs` · `GET /boletos/:id/logs`
- `GET /quarantine` · `POST /quarantine/:id/reprocess`
- `GET /clients` · `GET /health`
- `GET /healthz` — healthcheck do container (sempre publico)

## Variaveis (ver `.env.example`)
`PORT`, `API_TOKEN` (Bearer opcional), `ALLOWED_ORIGIN` (CORS), `SYNC_INTERVAL_MIN`.

## Integracao real (proximo passo)
Trocar `store.ts` por acesso ao PostgreSQL e `scheduler.ts` pelo ciclo real:
autenticar Conta Azul -> buscar cobrancas -> baixar PDF -> publicar no e-Doc do
Questor Zen -> gravar log/quarentena.
