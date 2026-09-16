# Segurança — Campanhas, brindes e backoffice

Notas de segurança do backend implementado pelo Agente A (`server.js`, `lib/**`,
`migrations/002_campaigns.*`). Complementa o que já valia para o ranking (ver `CLAUDE.md`).

## Identidade do jogador por telefone (sem OTP) — risco aceito e mitigação

O cadastro (`POST /api/players`) identifica o jogador por nome + WhatsApp, "de boa-fé":
não há verificação por SMS/WhatsApp (OTP) de que o número pertence a quem digitou. Isso
significa que:

- Qualquer pessoa pode se cadastrar com o WhatsApp de outra pessoa (de propósito ou por
  erro de digitação) e acumular progresso/cupons em nome desse número.
- Se o número já está cadastrado, um novo cadastro com o mesmo telefone **atualiza o nome**
  e devolve um token para o **mesmo jogador** (mesmo histórico, mesmos cupons) — ou seja,
  quem souber o WhatsApp de alguém pode "assumir" a conta dessa pessoa.

**Mitigação implementada:** o cupom só vale alguma coisa quando é trocado por um brinde
físico no caixa, e nesse momento o operador **sempre vê nome e telefone mascarado**
(`(47) 9****-4567`) do dono do cupom antes de dar baixa (`GET /api/admin/coupons/:code`).
Isso não impede o cadastro indevido, mas impede a fraude de valor: o brinde só sai se o
cliente físico souber justificar o nome/telefone associado ao código que está mostrando na
tela, e o caixa pode recusar se não bater.

**Sugestão futura (não implementada):** confirmar o telefone por um código enviado via
WhatsApp (OTP) no cadastro ou na primeira vez que aquele telefone tenta ganhar um cupom.
Isso fecha a lacuna acima ao custo de depender de um provedor de WhatsApp Business API.

## Autenticação e sessão

- **Sessão de jogo** (`POST /api/session` → usada por `/api/ranking` e `/api/plays`):
  token HMAC-SHA256 de uso único, ligado ao IP que a criou, com TTL de 3h. Consumido
  atomicamente (estado `open → pending → used`); em erro na gravação, volta para `open`
  para permitir nova tentativa com a mesma sessão.
- **Token do jogador** (`X-Player-Token`): HMAC-SHA256 sobre `{pid, iat, v:1}`, validade de
  400 dias, sem estado no servidor (não pode ser revogado antes de expirar) **exceto** que
  toda rota que o usa também confere `deleted_at IS NULL` no banco — por isso a exclusão
  LGPD invalida o token imediatamente mesmo sem lista de revogação.
- **Cookie do admin** (`cj_admin`): HMAC-SHA256 sobre `{uid, role, exp}`, validade de 12h,
  `HttpOnly; SameSite=Strict; Path=/`, e `Secure` quando a conexão chega por HTTPS (direto
  ou via `X-Forwarded-Proto` do proxy). O papel (`admin`/`caixa`) é sempre revalidado contra
  o banco a cada requisição (`disabled_at IS NULL`), então desativar um usuário o desloga na
  próxima chamada, não só no próximo login.
- Todas as comparações de assinatura usam `crypto.timingSafeEqual`. Nenhuma sessão, token ou
  cookie é aceito com tamanho fora do esperado antes da comparação (evita amplificação).

## Senhas

- `scrypt` com N=16384, r=8, p=1, salt de 16 bytes aleatórios, hash de 64 bytes, formato
  `scrypt$N$r$p$saltB64$hashB64` guardado em `password_hash`. Senha mínima de 10 caracteres,
  validada tanto em `POST /api/admin/users` quanto em `scripts/create-admin.js`.
- `POST /api/admin/login` compara com um hash "de mentira" (`LOGIN_DUMMY_HASH`, gerado uma
  vez no boot) quando o e-mail não existe, para que o tempo de resposta não distinga
  "e-mail não existe" de "senha errada". A mensagem de erro é sempre genérica: "e-mail ou
  senha inválidos".
- Bootstrap do primeiro admin (`CHEFJOHN_BOOTSTRAP_ADMIN_EMAIL`/`_PASSWORD`) só roda se não
  existir nenhum admin ainda e a senha atender ao mínimo; o e-mail criado é logado, a senha
  nunca.

## CSRF e validação de entrada

- Toda rota de mutação (`POST`/`PUT`/`DELETE`) exige `sameOrigin` (o header `Origin`, quando
  presente, precisa bater com o `Host`) e, quando há corpo, `Content-Type: application/json`
  — um formulário HTML simples não consegue montar essa combinação, o que bloqueia CSRF
  clássico via `<form>`.
- Corpo limitado a 4 KB nas rotas públicas e 32 KB nas rotas admin (`MAX_BODY`/`ADMIN_MAX_BODY`).
- Toda query SQL é parametrizada (`$1, $2, …`); nenhuma interpolação de valor de usuário em
  texto SQL.
- `lib/campaign-input.js` valida cada campo de campanha (tipo, faixa, enum) tanto na criação
  quanto na edição (o `PUT` mescla o corpo sobre a campanha existente e revalida tudo, então
  não há caminho de "campo antigo inválido sobrevive a uma edição parcial").

## Rate limiting (em memória, por processo)

| Rota | Limite |
|---|---|
| `POST /api/session` | 10/min por IP |
| `POST /api/ranking` | 5/min por IP |
| `GET /api/ranking`, `GET /api/campaigns` | 60/min por IP |
| `POST /api/players` | 5/min por IP |
| `POST /api/plays` | 6/min por IP |
| `POST /api/admin/login` | 5/min por IP **e** 5/min por e-mail |

Os limites são mapas em memória do processo Node (não sobrevivem a um restart nem são
compartilhados entre réplicas). Isso é aceitável para o volume de uma pizzaria local; se o
serviço rodar com múltiplas réplicas atrás do proxy, o limite efetivo multiplica pelo número
de réplicas — não é um controle de last-resort contra abuso distribuído, só contra scripts
simples de um único IP.

## LGPD

- `DELETE /api/players/me` (o próprio jogador, via token) e `DELETE /api/admin/players/:id`
  (admin) fazem a mesma coisa: `name='REMOVIDO'`, `phone=NULL`, `deleted_at=now()`. Os
  registros de `plays`, `campaign_entries` e `coupons` **permanecem**, ligados ao `player_id`
  antigo, para não quebrar a integridade referencial nem os números do dashboard — mas não
  carregam mais nome nem telefone de ninguém identificável.
- Como o telefone anonimizado vira `NULL` (não uma string qualquer), o mesmo número pode ser
  cadastrado de novo depois sem conflito de `UNIQUE`.
- O CSV de jogadores (`GET /api/admin/players.csv`) e a lista (`GET /api/admin/players`) só
  trazem jogadores com `deleted_at IS NULL`.

## Erros e logs

- Toda exceção não tratada em uma rota vira `500 {"error":"erro interno"}` — nunca a
  mensagem/stack da exceção original é devolvida ao cliente. `console.error(e.message)` loga
  só a mensagem (nunca o corpo da requisição, senha, telefone completo ou token) no servidor.
- Avisos de configuração (banco indisponível, senha de bootstrap fraca) usam `console.warn`
  com texto fixo, sem interpolar segredos.

## Coisas que ficaram de fora (conhecidas, não implementadas)

- Revogação individual de token de jogador antes da expiração (hoje só existe via exclusão
  LGPD, que também remove os dados).
- Rate limiting distribuído entre réplicas (Redis ou similar) — hoje é só em memória.
- 2FA para contas admin.
