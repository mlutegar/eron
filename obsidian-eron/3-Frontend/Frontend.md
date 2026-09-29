# 3 · Frontend (Dashboard)

← volta para [[Painel]] · anterior [[Arquitetura]] · próximo [[Escopo-e-Comercial]]

Local do código: `PycharmProjects/eron`.

## Stack
React 18 + Vite + TypeScript + Tailwind CSS + React Router. UI em português.
Dados **mock** nesta fase (`src/data/mock.ts`), com contrato tipado em
`src/types/api.ts`. Camada de acesso em `src/api/client.ts` (troca para `fetch`
real sem mexer nas telas).

## Telas
1. **Painel** (`/`) — fluxo animado CA ▸ Integrador ▸ Zen (assinatura visual),
   contadores hoje/semana/mês, valor no mês, quarentena, saúde do sistema.
2. **Log de sincronização** (`/log`) — tabela parcela→doc Zen, busca + filtro status.
3. **Quarentena** (`/quarentena`) — cards com motivo e ação "Reprocessar".
4. **Mapeamento de clientes** (`/clientes`) — CNPJ CA ↔ empresa Zen.
5. **Status do sistema** (`/status`) — saúde de auth CA, WS Zen, PDF, banco, agendador.

## Direção de design
Fundo grafite `#14161B`, acento verde-sincronizado `#3FD68C`, âmbar (atenção) e
vermelho (erro). Tipografia: Space Grotesk (display/números), Inter (corpo),
JetBrains Mono (IDs/CNPJ/datas). Acessível (foco por teclado, responsivo,
`prefers-reduced-motion`).

## Rodar
`npm install` → `npm run dev` (http://localhost:5173) · `npm run build`.

## Próximo passo de integração
Trocar corpo das funções de `src/api/client.ts` por chamadas HTTP ao backend.
Ver pendências em [[Pendencias]].
