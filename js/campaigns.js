// ============================================================
// Chef John Games - Campaigns API client
// Thin wrapper around /api/campaigns, /api/players and /api/plays, in the
// same style as js/ranking.js: every call is try/catch'd and resolves to a
// null/failure shape instead of throwing, so main.js can just hide the
// campaigns UI when the backend (or the network) is not available - the
// games must keep working offline. Also owns the player token/profile kept
// in localStorage and a few pure pt-BR formatting helpers used by main.js.
// ============================================================

window.ChefJohnCampaigns = (() => {
    const TOKEN_KEY = 'sushinachosPlayerToken';
    const PLAYER_KEY = 'sushinachosPlayer';

    // ---- Local player identity (token never leaves localStorage except as the X-Player-Token header) ----
    function getToken() {
        try { return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('chefJohnPlayerToken') || null; } catch (e) { return null; }
    }
    function setToken(token) {
        try { if (token) localStorage.setItem(TOKEN_KEY, token); } catch (e) { /* localStorage indisponível */ }
    }
    function clearLocalPlayer() {
        try {
            localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(PLAYER_KEY);
            localStorage.removeItem('chefJohnPlayerToken'); localStorage.removeItem('chefJohnPlayer');
        } catch (e) { /* localStorage indisponível */ }
    }
    function getPlayer() {
        try {
            const raw = localStorage.getItem(PLAYER_KEY) || localStorage.getItem('chefJohnPlayer');
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }
    function setPlayer(profile) {
        try { if (profile) localStorage.setItem(PLAYER_KEY, JSON.stringify(profile)); } catch (e) { /* localStorage indisponível */ }
    }

    // ---- API calls ----
    async function list() {
        try {
            const res = await fetch('api/campaigns');
            if (!res.ok) return null;
            const data = await res.json();
            return Array.isArray(data.campaigns) ? data : null;
        } catch (e) {
            return null;
        }
    }

    async function register(name, phone, consent) {
        try {
            const res = await fetch('api/players', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, consent: Boolean(consent) })
            });
            let data = {};
            try { data = await res.json(); } catch (e) { /* resposta sem corpo */ }
            if (!res.ok) return { ok: false, error: data.error || 'Não foi possível cadastrar agora.' };
            setToken(data.token);
            setPlayer(data.player);
            return { ok: true, token: data.token, player: data.player };
        } catch (e) {
            return { ok: false, error: 'Sem conexão agora. Tente de novo em instantes.' };
        }
    }

    async function me() {
        const token = getToken();
        if (!token) return null;
        try {
            const res = await fetch('api/players/me', { headers: { 'X-Player-Token': token } });
            if (res.status === 401) { clearLocalPlayer(); return null; }
            if (!res.ok) return null;
            const data = await res.json();
            if (data && data.player) setPlayer(data.player);
            return data;
        } catch (e) {
            return null;
        }
    }

    async function submitPlay(session, game, score, duration, deliveries) {
        const token = getToken();
        const body = { session, game, score, duration };
        if (game === 'runner' && typeof deliveries === 'number') body.deliveries = deliveries;
        try {
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['X-Player-Token'] = token;
            const res = await fetch('api/plays', { method: 'POST', headers, body: JSON.stringify(body) });
            let data = {};
            try { data = await res.json(); } catch (e) { /* resposta sem corpo */ }
            if (res.status === 401) clearLocalPlayer();
            if (!res.ok) return { ok: false, error: data.error || 'Não foi possível registrar sua partida agora.' };
            return Object.assign({ ok: true }, data);
        } catch (e) {
            return { ok: false, error: 'Sem conexão agora. Sua pontuação continua salva neste aparelho.' };
        }
    }

    async function forget() {
        const token = getToken();
        if (!token) { clearLocalPlayer(); return { ok: true }; }
        try {
            const res = await fetch('api/players/me', { method: 'DELETE', headers: { 'X-Player-Token': token } });
            clearLocalPlayer();
            return { ok: res.ok };
        } catch (e) {
            clearLocalPlayer();
            return { ok: false };
        }
    }

    // ---- Pure pt-BR formatting helpers (America/Sao_Paulo) ----
    const WEEKDAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

    function pad2(n) { return String(n).padStart(2, '0'); }

    // Coarse ("3h 20min") or precise ("02:13:45") countdown text for a millisecond duration.
    function formatCountdown(ms, precise) {
        if (!Number.isFinite(ms) || ms <= 0) return precise ? '00:00:00' : 'agora';
        const totalSeconds = Math.floor(ms / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        if (precise) {
            return (days > 0 ? `${days}d ` : '') + `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
        }
        if (days > 0) return `${days} dia${days > 1 ? 's' : ''}`;
        if (hours > 0) return `${hours}h ${minutes}min`;
        return `${Math.max(1, minutes)} min`;
    }

    function formatDateBR(iso) {
        try {
            return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' });
        } catch (e) {
            return '';
        }
    }

    function formatWeekdaysPhrase(weekdays) {
        if (!Array.isArray(weekdays) || weekdays.length === 0 || weekdays.length === 7) return null;
        if (weekdays.length === 1) return `Toda ${WEEKDAY_NAMES[weekdays[0]]}`;
        const names = weekdays.slice().sort((a, b) => a - b).map(n => WEEKDAY_NAMES[n]);
        return `Nos dias de ${names.join(', ')}`;
    }

    function formatDailyWindowPhrase(dailyStart, dailyEnd) {
        if (!dailyStart || !dailyEnd) return null;
        return `das ${dailyStart.replace(':', 'h')} às ${dailyEnd.replace(':', 'h')}`;
    }

    // Full human-readable rule text for the campaign modal, e.g.
    // "Toda terça-feira, das 18h às 21h, de 15/09 a 30/09. Horário de Brasília."
    function formatRules(campaign) {
        const window = campaign && campaign.window;
        const weekdayPhrase = formatWeekdaysPhrase(window && window.weekdays);
        const windowPhrase = formatDailyWindowPhrase(window && window.dailyStart, window && window.dailyEnd);
        const sentences = [];
        let opening = '';
        if (weekdayPhrase && windowPhrase) opening = `${weekdayPhrase}, ${windowPhrase}`;
        else if (weekdayPhrase) opening = weekdayPhrase;
        else if (windowPhrase) opening = `Todos os dias ${windowPhrase}`;
        else opening = 'A qualquer hora, todos os dias';
        const period = `de ${formatDateBR(campaign.startsAt)} a ${formatDateBR(campaign.endsAt)}`;
        sentences.push(`${opening}, ${period}.`);
        sentences.push('Horário de Brasília.');
        return sentences.join(' ');
    }

    // Live mask for the WhatsApp input: digits typed become "(47) 99999-9999".
    function maskPhoneInput(raw) {
        const digits = String(raw || '').replace(/\D/g, '').slice(0, 11);
        if (digits.length === 0) return '';
        if (digits.length <= 2) return `(${digits}`;
        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    function phoneDigits(raw) {
        return String(raw || '').replace(/\D/g, '');
    }

    return {
        list, register, me, submitPlay, forget,
        getToken, getPlayer,
        formatCountdown, formatRules, maskPhoneInput, phoneDigits
    };
})();
window.SushinachosCampaigns = window.ChefJohnCampaigns;

