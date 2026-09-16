# Plano — Campanhas, brindes e backoffice do Chef John

Objetivo: transformar o Chef John Games numa ferramenta de venda da pizzaria, com campanhas com data e hora, metas para os jogadores, **brindes reais** validados no caixa e um backoffice com a mesma cara do site. É a apresentação-surpresa para o John: tudo precisa estar polido, funcionando de ponta a ponta e com textos em pt-BR.

Decisões já tomadas com o dono do projeto:

- O jogador se identifica com **nome + WhatsApp**, com consentimento LGPD explícito.
- Os prêmios são **brindes reais**. Por isso cupom, progresso e estoque vivem **só no servidor** (Postgres). O `localStorage` nunca decide prêmio.
- Escopo da apresentação: (1) Desafio do Chef John; (2) campanha com horário turbinado e contagem regressiva; (3) meta coletiva com barra de progresso; (4) cupom gerado no servidor e validado pelo celular do caixa; (5) backoffice com Campanhas e Validar cupom, com o design do site.

Leia `CLAUDE.md` antes de começar: contrato dos jogos, cache-busting `?v=`, ranking, Umami e deploy.

---

## 1. Visão geral da arquitetura

```
index.html + js/main.js + js/campaigns.js   ← jogador (menu, cadastro, cupons)
admin.html + js/admin.js + css/admin.css    ← backoffice (/admin)
server.js                                   ← roteamento HTTP (continua o único entrypoint)
lib/*.js                                    ← regras de negócio puras + acesso a dados
migrations/002_campaigns.up.sql             ← esquema novo (idempotente, aplicado no boot)
```

- `server.js` continua sendo o único servidor. As regras novas ficam em módulos `lib/` para serem testáveis. `lib/` **nunca** é servido como estático.
- Sem dependências de produção novas: usar apenas `node:crypto` (scrypt, HMAC, randomBytes).
- Dependência de desenvolvimento permitida: `@electric-sql/pglite`, para testes de integração com Postgres real em memória (não há Docker nem Postgres na máquina de desenvolvimento).

## 2. Modelo de dados (`migrations/002_campaigns.up.sql`)

Tudo com `IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`, porque as migrações rodam a cada boot. Crie também `002_campaigns.down.sql`.

```sql
players (
  id BIGSERIAL PK,
  name VARCHAR(14) NOT NULL,              -- mesma regra do ranking (maiúsculas, validateEntry)
  phone VARCHAR(13) UNIQUE,               -- só dígitos, '55' + DDD + 9 dígitos; NULL após exclusão LGPD
  consent_at TIMESTAMPTZ NOT NULL,
  consent_version VARCHAR(20) NOT NULL,   -- ex.: '2026-09-v1'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ                  -- anonimizado (name='REMOVIDO', phone=NULL)
)

plays: ADD COLUMN player_id BIGINT REFERENCES players(id),
       ADD COLUMN deliveries INTEGER CHECK (deliveries >= 0),
       ADD COLUMN hidden BOOLEAN NOT NULL DEFAULT false,   -- moderação do ranking
       ALTER COLUMN player_name DROP NOT NULL             -- partidas anônimas (só estatística)

campaigns (
  id BIGSERIAL PK,
  title VARCHAR(60) NOT NULL,
  banner_text VARCHAR(90) NOT NULL,       -- chamada curta do card no menu
  description TEXT NOT NULL,              -- regras em linguagem de cliente
  kind VARCHAR(12) NOT NULL CHECK (kind IN ('challenge','collective')),
  game VARCHAR(10) CHECK (game IN ('catcher','runner','ninja')),   -- NULL = qualquer jogo
  metric VARCHAR(12) NOT NULL CHECK (metric IN ('score','deliveries','plays')),
  aggregation VARCHAR(4) NOT NULL CHECK (aggregation IN ('best','sum')),
  target INTEGER NOT NULL CHECK (target > 0),
  multiplier NUMERIC(3,1) NOT NULL DEFAULT 1 CHECK (multiplier BETWEEN 1 AND 5),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
  weekdays SMALLINT[],                    -- 0=domingo…6=sábado; NULL = todos
  daily_start TIME, daily_end TIME,       -- janela diária em America/Sao_Paulo; NULL = dia todo
  prize_title VARCHAR(60) NOT NULL,
  prize_description VARCHAR(200) NOT NULL,
  stock INTEGER CHECK (stock >= 0),       -- NULL = ilimitado
  per_player_limit INTEGER NOT NULL DEFAULT 1 CHECK (per_player_limit >= 1),
  coupon_valid_days INTEGER NOT NULL DEFAULT 7 CHECK (coupon_valid_days BETWEEN 1 AND 90),
  challenger_name VARCHAR(30),            -- Desafio do Chef John: "Chef John"
  challenger_score INTEGER,
  status VARCHAR(10) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','archived')),
  collective_reached_at TIMESTAMPTZ,
  created_by BIGINT REFERENCES admin_users(id),
  created_at, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
)

campaign_entries (                        -- o que cada partida valeu em cada campanha
  id BIGSERIAL PK,
  campaign_id BIGINT NOT NULL REFERENCES campaigns(id),
  player_id BIGINT NOT NULL REFERENCES players(id),
  play_id BIGINT NOT NULL REFERENCES plays(id),
  value INTEGER NOT NULL CHECK (value >= 0),   -- métrica × multiplicador (arredondado para baixo)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, play_id)
)

coupons (
  id BIGSERIAL PK,
  code VARCHAR(14) UNIQUE NOT NULL,       -- 'CJ-XXXX-XXXX', alfabeto sem 0/O/1/I/L
  campaign_id BIGINT NOT NULL REFERENCES campaigns(id),
  player_id BIGINT NOT NULL REFERENCES players(id),
  status VARCHAR(10) NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','redeemed','cancelled')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,        -- "expirado" é derivado: status='issued' AND expires_at < now()
  redeemed_at TIMESTAMPTZ,
  redeemed_by BIGINT REFERENCES admin_users(id)
)

admin_users (
  id BIGSERIAL PK,
  email VARCHAR(120) UNIQUE NOT NULL,     -- minúsculo
  name VARCHAR(60) NOT NULL,
  role VARCHAR(6) NOT NULL CHECK (role IN ('admin','caixa')),
  password_hash TEXT NOT NULL,            -- 'scrypt$N$r$p$saltB64$hashB64'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  disabled_at TIMESTAMPTZ
)
```

