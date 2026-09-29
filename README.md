# IAZAN Sync — Dashboard (Conta Azul → Questor Zen)

Painel operacional da integração que publica automaticamente os boletos emitidos
na **Conta Azul** dentro do módulo **e-Doc do Questor Zen**.

O front-end usa dados **mock** (`src/data/mock.ts`) quando `VITE_API_URL` não está
definido. O backend Node em `server/` já oferece a API e o fluxo OAuth da Conta Azul,
mas sua rotina de publicação no Questor Zen ainda é simulada. Nenhuma das duas
modalidades deve ser usada para publicar boletos reais nesta fase.

## Stack
React 18 + Vite + TypeScript + Tailwind CSS + React Router.

## Rodar
```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # build de produção (checa TS)
npm run preview  # serve o build
```

Para testar o front-end ligado à API local de demonstração, rode em dois terminais:

```bash
cd server
npm install
npm run dev      # API em http://localhost:3001
```

```bash
# Na raiz do projeto, crie .env.local com VITE_API_URL=http://localhost:3001
npm run dev      # painel em http://localhost:5173
```

A API local ainda simula o upload no Zen. O painel mostra esse estado mesmo quando
`VITE_API_URL` está configurada.

## Telas
- **Painel** — fluxo de sincronização animado + contadores (hoje/semana/mês) + saúde.
- **Log de sincronização** — cada tentativa CA→Zen, com busca e filtro por status.
- **Quarentena** — boletos que exigem intervenção; ação de reprocessar.
- **Mapeamento de clientes** — CNPJ Conta Azul ↔ empresa Zen.
- **Status do sistema** — saúde de auth CA, Web Service Zen, PDF, banco, agendador.

## Integração real (próximo passo)
Implementar no backend a busca e o download do boleto na Conta Azul, ligar o
cliente e-Doc já preparado em `server/src/zen.ts` ao ciclo de publicação e
registrar os resultados de forma persistente. Antes da ligação, validar uma
publicação com empresa e boleto de teste escolhidos. Depois, configurar
`VITE_API_URL` no build do front-end. A camada
`src/api/client.ts` já faz as chamadas HTTP quando essa variável está definida.

# eron
