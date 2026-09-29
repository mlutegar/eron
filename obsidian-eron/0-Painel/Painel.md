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
- [[Melhorias]] — backend Node, validacao Zod, healthchecks e deploy script
- [[Credenciais]] — inventário de credenciais (sem valores) e como conectar a CA

## Status atual
- ✅ Validação técnica em conta real (Venda 1591, R$ 10,00 — boleto IUGU IP)
- ✅ Front-end implementado com dados mock
- ✅ Tela inicial simplificada: **ativador** ("ligar o robô") + log subiu/não subiu ([[Frontend]])
- ✅ Backend integrador (Node) — OAuth2 CA + cliente de API implementados ([[Arquitetura]])
- ✅ Conexão OAuth com a CA concluída (29/09) + PDF do boleto de teste (Venda 2246) lido pela API ([[Pendencias]])
- ✅ Upload no Zen (e-Doc) — envio único da Venda 2246 feito em 29/09 (ponta a ponta validado); falta conferência visual e o ciclo automático ([[Pendencias]])
- 💰 Valor de implantação — a preencher

## Links rápidos
- Doc Conta Azul API · Questor Zen (Postman): ver [[Arquitetura]]
- Dashboard: `PycharmProjects/eron` (React + Vite)
