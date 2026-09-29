# 2 · Arquitetura

← volta para [[Painel]] · anterior [[Visao-Geral]] · próximo [[Frontend]]

## Fluxo (validado em campo)
```
Conta Azul (OAuth2)  ──►  Integrador (Node/Railway)  ──►  Questor Zen (token)
   vendas / PDF              dedup + quarentena              e-Doc / upload
                                   │
                                   ▼
                             PostgreSQL (dedup + log)
```

## Endpoints Conta Azul (identificados; validar na conta conectada)
1. OAuth2 — autenticação ✅
2. `GET /v1/financeiro/eventos-financeiros/contas-a-receber/buscar` — parcelas ✅
3. `GET /v1/financeiro/eventos-financeiros/parcelas/{id}` — detalhe + id cobrança ✅
4. `GET /v1/financeiro/eventos-financeiros/contas-a-receber/cobranca/{id}` — status ✅
5. `GET https://public.contaazul.com/payments/billing/charge/file/{id}` — PDF ✅ validado 29/09 com a Venda 2246 (boleto de teste, R$ 100). `{id}` é o **id da solicitação de cobrança** (`parcelas/{id}.solicitacoes_cobrancas[0].id`, o mesmo `id` devolvido por `/cobranca/{id}`). O `id_referencia` da fatura (o da URL `faturas.contaazul.com/#/fatura/visualizar/...`) dá HTTP 500. Endpoint público (sem token) e não documentado — pode mudar sem aviso.

## Questor Zen
- API pública (Postman): https://documenter.getpostman.com/view/19136635/UyxhonL3
- Host por cliente: `https://{dominio}.app.questorpublico.com.br`
- Auth: Token do usuário (Minha Conta → Token API, perfil Administrador)
- e-Doc aceita upload até 20 MB; requer Tipo de Documento "Boleto" + Cliente + Usuário WS
- `POST {dominio}.app.questorpublico.com.br/api/edoc/...` — upload ⏳ (ver [[Pendencias]])

## OAuth2 Conta Azul (implementado no backend)
Fluxo Authorization Code (Cognito). Rotas no `server/` (`src/contaazul.ts` + `index.ts`):
1. `GET /oauth/contaazul/start` → gera `state` e redireciona para o `authorize`.
2. Usuário loga na CA (`rio@assejurc.com.br`) + 2FA e consente.
3. CA volta em `GET /oauth/contaazul/callback?code&state`.
4. `exchangeCode` troca o `code` por `access_token` (1h) + `refresh_token` (~5 anos).
5. `getValidAccessToken` renova sozinho quando faltam <60s (grant `refresh_token`).
6. `GET /oauth/contaazul/status` informa se está conectado.

Endpoints/escopos são via env (defaults = doc oficial):
- authorize `https://login.contaazul.com/#/oauth/authorize` (doc oficial atual; o portal de devs gera essa URL)
- token `https://api-v2.contaazul.com/oauth/token` — Basic `client_id:client_secret` no header, **sem** `client_id` no body (doc: /changecode e /renewingaccesstoken). ⚠️ `auth.contaazul.com` era do portal antigo (chat de maio) — não usar.
- scope `openid profile aws.cognito.signin.user.admin` · API base `https://api-v2.contaazul.com`

Tokens persistidos em arquivo JSON gitignored (`server/src/tokenStore.ts`,
`CA_TOKENS_PATH`); em prod via volume Docker `/data`. Interface pronta p/ Postgres.
⚠️ `redirect_uri` deve casar EXATAMENTE com o registrado no portal de devs
(localhost em dev, URL do tunnel em prod — ver [[Deploy]]). Credenciais: [[Credenciais]].

## Match de cliente
CNPJ da CA → empresa no Zen (mapeamento inicial + fallback quarentena).

## Stack
Node.js + TypeScript · PostgreSQL · Railway · Sentry + healthcheck · Front React+Vite.
