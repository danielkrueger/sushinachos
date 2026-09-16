# Sushinachos Play 🍣🌮

Três jogos arcade para o restaurante de comida mexicana e japonesa **Sushinachos**, desenvolvidos em JavaScript puro e Canvas 2D, sem dependências de build.

## Executar

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Abra http://127.0.0.1:8765. O servidor deve continuar aberto durante os testes.

## Controles

- **Corrida Sushinachos**: setas ou WASD; espaço pula. No celular, deslize nas quatro direções ou use os botões na tela. Vans exigem desvio, barreiras permitem salto e toldos permitem deslize. Cada moeda rende 5 SN Coin; cada 10 metros rende 1 adicional.
- **Pega Sushinachos**: arraste ou use esquerda/direita. Capture sushis, nachos crocantes e ingredientes; evite itens queimados e pratos vazios. Três vidas.
- **Ninja Sushinachos**: arraste com o mouse pressionado ou com o dedo para fatiar sushis e nachos voadores. Combos até 4×. Prato ou copo encerra a partida; comida boa perdida custa uma vida.
- Escape pausa/retoma. Trocar de aba pausa automaticamente.

## Verificar

```powershell
npm test                                       # todos os testes (jogos, backend, campanhas, UI)
node --test tests/games.test.cjs               # apenas os jogos
Get-ChildItem js/*.js | ForEach-Object { node --check $_.FullName; if ($LASTEXITCODE -ne 0) { throw "Falha de sintaxe" } }
```

Os testes cobrem coleta persistente, colisão atravessada entre quadros, salto/deslize, faixas livres, gestos, encerramento único, cancelamento de partidas destruídas, saldo não negativo e cortes.

A corrida usa projeção em perspectiva 2.5D e ordenação por profundidade. Os demais jogos usam arte Canvas com sombras e volumes. Não requer WebGL.

O saldo de SN Coin e os recordes permanecem no localStorage. Brindes são reais: campanhas (desafio do Chef, horário turbinado, meta coletiva) emitem cupons no servidor, validados pelo caixa no backoffice.

## Campanhas e backoffice

```powershell
npm install
node scripts/dev-server.js
```

Abre http://localhost:3000 (site) e http://localhost:3000/admin (backoffice) com Postgres em memória (PGlite), 4 campanhas de demonstração e os usuários `admin@sushinachos.local` e `caixa@sushinachos.local` (senha `sushinachos-dev-123`, ou `SUSHINACHOS_DEV_PASSWORD`). `npm test` roda todos os testes. Plano e contrato da API em `docs/campanhas/PLANO.md`.

## Identidade e Arte

- **Logo**: `assets/logo-sushinachos.png` — emblema circular estilizado com sushi roll, nacho crocante com guacamole, hashi decorado e tipografia temática.
- **Mascote**: `assets/sushinachos-mascot.png` — mascote fusion carismático em renderização 3D para jogos mobile, combinando vestimentas de chef com elementos nipo-mexicanos, correndo com sushi e nacho.
- **Avatar do Chef**: `assets/sushinachos-chef.png` — retrato do chef para o card de desafio e perfil.
- A versão animada procedural é desenhada em `js/art.js`.