Crie `admin_users` antes de `campaigns` no SQL. Índices: `plays(player_id)`, `campaign_entries(campaign_id, player_id)`, `coupons(player_id)`, `coupons(campaign_id)`, `campaigns(status, ends_at)`.

## 3. Regras de negócio (`lib/`)

### 3.1 Campanha ativa (`lib/campaigns.js`, funções puras)

- `isLive(campaign, now)`: `status='active'`, `starts_at <= now < ends_at`, dia da semana em `weekdays` (se houver) e hora em `[daily_start, daily_end)` (se houver). Dia e hora sempre calculados em **America/Sao_Paulo** (use `Intl.DateTimeFormat` com `timeZone`). Janela que atravessa a meia-noite (22:00–02:00) deve funcionar.
- `nextChange(campaign, now)`: próximo instante em que `isLive` muda (para a contagem regressiva "começa em" / "termina em"), limitado a `ends_at`. Pode varrer em passos de minuto até 8 dias; precisa ser correto, não otimizado.
- `matches(campaign, play)`: `game` nulo ou igual ao da partida; métrica `deliveries` só vale para `runner`.
- `playValue(campaign, play)`: `score` → pontuação; `deliveries` → `play.deliveries`; `plays` → 1; multiplicado por `multiplier` e com `Math.floor`.
- Progresso individual: `best` = MAX(value) das entradas do jogador; `sum` = SUM(value). Coletivo: SUM(value) de todos os jogadores.
- **Desafio do Chef John** é só uma campanha `challenge` + `score` + `best` com `challenger_*` preenchido e `target = challenger_score + 1`. O backoffice oferece isso como modelo pronto.

### 3.2 Registro de partida e emissão de cupons (transação)

Ao receber `POST /api/plays` válido:

1. `BEGIN`.
2. `INSERT` em `plays` (com `player_id`/`player_name` se houver jogador válido; senão nulos).
3. Se houver jogador: para cada campanha **viva** que dá `matches` → `INSERT campaign_entries`. Depois bloqueie a campanha com `SELECT … FOR UPDATE` e calcule o progresso.
   - `challenge`: se progresso ≥ target, cupons já emitidos para o jogador < `per_player_limit` e estoque disponível (`stock` nulo ou cupons emitidos não cancelados < stock) → emitir 1 cupom.
   - `collective`: se o progresso coletivo cruzou o target agora (`collective_reached_at IS NULL`), grave `collective_reached_at` e emita cupom para **todos os jogadores com entrada** na campanha, respeitando estoque (os que chegaram primeiro, ordenado pela primeira entrada) e o limite por jogador. Quem joga depois de atingida a meta, enquanto a campanha estiver viva, também recebe o seu (respeitando estoque e limite).
