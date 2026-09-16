# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Três jogos arcade inspirados no restaurante de comida mexicana e japonesa **Sushinachos** (Pega Sushinachos, Corrida Sushinachos, Ninja Sushinachos) em JavaScript puro e Canvas 2D, mais campanhas com brindes reais (cupons validados no caixa) e um backoffice em `/admin`. Sem build, sem módulos: os scripts do jogo são globais carregados por `index.html`. A única dependência de produção é `pg`, usada só pelo `server.js` (ranking, campanhas e cupons em PostgreSQL); `@electric-sql/pglite` é devDependency para testes e servidor de desenvolvimento sem Postgres local. Textos da interface em pt-BR.

## Comandos

```powershell
npm install
npm test                                       # tudo: server.test.js + tests/*.test.{js,cjs} (jogos, admin UI, unidade e integração com PGlite)
node --test tests/games.test.cjs               # só os jogos
node --test server.test.js                     # só o servidor/ranking (mocka o pool do pg)
node --test --test-name-pattern "runner turbo" tests/games.test.cjs   # um teste
Get-ChildItem js/*.js,server.js | ForEach-Object { node --check $_.FullName; if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe" } }
node scripts/dev-server.js                     # http://localhost:3000 e /admin com PGlite em memória, usuários dev e 4 campanhas de demonstração
node server.js                                 # http://localhost:3000 — sem PG* o ranking fica indisponível, o resto do site funciona normalmente
python -m http.server 8765 --bind 127.0.0.1    # alternativa 100% estática (sem ranking/API), abrir http://127.0.0.1:8765
```

Rode os testes a partir da raiz do repositório: eles leem `js/pizza-*.js` por caminho relativo.

## Arquitetura

- `js/main.js` — telas, tutorial, loop `requestAnimationFrame`, pausa (Escape e troca de aba), saldo de SN Coin e recordes em `localStorage` (`sushinachosTotalPoints`, `sushinachosBestScores`; com fallback para legados). Guarda o nome do jogador (`sushinachosPlayerName`) e controla a faixa de campanhas, o cadastro, o envio da partida no game over, "Meus brindes", e tela de ranking.
- `js/campaigns.js` — cliente de `/api/campaigns`, `/api/players`, `/api/players/me` e `/api/plays`.
- `js/ranking.js` — cliente HTTP fino para `/api/session` e `/api/ranking`.
- `js/pizza-{catcher,runner,ninja}.js` — classes globais dos três jogos.
- `js/art.js` — desenhos Canvas compartilhados (chef, comidas, moedas SN, cozinha/balcão).
- `js/audio.js` — áudio sintetizado via Web Audio API.
- `js/covers.js` — capas dinâmicas do menu renderizadas no próprio Canvas.
- `server.js` — servidor Node único (só `pg` como dependência): serve estáticos (`index.html`, `css/`, `js/`, `assets/`) e expõe as APIs de ranking, campanhas e admin (`/admin` serve `admin.html`).

## Arte e Identidade

- `assets/logo-sushinachos.png`: logo oficial em formato badge circular com temática nipo-mexicana.
- `assets/sushinachos-mascot.png`: mascote 3D em pose de corrida com sushi e nacho.
- `assets/sushinachos-chef.png`: retrato do chef mascot para cards de desafio.
- Em `js/art.js`: arte processual no Canvas renderizando moedas SN Coin, comidas temáticas e cenários.

## Commits

Conventional commits curtos em inglês (`feat:`, `fix:`, `chore:`).
