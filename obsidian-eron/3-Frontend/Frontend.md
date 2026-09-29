# 3 · Frontend (Dashboard)

← volta para [[Painel]] · anterior [[Arquitetura]] · próximo [[Escopo-e-Comercial]]

Local do código: `PycharmProjects/eron`.

## Stack
React 18 + Vite + TypeScript + Tailwind CSS + React Router. UI em português.
Dados **mock** nesta fase (`src/data/mock.ts`), com contrato tipado em
`src/types/api.ts`. Camada de acesso em `src/api/client.ts` (troca para `fetch`
real sem mexer nas telas).

## Telas
1. **Ativar** (`/`) — tela inicial simplificada (`src/pages/Activate.tsx`). Um botão
   grande **"Ativar"** liga o robô: varre os boletos **pendentes**, sobe cada um no
   e-Doc do Zen batendo pelo nome/CNPJ do cliente e mostra o **log da execução**
   (subiu ✅ / não subiu ❌ + motivo) com resumo `X subiram · Y não subiram`.
   Antes de rodar exibe a contagem de pendentes; clique numa linha abre o detalhe.
2. **Log de sincronização** (`/log`) — tabela parcela→doc Zen, busca + filtro status.
3. **Quarentena** (`/quarentena`) — cards com motivo e ação "Reprocessar".
4. **Mapeamento de clientes** (`/clientes`) — CNPJ CA ↔ empresa Zen.
5. **Status do sistema** (`/status`) — saúde de auth CA, WS Zen, PDF, banco, agendador.

> A antiga tela de Painel (fluxo animado + cards de contadores) foi removida em favor
> do ativador — o uso real é operacional/sob demanda, não monitoramento contínuo.
> Contrato: `getPending()`, `runSync()`, `getLastRun()`, `getSettings()`/`setSettings()`
> em `src/api/client.ts` (mock; backend real via `POST /run`, `GET /pending`,
> `GET /last-run`, `GET/POST /settings`). Tipos `RunItem`/`RunResult`/`Settings` em
> `src/types/api.ts`.
>
> Recursos do ativador: lock contra clique duplo + 409 no backend, idempotência
> (não sobe o mesmo boleto 2×), última execução persistida, confirmação antes de rodar,
> resumo financeiro (R$ publicado), falhas agrupadas por motivo, filtro "só falhas",
> reprocessar só as falhas, export CSV das falhas, mensagem amigável de 2FA/sessão da CA,
> notificação ao terminar com falhas e **modo automático** (agendador publica sozinho).

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

## Responsivo / Mobile
Ver [[Design-Mobile]] — tabelas viram cards no celular e menu em drawer (hambúrguer).

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
