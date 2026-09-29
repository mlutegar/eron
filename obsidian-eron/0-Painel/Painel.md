# 🗂️ Painel — Integração Conta Azul → Questor Zen

Projeto: automatizar a publicação de boletos da **Conta Azul** no módulo **e-Doc do
Questor Zen** para a **ASSEJURC** (contato: Heron). Fornecedor: **IAZAN (João)**.

## Mapa do projeto
- [[Visao-Geral]] — objetivo, problema atual e solução
- [[Arquitetura]] — fluxo técnico CA → Integrador → Zen e endpoints validados
- [[Frontend]] — stack, telas e contrato de dados do dashboard
- [[Escopo-e-Comercial]] — incluso/fora, cronograma e valores
- [[Pendencias]] — o que falta validar/decidir
- [[Deploy]] — deploy no VPS, porta alocada e Cloudflare Tunnel

## Status atual
- ✅ Validação técnica em conta real (Venda 1591, R$ 10,00 — boleto IUGU IP)
- ✅ Front-end (dashboard) implementado com dados mock
- ⏳ Upload no Zen (e-Doc) — pendente de execução
- ⏳ Backend integrador (Node) — a construir
- 💰 Valor de implantação — a preencher

## Links rápidos
- Doc Conta Azul API · Questor Zen (Postman): ver [[Arquitetura]]
- Dashboard: `PycharmProjects/eron` (React + Vite)