4. `COMMIT`. Em erro, `ROLLBACK` e 500 genérico.
5. A sessão de jogo (token de uso único já existente) é consumida como no `POST /api/ranking`.

Código do cupom: `CJ-` + 4 + `-` + 4 caracteres de `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, gerado com `crypto.randomInt`. Em colisão de UNIQUE, tente de novo (até 5 vezes). `expires_at = issued_at + coupon_valid_days`.

### 3.3 Validação anti-trapaça

- Reaproveite `validateEntry`/`scoreCap` e a verificação de duração contra a sessão do `POST /api/ranking` atual. Extraia a lógica comum e **não quebre os testes existentes em `server.test.js`**.
- `deliveries`: inteiro ≥ 0, só para `runner`, e `deliveries <= Math.floor(duration / 45) + 1`.
- Rate limit: `POST /api/plays` 6/min por IP; `POST /api/players` 5/min por IP; login admin 5/min por IP e por e-mail.

### 3.4 Jogador (`lib/players.js`)

- `normalizePhone(input)`: remove não dígitos; aceita 11 dígitos (DDD + celular começando com 9) ou 13 começando com `55`; devolve `'55'+DDD+numero` ou `null`. DDD válido: 11–99, sem zero.
- `maskPhone('5547991234567')` → `'(47) 9****-4567'`.
- Token do jogador: HMAC como `signSession`, payload `{ pid, iat, v:1 }`, validade de 400 dias, segredo `CHEFJOHN_SESSION_SECRET`. É enviado no header `X-Player-Token`.
- Cadastro com telefone já existente: atualiza o nome e devolve token do mesmo jogador. O telefone vale como identidade "de boa-fé", sem OTP. **Mitigação:** o caixa sempre vê nome e telefone mascarado do dono do cupom antes de dar baixa. Documente isso em `docs/campanhas/SEGURANCA.md`, com a sugestão futura de OTP por WhatsApp.
- Jogador excluído (`deleted_at`) → token inválido.

### 3.5 Admin (`lib/admin-auth.js`)

- Senha: `crypto.scrypt` com N=16384, r=8, p=1, salt de 16 bytes e hash de 64 bytes; comparação com `timingSafeEqual`. Senha mínima de 10 caracteres.
- Cookie `cj_admin`: HMAC `{ uid, role, exp }` (12 h), `HttpOnly; SameSite=Strict; Path=/`, e `Secure` quando `x-forwarded-proto=https` ou a conexão for TLS. Segredo `CHEFJOHN_ADMIN_SECRET`, com fallback em `CHEFJOHN_SESSION_SECRET`, ou efêmero.
- A cada requisição admin: valida o cookie **e** busca o usuário (existe e `disabled_at IS NULL`); o papel vem do banco.
- Todas as rotas admin mutáveis exigem `sameOrigin` + `Content-Type: application/json`.
- Bootstrap: se não existir nenhum admin e houver `CHEFJOHN_BOOTSTRAP_ADMIN_EMAIL` + `CHEFJOHN_BOOTSTRAP_ADMIN_PASSWORD` no env, cria o admin no boot e loga só o e-mail (nunca a senha). Também `scripts/create-admin.js --email x --name y --role admin|caixa`, com a senha lida de `CHEFJOHN_ADMIN_PASSWORD`.
- Papéis: `caixa` só acessa `me`, `logout` e cupons (consultar/dar baixa). Todo o resto exige `admin`.

## 4. Contrato da API (fonte única de verdade para os três agentes)

Formato: JSON, erros `{ "error": "mensagem pt-BR" }`, datas ISO 8601 UTC. Corpo máximo: 4 KB nas rotas públicas e 32 KB nas rotas admin.

### 4.1 Públicas

**`GET /api/campaigns`**: campanhas `status='active'` com `ends_at > now` e `starts_at < now + 7 dias`.
```json
{ "now": "…", "campaigns": [ {
  "id": 3, "title": "Desafio do Chef John", "bannerText": "O John fez 1.240 na Corrida. Você supera?",
  "description": "…", "kind": "challenge", "game": "runner", "metric": "score", "aggregation": "best",
  "target": 1241, "multiplier": 1, "startsAt": "…", "endsAt": "…",
  "window": { "weekdays": [2], "dailyStart": "18:00", "dailyEnd": "21:00" } ,
  "live": true, "nextChangeAt": "…",
  "prize": { "title": "Refri 2L grátis", "description": "…" },
  "stockLeft": 42,
  "challenger": { "name": "Chef John", "score": 1240 },
  "collective": { "progress": 3482, "target": 10000, "reachedAt": null }
} ] }
```
`window`, `stockLeft`, `challenger` e `collective` são `null` quando não se aplicam.

**`POST /api/players`** `{ name, phone, consent: true }` → `201 { token, player: { name, phoneMasked } }`. Erros: 400 (nome/telefone inválido, consentimento ausente), 429.

**`GET /api/players/me`** (header `X-Player-Token`) →
```json
{ "player": { "name": "DANIEL", "phoneMasked": "(47) 9****-4567" },
  "campaigns": [ { "id": 3, "progress": 980, "target": 1241, "completed": false, "couponsIssued": 0 } ],
  "coupons": [ { "code": "CJ-7KQ2-M9TX", "campaignTitle": "…", "prizeTitle": "…", "prizeDescription": "…",
                 "status": "issued|redeemed|expired|cancelled", "issuedAt": "…", "expiresAt": "…", "redeemedAt": null } ] }
