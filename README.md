# IAZAN Sync — Dashboard (Conta Azul → Questor Zen)

Painel operacional da integração que publica automaticamente os boletos emitidos
na **Conta Azul** dentro do módulo **e-Doc do Questor Zen**.

> Front-end desta fase. O backend (integrador Node) ainda não existe — a UI roda
> contra uma camada de dados **mock** (`src/data/mock.ts`) com contrato tipado
> (`src/types/api.ts`), pronta para trocar por chamadas HTTP reais em
> `src/api/client.ts` sem alterar as telas.

## Stack
React 18 + Vite + TypeScript + Tailwind CSS + React Router.

## Rodar
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de produção (checa TS)
npm run preview  # serve o build
```

## Telas
- **Painel** — fluxo de sincronização animado + contadores (hoje/semana/mês) + saúde.
- **Log de sincronização** — cada tentativa CA→Zen, com busca e filtro por status.
- **Quarentena** — boletos que exigem intervenção; ação de reprocessar.
- **Mapeamento de clientes** — CNPJ Conta Azul ↔ empresa Zen.
- **Status do sistema** — saúde de auth CA, Web Service Zen, PDF, banco, agendador.

## Integração real (próximo passo)
Substituir o corpo das funções em `src/api/client.ts` por `fetch` ao backend,
mantendo as mesmas assinaturas e os tipos de `src/types/api.ts`.

# eron
