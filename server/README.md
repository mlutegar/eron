# IAZAN Sync — Backend integrador

API que serve o contrato consumido pelo dashboard (`src/api/client.ts`), o fluxo
OAuth da Conta Azul e o **robô** que publica boletos no e-Doc do Questor Zen.

## Rodar
```bash
npm install
npm run dev     # tsx watch, porta 3001
npm run build   # compila para dist/
npm start       # roda dist/index.js
npm test        # vitest (Conta Azul e Zen simulados; nenhuma chamada de rede)
```

Configuração em `server/.env` (ver `.env.example`). Estado persistido em SQLite
(`DB_PATH`, padrão `.eron.db`; em produção `/data/eron.db` no volume Docker).

## Como o robô funciona (`src/sync.ts`)

A cada `SYNC_INTERVAL_MIN` minutos (padrão 10) o agendador roda um ciclo:

1. **Detectar** (24h, só leitura na Conta Azul): busca parcelas de contas a
   receber alteradas nos últimos 10 dias (nunca antes da **data de corte**),
   consulta o detalhe de cada parcela nova/alterada e guarda no banco:
   - `REGISTRADO`: boleto bancário registrado, aguardando publicação;
   - `IGNORADO`: sem boleto (pix, cartão, quitada, ou boleto compartilhado com
     outra parcela). É reavaliada se a Conta Azul alterar a parcela.
2. **Entregar** (só das 7h às 19h de Brasília, e só se `envioHabilitado` e
   `autoRun` estiverem ligados): para cada parcela pronta, até `limitePorRodada`,
   obtém o CPF/CNPJ pela venda, confirma a cobrança, baixa o PDF, localiza o
   cliente no Zen e publica na pasta Boleto com valor e vencimento.
3. **Falhas**: nova tentativa em 1h, 6h, 1 dia, 3, 7 e 30 dias (`QUARENTENA`);
   na 7ª falha vira `ERRO` (definitiva) e dispara alerta.

Regras puras em `src/regras.ts`; banco em `src/db.ts`; leitura do painel em
`src/store.ts`.

### Travas de segurança
- `envioHabilitado=false` (padrão): **nada** é publicado, nem pelo botão Ativar.
- `dataCorte`: só boletos emitidos a partir dela entram. Ao habilitar o envio sem
  data de corte, ela vira o dia atual (nunca publicamos o passado por acidente).
- `limitePorRodada` (padrão 20) e lock contra rodadas simultâneas.
- Idempotência pelo id da parcela/cobrança no banco: um boleto nunca sobe duas
  vezes, mesmo reiniciando o servidor. Um boleto que cobre várias parcelas sobe
  uma vez só.
- O botão **Ativar** (`POST /run`) roda uma rodada manual: ignora o horário e o
  `autoRun`, mas respeita a chave geral, a data de corte e o limite.

Tudo isso é configurável em `GET/POST /settings`
(`autoRun`, `envioHabilitado`, `dataCorte`, `limitePorRodada`, `destinatarios`).

## Login do painel

Usuários ficam no SQLite com senha em scrypt; a sessão é um token assinado
(`SESSION_SECRET`, 12 h) enviado em `Authorization: Bearer`. Regra de acesso à API:
`API_TOKEN` (integrações) **ou** sessão válida; sem `API_TOKEN` e sem usuários a API
fica aberta (só dev; o log avisa). Cinco senhas erradas no mesmo minuto bloqueiam a
origem por 1 minuto.

```bash
npm run usuario -- criar heron      # pede a senha no terminal (ou SENHA=... no ambiente)
npm run usuario -- listar
npm run usuario -- remover heron
```

## Scripts de apoio (a partir de `server/`, após `npm run build`)

| Comando | O que faz |
|---|---|
| `npm run usuario -- criar\|listar\|remover` | Usuários do painel. |
| `npm run check:zen` | Consulta de leitura às categorias do Zen (valida o token). |
| `npm run ca:get -- /v1/...` | GET autenticado na API da Conta Azul, imprime o JSON. |
| `npm run ca:exchange -- "<url com ?code=>"` | Troca manual do código OAuth quando o redirect registrado não aponta para este servidor. |
| `npm run probe:boleto -- <id da cobrança>` | Baixa o PDF de um boleto e salva em pasta temporária. Não chama o Zen. |
| `npm run publicar:teste -- --parcela <id> --documento <cpf/cnpj> [--confirmar]` | Envio único e controlado de um boleto ao Zen. Sem `--confirmar`, só simula. |

## Conta Azul: o que foi validado na conta real (29/09/2026)

- OAuth: `login.contaazul.com/#/oauth/authorize` → `api-v2.contaazul.com/oauth/token`
  (Basic `client_id:client_secret`); refresh automático confirmado.
- `GET /v1/financeiro/eventos-financeiros/contas-a-receber/buscar` exige
  `data_vencimento_de/ate`; aceita `data_alteracao_de/ate` e `data_criacao_de/ate`
  (data-hora ISO), `status=EM_ABERTO`, `pagina`, `tamanho_pagina`.
- `GET /v1/financeiro/eventos-financeiros/parcelas/{id}` →
  `metodo_pagamento`, `solicitacoes_cobrancas[].id` (a cobrança), `status_solicitacao_cobranca`.
- `GET /v1/venda/{id}` → `cliente.documento` (CPF/CNPJ).
- `GET /v1/financeiro/eventos-financeiros/contas-a-receber/cobranca/{id}` → `{ id, url, status }`.
- PDF: `GET https://public.contaazul.com/payments/billing/charge/file/{id da cobrança}`,
  público, sem token, não documentado (pode mudar sem aviso).

## Questor Zen

`src/zen.ts` implementa `clientes/{cpf|cnpj}`, `categorias`, `upload/{arquivo}` e
`documentos`. O Zen avisa por e-mail os **Usuários do Cliente** (logins do portal)
quando um documento entra; o e-mail do cadastro no CRM não é usado para isso.