```
401 se o token for inválido.

**`DELETE /api/players/me`** (header `X-Player-Token`) → `200 { ok: true }`: exclusão LGPD pelo próprio jogador (anonimiza).

**`POST /api/plays`** `{ session, game, score, duration, deliveries? }`, com header `X-Player-Token` opcional →
```json
201 { "play": { "game": "runner", "score": 1320, "duration": 212.4 },
      "registered": true,
      "campaigns": [ { "id": 3, "title": "…", "progressBefore": 980, "progress": 1320, "target": 1241, "completed": true } ],
      "newCoupons": [ { "code": "CJ-7KQ2-M9TX", "campaignTitle": "…", "prizeTitle": "…", "prizeDescription": "…", "expiresAt": "…" } ],
      "ranking": { "allRank": 4, "monthRank": 1 } }
```
Anônimo: `registered: false`, `campaigns: []`, `newCoupons: []`, `ranking: null`, e a partida é gravada só como estatística. Com jogador: a partida entra no ranking com o nome do jogador (ranking automático; o `POST /api/ranking` antigo continua existindo e funcionando).

**`GET /api/ranking`**: inalterado, mas passa a ignorar `hidden = true` e `player_name IS NULL`.

### 4.2 Admin (cookie `cj_admin`)

| Método e rota | Papel | Resposta |
|---|---|---|
| `POST /api/admin/login` `{email,password}` | — | `200 {user:{id,name,email,role}}` + Set-Cookie; 401 genérico "e-mail ou senha inválidos" |
| `POST /api/admin/logout` | ambos | `200 {ok:true}` e limpa o cookie |
| `GET /api/admin/me` | ambos | `{user}` ou 401 |
| `GET /api/admin/dashboard?days=7` | admin | `{ kpis:{ playsToday, playersTotal, newPlayers, avgDurationByGame:{catcher,runner,ninja}, playsByGame:{…}, couponsIssued, couponsRedeemed }, playsPerDay:[{day:'2026-09-14',catcher,runner,ninja}], campaigns:[{id,title,kind,live,progress,target,couponsIssued,couponsRedeemed,stockLeft}] }` ("hoje" e os dias em America/Sao_Paulo) |
| `GET /api/admin/campaigns` | admin | `{campaigns:[…todos os campos em camelCase, com live, couponsIssued, couponsRedeemed, participants]}` |
| `POST /api/admin/campaigns` | admin | cria (status inicial `draft` se não informado) → `201 {campaign}`; 400 com mensagem do campo inválido |
| `PUT /api/admin/campaigns/:id` | admin | atualiza → `{campaign}` |
| `POST /api/admin/campaigns/:id/status` `{status}` | admin | `{campaign}` |
| `POST /api/admin/campaigns/:id/duplicate` | admin | cópia em `draft`, título "(cópia)" → `201 {campaign}` |
| `GET /api/admin/coupons/:code` | ambos | `{coupon:{code,status,campaignTitle,prizeTitle,prizeDescription,player:{name,phoneMasked},issuedAt,expiresAt,redeemedAt,redeemedBy}}`; 404 |
| `POST /api/admin/coupons/:code/redeem` | ambos | `{coupon}`; 409 se já usado/expirado/cancelado (mensagem clara) |
| `POST /api/admin/coupons/:code/cancel` | admin | `{coupon}` |
| `GET /api/admin/players?q=&page=1` | admin | `{players:[{id,name,phone,phoneMasked,createdAt,plays,coupons}], page, pages}` (20 por página; busca por nome ou dígitos do telefone) |
| `GET /api/admin/players.csv` | admin | CSV `nome;whatsapp;cadastro;consentimento;partidas;cupons` (BOM UTF-8) |
| `DELETE /api/admin/players/:id` | admin | anonimiza → `{ok:true}` |
| `GET /api/admin/ranking?game=&period=` | admin | top 50 com `hidden` |
| `POST /api/admin/ranking/hide` `{game,name,hidden}` | admin | `{ok:true}` |
| `GET /api/admin/users` / `POST /api/admin/users` `{email,name,role,password}` / `POST /api/admin/users/:id/disable` | admin | gestão de usuários do caixa |

Entrada e saída de campanha em camelCase: `title, bannerText, description, kind, game, metric, aggregation, target, multiplier, startsAt, endsAt, weekdays, dailyStart ('HH:MM'), dailyEnd, prizeTitle, prizeDescription, stock, perPlayerLimit, couponValidDays, challengerName, challengerScore, status`.

Estáticos: `GET /admin` e `/admin/` servem `admin.html` (adicione à allowlist). Headers de segurança iguais aos atuais; no `admin.html`, adicione também `Cache-Control: no-store`.

## 5. Frontend do jogador (`index.html`, `js/main.js`, `js/campaigns.js`, `css/style.css`)

- **`js/campaigns.js`** → `window.ChefJohnCampaigns`: cliente fino no estilo de `js/ranking.js` (tudo em try/catch; falha devolve `null`/`{ok:false}`). Guarda o token em `localStorage['chefJohnPlayerToken']` e o perfil em `localStorage['chefJohnPlayer']`. Funções: `list()`, `register(name, phone, consent)`, `me()`, `submitPlay(session, game, score, duration, deliveries)`, `forget()`.
- **Menu: faixa "Promoções no forno"** entre o hero e a lista de jogos. Mostra cards horizontais com rolagem e scroll-snap, e só aparece se houver campanhas (sem backend, some sem erro).
  - Card do **Desafio do Chef John** com destaque: foto `assets/chef-john.png`, "Recorde do John: 1.240", CTA "Superar o John".
  - **Contagem regressiva** ao vivo ("termina em 02:13:45" / "começa em 3h 20min") com base em `nextChangeAt`, e selo "2× John Coin" quando `multiplier > 1`.
  - **Meta coletiva:** barra de progresso "Penha já entregou 3.482 de 10.000 pizzas".
  - Tocar no card abre o **modal da campanha**: regras, prêmio, período e janela em linguagem humana ("toda terça, das 18h às 21h"), progresso do jogador (se cadastrado), estoque restante e botão "Jogar agora", que inicia o jogo da campanha.
- **Cadastro** (modal): nome (até 14), WhatsApp com máscara `(47) 99999-9999`, checkbox obrigatório "Aceito que a Pizzaria Chef John use meu nome e WhatsApp para validar brindes e enviar promoções. Posso pedir exclusão quando quiser." e link "Excluir meus dados", que chama `DELETE /api/players/me`. Aparece ao tocar "Participar" numa campanha e na tela de fim de jogo.
- **Fim de jogo:**
  - **Cadastrado:** envia `submitPlay` automaticamente. Some a caixa antiga "Seu nome no ranking" e aparecem as linhas de progresso das campanhas (barra animada "980 → 1.320 / 1.241 ✅") e a posição no ranking.
  - **Não cadastrado:** caixa "Cadastre-se para entrar no ranking e ganhar brindes". Ao cadastrar, envia a mesma partida (a sessão de uso único ainda não foi consumida).
  - **Cupom novo:** modal comemorativo com confete ou estrelas no Canvas/CSS, código grande `CJ-7KQ2-M9TX`, prêmio, validade e "Mostre este código no caixa da Pizzaria Chef John". Também fica em "Meus cupons".
- **Tela Recompensas → "Meus brindes"**: lista de cupons do servidor com status (válido, usado, expirado). O saldo de John Coin continua visível como pontuação, mas os **resgates locais de desconto saem** (eram manipuláveis). Se não houver cupons, mostre as campanhas ativas como convite.
- **Corrida (`js/pizza-runner.js`):** adicione o contador `this.deliveries` (reiniciado em `start()`), incrementado **uma vez** por chegada em destino `family` (entrega real, não a volta à pizzaria). Teste em `tests/games.test.cjs`. `main.js` envia `deliveries` só para o runner.
- **Umami** via `track()` em `main.js`: `campaign_view {id}`, `player_register`, `coupon_won {campaignId}`, `campaign_play {id, game}`.
- Atualize os `?v=` no `index.html` e mantenha o layout em celular (~390 px) e desktop.

## 6. Backoffice (`admin.html`, `js/admin.js`, `css/admin.css`)

**Identidade visual = site principal.** Antes de desenhar, leia `index.html` e `css/style.css`: fundo creme, fontes `Fredoka One` (títulos) e `Nunito` (texto), vermelho da marca, cards arredondados com sombra sólida embaixo, selo "PLAY", botões `.overlay-btn` e logo `assets/logo-chef-john.png`. Replique os tokens em `css/admin.css` com variáveis CSS; não importe `style.css` inteiro, porque ele trava a rolagem e o toque do jogo.

- SPA em JS puro, com rotas por hash: `#/login`, `#/painel`, `#/campanhas`, `#/campanhas/nova`, `#/campanhas/:id`, `#/cupons`, `#/jogadores`, `#/ranking`, `#/usuarios`. Menu lateral no desktop e barra inferior no celular. O `caixa` só vê **Validar cupom** e abre direto nela.
- **Login:** logo, e-mail e senha, "Entrar".
- **Painel:** cards de KPI, gráfico de barras de partidas por dia e por jogo (SVG ou CSS, sem biblioteca externa), tempo médio por jogo e lista de campanhas ativas com barra de progresso, cupons emitidos/usados e estoque.
- **Campanhas:**
  - Lista com status em selos coloridos (Rascunho, Agendada, Ao vivo, Pausada, Encerrada, derivados de `status` + datas + `live`) e ações Editar, Duplicar, Ativar/Pausar e Arquivar.
  - **Formulário com modelos prontos** no topo, que preenchem os campos:
    1. **Desafio do Chef John:** challenge, score, best, `challengerName="Chef John"`; o target é recalculado a partir de `challengerScore` (+1).
    2. **Horário turbinado:** challenge, score, sum, multiplier 2, terça 18:00–21:00, target 2000.
    3. **Meta coletiva:** collective, runner, deliveries, sum, target 1000.
    4. **Missão da Corrida:** challenge, runner, deliveries, best, target 3.
  - Campos agrupados: Chamada · Objetivo · Quando (início/fim `datetime-local`, sempre interpretados como horário de Brasília `-03:00`; dias da semana em chips; janela diária) · Prêmio (título, descrição, estoque, limite por pessoa, validade) · Prévia ao vivo do card como ele aparecerá no menu do jogo.
  - Resumo em linguagem humana antes de salvar ("Toda terça das 18h às 21h, de 15/09 a 30/09, quem somar 2.000 pontos em qualquer jogo ganha Refri 2L; 50 unidades, 1 por pessoa").
  - Validação amigável dos campos no cliente, com o servidor sendo a regra final.
