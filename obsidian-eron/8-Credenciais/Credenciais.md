# 🔐 Credenciais

← volta para [[Painel]] · relacionado: [[Arquitetura]] · [[Pendencias]]

> ⚠️ **Esta nota NÃO contém valores.** Segredos ficam apenas em `server/.env`
> (gitignored) e no combinado privado com a Mari. Nunca commitar valores.

## Onde ficam
- **`server/.env`** (não versionado) — client_id/secret e endpoints OAuth da Conta Azul.
- Senhas de contas (CA produção, Questor Zen) e token do Zen — guardar em cofre
  privado (não neste vault). Aqui só registramos que existem.

## Inventário (sem valores)
| Item | Uso | Local |
|---|---|---|
| App dev Conta Azul (client_id + client_secret) | OAuth2 da API | `server/.env` (`CA_CLIENT_ID`/`CA_CLIENT_SECRET`) |
| Conta CA produção — `rio@assejurc.com.br` | login + 2FA p/ consentir OAuth | cofre privado |
| Questor Zen — `heron@assejurc.com.br` + token API | upload e-Doc (próximo passo) | cofre privado |
| Usuário devportal (UUID@devportal.com) | acesso ao ERP de testes CA | cofre privado |

## Pendências de segurança
- [ ] 🔁 **Rotacionar o `client_secret`** no portal de devs — trafegou em texto no chat.
- [ ] Definir credenciais reais de acesso ao dashboard (hoje `admin`/`iazan` via env).
- [ ] Confirmar quem detém o 2FA da conta CA para concluir o consentimento.

## Como conectar a Conta Azul (passo a passo)
1. Preencher `server/.env` (`CA_CLIENT_ID`, `CA_CLIENT_SECRET`).
2. Registrar o `redirect_uri` no portal (dev: `http://localhost:3001/oauth/contaazul/callback`).
3. Subir a API (`cd server && npm run dev`).
4. Abrir `http://localhost:3001/oauth/contaazul/start` no browser.
5. Logar na conta CA, **passar no 2FA** e consentir.
6. Conferir `GET /oauth/contaazul/status` → `connected: true`.
