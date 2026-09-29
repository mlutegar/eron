# IAZAN Sync — Backend integrador

API que serve o contrato consumido pelo dashboard (`src/api/client.ts`).
Fase atual: dados em memoria (`src/store.ts`) + agendador stub (`src/scheduler.ts`).

## Rodar
```bash
npm install
npm run dev     # tsx watch, porta 3001
npm run build   # compila para dist/
npm start       # roda dist/index.js
npm test        # vitest
```

## Verificar acesso ao Questor Zen

Preencha `ZEN_BASE_URL` e `ZEN_API_TOKEN` em `server/.env` (arquivo ignorado pelo
Git) e execute `npm run check:zen`. O comando faz somente uma consulta de leitura
às categorias do Zen e informa se a categoria “Boleto” está disponível. Ele não
envia documentos nem imprime o token.

## Envio ao e-Doc preparado

`src/zen.ts` implementa as duas etapas documentadas pela API do Zen: enviar o
PDF (`/upload`) e registrar o documento (`/documentos`). Antes de enviar, consulta
a categoria Boleto e confirma que o CNPJ corresponde ao cliente encontrado no
Zen. O código valida PDF, vencimento e valor, e só considera publicado quando
recebe o ID do documento. Os testes de `src/zen.test.ts` simulam todas as
respostas: não fazem upload real.

O cliente Zen **ainda não está ligado** a `POST /run` nem ao agendador. Para testar
uma publicação de verdade, é preciso selecionar uma empresa de teste no Zen e
um boleto de teste em PDF. Depois disso, falta ligar esse cliente ao ciclo da
Conta Azul e persistir IDs e resultados para evitar duplicidades.

## Conta Azul de desenvolvimento

Um App de Desenvolvimento no portal da Conta Azul fornece `client_id`,
`client_secret` e uma conta ERP temporária com dados fictícios. Para iniciar
OAuth local, configure essas credenciais e uma `CA_REDIRECT_URI` registrada no
portal. Os endpoints padrão deste projeto seguem a documentação atual da
Conta Azul. A conexão e o acesso a PDFs ainda precisam ser validados na conta
de desenvolvimento ou com uma unica cobranca controlada pelo cliente na conta
real. Nenhum teste deve enviar cobrancas antigas em lote.

## Verificar um PDF sem enviar ao Zen

Depois de concluir OAuth e identificar o `id_cobranca` de um unico boleto de
teste, execute a partir de `server/`:

```bash
npm run build
npm run probe:boleto -- ID_DA_COBRANCA
```

O comando tenta o endpoint candidato da Conta Azul, exige que a resposta seja
um PDF de verdade e salva o arquivo em um diretorio privado temporario. Nao
chama o Zen, nao envia email e nao varre outras cobrancas. O endpoint ainda
precisa ser confirmado com esse teste real.

Em producao, `POST /run` e a ativacao do modo automatico respondem 503 ate o
ciclo real estar implementado. Os dados ficticios do painel sao carregados
somente fora de producao.

## Endpoints
- `GET /overview` · `GET /sync-logs` · `GET /boletos/:id/logs`
- `GET /quarantine` · `POST /quarantine/:id/reprocess`
- `GET /clients` · `GET /health`
- `GET /healthz` — healthcheck do container (sempre publico)

## Variaveis (ver `.env.example`)
`PORT`, `API_TOKEN` (Bearer opcional), `ALLOWED_ORIGIN` (CORS), `SYNC_INTERVAL_MIN`.

## Integracao real (proximo passo)
Trocar `store.ts` por acesso ao PostgreSQL e `scheduler.ts` pelo ciclo real:
autenticar Conta Azul -> buscar cobrancas -> baixar PDF -> chamar `ZenClient` ->
gravar IDs, log e quarentena.
