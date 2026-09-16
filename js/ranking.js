// ============================================================
// Chef John Games - Ranking API client
// Thin wrapper around /api/session and /api/ranking. Every call is
// try/catch'd and resolves to a null/failure shape instead of throwing,
// so main.js can just hide the ranking UI when the backend (or the
// network) is not available - the games must keep working offline.
// ============================================================

window.ChefJohnRanking = (() => {
    async function createSession() {
        try {
            const res = await fetch('api/session', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
            if (!res.ok) return null;
            const data = await res.json();
            return typeof data.session === 'string' ? data.session : null;
        } catch (e) {
            return null;
        }
    }

    async function submitScore(session, game, name, score, duration) {
        if (!session) return { ok: false, error: 'Ranking indisponível agora.' };
        try {
            const res = await fetch('api/ranking', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ session, game, name, score, duration })
            });
            let data = {};
            try { data = await res.json(); } catch (e) { /* resposta sem corpo */ }
            if (!res.ok) return { ok: false, error: data.error || 'Não foi possível enviar sua pontuação.' };
            return { ok: true, entry: data.entry, all: data.all, month: data.month };
        } catch (e) {
            return { ok: false, error: 'Sem conexão com o ranking agora.' };
        }
    }

    async function fetchRanking(game, period, name) {
        try {
            const params = new URLSearchParams({ game, period });
            if (name) params.set('name', name);
            const res = await fetch('api/ranking?' + params.toString());
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            return null;
        }
    }

    return { createSession, submitScore, fetchRanking };
})();
