# 5 · Pendências

← volta para [[Painel]] · anterior [[Escopo-e-Comercial]]

## Técnicas
- [ ] ⏳ Validar upload real no Zen (e-Doc) — endpoint `POST /api/edoc/...` ([[Arquitetura]])
- [ ] Confirmar formato/limite de arquivo aceito no e-Doc do cliente
- [ ] Backend integrador (Node) — a construir; front já pronto para plugar ([[Frontend]])
- [ ] Definir estratégia de renovação/armazenamento seguro de tokens

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

## Backlog de front (próximos)
- [ ] Sentry no front (hoje só ErrorBoundary com console)
- [ ] Notificação ativa (e-mail/WhatsApp) ao cair boleto em quarentena
- [ ] Virtualização da tabela se volume crescer muito
- [ ] Reconciliação de pagamento (novo escopo)
- [ ] Multi-tenant, caso IAZAN revenda a solução (novo escopo)
