// ============================================================
// Chef John Games - Core Engine
// ============================================================

const ChefJohnGames = (() => {
    // ---- State ----
    let currentGame = null;
    let currentGameType = null;
    let animationFrameId = null;
    let lastTime = 0;
    let isPaused = false;
    let finished = false;
    let tutorial = false;
    let totalPoints = 0;
    let bestScores = {};

    // ---- Ranking / telemetry state ----
    let apiSession = null;       // signed one-use session token from POST /api/session
    let playElapsed = 0;         // seconds of actual gameplay (paused/tutorial time excluded)
    let lastPlayerName = '';     // remembered ranking name, own localStorage key
    let pendingRanking = null;   // { game, score, duration, deliveries } captured at game over
    let rankingGame = 'catcher';
    let rankingPeriod = 'all';
    let quitTracked = false;       // game_quit is sent at most once per play
    let trackedDeliveryStage = -1; // runner stage already reported as runner_delivery

    // ---- Campaigns state (window.ChefJohnCampaigns, backend may be absent) ----
    let campaignsData = null;        // last GET /api/campaigns response, or null when unavailable/empty
    let campaignsById = {};          // id -> campaign, from the last fetch
    let campaignCountdownTimer = null;
    let campaignRefreshedOnZero = {}; // { pending: true } once a zeroed countdown triggered a refetch
    let campaignModalCampaignId = null; // campaign currently open in the campaign modal
    let registerContext = null;      // { from: 'campaign'|'gameover', campaignId }
    let couponQueue = [];            // coupons pending the celebratory modal

    // ---- DOM Elements ----
    let screens = {};
    let canvas, ctx;

    // ============================================================
    // TELEMETRY (Umami) - optional, never blocks gameplay
    // ============================================================
    function track(name, data) {
        try { if (window.umami) window.umami.track(name, data); } catch (e) { /* telemetria opcional */ }
    }

    // Shared payload for play events; the runner also reports the stage (etapa) reached.
    function playStats(score) {
        const data = {
            game: currentGameType,
            score: Math.max(0, Math.floor(score ?? currentGame?.score ?? 0)),
            duration: Math.round(playElapsed * 10) / 10
        };
        if (currentGameType === 'runner' && currentGame) data.stage = currentGame.stage + 1;
        return data;
    }

    // A play abandoned before game over (menu or closing the page) still reports its time.
    function trackQuit(reason) {
        if (!currentGame || finished || tutorial || quitTracked) return;
        quitTracked = true;
        track('game_quit', { ...playStats(), reason });
    }

    // ---- Tutorials ----
    const TUTORIALS = {
        catcher: { icon: '🌮', title: 'Festa Mexicana', text: 'A festa mexicana está a todo vapor!\n\nArraste o dedo ou use ← → para mover o nacho.\nPegue burritos, tacos, tortilhas crocantes e guacamole fresco para ganhar SN Coin.\n⚠️ Evite: 🔥 itens queimados e 🍽️ pratos vazios.\n\nVocê tem 3 vidas. Não deixe as comidas caírem!' },
        runner: { icon: '🏃', title: 'Entrega Sushinachos', text: 'A próxima entrega é sua!\n\n← → ou deslize para os lados: troque de faixa.\n↑ / espaço ou deslize para cima: pule as barreiras e os buracos.\n↓ ou deslize para baixo: passe sob os toldos.\n⚡ TURBO: toque no botão ou pressione Shift para acelerar por alguns segundos.\n\nEntregue o pedido de sushi & nachos, volte ao Sushinachos para pegar o próximo e siga assim! Cada chegada vale 100 SN Coin de bônus, e a corrida fica mais longa e mais rápida.' },
        ninja: { icon: '⚔️', title: 'Sushi Ninja', text: 'Um corte de mestre, uma chuva de sushis!\n\nArraste o dedo ou o mouse pressionado para fatiar sushis, sashimis e temakis no ar.\nCorte várias comidas no mesmo gesto: combo até 4×!\n⚠️ Não corte: 🍽️ pratos vazios e 🥛 copos.\n\nVocê tem 3 vidas. Comida boa não pode cair!' }
    };

    // ============================================================
    // INITIALIZATION
    // ============================================================

    function init() {
        // Cache screens
        screens.menu = document.getElementById('menu-screen');
        screens.game = document.getElementById('game-screen');
        screens.rewards = document.getElementById('rewards-screen');
        screens.ranking = document.getElementById('ranking-screen');

        canvas = document.getElementById('game-canvas');
        ctx = canvas.getContext('2d');

        // Load saved data
        loadData();
        updatePointsDisplay();

        // Setup all listeners
        setupMenuListeners();
        setupGameListeners();
        setupOverlayListeners();
        setupRewardsListeners();
        setupRankingListeners();
        setupCampaignListeners();

        // Canvas resize
        window.addEventListener('resize', resizeCanvas);
        document.addEventListener('visibilitychange', () => { if (document.hidden && currentGame && !isPaused && !finished && !tutorial) pauseGame(); });
        window.addEventListener('pagehide', () => trackQuit('close'));

        refreshCampaigns();
    }

    // ============================================================
    // DATA PERSISTENCE
    // ============================================================

    function loadData() {
        try {
            totalPoints = parseInt(localStorage.getItem('sushinachosTotalPoints') || localStorage.getItem('chefJohnTotalPoints') || '0');
            bestScores = JSON.parse(localStorage.getItem('sushinachosBestScores') || localStorage.getItem('chefJohnBestScores') || '{}');
        } catch (e) {
            totalPoints = 0;
            bestScores = {};
        }
        try {
            lastPlayerName = localStorage.getItem('sushinachosPlayerName') || localStorage.getItem('chefJohnPlayerName') || '';
        } catch (e) {
            lastPlayerName = '';
        }
    }

    function saveData() {
        try {
            localStorage.setItem('sushinachosTotalPoints', totalPoints.toString());
            localStorage.setItem('sushinachosBestScores', JSON.stringify(bestScores));
            if (lastPlayerName) localStorage.setItem('sushinachosPlayerName', lastPlayerName);
        } catch (e) {
            // localStorage may be full or unavailable
        }
    }

    function updatePointsDisplay() {
        const el1 = document.getElementById('total-points');
        const el2 = document.getElementById('rewards-total-points');
        if (el1) el1.textContent = totalPoints.toLocaleString('pt-BR');
        if (el2) el2.textContent = totalPoints.toLocaleString('pt-BR');
    }

    // ============================================================
    // SCREEN NAVIGATION
    // ============================================================

    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        if (screens[name]) screens[name].classList.add('active');
    }

    // ============================================================
    // CANVAS MANAGEMENT
    // ============================================================

    function resizeCanvas() {
        if (!screens.game) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = screens.game.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (currentGame && currentGame.resize) {
            currentGame.resize(rect.width, rect.height);
            currentGame.render();
        }
    }

    function getCanvasLogicalSize() {
        const rect = screens.game.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
    }

    // ============================================================
    // EVENT LISTENERS
    // ============================================================

    function setupMenuListeners() {
        document.querySelectorAll('.game-btn').forEach(btn => {
            btn.addEventListener('click', () => startGame(btn.dataset.game));
        });
        document.getElementById('rewards-btn').addEventListener('click', showRewards);
        document.getElementById('ranking-btn').addEventListener('click', () => openRanking());
    }

    function setupGameListeners() {
        // Touch events
        canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
        canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
        canvas.addEventListener('touchend', handleTouchEnd, { passive: false });

        // Mouse events (desktop)
        let mouseDown = false;
        canvas.addEventListener('mousedown', (e) => {
            mouseDown = true;
            handlePointerStart(e.clientX, e.clientY);
        });
        canvas.addEventListener('mousemove', (e) => {
            if (mouseDown) handlePointerMove(e.clientX, e.clientY);
        });
        canvas.addEventListener('mouseup', (e) => {
            mouseDown = false;
            handlePointerEnd(e.clientX, e.clientY);
        });
        canvas.addEventListener('mouseleave', (e) => {
            if (mouseDown) {
                mouseDown = false;
                handlePointerEnd(e.clientX, e.clientY);
            }
        });

        canvas.addEventListener('touchcancel', () => { if (currentGame?.onTouchEnd) currentGame.onTouchEnd(0, 0); });
        document.querySelectorAll('[data-control]').forEach(btn => btn.addEventListener('click', () => {
            if (currentGame && !isPaused && !finished && !tutorial) currentGame.onKeyDown(btn.dataset.control);
        }));
        // Keyboard
        document.addEventListener('keydown', handleKeyDown);

        // HUD
        document.getElementById('back-btn').addEventListener('click', () => {
            if (tutorial) quitToMenu();
            else if (currentGame) pauseGame();
        });
        document.getElementById('pause-btn').addEventListener('click', () => {
            if (currentGame) pauseGame();
        });
    }

    function setupOverlayListeners() {
        document.getElementById('next-delivery').addEventListener('click',()=>{
            if(currentGame?.state==='delivery'){currentGame.nextStage();document.getElementById('delivery-overlay').classList.add('hidden');}
        });
        document.getElementById('resume-btn').addEventListener('click', resumeGame);
        document.getElementById('quit-btn').addEventListener('click', quitToMenu);
        document.getElementById('retry-btn').addEventListener('click', retryGame);
        document.getElementById('menu-btn').addEventListener('click', quitToMenu);
        document.getElementById('tutorial-start-btn').addEventListener('click', () => {
            document.getElementById('tutorial-overlay').classList.add('hidden');
            tutorial = false;
            track('tutorial_conclude', { game: currentGameType });
            resumeGame();
        });
        document.getElementById('register-invite-btn').addEventListener('click', () => openRegisterModal({ from: 'gameover' }));
    }

    function setupRewardsListeners() {
        document.getElementById('rewards-back').addEventListener('click', () => showScreen('menu'));
    }

    function setupRankingListeners() {
        document.getElementById('ranking-back').addEventListener('click', () => showScreen('menu'));
        document.querySelectorAll('#ranking-game-tabs [data-ranking-game]').forEach(btn => {
            btn.addEventListener('click', () => {
                rankingGame = btn.dataset.rankingGame;
                updateRankingTabsUI();
                loadRanking();
            });
        });
        document.querySelectorAll('#ranking-period-toggle [data-ranking-period]').forEach(btn => {
            btn.addEventListener('click', () => {
                rankingPeriod = btn.dataset.rankingPeriod;
                updateRankingTabsUI();
                loadRanking();
            });
        });
    }

    // ---- Coordinate helpers ----
    function getCanvasCoords(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    // ---- Touch handlers ----
    function handleTouchStart(e) {
        e.preventDefault();
        if (isPaused || !currentGame) return;
        const t = e.touches[0];
        const c = getCanvasCoords(t.clientX, t.clientY);
        if (currentGame.onTouchStart) currentGame.onTouchStart(c.x, c.y, e);
    }

    function handleTouchMove(e) {
        e.preventDefault();
        if (isPaused || !currentGame) return;
        const t = e.touches[0];
        const c = getCanvasCoords(t.clientX, t.clientY);
        if (currentGame.onTouchMove) currentGame.onTouchMove(c.x, c.y, e);
    }

    function handleTouchEnd(e) {
        e.preventDefault();
        if (isPaused || !currentGame) return;
        // Pass end coordinates via changedTouches
        let cx = 0, cy = 0;
        if (e.changedTouches && e.changedTouches.length > 0) {
            const c = getCanvasCoords(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
            cx = c.x;
            cy = c.y;
        }
        if (currentGame.onTouchEnd) currentGame.onTouchEnd(cx, cy, e);
    }

    // ---- Mouse/pointer handlers ----
    function handlePointerStart(clientX, clientY) {
        if (isPaused || !currentGame) return;
        const c = getCanvasCoords(clientX, clientY);
        if (currentGame.onTouchStart) currentGame.onTouchStart(c.x, c.y);
    }

    function handlePointerMove(clientX, clientY) {
        if (isPaused || !currentGame) return;
        const c = getCanvasCoords(clientX, clientY);
        if (currentGame.onTouchMove) currentGame.onTouchMove(c.x, c.y);
    }

    function handlePointerEnd(clientX, clientY) {
        if (isPaused || !currentGame) return;
        const c = getCanvasCoords(clientX, clientY);
        if (currentGame.onTouchEnd) currentGame.onTouchEnd(c.x, c.y);
    }

    // ---- Keyboard handler ----
    function handleKeyDown(e) {
        if (!currentGame || finished || tutorial) return;
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
        if (e.repeat && currentGameType === 'runner') return;
        if (e.key === 'Escape') {
            if (isPaused) resumeGame();
            else pauseGame();
            return;
        }
        if (isPaused) return;
        if (currentGame.onKeyDown) currentGame.onKeyDown(e.key);
    }

    // ============================================================
    // GAME LIFECYCLE
    // ============================================================

    function startGame(gameType) {
        if (window.ChefJohnAudio) window.ChefJohnAudio.unlock();
        currentGameType = gameType;
        tutorial = true;
        track('game_start', { game: gameType });
        showScreen('game');
        screens.game.dataset.game = gameType;
        const tut = TUTORIALS[gameType];
        document.getElementById('tutorial-icon').textContent = tut.icon;
        document.getElementById('tutorial-title').textContent = tut.title;
        document.getElementById('tutorial-text').textContent = tut.text;
        document.getElementById('tutorial-overlay').classList.remove('hidden');
        document.getElementById('runner-controls').classList.toggle('hidden', gameType !== 'runner');
        actuallyStartGame();
    }

    function actuallyStartGame() {
        cancelAnimationFrame(animationFrameId);
        if (currentGame?.destroy) currentGame.destroy();
        currentGame = null;
        playElapsed = 0;
        pendingRanking = null;
        quitTracked = false;
        trackedDeliveryStage = -1;
        apiSession = null;
        if (window.ChefJohnRanking) {
            window.ChefJohnRanking.createSession().then(token => { apiSession = token; });
        }
        resizeCanvas();
        const size = getCanvasLogicalSize();
        const Game = { catcher: PizzaCatcherGame, runner: PizzaRunnerGame, ninja: PizzaNinjaGame }[currentGameType];
        currentGame = new Game(canvas, size.width, size.height, handleGameOver);
        currentGame.start();
        finished = false;
        isPaused = tutorial;
        document.getElementById('game-score').textContent = '0';
        updateRunnerTurboUI();
        currentGame.render();
        lastTime = performance.now();
        if (!tutorial) animationFrameId = requestAnimationFrame(gameLoop);
    }

    function gameLoop(timestamp) {
        if (!currentGame || isPaused) return;

        const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
        lastTime = timestamp;
        playElapsed += dt;

        currentGame.update(dt);
        const delivering=currentGame.state==='delivery';
        document.getElementById('delivery-overlay').classList.toggle('hidden',!delivering);
        if(delivering&&currentGame.deliveryInfo){
            const info=currentGame.deliveryInfo();
            document.getElementById('delivery-title').textContent=info.title;
            document.getElementById('delivery-text').textContent=info.text;
            document.getElementById('next-delivery').textContent=info.button;
        }
        if(delivering&&currentGameType==='runner'&&trackedDeliveryStage!==currentGame.stage){
            trackedDeliveryStage=currentGame.stage;
            track('runner_delivery',{...playStats(),destination:currentGame.destinationKind()});
        }
        currentGame.render();

        // Update HUD
        document.getElementById('game-score').textContent =
            currentGame.score.toLocaleString('pt-BR');
        updateRunnerTurboUI();

        if (!finished && !isPaused) animationFrameId = requestAnimationFrame(gameLoop);
    }

    function updateRunnerTurboUI() {
        const btn = document.getElementById('runner-turbo');
        if (!btn) return;
        const runner = currentGameType === 'runner' && currentGame;
        const active = runner && currentGame.turboTime > 0;
        const cooldown = runner ? currentGame.turboCooldown : 0;
        const small = btn.querySelector('small');
        btn.disabled = !runner || isPaused || finished || tutorial || cooldown > 0;
        btn.classList.toggle('turbo-active', Boolean(active));
        if (small) small.textContent = active ? `TURBO ${currentGame.turboTime.toFixed(1)}s` : cooldown > 0 ? `${cooldown.toFixed(1)}s` : 'TURBO';
        btn.setAttribute('aria-label', active ? 'Turbo ativado' : cooldown > 0 ? `Turbo recarregando, ${cooldown.toFixed(1)} segundos` : 'Ativar Turbo');
    }

    function pauseGame() {
        if (finished || tutorial || !currentGame) return;
        if (currentGame.onTouchEnd) currentGame.onTouchEnd(0, 0);
        isPaused = true;
        cancelAnimationFrame(animationFrameId);
        track('pause', { game: currentGameType });
        document.getElementById('pause-overlay').classList.remove('hidden');
    }

    function resumeGame() {
        if (finished || tutorial || !currentGame) return;
        cancelAnimationFrame(animationFrameId);
        document.getElementById('pause-overlay').classList.add('hidden');
        isPaused = false;
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function handleGameOver(score) {
        if (finished) return;
        if (window.ChefJohnAudio) window.ChefJohnAudio.play('gameover');
        finished = true;
        isPaused = true;
        score = Math.max(0, Math.floor(score));
        cancelAnimationFrame(animationFrameId);
        const duration = Math.round(playElapsed * 10) / 10;
        track('game_over', playStats(score));
        const deliveries = currentGameType === 'runner' && currentGame ? currentGame.deliveries : undefined;
        pendingRanking = { game: currentGameType, score, duration, deliveries };

        // Best score
        const prevBest = bestScores[currentGameType] || 0;
        const isNewBest = score > prevBest;
        if (isNewBest) bestScores[currentGameType] = score;

        // Add points
        totalPoints += score;
        saveData();
        updatePointsDisplay();

        // Update overlay
        document.getElementById('final-score-value').textContent =
            score.toLocaleString('pt-BR');

        const bestEl = document.getElementById('best-score-display');
        if (isNewBest && score > 0) {
            bestEl.textContent = '🏆 Novo recorde!';
        } else {
            bestEl.textContent = `Melhor: ${(bestScores[currentGameType] || 0).toLocaleString('pt-BR')}`;
        }
        bestEl.style.display = 'block';

        // Fun title
        const titles = score >= 100
            ? ['🍣 Incrível!', '🔥 Mandou bem!', '⭐ Espetacular!', '🏆 Mestre Sushinachos!']
            : ['🌮 Fim de Jogo!', '🥢 Boa tentativa!', '🍣 Quase lá!'];
        document.getElementById('gameover-title').textContent =
            titles[Math.floor(Math.random() * titles.length)];

        handlePostGamePlayerFlow(score);
        document.getElementById('gameover-overlay').classList.remove('hidden');
    }

    // ============================================================
    // RANKING (geral e mensal, via server.js / PostgreSQL)
    // ============================================================

    function openRanking(initialGame) {
        showScreen('ranking');
        rankingGame = initialGame || currentGameType || rankingGame || 'catcher';
        updateRankingTabsUI();
        loadRanking();
    }

    function updateRankingTabsUI() {
        document.querySelectorAll('#ranking-game-tabs [data-ranking-game]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.rankingGame === rankingGame);
        });
        document.querySelectorAll('#ranking-period-toggle [data-ranking-period]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.rankingPeriod === rankingPeriod);
        });
    }

    async function loadRanking() {
        const list = document.getElementById('ranking-list');
        const loading = document.getElementById('ranking-loading');
        const empty = document.getElementById('ranking-empty');
        list.innerHTML = '';
        empty.classList.add('hidden');
        loading.classList.remove('hidden');

        if (!window.ChefJohnRanking) {
            loading.classList.add('hidden');
            empty.textContent = 'Ranking indisponível agora. Seus SN Coins continuam valendo — tente de novo mais tarde!';
            empty.classList.remove('hidden');
            return;
        }

        const data = await window.ChefJohnRanking.fetchRanking(rankingGame, rankingPeriod, lastPlayerName);
        loading.classList.add('hidden');
        track('ranking_view', { game: rankingGame, period: rankingPeriod });

        if (!data || !Array.isArray(data.scores)) {
            empty.textContent = 'Ranking indisponível agora. Seus SN Coins continuam valendo — tente de novo mais tarde!';
            empty.classList.remove('hidden');
            return;
        }
        if (data.scores.length === 0) {
            empty.textContent = 'Ninguém pontuou neste recorte ainda. Jogue e seja o primeiro!';
            empty.classList.remove('hidden');
            return;
        }
        renderRankingList(data);
    }

    function renderRankingList(data) {
        const list = document.getElementById('ranking-list');
        list.innerHTML = '';
        let normalizedName = '';
        try { normalizedName = lastPlayerName.trim().replace(/\s+/g, ' ').toLocaleUpperCase('pt-BR'); } catch (e) { normalizedName = ''; }

        let playerInList = false;
        data.scores.forEach((row, idx) => {
            const li = document.createElement('li');
            const isYou = Boolean(normalizedName) && row.name === normalizedName;
            if (isYou) playerInList = true;
            li.className = 'ranking-row' + (isYou ? ' you' : '');
            li.innerHTML = `<span class="ranking-pos">${idx + 1}º</span><span class="ranking-name">${escapeHTML(row.name)}</span><span class="ranking-score">${row.score.toLocaleString('pt-BR')}</span>`;
            list.appendChild(li);
        });

        if (!playerInList && data.player) {
            const li = document.createElement('li');
            li.className = 'ranking-row you ranking-row-outside';
            li.innerHTML = `<span class="ranking-pos">${data.player.rank}º</span><span class="ranking-name">${escapeHTML(data.player.name)}</span><span class="ranking-score">${data.player.score.toLocaleString('pt-BR')}</span>`;
            list.appendChild(li);
        }
    }

    function escapeHTML(text) {
        return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function retryGame() {
        document.getElementById('gameover-overlay').classList.add('hidden');
        if (currentGame && currentGame.destroy) currentGame.destroy();
        currentGame = null;
        actuallyStartGame();
    }

    function quitToMenu() {
        trackQuit('menu');
        document.getElementById('delivery-overlay').classList.add('hidden');
        document.getElementById('pause-overlay').classList.add('hidden');
        document.getElementById('gameover-overlay').classList.add('hidden');
        document.getElementById('tutorial-overlay').classList.add('hidden');
        cancelAnimationFrame(animationFrameId);
        if (currentGame && currentGame.destroy) currentGame.destroy();
        currentGame = null;
        currentGameType = null;
        tutorial = false;
        finished = false;
        isPaused = false;
        updatePointsDisplay();
        showScreen('menu');
        refreshCampaigns();
    }

    // ============================================================
    // CAMPAIGNS - menu strip, campaign modal, cadastro, cupom
    // window.ChefJohnCampaigns already resolves every failure to null/{ok:false}
    // instead of throwing, so this whole section is a no-op without a backend.
    // ============================================================

    function setupCampaignListeners() {
        document.getElementById('campaign-modal-close').addEventListener('click', closeCampaignModal);
        document.getElementById('campaign-modal').addEventListener('click', (e) => {
            if (e.target.id === 'campaign-modal') closeCampaignModal();
        });
        document.getElementById('campaign-modal-play-btn').addEventListener('click', playFromCampaignModal);
        document.getElementById('campaign-modal-register-btn').addEventListener('click', () => {
            const id = campaignModalCampaignId;
            closeCampaignModal();
            openRegisterModal({ from: 'campaign', campaignId: id });
        });

        document.getElementById('register-modal-close').addEventListener('click', closeRegisterModal);
        document.getElementById('register-modal').addEventListener('click', (e) => {
            if (e.target.id === 'register-modal') closeRegisterModal();
        });
        const phoneInput = document.getElementById('register-phone-input');
        phoneInput.addEventListener('input', () => {
            if (!window.ChefJohnCampaigns) return;
            phoneInput.value = window.ChefJohnCampaigns.maskPhoneInput(phoneInput.value);
        });
        document.getElementById('register-submit-btn').addEventListener('click', submitRegisterForm);
        document.getElementById('register-forget-btn').addEventListener('click', forgetPlayer);

        document.getElementById('coupon-modal-close').addEventListener('click', showNextCoupon);

        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (!document.getElementById('coupon-modal').classList.contains('hidden')) { showNextCoupon(); return; }
            if (!document.getElementById('register-modal').classList.contains('hidden')) { closeRegisterModal(); return; }
            if (!document.getElementById('campaign-modal').classList.contains('hidden')) closeCampaignModal();
        });
    }

    async function refreshCampaigns() {
        if (!window.ChefJohnCampaigns) { renderCampaignsStrip(null); return; }
        renderCampaignsStrip(await window.ChefJohnCampaigns.list());
    }

    function renderCampaignsStrip(data) {
        const strip = document.getElementById('campaigns-strip');
        const trackEl = document.getElementById('campaigns-track');
        if (campaignCountdownTimer) { clearInterval(campaignCountdownTimer); campaignCountdownTimer = null; }
        campaignsData = data && Array.isArray(data.campaigns) && data.campaigns.length > 0 ? data : null;
        campaignsById = {};
        trackEl.textContent = '';
        if (!campaignsData) {
            strip.classList.add('hidden');
            return;
        }
        campaignRefreshedOnZero = {};
        campaignsData.campaigns.forEach(c => {
            campaignsById[c.id] = c;
            trackEl.appendChild(buildCampaignCard(c));
        });
        strip.classList.remove('hidden');
        updateCampaignCountdowns();
        campaignCountdownTimer = setInterval(updateCampaignCountdowns, 1000);
    }

    function formatMultiplier(m) {
        const n = Number(m);
        return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
    }

    function buildCampaignGoalBar(progress, target) {
        const goal = document.createElement('div');
        goal.className = 'campaign-goal';
        const trackBar = document.createElement('div');
        trackBar.className = 'campaign-goal-track';
        const fill = document.createElement('div');
        fill.className = 'campaign-goal-fill';
        fill.style.width = (target > 0 ? Math.min(100, (progress / target) * 100) : 0) + '%';
        trackBar.appendChild(fill);
        goal.appendChild(trackBar);
        return goal;
    }

    function buildCampaignCard(c) {
        const isChef = Boolean(c.challenger);
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'campaign-card' + (isChef ? ' campaign-card-chef' : '');
        card.dataset.campaignId = String(c.id);
        card.setAttribute('role', 'listitem');

        if (isChef) {
            const photo = document.createElement('img');
            photo.className = 'campaign-chef-photo';
            photo.src = 'assets/sushinachos-chef.png';
            photo.alt = 'Chef Sushinachos';
            card.appendChild(photo);
        }

        const top = document.createElement('div');
        top.className = 'campaign-card-top';
        if (c.multiplier > 1) {
            const badge = document.createElement('span');
            badge.className = 'campaign-badge';
            badge.textContent = `${formatMultiplier(c.multiplier)}× SN Coin`;
            top.appendChild(badge);
        }
        const countdown = document.createElement('span');
        countdown.className = 'campaign-countdown';
        countdown.dataset.countdownFor = String(c.id);
        top.appendChild(countdown);
        card.appendChild(top);

        const title = document.createElement('h3');
        title.className = 'campaign-title';
        title.textContent = c.title;
        card.appendChild(title);

        if (isChef) {
            const record = document.createElement('span');
            record.className = 'campaign-chef-record';
            record.textContent = `Recorde a bater: ${Number(c.challenger.score).toLocaleString('pt-BR')}`;
            card.appendChild(record);
            const cta = document.createElement('span');
            cta.className = 'campaign-chef-cta';
            cta.textContent = 'Superar Desafio';
            card.appendChild(cta);
        } else {
            const banner = document.createElement('p');
            banner.className = 'campaign-banner';
            banner.textContent = c.bannerText;
            card.appendChild(banner);
        }

        if (c.collective) {
            const goal = buildCampaignGoalBar(c.collective.progress, c.collective.target);
            const label = document.createElement('span');
            label.className = 'campaign-goal-label';
            label.textContent = `Já entregamos ${Number(c.collective.progress).toLocaleString('pt-BR')} de ${Number(c.collective.target).toLocaleString('pt-BR')}`;
            goal.appendChild(label);
            card.appendChild(goal);
        }

        card.addEventListener('click', () => openCampaignModal(c.id));
        return card;
    }

    function updateCampaignCountdowns() {
        if (!campaignsData) return;
        let anyZero = false;
        campaignsData.campaigns.forEach(c => {
            const el = document.querySelector(`[data-countdown-for="${c.id}"]`);
            if (!el) return;
            const remaining = new Date(c.nextChangeAt).getTime() - Date.now();
            if (remaining <= 0) {
                anyZero = true;
                el.textContent = c.live ? 'Terminando…' : 'Começando…';
                return;
            }
            el.textContent = (c.live ? 'Termina em ' : 'Começa em ') + window.ChefJohnCampaigns.formatCountdown(remaining, c.live);
        });
        if (anyZero && !campaignRefreshedOnZero.pending) {
            campaignRefreshedOnZero.pending = true;
            setTimeout(() => { campaignRefreshedOnZero.pending = false; refreshCampaigns(); }, 1500);
        }
    }

    async function openCampaignModal(id) {
        const c = campaignsById[id];
        if (!c || !window.ChefJohnCampaigns) return;
        campaignModalCampaignId = id;
        track('campaign_view', { id });

        document.getElementById('campaign-modal-title').textContent = c.title;
        document.getElementById('campaign-modal-banner').textContent = c.bannerText;
        document.getElementById('campaign-modal-description').textContent = c.description;
        document.getElementById('campaign-modal-rules').textContent = window.ChefJohnCampaigns.formatRules(c);

        const prizeEl = document.getElementById('campaign-modal-prize');
        prizeEl.textContent = '';
        const prizeTitle = document.createElement('strong');
        prizeTitle.textContent = `🎁 ${c.prize.title}`;
        const prizeDesc = document.createElement('p');
        prizeDesc.textContent = c.prize.description;
        prizeEl.appendChild(prizeTitle);
        prizeEl.appendChild(prizeDesc);

        const stockEl = document.getElementById('campaign-modal-stock');
        if (typeof c.stockLeft === 'number') {
            stockEl.textContent = c.stockLeft > 0 ? `Restam ${c.stockLeft.toLocaleString('pt-BR')} brindes` : 'Estoque esgotado por agora';
            stockEl.classList.remove('hidden');
        } else {
            stockEl.classList.add('hidden');
        }

        const collectiveEl = document.getElementById('campaign-modal-collective');
        collectiveEl.textContent = '';
        if (c.collective) {
            const goal = buildCampaignGoalBar(c.collective.progress, c.collective.target);
            const label = document.createElement('span');
            label.className = 'campaign-goal-label';
            label.textContent = `${Number(c.collective.progress).toLocaleString('pt-BR')} de ${Number(c.collective.target).toLocaleString('pt-BR')}`;
            goal.appendChild(label);
            collectiveEl.appendChild(goal);
            collectiveEl.classList.remove('hidden');
        } else {
            collectiveEl.classList.add('hidden');
        }

        const progressEl = document.getElementById('campaign-modal-progress');
        const registerHint = document.getElementById('campaign-modal-register-hint');
        progressEl.classList.add('hidden');
        registerHint.classList.add('hidden');
        if (window.ChefJohnCampaigns.getToken()) {
            const me = await window.ChefJohnCampaigns.me();
            if (campaignModalCampaignId !== id) return; // user closed/switched while we awaited
            const mine = me && Array.isArray(me.campaigns) ? me.campaigns.find(p => p.id === id) : null;
            if (mine) {
                progressEl.textContent = (mine.completed ? 'Meta cumprida! ' : 'Seu progresso: ')
                    + `${mine.progress.toLocaleString('pt-BR')} / ${mine.target.toLocaleString('pt-BR')}`
                    + (mine.completed ? ' ✅' : '');
                progressEl.classList.remove('hidden');
            }
        } else {
            registerHint.classList.remove('hidden');
        }

        document.getElementById('campaign-modal-play-btn').textContent = c.game ? 'Jogar agora' : 'Escolher um jogo';
        document.getElementById('campaign-modal').classList.remove('hidden');
    }

    function closeCampaignModal() {
        document.getElementById('campaign-modal').classList.add('hidden');
        campaignModalCampaignId = null;
    }

    function playFromCampaignModal() {
        const c = campaignsById[campaignModalCampaignId];
        closeCampaignModal();
        if (!c) return;
        if (c.game) {
            track('campaign_play', { id: c.id, game: c.game });
            startGame(c.game);
        }
    }

    // ---- Cadastro (nome + WhatsApp + consentimento LGPD) ----

    function openRegisterModal(context) {
        registerContext = context || null;
        const nameInput = document.getElementById('register-name-input');
        const phoneInput = document.getElementById('register-phone-input');
        const consent = document.getElementById('register-consent-input');
        const status = document.getElementById('register-status');
        const player = window.ChefJohnCampaigns && window.ChefJohnCampaigns.getPlayer();
        nameInput.value = (player && player.name) || lastPlayerName || '';
        phoneInput.value = '';
        consent.checked = false;
        status.textContent = '';
        const btn = document.getElementById('register-submit-btn');
        btn.disabled = false;
        btn.textContent = 'Cadastrar';
        document.getElementById('register-modal').classList.remove('hidden');
        nameInput.focus();
    }

    function closeRegisterModal() {
        document.getElementById('register-modal').classList.add('hidden');
        registerContext = null;
    }

    async function submitRegisterForm() {
        if (!window.ChefJohnCampaigns) return;
        const nameInput = document.getElementById('register-name-input');
        const phoneInput = document.getElementById('register-phone-input');
        const consent = document.getElementById('register-consent-input');
        const status = document.getElementById('register-status');
        const btn = document.getElementById('register-submit-btn');
        const name = (nameInput.value || '').trim();
        const phone = window.ChefJohnCampaigns.phoneDigits(phoneInput.value);

        if (!name) { status.textContent = 'Digite seu nome.'; return; }
        if (phone.length !== 11) { status.textContent = 'Digite um WhatsApp válido, com DDD.'; return; }
        if (!consent.checked) { status.textContent = 'É preciso aceitar o uso dos dados para continuar.'; return; }

        lastPlayerName = name;
        try {
            localStorage.setItem('sushinachosPlayerName', name);
            localStorage.setItem('chefJohnPlayerName', name);
        } catch (e) { /* localStorage indisponível */ }

        btn.disabled = true;
        status.textContent = 'Cadastrando…';
        const result = await window.ChefJohnCampaigns.register(name, phone, true);
        if (!result.ok) {
            btn.disabled = false;
            status.textContent = result.error || 'Não foi possível cadastrar agora.';
            return;
        }

        track('player_register', {});
        const ctx = registerContext;
        closeRegisterModal();
        refreshCampaigns();
        if (ctx && ctx.from === 'gameover') {
            document.getElementById('register-invite').classList.add('hidden');
            await submitRegisteredPlay();
        } else if (ctx && ctx.from === 'campaign' && ctx.campaignId != null) {
            openCampaignModal(ctx.campaignId);
        }
    }

    async function forgetPlayer() {
        if (!window.ChefJohnCampaigns || !window.ChefJohnCampaigns.getToken()) {
            closeRegisterModal();
            return;
        }
        if (!confirm('Tem certeza que deseja excluir seu cadastro e seus dados do Sushinachos?')) return;
        await window.ChefJohnCampaigns.forget();
        closeRegisterModal();
        refreshCampaigns();
        if (screens.rewards.classList.contains('active')) renderBrindes();
    }

    // ---- Fim de jogo: progresso de campanha e cupons ----

    function resetGameOverPlayerUI() {
        const progress = document.getElementById('campaign-progress');
        progress.classList.add('hidden');
        progress.textContent = '';
        document.getElementById('register-invite').classList.add('hidden');
        const status = document.getElementById('gameover-status');
        status.classList.add('hidden');
        status.textContent = '';
    }

    function handlePostGamePlayerFlow(score) {
        resetGameOverPlayerUI();
        if (!window.ChefJohnCampaigns || score <= 0) return;
        if (window.ChefJohnCampaigns.getToken()) submitRegisteredPlay();
        else document.getElementById('register-invite').classList.remove('hidden');
    }

    async function submitRegisteredPlay() {
        if (!pendingRanking) return;
        const status = document.getElementById('gameover-status');
        status.classList.remove('hidden');
        status.textContent = 'Registrando sua pontuação…';
        const { game, score, duration, deliveries } = pendingRanking;
        const result = await window.ChefJohnCampaigns.submitPlay(apiSession, game, score, duration, deliveries);
        apiSession = null; // the one-time session was spent (or already invalid) either way
        if (!result.ok) {
            status.textContent = result.error || 'Não foi possível registrar sua pontuação agora.';
            return;
        }
        status.classList.add('hidden');
        status.textContent = '';
        renderCampaignProgress(result);
        if (Array.isArray(result.newCoupons) && result.newCoupons.length) {
            const idByTitle = {};
            (result.campaigns || []).forEach(c => { idByTitle[c.title] = c.id; });
            result.newCoupons.forEach(coupon => {
                const campaignId = idByTitle[coupon.campaignTitle];
                couponQueue.push(Object.assign({ campaignId }, coupon));
                track('coupon_won', { campaignId });
            });
            showNextCoupon();
        }
    }

    function renderCampaignProgress(result) {
        const box = document.getElementById('campaign-progress');
        box.textContent = '';
        const bars = [];

        (result.campaigns || []).forEach(c => {
            const row = document.createElement('div');
            row.className = 'campaign-progress-row';
            const label = document.createElement('div');
            label.className = 'campaign-progress-label';
            label.textContent = c.title;
            const bar = document.createElement('div');
            bar.className = 'campaign-progress-track';
            const fill = document.createElement('div');
            fill.className = 'campaign-progress-fill';
            fill.style.width = (c.target > 0 ? Math.min(100, (c.progressBefore / c.target) * 100) : 0) + '%';
            bar.appendChild(fill);
            const numbers = document.createElement('div');
            numbers.className = 'campaign-progress-numbers';
            numbers.textContent = `${c.progressBefore.toLocaleString('pt-BR')} → ${c.progress.toLocaleString('pt-BR')} / ${c.target.toLocaleString('pt-BR')}` + (c.completed ? ' ✅' : '');
            row.appendChild(label);
            row.appendChild(bar);
            row.appendChild(numbers);
            box.appendChild(row);
            bars.push({ fill, target: c.target, progress: c.progress });
        });

        if (result.ranking) {
            const parts = [];
            if (result.ranking.allRank) parts.push(`${result.ranking.allRank}º no geral`);
            if (result.ranking.monthRank) parts.push(`${result.ranking.monthRank}º no mês`);
            if (parts.length) {
                const rankRow = document.createElement('div');
                rankRow.className = 'campaign-progress-rank';
                rankRow.textContent = `Você ficou em ${parts.join(' e ')}!`;
                box.appendChild(rankRow);
            }
        }

        if (box.children.length > 0) box.classList.remove('hidden');

        // Animate the bars to their final width on the next frame.
        requestAnimationFrame(() => {
            bars.forEach(b => { b.fill.style.width = (b.target > 0 ? Math.min(100, (b.progress / b.target) * 100) : 0) + '%'; });
        });
    }

    // ---- Cupom comemorativo (fila, um por vez) ----

    function showNextCoupon() {
        const modal = document.getElementById('coupon-modal');
        const coupon = couponQueue.shift();
        if (!coupon) { modal.classList.add('hidden'); return; }
        document.getElementById('coupon-modal-campaign').textContent = coupon.campaignTitle || '';
        document.getElementById('coupon-modal-code').textContent = coupon.code;
        document.getElementById('coupon-modal-prize').textContent = coupon.prizeDescription
            ? `${coupon.prizeTitle} — ${coupon.prizeDescription}` : coupon.prizeTitle;
        document.getElementById('coupon-modal-expiry').textContent = `Válido até ${formatDateBR(coupon.expiresAt)}`;
        renderConfetti();
        modal.classList.remove('hidden');
    }

    function renderConfetti() {
        const el = document.getElementById('coupon-confetti');
        el.textContent = '';
        const glyphs = ['🎉', '⭐', '🍕', '✨'];
        for (let i = 0; i < 18; i++) {
            const span = document.createElement('span');
            span.textContent = glyphs[i % glyphs.length];
            span.style.left = Math.random() * 100 + '%';
            span.style.animationDelay = (Math.random() * 0.6) + 's';
            span.style.animationDuration = (1.6 + Math.random() * 1.1) + 's';
            el.appendChild(span);
        }
    }

    function formatDateBR(iso) {
        try { return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); } catch (e) { return ''; }
    }

    // ============================================================
    // MEUS BRINDES - cupons do servidor (o localStorage nunca decide prêmio)
    // ============================================================

    async function showRewards() {
        showScreen('rewards');
        updatePointsDisplay();
        await renderBrindes();
    }

    const COUPON_STATUS_LABELS = { issued: 'Válido', redeemed: 'Usado', expired: 'Expirado', cancelled: 'Cancelado' };

    async function renderBrindes() {
        const playerBox = document.getElementById('brindes-player');
        const loading = document.getElementById('brindes-loading');
        const list = document.getElementById('brindes-list');
        const empty = document.getElementById('brindes-empty');
        const invite = document.getElementById('brindes-campaigns-invite');
        list.textContent = '';
        playerBox.classList.add('hidden');
        empty.classList.add('hidden');
        invite.classList.add('hidden');
        loading.classList.add('hidden');

        if (!window.ChefJohnCampaigns || !window.ChefJohnCampaigns.getToken()) {
            empty.textContent = 'Cadastre-se em uma promoção para acompanhar seus cupons aqui.';
            empty.classList.remove('hidden');
            renderCampaignsInviteInBrindes();
            return;
        }

        loading.classList.remove('hidden');
        const me = await window.ChefJohnCampaigns.me();
        loading.classList.add('hidden');

        if (!me) {
            empty.textContent = 'Não foi possível carregar seus brindes agora. Tente de novo mais tarde.';
            empty.classList.remove('hidden');
            return;
        }

        if (me.player) {
            playerBox.textContent = '';
            const name = document.createElement('strong');
            name.textContent = me.player.name;
            const phone = document.createElement('span');
            phone.textContent = ' · ' + me.player.phoneMasked;
            const forgetBtn = document.createElement('button');
            forgetBtn.type = 'button';
            forgetBtn.className = 'link-btn';
            forgetBtn.textContent = 'Excluir meus dados';
            forgetBtn.addEventListener('click', forgetPlayer);
            playerBox.appendChild(name);
            playerBox.appendChild(phone);
            playerBox.appendChild(document.createElement('br'));
            playerBox.appendChild(forgetBtn);
            playerBox.classList.remove('hidden');
        }

        const coupons = Array.isArray(me.coupons) ? me.coupons : [];
        if (coupons.length === 0) {
            empty.textContent = 'Você ainda não ganhou nenhum cupom. Jogue as promoções ativas para ganhar brindes!';
            empty.classList.remove('hidden');
            renderCampaignsInviteInBrindes();
            return;
        }
        coupons.forEach(coupon => list.appendChild(buildCouponItem(coupon)));
    }

    function buildCouponItem(coupon) {
        const item = document.createElement('div');
        item.className = 'brinde-item brinde-status-' + coupon.status;
        const head = document.createElement('div');
        head.className = 'brinde-head';
        const code = document.createElement('span');
        code.className = 'brinde-code';
        code.textContent = coupon.code;
        const status = document.createElement('span');
        status.className = 'brinde-status-badge';
        status.textContent = COUPON_STATUS_LABELS[coupon.status] || coupon.status;
        head.appendChild(code);
        head.appendChild(status);
        const prize = document.createElement('div');
        prize.className = 'brinde-prize';
        prize.textContent = coupon.prizeTitle;
        const campaignEl = document.createElement('div');
        campaignEl.className = 'brinde-campaign';
        campaignEl.textContent = coupon.campaignTitle || '';
        const dates = document.createElement('div');
        dates.className = 'brinde-dates';
        dates.textContent = coupon.status === 'redeemed' && coupon.redeemedAt
            ? `Usado em ${formatDateBR(coupon.redeemedAt)}`
            : `Válido até ${formatDateBR(coupon.expiresAt)}`;
        item.appendChild(head);
        item.appendChild(prize);
        if (coupon.prizeDescription) {
            const desc = document.createElement('div');
            desc.className = 'brinde-desc';
            desc.textContent = coupon.prizeDescription;
            item.appendChild(desc);
        }
        item.appendChild(campaignEl);
        item.appendChild(dates);
        return item;
    }

    function renderCampaignsInviteInBrindes() {
        const invite = document.getElementById('brindes-campaigns-invite');
        invite.textContent = '';
        if (!campaignsData) { invite.classList.add('hidden'); return; }
        const heading = document.createElement('p');
        heading.className = 'brindes-invite-heading';
        heading.textContent = 'Promoções ativas agora:';
        invite.appendChild(heading);
        campaignsData.campaigns.forEach(c => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'brindes-invite-card';
            btn.textContent = c.title;
            btn.addEventListener('click', () => openCampaignModal(c.id));
            invite.appendChild(btn);
        });
        invite.classList.remove('hidden');
    }

    // ============================================================
    // INIT ON DOM READY
    // ============================================================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return { /* public API if needed */ };
})();
