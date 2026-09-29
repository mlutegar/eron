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
- [ ] Precisa de autenticação/login real no dashboard? (hoje: sem login)
- [ ] Quando backend existir, apontar `VITE_API_URL` e trocar `src/api/client.ts`
