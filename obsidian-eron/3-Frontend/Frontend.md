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

## Recursos (implementados)
- **Login** + rota protegida + logout (`src/auth/AuthContext.tsx`, credencial em `.env`)
- **Detalhe do boleto** em drawer: PDF, IDs CA/Zen, histórico de tentativas
- **Auto-refresh** (60s) com indicador "atualizado há X" e botão atualizar
- **Log**: filtro por status e período, paginação, busca e **export CSV**
- **Badge** de quarentena no menu; **ErrorBoundary** + estados de erro com retry
- `client.ts` faz **fetch real** se `VITE_API_URL` existir; senão usa mock

## Qualidade
- Scripts: `npm run dev | build | lint | format | test`
- ESLint + Prettier + `.gitattributes` (LF)
- Testes: Vitest + Testing Library (`format`, `AuthContext`, `SyncLog`) — 9 ok
- CI: `.github/workflows/ci.yml` (lint + test + build no push/PR)

## Rodar
`npm install` → `npm run dev` (http://localhost:5173). Login padrão: `admin` / `iazan`.

## Próximo passo de integração
Definir `VITE_API_URL` (ver `.env.example`) apontando para o backend integrador.
As telas não mudam. Ver pendências em [[Pendencias]].