- **Validar cupom** (mobile-first, pensado para o celular do caixa):
  - Campo gigante com máscara `CJ-____-____`, que aceita digitação sem hífen e em minúsculas, e botão "Consultar".
  - Resultado em card grande: verde "Válido" com prêmio, nome e telefone mascarado do cliente, validade e botão "Dar baixa"; amarelo "Já usado em 14/09 às 19:32 por Fulano"; vermelho "Expirado" ou "Não encontrado".
  - Confirmação antes da baixa e histórico das últimas baixas da sessão.
- **Jogadores:** busca, tabela ou cards no celular, exportar CSV e excluir (LGPD) com confirmação.
- **Ranking:** abas por jogo e período, e alternância "ocultar do ranking".
- **Usuários:** criar usuário do caixa ou admin e desativar.
- Toda saída de dados via `textContent`/`createElement` (nada de `innerHTML` com dados). Estados de carregando, vazio e erro. Toasts de sucesso/erro. Acessível: labels, foco visível, `aria-live` nos resultados do cupom.

## 7. Divisão do trabalho (agentes em paralelo)

Cada agente só edita os arquivos da sua coluna. O contrato da seção 4 é o ponto de encontro.

| Agente | Arquivos exclusivos |
|---|---|
| **A: Backend** | `server.js`, `lib/**`, `migrations/002_*`, `scripts/create-admin.js`, `scripts/seed-demo.js`, `scripts/dev-server.js`, `server.test.js`, `tests/server-*.test.js`, `package.json`/`package-lock.json` (só a devDependency pglite), `Dockerfile`, `.dockerignore`, `docs/campanhas/SEGURANCA.md` |
| **B: Jogador** | `index.html`, `js/main.js`, `js/campaigns.js`, `js/pizza-runner.js`, `css/style.css`, `tests/games.test.cjs` |
| **C: Backoffice** | `admin.html`, `js/admin.js`, `css/admin.css`, `tests/admin-ui.test.cjs` (opcional: funções puras exportáveis) |

