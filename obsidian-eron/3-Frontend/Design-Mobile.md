# 3.1 · Design Mobile & UX (Responsivo)

← volta para [[Frontend]] · [[Painel]]

Rodada de melhorias de responsividade, acessibilidade e UX do dashboard
(`PycharmProjects/eron`), mantendo o visual e adicionando tema claro/escuro.
Breakpoints: `sm` = 640px, `md` = 768px.

## 1. Tabelas → cards no mobile
`src/components/DataTable.tsx` renderiza **uma única variante** via
`useMediaQuery("(max-width: 767px)")` (`src/lib/useMediaQuery.ts`) — evita conteúdo
duplicado no DOM/leitor de tela:
- Desktop: `<table>` com **cabeçalho fixo** (`sticky top-0`).
- Mobile: cada linha vira um card com rótulo + valor e **borda esquerda colorida** por
  status (`rowAccent`), sem scroll horizontal. Cor vem de `statusAccent` (StatusBadge).

## 2. Navegação mobile
- **Bottom nav** fixa (`src/components/BottomNav.tsx`) com 5 ícones + badge de quarentena.
- **Drawer** (hambúrguer no header) para ações secundárias (tema, logout, org):
  fecha com **Esc**, **trava o scroll** do body e **foca o primeiro link** (`AppShell.tsx`).

## 3. Tema claro/escuro
- Cores migradas para **CSS variables** (canais RGB) em `src/index.css`
  (`:root`/`[data-theme]`), mapeadas no `tailwind.config.js` como
  `rgb(var(--x) / <alpha-value>)` — preserva opacidades (`bg-flow/10` etc.).
- `src/theme/ThemeContext.tsx`: alterna `data-theme`, persiste em `localStorage`,
  respeita `prefers-color-scheme`. Toggle no header (desktop) e no drawer (mobile).

## 4. Loading, feedback e estado
- **Skeletons** no formato de cada tela (`src/components/Skeleton.tsx`) substituem o
  spinner genérico em Overview, Log, Quarentena, Clientes e Status.
- **Toasts** (`src/components/Toast.tsx`): confirmação em "Reprocessar" e "Exportar CSV"
  (`aria-live`). `useToast` degrada para no-op fora do provider (testes).
- **FAB de atualizar** no mobile da Overview; ícone gira durante o refresh.

## 5. Acessibilidade
- `fg-faint` clareado (de `#69707E`) para melhorar contraste (WCAG AA).
- `aria-live` no "atualizado há X" e no status "Servico ativo"; `role="dialog"`
  + `aria-modal` no drawer/bottom sheet; `aria-current` automático via `NavLink`.

## 6. Log: filtros persistentes + bottom sheet
`src/pages/SyncLog.tsx`: filtro/período/busca/página em **query params** (`useSearchParams`)
— estado compartilhável e preservado ao voltar. No mobile, filtros num **bottom sheet**
com contador de filtros ativos e botão "Limpar".

## Deixado como futuro
- **Virtualização** da tabela (react-window): desnecessária hoje (Log paginado, dados
  mock). Reavaliar quando o volume real crescer.

## Verificação
- `npx tsc --noEmit`, `npm run build` e `npm run lint` (0 erros) OK.
- `npm test` → 15 testes passam (inclui `DataTable.test.tsx` cobrindo a coluna Status).
- DevTools ~375px: cards sem scroll horizontal, bottom nav, drawer, bottom sheet de
  filtros e toggle de tema funcionando; desktop inalterado.

Relacionado: [[Pendencias]]
