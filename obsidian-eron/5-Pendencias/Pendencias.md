# 5 · Pendências

← volta para [[Painel]] · anterior [[Escopo-e-Comercial]]

## Técnicas
- [x] Backend integrador (Node) — estrutura pronta; OAuth CA + cliente de API implementados ([[Arquitetura]])
- [x] OAuth2 Conta Azul (start/callback/refresh/status) + persistência de tokens (arquivo JSON gitignored)
- [ ] 🔑 **Concluir o consentimento OAuth** — depende do **2FA** da conta CA. Abrir `/oauth/contaazul/start`, logar em `rio@assejurc.com.br`, aprovar 2FA e consentir. Ver [[Credenciais]]
- [ ] Registrar `redirect_uri` no portal de devs (localhost + URL do tunnel)
- [ ] Confirmar escopos necessários e os filtros da busca de contas a receber
- [x] Cliente e-Doc preparado conforme API do Zen: upload do PDF + cadastro do documento, com testes simulados (`server/src/zen.ts`)
- [ ] ⏳ Validar upload real no Zen com empresa e boleto de teste escolhidos — endpoints `/api/v1/{token}/upload/{arquivo}` e `/api/v1/{token}/documentos`
- [x] Token Zen validado em 29/09: consulta de categorias da API respondeu HTTP 200 e encontrou “Boleto” (sem upload)
- [ ] Conectar a conta de desenvolvimento da Conta Azul por OAuth, confirmar acesso aos boletos/PDFs de teste e ligar o fluxo ao cliente Zen
- [ ] Confirmar formato/limite de arquivo aceito no e-Doc do cliente
- [ ] Migrar persistência de tokens para PostgreSQL (hoje arquivo JSON)
- [ ] 🔁 Rotacionar o `client_secret` no portal (trafegou em texto no chat)

## Comerciais
- [ ] 💰 Definir valor de implantação (campo "[preencher]" em [[Escopo-e-Comercial]])
- [ ] Confirmar aceite por escrito do cliente + 1ª parcela

## Perguntas ao cliente
- [ ] Confirmar que usa Conta PJ Conta Azul IP (IUGU) — validado, reconfirmar em produção
- [ ] Todos os CNPJs finais estão cadastrados igualmente na CA e no Zen?
- [ ] Quem recebe alertas de quarentena/erros?

## Decisões de front (premissas — revisar)
- [x] Login no dashboard — implementado (fase mock, credencial em `.env`); trocar por sessão real do backend no go-live
- [ ] Definir credenciais reais de acesso (hoje `admin` / `iazan` via env)
- [ ] Quando backend existir, apontar `VITE_API_URL` e trocar `src/api/client.ts`

## Melhorias de front implementadas (28/09)
- [x] Login + rota protegida + logout ([[Frontend]])
- [x] Drawer de detalhe do boleto (PDF, IDs CA/Zen, histórico de tentativas)
- [x] Auto-refresh (60s) + indicador "atualizado há X" + botão atualizar
- [x] ErrorState com "tentar de novo" + ErrorBoundary global
- [x] Log: filtro por período, paginação e export CSV
- [x] Badge de contagem de quarentena no menu
- [x] Camada `client.ts` com fetch real via `VITE_API_URL` (fallback mock)
- [x] ESLint + Prettier + `.gitattributes`
- [x] Testes (Vitest + Testing Library) — 9 passando
- [x] CI (GitHub Actions): lint + test + build

## Tela inicial simplificada — ativador (28/09)
- [x] `/` agora é a tela **Ativar** (`src/pages/Activate.tsx`): botão "Ativar" → `runSync()` → log subiu/não subiu ([[Frontend]])
- [x] `getPending()` + `runSync()` em `client.ts` (mock); tipos `RunItem`/`RunResult`
- [x] Painel antigo (fluxo animado + cards) removido; menu renomeado "Painel" → "Ativar"
- [x] Backend expõe `GET /pending`, `POST /run`, `GET /last-run`, `GET/POST /settings` (`server/src/index.ts`)
- [ ] Testes reais só em **horário comercial** (banco pede código 2FA que só o cliente tem)
- [ ] Pedir ao cliente **boleto teste** + **cliente teste** no Questor p/ validar ponta a ponta

## Melhorias do ativador implementadas (28/09)
- [x] **Lock de execução** (front desabilita + backend responde 409) — evita boleto duplicado
- [x] **Idempotência**: `runSync` pula boletos já publicados (nunca sobe 2×)
- [x] **Última execução persistida** (`GET /last-run` + `localStorage` no mock) — aparece ao abrir
- [x] **Confirmação** antes de ligar o robô + trava contra clique duplo
- [x] **Resumo financeiro**: `valorPublicado` (R$ que subiu) no resultado
- [x] **Falhas agrupadas por motivo** + filtro "só falhas"
- [x] **Reprocessar só os que falharam** (reexecução idempotente)
- [x] **Exportar falhas em CSV** (reusa `src/lib/csv.ts`)
- [x] **Mensagem amigável de 2FA/sessão** da Conta Azul (backend 503 → texto orientando pedir código)
- [x] **Notificação ativa** ao terminar com falhas (`sendAlert` em `server/src/index.ts` / scheduler)
- [x] **Modo automático** (toggle) — agendador publica sozinho quando ligado (`/settings` + `scheduler.ts`)
- [x] **Log "ao vivo"** (revelação progressiva das linhas do resultado)
- [x] **Testes**: `Activate.test.tsx` (front) + casos de `runSync`/idempotência/settings (`server/src/store.test.ts`)

## Backlog de front (próximos)
- [ ] Sentry no front (hoje só ErrorBoundary com console)
- [ ] Notificação ativa (e-mail/WhatsApp) ao cair boleto em quarentena
- [ ] Virtualização da tabela se volume crescer muito
- [ ] Reconciliação de pagamento (novo escopo)
- [ ] Multi-tenant, caso IAZAN revenda a solução (novo escopo)