Ninguém edita `CLAUDE.md`, `README.md` ou este plano; o coordenador atualiza depois.

### Entregáveis específicos

- **A:**
  - `scripts/dev-server.js`: sobe o servidor com PGlite em memória (adaptador `{ query, connect }` compatível com o uso do `pg` em `server.js`), aplica as migrações, cria o admin `admin@chefjohn.local` e o caixa `caixa@chefjohn.local`, com senhas lidas de `CHEFJOHN_DEV_PASSWORD` (padrão `chefjohn-dev-123`, **só neste script de dev**), roda o seed e escuta na porta `PORT` (padrão 3000).
  - `scripts/seed-demo.js`: cria as 4 campanhas da apresentação (Desafio do Chef John na Corrida com recorde 1.240; Terça turbinada; Meta coletiva "Penha entrega 1.000 pizzas"; Missão da Corrida), ativas a partir de agora e por 30 dias, com prêmios plausíveis da pizzaria. Funciona tanto no dev-server quanto com `DATABASE_URL`, e é idempotente pelo título.
  - O `Dockerfile` precisa copiar `lib/` e `admin.html`; o `.dockerignore` deve excluir `docs/`.
  - Testes: unitários das funções puras (janela com fuso e virada de meia-noite, `nextChange`, telefone, código de cupom, scrypt, cookie) e integração com PGlite cobrindo cadastro → partida → cupom, estoque esgotado, limite por jogador, coletiva que cruza o alvo, caixa sem acesso a campanhas, baixa dupla → 409 e jogador excluído.
