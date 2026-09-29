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

## Endpoints Conta Azul (validados)
1. OAuth2 — autenticação ✅
2. `GET /v1/financeiro/eventos-financeiros/contas-a-receber/buscar` — parcelas ✅
3. `GET /v1/financeiro/eventos-financeiros/parcelas/{id}` — detalhe + id cobrança ✅
4. `GET /v1/financeiro/eventos-financeiros/contas-a-receber/cobranca/{id}` — status ✅
5. `GET https://public.contaazul.com/payments/billing/charge/file/{id}` — PDF ✅

## Questor Zen
- API pública (Postman): https://documenter.getpostman.com/view/19136635/UyxhonL3
- Host por cliente: `https://{dominio}.app.questorpublico.com.br`
- Auth: Token do usuário (Minha Conta → Token API, perfil Administrador)
- e-Doc aceita upload até 20 MB; requer Tipo de Documento "Boleto" + Cliente + Usuário WS
- `POST {dominio}.app.questorpublico.com.br/api/edoc/...` — upload ⏳ (ver [[Pendencias]])

## Match de cliente
CNPJ da CA → empresa no Zen (mapeamento inicial + fallback quarentena).

## Stack
Node.js + TypeScript · PostgreSQL · Railway · Sentry + healthcheck · Front React+Vite.
