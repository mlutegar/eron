# 5 · Pendências

← volta para [[Painel]] · anterior [[Escopo-e-Comercial]]

## Técnicas
- [x] Backend integrador (Node) — estrutura pronta; OAuth CA + cliente de API implementados ([[Arquitetura]])
- [x] OAuth2 Conta Azul (start/callback/refresh/status) + persistência de tokens (arquivo JSON gitignored)
- [x] 🔑 **Consentimento OAuth concluído em 29/09** com o app do portal do Heron ("Integração boletos para Questor"). Fluxo usado: URL de autorização copiada do portal → login + 2FA → redirect em `https://google.com/?code=...` → `npm run ca:exchange -- "<url>"` (código vale 3 min). Tokens em `server/.tokens.json`. Ver [[Credenciais]]
- [ ] Registrar `redirect_uri` no portal de devs (hoje `https://google.com`, editável em "Editar informações"). Só precisa mudar quando o consentimento for feito pelo callback do servidor; o refresh_token atual (5 anos) pode ser copiado para a VPS
- [ ] Confirmar escopos necessários e os filtros da busca de contas a receber
- [x] Cliente e-Doc preparado conforme API do Zen: upload do PDF + cadastro do documento, com testes simulados (`server/src/zen.ts`)
- [x] Upload real no Zen validado em 29/09 — endpoints `/api/v1/{token}/upload/{arquivo}` e `/api/v1/{token}/documentos` funcionam como no cliente `server/src/zen.ts`
- [x] Token Zen validado em 29/09: consulta de categorias da API respondeu HTTP 200 e encontrou “Boleto” (sem upload)
- [x] Boleto de teste lido pela API em 29/09 — Venda 2246 (R$ 100, venc. 02/10, Leonardo Augusto Andrade Neves, **CPF**). PDF idêntico ao emitido pela CA. Nada enviado ao Zen
- [x] **Envio único ao Zen feito em 29/09** (`npm run publicar:teste -- --parcela <id> --documento <cpf> --confirmar`): PDF da Venda 2246 publicado no e-Doc do cliente de teste Leonardo (CPF 41323983821, já existia no Zen; e-mail da Marina) — documentId `6abc288c5f0ded141039c74e`, fileId `6abc288c7f61cbbef2d71a11`. Falta a conferência visual (pasta/valor/vencimento/e-mail)
- [x] **Ciclo real implementado (29/09)**: detecção + entrega + tentativas + banco SQLite + travas (`server/src/sync.ts`, `db.ts`, `regras.ts`); 43 testes com CA/Zen simulados. Nasce DESLIGADO (`envioHabilitado=false`).
- [x] E-mails de operação no ar (29/09): Resend, domínio `avisos.iazan.com.br` (conta iazan.corp, DNS no Cloudflare via auto configure; domínio principal intacto), remetente `IAZAN Sync <robo@avisos.iazan.com.br>`. Alertas (falha definitiva, Zen instável, falha de rodada) + resumo diário 18h para os 7 destinatários salvos em settings. Resumo de 29/09 marcado como enviado para não disparar; primeiro resumo real 30/09 18h. Teste enviado só para marinaseveriano@gmail.com
- [x] Painel: tela Ativar com controles do robô (chave geral, automático, data de corte, limite) e todas as telas lendo a API real (29/09; local via `.env.local` com `VITE_API_URL=http://localhost:3001`)
- [x] Login real do painel (29/09): usuários no SQLite (`npm run usuario -- criar <login>`), sessão assinada 12h, API exige sessão quando há usuários; modo mock mantém admin/iazan só para demonstração
- [x] Front na VPS com `VITE_API_URL=/api` e nginx proxy `/api/` (29/09)
- [x] Deploy na VPS feito em 29/09 (robô real, travado: chave geral off + sem `ZEN_API_TOKEN`); ver [[Deploy]]
- [ ] Ativação oficial: **01/10/2026**, pelo Heron. Nenhum envio real antes disso.
- [ ] Confirmar formato/limite de arquivo aceito no e-Doc do cliente
- [ ] Migrar persistência de tokens para o SQLite (hoje arquivo JSON no mesmo volume)
- [ ] 🔁 Rotacionar o `client_secret` do app de **teste da Marina** (trafegou em texto no chat). O app do Heron, que é o usado agora, não vazou

## Comerciais
- [ ] 💰 Definir valor de implantação (campo "[preencher]" em [[Escopo-e-Comercial]])
- [ ] Confirmar aceite por escrito do cliente + 1ª parcela

## Perguntas ao cliente
- [ ] Confirmar que usa Conta PJ Conta Azul IP (IUGU) — validado, reconfirmar em produção
- [ ] Todos os CNPJs finais estão cadastrados igualmente na CA e no Zen?
- [ ] Quem recebe alertas de quarentena/erros?

## Decisões de front (premissas — revisar)
- [x] Login no dashboard — implementado (fase mock, credencial em `.env`); trocar por sessão real do backend no go-live
- [x] Usuário `admin` criado na VPS e `SESSION_SECRET` definido (29/09); mais usuários sob demanda
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