- **B:** tudo da seção 5. Funciona com o backend ausente, sem nenhuma exceção no console. Mantenha os 29+ testes de jogo passando.
- **C:** tudo da seção 6. Enquanto o backend não existir, desenvolva contra um mock local dentro de `js/admin.js`, ativado só por `?mock=1`, que devolve dados de exemplo no formato do contrato. Ele serve para as capturas da apresentação e fica desligado por padrão.

## 8. Critérios de pronto (verificados pelo coordenador)

1. `npm test` verde (servidor, jogos e novos testes) e `node --check` em todos os JS.
2. `node scripts/dev-server.js` sobe com PGlite e roda o fluxo completo no navegador: menu mostra as campanhas com contagem → cadastro → jogar a Corrida → cupom ganho → aparece em "Meus brindes" → login do caixa no `/admin` → consultar → dar baixa → segunda baixa recusada → admin cria campanha pelo modelo "Horário turbinado" e ela aparece no menu.
3. Sem backend (`python -m http.server`), o site e os jogos funcionam sem erros e sem a faixa de promoções.
4. Layout conferido em 390 px e em desktop, no jogo e no backoffice.
5. Nenhum segredo em código ou log. Senhas só via env. Nada de `innerHTML` com dado do usuário.
6. Deploy (depois da aprovação do dono): variáveis `CHEFJOHN_ADMIN_SECRET`, `CHEFJOHN_BOOTSTRAP_ADMIN_EMAIL` e `CHEFJOHN_BOOTSTRAP_ADMIN_PASSWORD` no EasyPanel, migração 002 aplicada no Postgres de produção e seed das campanhas.
