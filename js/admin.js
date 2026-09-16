/* Chef John — Backoffice SPA (js/admin.js)
 * Pure helpers are exported at the bottom for node --test.
 * Browser-only code (DOM, fetch, router) runs only when window/document exist. */
(function () {
  'use strict';

  /* ================= Pure helpers ================= */

  function pad2(n) { return String(n).padStart(2, '0'); }

  // Brazil has used a fixed UTC-03:00 offset (no DST) since 2019.
  function shiftToBR(iso) { return new Date(new Date(iso).getTime() - 3 * 3600 * 1000); }

  function brDateOnly(iso) {
    if (!iso) return '';
    const t = shiftToBR(iso);
    return `${pad2(t.getUTCDate())}/${pad2(t.getUTCMonth() + 1)}/${t.getUTCFullYear()}`;
  }

  function brDateTime(iso) {
    if (!iso) return '';
    const t = shiftToBR(iso);
    return `${brDateOnly(iso)} ${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}`;
  }

  // datetime-local value ("2026-09-15T18:00") interpreted as America/Sao_Paulo -> UTC ISO.
  function isoFromDatetimeLocalBR(value) {
    if (!value) return null;
    const d = new Date(`${value}:00-03:00`);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  function datetimeLocalBRFromISO(iso) {
    if (!iso) return '';
    const t = shiftToBR(iso);
    return `${t.getUTCFullYear()}-${pad2(t.getUTCMonth() + 1)}-${pad2(t.getUTCDate())}T${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}`;
  }

  // Coupon input mask: accepts lowercase/no-hyphen typing, always renders "CJ-XXXX-XXXX".
  function formatCouponCode(raw) {
    let s = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (s.slice(0, 2) === 'CJ') s = s.slice(2);
    s = s.slice(0, 8);
    let out = 'CJ-';
    if (s.length > 0) out += s.slice(0, 4);
    if (s.length > 4) out += '-' + s.slice(4, 8);
    return out;
  }

  function isCompleteCouponCode(code) {
    return /^CJ-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(String(code || ''));
  }

  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  function joinWithE(arr) {
    if (arr.length <= 1) return arr[0] || '';
    return arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
  }

  const WEEKDAY_NAMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  function weekdaysSummary(weekdays) {
    if (!weekdays || !weekdays.length) return '';
    if (weekdays.length === 1) {
      const d = weekdays[0];
      const det = (d === 0 || d === 6) ? 'todo' : 'toda';
      return `${det} ${WEEKDAY_NAMES[d]}`;
    }
    const list = weekdays.slice().sort((a, b) => a - b).map((d) => WEEKDAY_NAMES[d] + 's');
    return `às ${joinWithE(list)}`;
  }

  function hourLabel(hhmm) {
    if (!hhmm) return '';
    const [h, m] = hhmm.split(':');
    const hi = parseInt(h, 10);
    return (m && m !== '00') ? `${hi}h${m}` : `${hi}h`;
  }

  function windowSummary(dailyStart, dailyEnd) {
    if (!dailyStart || !dailyEnd) return '';
    return `das ${hourLabel(dailyStart)} às ${hourLabel(dailyEnd)}`;
  }

  function gameLabel(game) {
    if (game === 'catcher') return 'Pega Pizza';
    if (game === 'runner') return 'Corrida da Pizza';
    if (game === 'ninja') return 'Ninja da Pizza';
    return 'qualquer jogo';
  }

  function numberBR(n) {
    try { return Number(n).toLocaleString('pt-BR'); } catch (e) { return String(n); }
  }

  function metricVerb(c) {
    const n = numberBR(c.target);
    const gamePart = c.game ? ` na ${gameLabel(c.game)}` : ' em qualquer jogo';
    if (c.metric === 'score') {
      return c.aggregation === 'sum' ? `somar ${n} pontos${gamePart}` : `fizer ${n} pontos${gamePart}`;
    }
    if (c.metric === 'deliveries') {
      return c.aggregation === 'sum' ? `somar ${n} entregas${gamePart}` : `fizer ${n} entregas em uma corrida`;
    }
    return `jogar ${n} partidas${gamePart}`;
  }

  function targetHintText(metric) {
    if (metric === 'deliveries') return '🛵 Corrida da Pizza: ~1 entrega a cada 45–60s de corrida.';
    if (metric === 'plays') return '🎮 Partidas jogadas: 1 por partida completa (~1 a 2 min cada).';
    return '💡 Rendimento: ~370 a 400 John Coins por minuto (equilibrado nos 3 jogos).';
  }

  function humanSummary(c) {
    if (!c) return '';
    const parts = [];
    const weekdaysTxt = weekdaysSummary(c.weekdays);
    const windowTxt = windowSummary(c.dailyStart, c.dailyEnd);
    let whenClause = '';
    if (weekdaysTxt) whenClause = capitalize(weekdaysTxt);
    if (windowTxt) whenClause = whenClause ? `${whenClause} ${windowTxt}` : capitalize(windowTxt);
    if (whenClause) parts.push(whenClause);
    if (c.startsAt && c.endsAt) parts.push(`de ${brDateOnly(c.startsAt)} a ${brDateOnly(c.endsAt)}`);
    let subject;
    if (c.challengerName) {
      subject = `quem superar ${c.challengerName} (${numberBR(c.challengerScore)} pontos${c.game ? ` na ${gameLabel(c.game)}` : ''}) ganha ${c.prizeTitle || 'o prêmio'}`;
    } else if (c.kind === 'collective') {
      subject = `juntos, os jogadores precisam ${metricVerb(c)} para desbloquear ${c.prizeTitle || 'o prêmio'} para todo mundo`;
    } else {
      subject = `quem ${metricVerb(c)} ganha ${c.prizeTitle || 'o prêmio'}`;
    }
    parts.push(subject);
    if (c.multiplier && Number(c.multiplier) > 1) parts.push(`${c.multiplier}× John Coin no período`);
    const stockTxt = (c.stock === null || c.stock === undefined) ? 'estoque ilimitado' : `${numberBR(c.stock)} unidades`;
    parts.push(`${stockTxt}, ${c.perPlayerLimit || 1} por pessoa`);
    if (c.couponValidDays) parts.push(`cupom válido por ${c.couponValidDays} dias`);
    return parts.join(', ') + '.';
  }

  // Status badge derived from status + dates + live flag, per PLANO.md section 6.
  function campaignStatusInfo(c, now) {
    now = now || new Date();
    if (c.status === 'archived') return { code: 'ended', label: 'Encerrada' };
    if (c.status === 'draft') return { code: 'draft', label: 'Rascunho' };
    const endsAt = c.endsAt ? new Date(c.endsAt) : null;
    const startsAt = c.startsAt ? new Date(c.startsAt) : null;
    if (endsAt && now >= endsAt) return { code: 'ended', label: 'Encerrada' };
    if (c.status === 'paused') return { code: 'paused', label: 'Pausada' };
    if (startsAt && now < startsAt) return { code: 'scheduled', label: 'Agendada' };
    if (c.live) return { code: 'live', label: 'Ao vivo' };
    return { code: 'scheduled', label: 'Agendada' };
  }

  function progressPercent(progress, target) {
    if (!target) return 0;
    const p = Math.round((Number(progress) || 0) / Number(target) * 100);
    return Math.max(0, Math.min(100, p));
  }

  function formatDuration(seconds) {
    const s = Math.round(seconds || 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}min ${pad2(r)}s` : `${r}s`;
  }

  function maskPhoneFallback(phone) {
    // Fallback only: server always sends phoneMasked already.
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 4) return phone || '';
    return `(${digits.slice(2, 4)}) 9****-${digits.slice(-4)}`;
  }

  const PURE = {
    pad2, brDateOnly, brDateTime, isoFromDatetimeLocalBR, datetimeLocalBRFromISO,
    formatCouponCode, isCompleteCouponCode, capitalize, weekdaysSummary, hourLabel,
    windowSummary, gameLabel, numberBR, metricVerb, targetHintText, humanSummary, campaignStatusInfo,
    progressPercent, formatDuration, maskPhoneFallback, WEEKDAY_NAMES, WEEKDAY_SHORT,
  };

  /* ================= Browser app ================= */
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    runApp();
  }

  function runApp() {
    const MOCK = /(^|[?&])mock=1(&|$)/.test(location.search);

    /* ---- DOM helpers ---- */
    function h(tag, attrs, children) {
      const el = document.createElement(tag);
      if (attrs) {
        for (const k in attrs) {
          if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
          const v = attrs[k];
          if (k === 'class') el.className = v;
          else if (k === 'dataset') { for (const dk in v) el.dataset[dk] = v[dk]; }
          else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
          else if (v === true) el.setAttribute(k, '');
          else if (v === false || v === null || v === undefined) { /* skip */ }
          else el.setAttribute(k, v);
        }
      }
      const kids = Array.isArray(children) ? children : (children === undefined || children === null ? [] : [children]);
      for (const kid of kids) {
        if (kid === null || kid === undefined || kid === false) continue;
        el.appendChild((typeof kid === 'string' || typeof kid === 'number') ? document.createTextNode(String(kid)) : kid);
      }
      return el;
    }
    function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
    function setChildren(el, children) { clear(el); (Array.isArray(children) ? children : [children]).forEach((c) => { if (c) el.appendChild(c); }); }

    /* ---- Toasts ---- */
    function toast(message, kind) {
      const region = document.getElementById('toast-region');
      if (!region) return;
      const el = h('div', { class: `toast ${kind || ''}`, role: 'status' }, message);
      region.appendChild(el);
      setTimeout(() => { el.remove(); }, 4200);
    }

    /* ---- Confirm modal ---- */
    function confirmModal(opts) {
      return new Promise((resolve) => {
        const backdrop = h('div', { class: 'modal-backdrop', role: 'dialog', 'aria-modal': 'true' });
        function close(result) { backdrop.remove(); resolve(result); }
        const card = h('div', { class: 'modal-card' }, [
          h('h2', {}, opts.title || 'Confirmar'),
          h('p', {}, opts.message || ''),
          h('div', { class: 'modal-actions' }, [
            h('button', { class: 'btn btn-ghost', onclick: () => close(false) }, opts.cancelLabel || 'Cancelar'),
            h('button', { class: `btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`, onclick: () => close(true) }, opts.confirmLabel || 'Confirmar'),
          ]),
        ]);
        backdrop.appendChild(card);
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(false); });
        document.body.appendChild(backdrop);
        card.querySelector('button').focus();
      });
    }

    /* ---- API client ---- */
    async function apiFetch(path, options) {
      options = options || {};
      const opts = Object.assign({ credentials: 'same-origin' }, options);
      opts.headers = Object.assign({}, options.headers);
      if (opts.body && typeof opts.body === 'string') opts.headers['Content-Type'] = 'application/json';
      let res;
      try {
        res = await fetch(path, opts);
      } catch (e) {
        const err = new Error('Falha de rede. Verifique sua conexão.');
        err.network = true;
        throw err;
      }
      if (path.endsWith('.csv')) {
        if (!res.ok) { const err = new Error('Não foi possível exportar.'); err.status = res.status; throw err; }
        return res.text();
      }
      const text = await res.text();
      let data = null;
      if (text) { try { data = JSON.parse(text); } catch (e) { data = null; } }
      if (!res.ok) {
        const err = new Error((data && data.error) || `Erro ${res.status}`);
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    }

    const api = {
      login: (email, password) => apiFetch('/api/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
      logout: () => apiFetch('/api/admin/logout', { method: 'POST' }),
      me: () => apiFetch('/api/admin/me'),
      dashboard: (days) => apiFetch(`/api/admin/dashboard?days=${days || 7}`),
      listCampaigns: () => apiFetch('/api/admin/campaigns'),
      createCampaign: (data) => apiFetch('/api/admin/campaigns', { method: 'POST', body: JSON.stringify(data) }),
      updateCampaign: (id, data) => apiFetch(`/api/admin/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
      setCampaignStatus: (id, status) => apiFetch(`/api/admin/campaigns/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) }),
      duplicateCampaign: (id) => apiFetch(`/api/admin/campaigns/${id}/duplicate`, { method: 'POST' }),
      getCoupon: (code) => apiFetch(`/api/admin/coupons/${encodeURIComponent(code)}`),
      redeemCoupon: (code) => apiFetch(`/api/admin/coupons/${encodeURIComponent(code)}/redeem`, { method: 'POST' }),
      cancelCoupon: (code) => apiFetch(`/api/admin/coupons/${encodeURIComponent(code)}/cancel`, { method: 'POST' }),
      listPlayers: (q, page) => apiFetch(`/api/admin/players?q=${encodeURIComponent(q || '')}&page=${page || 1}`),
      playersCsv: () => apiFetch('/api/admin/players.csv'),
      deletePlayer: (id) => apiFetch(`/api/admin/players/${id}`, { method: 'DELETE' }),
      ranking: (game, period) => apiFetch(`/api/admin/ranking?game=${game}&period=${period}`),
      hideRanking: (game, name, hidden) => apiFetch('/api/admin/ranking/hide', { method: 'POST', body: JSON.stringify({ game, name, hidden }) }),
      listUsers: () => apiFetch('/api/admin/users'),
      createUser: (data) => apiFetch('/api/admin/users', { method: 'POST', body: JSON.stringify(data) }),
      disableUser: (id) => apiFetch(`/api/admin/users/${id}/disable`, { method: 'POST' }),
    };

    if (MOCK) installMock();

    /* ================= Mock backend (dev only, ?mock=1) ================= */
    function installMock() {
      const realFetch = window.fetch.bind(window);
      const db = buildMockDb();
      let session = null; // { id, name, email, role }

      window.fetch = function (input, init) {
        const urlStr = typeof input === 'string' ? input : input.url;
        let u;
        try { u = new URL(urlStr, location.origin); } catch (e) { return realFetch(input, init); }
        if (u.pathname.indexOf('/api/admin') !== 0) return realFetch(input, init);
        return new Promise((resolve) => {
          setTimeout(() => resolve(mockHandle(u, init || {})), 220);
        });
      };

      function json(status, body) {
        return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
      }
      function text(status, body, type) {
        return new Response(body, { status, headers: { 'Content-Type': type || 'text/plain; charset=utf-8' } });
      }
      function requireAuth() { return session; }
      function requireAdmin() { return session && session.role === 'admin'; }

      function mockHandle(u, init) {
        const method = (init.method || 'GET').toUpperCase();
        const p = u.pathname;
        let body = null;
        if (init.body) { try { body = JSON.parse(init.body); } catch (e) { body = null; } }

        if (p === '/api/admin/login' && method === 'POST') {
          const email = String((body && body.email) || '').trim().toLowerCase();
          const password = (body && body.password) || '';
          if (!email || !password) return json(401, { error: 'e-mail ou senha inválidos' });
          const isCaixa = email.indexOf('caixa') !== -1;
          session = { id: isCaixa ? 2 : 1, name: isCaixa ? 'Caixa Demo' : 'Admin Demo', email, role: isCaixa ? 'caixa' : 'admin' };
          return json(200, { user: session });
        }
        if (p === '/api/admin/logout' && method === 'POST') { session = null; return json(200, { ok: true }); }
        if (p === '/api/admin/me' && method === 'GET') return session ? json(200, { user: session }) : json(401, { error: 'não autenticado' });

        if (!requireAuth()) return json(401, { error: 'não autenticado' });

        if (p === '/api/admin/dashboard' && method === 'GET') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          return json(200, db.dashboard());
        }
        if (p === '/api/admin/campaigns' && method === 'GET') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          return json(200, { campaigns: db.campaigns });
        }
        if (p === '/api/admin/campaigns' && method === 'POST') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          if (!body || !body.title) return json(400, { error: 'Título é obrigatório.' });
          const c = db.createCampaign(body);
          return json(201, { campaign: c });
        }
        let m;
        if ((m = p.match(/^\/api\/admin\/campaigns\/(\d+)$/)) && method === 'PUT') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          const c = db.updateCampaign(Number(m[1]), body || {});
          if (!c) return json(404, { error: 'Campanha não encontrada.' });
          return json(200, { campaign: c });
        }
        if ((m = p.match(/^\/api\/admin\/campaigns\/(\d+)\/status$/)) && method === 'POST') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          const c = db.updateCampaign(Number(m[1]), { status: body && body.status });
          if (!c) return json(404, { error: 'Campanha não encontrada.' });
          return json(200, { campaign: c });
        }
        if ((m = p.match(/^\/api\/admin\/campaigns\/(\d+)\/duplicate$/)) && method === 'POST') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          const c = db.duplicateCampaign(Number(m[1]));
          if (!c) return json(404, { error: 'Campanha não encontrada.' });
          return json(201, { campaign: c });
        }
        if ((m = p.match(/^\/api\/admin\/coupons\/([^/]+)$/)) && method === 'GET') {
          const c = db.findCoupon(decodeURIComponent(m[1]));
          if (!c) return json(404, { error: 'Cupom não encontrado.' });
          return json(200, { coupon: db.couponView(c) });
        }
        if ((m = p.match(/^\/api\/admin\/coupons\/([^/]+)\/redeem$/)) && method === 'POST') {
          const c = db.findCoupon(decodeURIComponent(m[1]));
          if (!c) return json(404, { error: 'Cupom não encontrado.' });
          const status = db.couponStatus(c);
          if (status !== 'issued') return json(409, { error: status === 'redeemed' ? 'Este cupom já foi usado.' : status === 'expired' ? 'Este cupom está expirado.' : 'Este cupom foi cancelado.' });
          c.status = 'redeemed';
          c.redeemedAt = new Date().toISOString();
          c.redeemedBy = session.name;
          return json(200, { coupon: db.couponView(c) });
        }
        if ((m = p.match(/^\/api\/admin\/coupons\/([^/]+)\/cancel$/)) && method === 'POST') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          const c = db.findCoupon(decodeURIComponent(m[1]));
          if (!c) return json(404, { error: 'Cupom não encontrado.' });
          c.status = 'cancelled';
          return json(200, { coupon: db.couponView(c) });
        }
        if (p === '/api/admin/players' && method === 'GET') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          const q = (u.searchParams.get('q') || '').toLowerCase();
          const page = Number(u.searchParams.get('page') || 1);
          return json(200, db.listPlayers(q, page));
        }
        if (p === '/api/admin/players.csv' && method === 'GET') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          return text(200, '﻿' + db.playersCsv(), 'text/csv; charset=utf-8');
        }
        if ((m = p.match(/^\/api\/admin\/players\/(\d+)$/)) && method === 'DELETE') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          db.deletePlayer(Number(m[1]));
          return json(200, { ok: true });
        }
        if (p === '/api/admin/ranking' && method === 'GET') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          return json(200, db.ranking(u.searchParams.get('game'), u.searchParams.get('period')));
        }
        if (p === '/api/admin/ranking/hide' && method === 'POST') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          db.hideRanking(body.game, body.name, body.hidden);
          return json(200, { ok: true });
        }
        if (p === '/api/admin/users' && method === 'GET') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          return json(200, { users: db.users });
        }
        if (p === '/api/admin/users' && method === 'POST') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          if (!body || !body.email || !body.password || body.password.length < 10) return json(400, { error: 'Senha deve ter ao menos 10 caracteres.' });
          const user = db.createUser(body);
          return json(201, { user });
        }
        if ((m = p.match(/^\/api\/admin\/users\/(\d+)\/disable$/)) && method === 'POST') {
          if (!requireAdmin()) return json(403, { error: 'sem permissão' });
          db.disableUser(Number(m[1]));
          return json(200, { ok: true });
        }
        return json(404, { error: 'Rota não encontrada.' });
      }
    }

    function buildMockDb() {
      const now = Date.now();
      const iso = (offsetMs) => new Date(now + offsetMs).toISOString();
      const DAY = 86400000;
      let nextCampaignId = 5;
      let nextUserId = 3;
      let nextPlayerId = 40;

      const campaigns = [
        {
          id: 1, title: 'Desafio do Chef John', bannerText: 'O Chef John fez 1.240 na Corrida. Você supera?',
          description: 'Supere o recorde pessoal do Chef John na Corrida da Pizza e ganhe um brinde na loja.',
          kind: 'challenge', game: 'runner', metric: 'score', aggregation: 'best', target: 1241, multiplier: 1,
          startsAt: iso(-5 * DAY), endsAt: iso(25 * DAY), weekdays: null, dailyStart: null, dailyEnd: null,
          prizeTitle: 'Refrigerante 2L grátis', prizeDescription: 'Um refrigerante de 2 litros grátis na sua próxima visita.',
          stock: 50, perPlayerLimit: 1, couponValidDays: 7, challengerName: 'Chef John', challengerScore: 1240,
          status: 'active', live: true, couponsIssued: 6, couponsRedeemed: 2, participants: 34,
        },
        {
          id: 2, title: 'Terça turbinada', bannerText: 'Toda terça vale o dobro de John Coin!',
          description: 'Jogue nas terças-feiras à noite e some pontos em dobro para ganhar seu brinde.',
          kind: 'challenge', game: null, metric: 'score', aggregation: 'sum', target: 2000, multiplier: 2,
          startsAt: iso(-2 * DAY), endsAt: iso(28 * DAY), weekdays: [2], dailyStart: '18:00', dailyEnd: '21:00',
          prizeTitle: 'Fatia grátis', prizeDescription: 'Uma fatia de pizza grátis na sua próxima visita.',
          stock: 100, perPlayerLimit: 1, couponValidDays: 10, challengerName: null, challengerScore: null,
          status: 'active', live: isTuesdayNowBR(), couponsIssued: 11, couponsRedeemed: 4, participants: 58,
        },
        {
          id: 3, title: 'Penha entrega 1.000 pizzas', bannerText: 'Ajude a Penha a bater 1.000 entregas!',
          description: 'Meta coletiva: quando todos os jogadores juntos somarem 1.000 entregas na Corrida, todo mundo que participou ganha um brinde.',
          kind: 'collective', game: 'runner', metric: 'deliveries', aggregation: 'sum', target: 1000, multiplier: 1,
          startsAt: iso(-10 * DAY), endsAt: iso(20 * DAY), weekdays: null, dailyStart: null, dailyEnd: null,
          prizeTitle: 'Rodada de refrigerantes', prizeDescription: 'Um copo de refrigerante grátis para cada participante.',
          stock: null, perPlayerLimit: 1, couponValidDays: 14, challengerName: null, challengerScore: null,
          status: 'active', live: true, couponsIssued: 0, couponsRedeemed: 0, participants: 71, collectiveProgress: 742,
        },
        {
          id: 4, title: 'Missão da Corrida', bannerText: 'Complete 3 entregas numa única corrida!',
          description: 'Entregue 3 pizzas em uma única corrida e ganhe um brinde na hora.',
          kind: 'challenge', game: 'runner', metric: 'deliveries', aggregation: 'best', target: 3, multiplier: 1,
          startsAt: iso(-30 * DAY), endsAt: iso(-1 * DAY), weekdays: null, dailyStart: null, dailyEnd: null,
          prizeTitle: 'Brownie grátis', prizeDescription: 'Um brownie de sobremesa grátis.',
          stock: 30, perPlayerLimit: 1, couponValidDays: 7, challengerName: null, challengerScore: null,
          status: 'archived', live: false, couponsIssued: 19, couponsRedeemed: 15, participants: 40,
        },
        {
          id: 5, title: 'Fim de semana ninja', bannerText: 'Combos afiados valem prêmio no fim de semana.',
          description: 'Faça um combo de 20x ou mais no Ninja da Pizza no fim de semana.',
          kind: 'challenge', game: 'ninja', metric: 'score', aggregation: 'best', target: 3000, multiplier: 1,
          startsAt: iso(3 * DAY), endsAt: iso(33 * DAY), weekdays: [0, 6], dailyStart: null, dailyEnd: null,
          prizeTitle: 'Sobremesa do dia', prizeDescription: 'Sobremesa do dia grátis.',
          stock: 40, perPlayerLimit: 1, couponValidDays: 7, challengerName: null, challengerScore: null,
          status: 'draft', live: false, couponsIssued: 0, couponsRedeemed: 0, participants: 0,
        },
      ];

      function isTuesdayNowBR() {
        const br = new Date(Date.now() - 3 * 3600 * 1000);
        const h = br.getUTCHours();
        return br.getUTCDay() === 2 && h >= 18 && h < 21;
      }

      const players = [];
      const firstNames = ['ANA', 'JOAO', 'MARIA', 'PEDRO', 'LUCAS', 'JULIA', 'BRUNO', 'CARLA', 'DIEGO', 'FERNANDA', 'GABRIEL', 'HELENA', 'IGOR', 'JULIANA', 'KAUE', 'LARISSA', 'MARCOS', 'NATALIA', 'OTAVIO', 'PAULA', 'RAFAEL', 'SABRINA', 'TIAGO', 'VITORIA', 'WESLEY'];
      for (let i = 0; i < firstNames.length; i++) {
        players.push({
          id: nextPlayerId + i, name: firstNames[i], phone: `5547991${String(100000 + i * 37).slice(-6)}`,
          createdAt: iso(-(i + 1) * 3 * 3600000), plays: 4 + (i % 9), coupons: i % 4, deleted: false,
        });
      }
      nextPlayerId += firstNames.length;

      const coupons = [
        { code: 'CJ-7KQ2-M9TX', campaignId: 1, playerId: players[0].id, status: 'issued', issuedAt: iso(-2 * DAY), expiresAt: iso(5 * DAY), redeemedAt: null, redeemedBy: null },
        { code: 'CJ-3PLM-8XZR', campaignId: 2, playerId: players[1].id, status: 'redeemed', issuedAt: iso(-6 * DAY), expiresAt: iso(4 * DAY), redeemedAt: iso(-1 * DAY), redeemedBy: 'Caixa Demo' },
        { code: 'CJ-9V2K-TQ4H', campaignId: 4, playerId: players[2].id, status: 'issued', issuedAt: iso(-40 * DAY), expiresAt: iso(-33 * DAY), redeemedAt: null, redeemedBy: null },
        { code: 'CJ-2M8N-RXY7', campaignId: 1, playerId: players[3].id, status: 'cancelled', issuedAt: iso(-3 * DAY), expiresAt: iso(4 * DAY), redeemedAt: null, redeemedBy: null },
      ];

      const users = [
        { id: 1, name: 'Admin Demo', email: 'admin@chefjohn.local', role: 'admin', disabledAt: null },
        { id: 2, name: 'Caixa Demo', email: 'caixa@chefjohn.local', role: 'caixa', disabledAt: null },
      ];

      const rankingEntries = { catcher: [], runner: [], ninja: [] };
      for (const game of ['catcher', 'runner', 'ninja']) {
        for (let i = 0; i < 12; i++) {
          rankingEntries[game].push({ name: firstNames[i], score: 3000 - i * 180 - (game === 'runner' ? 0 : 200), hidden: i === 5 });
        }
      }

      const playsPerDay = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * DAY);
        playsPerDay.push({
          day: `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`,
          catcher: 8 + ((i * 7) % 12), runner: 14 + ((i * 5) % 15), ninja: 6 + ((i * 3) % 10),
        });
      }

      function couponStatus(c) {
        if (c.status === 'issued' && new Date(c.expiresAt).getTime() < Date.now()) return 'expired';
        return c.status;
      }
      function couponView(c) {
        const campaign = campaigns.find((x) => x.id === c.campaignId);
        const player = players.find((x) => x.id === c.playerId);
        return {
          code: c.code, status: couponStatus(c), campaignTitle: campaign ? campaign.title : '—',
          prizeTitle: campaign ? campaign.prizeTitle : '—', prizeDescription: campaign ? campaign.prizeDescription : '',
          player: player ? { name: player.name, phoneMasked: maskPhoneFallback(player.phone) } : { name: 'Jogador removido', phoneMasked: '—' },
          issuedAt: c.issuedAt, expiresAt: c.expiresAt, redeemedAt: c.redeemedAt, redeemedBy: c.redeemedBy,
        };
      }

      return {
        campaigns, users, coupons, players,
        dashboard() {
          const active = campaigns.filter((c) => c.status !== 'draft' && c.status !== 'archived');
          return {
            kpis: {
              playsToday: playsPerDay[playsPerDay.length - 1].catcher + playsPerDay[playsPerDay.length - 1].runner + playsPerDay[playsPerDay.length - 1].ninja,
              playersTotal: players.filter((p) => !p.deleted).length,
              newPlayers: 5,
              avgDurationByGame: { catcher: 62, runner: 118, ninja: 74 },
              playsByGame: { catcher: 91, runner: 143, ninja: 68 },
              couponsIssued: coupons.length,
              couponsRedeemed: coupons.filter((c) => c.status === 'redeemed').length,
            },
            playsPerDay,
            campaigns: active.map((c) => ({
              id: c.id, title: c.title, kind: c.kind, live: c.live,
              progress: c.kind === 'collective' ? (c.collectiveProgress || 0) : Math.round(c.target * 0.6),
              target: c.target, couponsIssued: c.couponsIssued, couponsRedeemed: c.couponsRedeemed, stockLeft: c.stock === null ? null : Math.max(0, c.stock - c.couponsIssued),
            })),
          };
        },
        createCampaign(data) {
          const c = Object.assign({ status: 'draft', live: false, couponsIssued: 0, couponsRedeemed: 0, participants: 0 }, data, { id: nextCampaignId++ });
          campaigns.push(c);
          return c;
        },
        updateCampaign(id, data) {
          const c = campaigns.find((x) => x.id === id);
          if (!c) return null;
          Object.assign(c, data);
          return c;
        },
        duplicateCampaign(id) {
          const c = campaigns.find((x) => x.id === id);
          if (!c) return null;
          const copy = Object.assign({}, c, { id: nextCampaignId++, title: `${c.title} (cópia)`, status: 'draft', live: false, couponsIssued: 0, couponsRedeemed: 0, participants: 0 });
          campaigns.push(copy);
          return copy;
        },
        findCoupon(code) { return coupons.find((c) => c.code === code.toUpperCase()); },
        couponStatus, couponView,
        listPlayers(q, page) {
          const qDigits = (q || '').replace(/\D/g, '');
          const filtered = players.filter((p) => !p.deleted && (!q || p.name.toLowerCase().indexOf(q) !== -1 || (qDigits && p.phone.indexOf(qDigits) !== -1)));
          const pageSize = 20;
          const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
          const slice = filtered.slice((page - 1) * pageSize, page * pageSize).map((p) => ({
            id: p.id, name: p.name, phone: p.phone, phoneMasked: maskPhoneFallback(p.phone), createdAt: p.createdAt, plays: p.plays, coupons: p.coupons,
          }));
          return { players: slice, page, pages };
        },
        playersCsv() {
          const rows = [['nome', 'whatsapp', 'cadastro', 'consentimento', 'partidas', 'cupons'].join(';')];
          players.filter((p) => !p.deleted).forEach((p) => {
            rows.push([p.name, maskPhoneFallback(p.phone), brDateOnly(p.createdAt), 'sim', p.plays, p.coupons].join(';'));
          });
          return rows.join('\n');
        },
        deletePlayer(id) {
          const p = players.find((x) => x.id === id);
          if (p) { p.deleted = true; p.name = 'REMOVIDO'; p.phone = null; }
        },
        ranking(game, period) {
          const list = (rankingEntries[game] || []).map((e, i) => Object.assign({ pos: i + 1 }, e));
          return { entries: list, period: period || 'all' };
        },
        hideRanking(game, name, hidden) {
          const entry = (rankingEntries[game] || []).find((e) => e.name === name);
          if (entry) entry.hidden = !!hidden;
        },
        createUser(data) {
          const u = { id: nextUserId++, name: data.name, email: data.email, role: data.role, disabledAt: null };
          users.push(u);
          return u;
        },
        disableUser(id) {
          const u = users.find((x) => x.id === id);
          if (u) u.disabledAt = new Date().toISOString();
        },
      };
    }

    /* ================= Router / state ================= */
    const App = { user: null };
    let renderToken = 0;

    const NAV_ADMIN = [
      { hash: '#/painel', label: 'Painel', icon: '📊' },
      { hash: '#/campanhas', label: 'Campanhas', icon: '📣' },
      { hash: '#/cupons', label: 'Validar cupom', icon: '🎟️' },
      { hash: '#/jogadores', label: 'Jogadores', icon: '👥' },
      { hash: '#/ranking', label: 'Ranking', icon: '🏆' },
      { hash: '#/usuarios', label: 'Usuários', icon: '🔑' },
    ];
    const NAV_CAIXA = [{ hash: '#/cupons', label: 'Validar cupom', icon: '🎟️' }];
    const PAGE_TITLES = { painel: 'Painel', campanhas: 'Campanhas', cupons: 'Validar cupom', jogadores: 'Jogadores', ranking: 'Ranking', usuarios: 'Usuários', login: 'Entrar' };

    function currentSection(hash) {
      const parts = (hash || '').replace(/^#\//, '').split('/');
      return parts[0] || 'painel';
    }

    function navFor(role) { return role === 'caixa' ? NAV_CAIXA : NAV_ADMIN; }

    async function boot() {
      window.addEventListener('hashchange', renderRoute);
      try {
        const res = await api.me();
        App.user = res.user;
      } catch (e) {
        App.user = null;
      }
      renderRoute();
    }

    function goto(hash) { location.hash = hash; }

    async function logout() {
      try { await api.logout(); } catch (e) { /* ignore */ }
      App.user = null;
      goto('#/login');
    }

    function renderRoute() {
      const root = document.getElementById('app');
      const hash = location.hash || '#/painel';
      const section = currentSection(hash);

      if (!App.user) {
        if (section !== 'login') { goto('#/login'); return; }
        clear(root);
        root.appendChild(renderLogin());
        return;
      }
      if (section === 'login') { goto(App.user.role === 'caixa' ? '#/cupons' : '#/painel'); return; }

      const nav = navFor(App.user.role);
      const allowed = nav.some((item) => currentSection(item.hash) === section);
      if (!allowed) { goto(nav[0].hash); return; }

      clear(root);
      const shell = buildShell(hash, section);
      root.appendChild(shell.el);
      const token = ++renderToken;
      dispatchPage(section, hash, shell.content, token);
      shell.content.focus();
    }

    function dispatchPage(section, hash, container, token) {
      if (section === 'painel') return renderPainel(container, token);
      if (section === 'campanhas') {
        const m = hash.match(/^#\/campanhas\/(nova|\d+)$/);
        if (m) return renderCampaignForm(container, token, m[1] === 'nova' ? null : Number(m[1]));
        return renderCampanhasList(container, token);
      }
      if (section === 'cupons') return renderCupons(container, token);
      if (section === 'jogadores') return renderJogadores(container, token);
      if (section === 'ranking') return renderRanking(container, token);
      if (section === 'usuarios') return renderUsuarios(container, token);
    }

    function buildShell(hash, section) {
      const nav = navFor(App.user.role);
      function navButton(item, cls) {
        const isActive = currentSection(item.hash) === section;
        return h('a', { href: item.hash, class: `${cls} ${isActive ? 'active' : ''}`, 'aria-current': isActive ? 'page' : null }, [
          h('span', { class: 'side-ic', 'aria-hidden': 'true' }, item.icon), h('span', {}, item.label),
        ]);
      }
      const sidebar = h('aside', { class: 'sidebar' }, [
        h('div', { class: 'brand' }, [
          h('img', { class: 'brand-logo', src: 'assets/logo-sushinachos.png?v=20260915-logo', alt: '', 'aria-hidden': 'true' }),
          h('div', { class: 'brand-text' }, [h('strong', {}, 'Sushinachos'), h('span', { class: 'brand-badge' }, 'PAINEL')]),
        ]),
        h('nav', { class: 'side-nav', 'aria-label': 'Navegação principal' }, nav.map((it) => navButton(it, 'side-link'))),
        h('div', { class: 'side-foot' }, [
          h('div', { class: 'side-user' }, [h('strong', {}, App.user.name), h('span', {}, App.user.role === 'admin' ? 'Administrador' : 'Caixa')]),
          h('button', { class: 'btn btn-secondary btn-block', onclick: logout }, 'Sair'),
        ]),
      ]);
      const content = h('div', { class: 'content', id: 'content', tabindex: '-1' });
      const main = h('div', { class: 'main' }, [
        h('header', { class: 'topbar' }, [
          h('h1', { class: 'page-title' }, PAGE_TITLES[section] || ''),
          h('div', { class: 'topbar-right' }, [
            h('span', { class: 'user-chip' }, [h('strong', {}, App.user.name), ` · ${App.user.role === 'admin' ? 'Admin' : 'Caixa'}`]),
            h('button', { class: 'btn btn-ghost btn-sm', onclick: logout }, 'Sair'),
          ]),
        ]),
        content,
      ]);
      const bottomNav = h('nav', { class: 'bottom-nav', 'aria-label': 'Navegação' }, [
        h('div', { class: 'bottom-nav-list' }, nav.map((it) => navButton(it, 'bottom-link'))),
      ]);
      const el = h('div', { class: 'shell' }, [sidebar, main, bottomNav]);
      return { el, content };
    }

    /* ---- Loading / empty / error helpers ---- */
    function showLoading(container, label) {
      setChildren(container, h('div', { class: 'state-box' }, [h('div', { class: 'spinner', 'aria-hidden': 'true' }), label || 'Carregando…']));
    }
    function showError(container, err, retry) {
      const msg = err && err.network ? 'Falha de rede. Verifique sua conexão e tente novamente.' : (err && err.message) || 'Algo deu errado.';
      setChildren(container, h('div', { class: 'state-box error' }, [h('p', {}, msg), retry ? h('button', { class: 'btn btn-secondary btn-sm', onclick: retry, style: 'margin-top:10px' }) : null].filter(Boolean)));
      if (retry) container.querySelector('button').textContent = 'Tentar de novo';
    }
    function showEmpty(container, label) {
      setChildren(container, h('div', { class: 'state-box' }, label));
    }

    async function guardedLoad(container, token, loader, onData, onRetry) {
      showLoading(container);
      try {
        const data = await loader();
        if (token !== renderToken) return;
        onData(data);
      } catch (err) {
        if (token !== renderToken) return;
        if (err.status === 401) { App.user = null; toast('Sessão expirada. Faça login novamente.', 'error'); goto('#/login'); return; }
        if (err.status === 403) { setChildren(container, h('div', { class: 'state-box error' }, 'Você não tem permissão para acessar isto.')); return; }
        showError(container, err, onRetry);
      }
    }

    /* ================= Login ================= */
    function renderLogin() {
      const errorBox = h('div', { class: 'login-error hidden' });
      const emailInput = h('input', { type: 'email', id: 'login-email', required: true, autocomplete: 'username' });
      const passInput = h('input', { type: 'password', id: 'login-password', required: true, autocomplete: 'current-password' });
      const submitBtn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Entrar');

      const form = h('form', { class: 'login-form', onsubmit: onSubmit }, [
        h('div', { class: 'field' }, [h('label', { for: 'login-email' }, 'E-mail'), emailInput]),
        h('div', { class: 'field' }, [h('label', { for: 'login-password' }, 'Senha'), passInput]),
        errorBox,
        submitBtn,
      ]);

      async function onSubmit(e) {
        e.preventDefault();
        errorBox.classList.add('hidden');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Entrando…';
        try {
          const res = await api.login(emailInput.value.trim(), passInput.value);
          App.user = res.user;
          goto(App.user.role === 'caixa' ? '#/cupons' : '#/painel');
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Entrar';
          if (err.network) { toast(err.message, 'error'); return; }
          errorBox.textContent = err.status === 401 ? 'E-mail ou senha inválidos.' : err.message;
          errorBox.classList.remove('hidden');
        }
      }

      const wrap = h('div', { class: 'login-wrap' }, [
        h('div', { class: 'login-card' }, [
          h('img', { class: 'login-logo', src: 'assets/logo-sushinachos.png?v=20260915-logo', alt: '' }),
          h('h1', {}, ['Sushinachos ', h('span', {}, 'PAINEL')]),
          h('p', { class: 'login-sub' }, 'ACESSO DA EQUIPE'),
          MOCK ? h('p', { class: 'login-sub' }, 'Modo demonstração: qualquer senha funciona; e-mail com "caixa" entra como caixa.') : null,
          form,
        ].filter(Boolean)),
      ]);
      return wrap;
    }

    /* ================= Painel ================= */
    function renderPainel(container, token) {
      guardedLoad(container, token, () => api.dashboard(7), (data) => {
        const k = data.kpis;
        const kpiGrid = h('div', { class: 'kpi-grid' }, [
          kpiCard('Partidas hoje', k.playsToday),
          kpiCard('Jogadores', k.playersTotal),
          kpiCard('Novos jogadores', k.newPlayers),
          kpiCard('Cupons emitidos', `${k.couponsRedeemed}/${k.couponsIssued}`, 'usados/emitidos'),
        ]);

        const maxTotal = Math.max(1, ...data.playsPerDay.map((d) => d.catcher + d.runner + d.ninja));
        const bars = data.playsPerDay.map((d) => {
          const total = d.catcher + d.runner + d.ninja;
          const seg = (val, cls) => val > 0 ? h('div', { class: `bar-seg ${cls}`, style: `height:${Math.max(2, (val / maxTotal) * 100)}%` }) : null;
          return h('div', { class: 'bar-day' }, [
            h('div', { class: 'bar-stack' }, [seg(d.ninja, 'ninja'), seg(d.runner, 'runner'), seg(d.catcher, 'catcher')].filter(Boolean)),
            h('span', { class: 'bar-day-total' }, String(total)),
            h('span', { class: 'bar-day-label' }, d.day.slice(5).split('-').reverse().join('/')),
          ]);
        });

        const avgList = h('div', { class: 'avg-duration-list' }, ['catcher', 'runner', 'ninja'].map((g) => h('div', { class: 'avg-duration-row' }, [gameLabel(g), h('strong', {}, formatDuration(k.avgDurationByGame[g]))])));

        const chartCard = h('div', { class: 'card' }, [
          h('div', { class: 'section-heading' }, [h('h2', {}, 'Partidas por dia')]),
          h('div', { class: 'chart-wrap' }, h('div', { class: 'bar-chart' }, bars)),
          h('div', { class: 'chart-legend' }, [
            h('span', {}, [h('span', { class: 'legend-dot catcher' }), 'Pega Pizza']),
            h('span', {}, [h('span', { class: 'legend-dot runner' }), 'Corrida']),
            h('span', {}, [h('span', { class: 'legend-dot ninja' }), 'Ninja']),
          ]),
          h('h3', { style: 'margin-top:18px;font-size:13px;color:var(--ink-soft-2)' }, 'Tempo médio por jogo'),
          avgList,
        ]);

        const campaignsCard = h('div', { class: 'card' }, [
          h('div', { class: 'section-heading' }, [h('h2', {}, 'Campanhas ativas')]),
          data.campaigns.length ? h('div', { class: 'active-campaigns-list' }, data.campaigns.map((c) => {
            const pct = progressPercent(c.progress, c.target);
            return h('div', { class: 'mini-campaign' }, [
              h('div', { class: 'mini-campaign-top' }, [h('strong', {}, c.title), c.live ? h('span', { class: 'badge badge-live' }, [h('span', { class: 'dot' }), 'Ao vivo']) : h('span', { class: 'badge badge-scheduled' }, 'Agendada')]),
              h('div', { class: 'progress-track' }, h('div', { class: 'progress-fill', style: `width:${pct}%` })),
              h('div', { class: 'mini-campaign-meta' }, [
                `${numberBR(c.progress)} / ${numberBR(c.target)}`,
                `Cupons ${c.couponsRedeemed}/${c.couponsIssued}`,
                `Estoque: ${c.stockLeft === null ? 'ilimitado' : numberBR(c.stockLeft)}`,
              ]),
            ]);
          })) : h('div', { class: 'state-box' }, 'Nenhuma campanha ativa agora.'),
        ]);

        setChildren(container, [kpiGrid, h('div', { class: 'panel-grid' }, [chartCard, campaignsCard])]);
      }, () => renderPainel(container, token));
    }

    function kpiCard(label, value, sub) {
      return h('div', { class: 'kpi-card' }, [h('div', { class: 'kpi-label' }, label), h('div', { class: 'kpi-value' }, String(value)), sub ? h('div', { class: 'kpi-sub' }, sub) : null].filter(Boolean));
    }

    /* ================= Campanhas: lista ================= */
    function renderCampanhasList(container, token) {
      guardedLoad(container, token, api.listCampaigns, (data) => {
        const toolbar = h('div', { class: 'toolbar' }, [h('a', { href: '#/campanhas/nova', class: 'btn btn-primary' }, '+ Nova campanha')]);
        if (!data.campaigns.length) {
          setChildren(container, [toolbar, h('div', { class: 'card' }, h('div', { class: 'state-box' }, 'Nenhuma campanha cadastrada ainda.'))]);
          return;
        }
        const now = new Date();
        const rows = data.campaigns.map((c) => {
          const info = campaignStatusInfo(c, now);
          const badge = h('span', { class: `badge badge-${info.code}` }, info.code === 'live' ? [h('span', { class: 'dot' }), info.label] : info.label);
          const canToggle = c.status === 'active' || c.status === 'paused';
          const actions = [
            h('a', { href: `#/campanhas/${c.id}`, class: 'btn btn-ghost btn-sm' }, 'Editar'),
            h('button', { class: 'btn btn-ghost btn-sm', onclick: () => onDuplicate(c) }, 'Duplicar'),
            canToggle ? h('button', { class: 'btn btn-secondary btn-sm', onclick: () => onToggle(c) }, c.status === 'active' ? 'Pausar' : 'Ativar') : null,
            info.code !== 'ended' ? h('button', { class: 'btn btn-ghost btn-sm', onclick: () => onArchive(c) }, 'Arquivar') : null,
          ].filter(Boolean);
          return h('div', { class: 'campaign-row' }, [
            h('div', { class: 'campaign-row-main' }, [
              h('div', { class: 'campaign-row-title' }, [c.title, ' ', badge]),
              h('div', { class: 'campaign-row-sub' }, `${c.kind === 'collective' ? 'Meta coletiva' : 'Desafio'} · ${gameLabel(c.game)}`),
              h('div', { class: 'campaign-row-stats' }, [
                `Participantes: ${numberBR(c.participants || 0)}`,
                `Cupons: ${c.couponsRedeemed || 0}/${c.couponsIssued || 0}`,
              ]),
            ]),
            h('div', { class: 'campaign-row-actions' }, actions),
          ]);
        });
        setChildren(container, [toolbar, h('div', { class: 'campaign-list' }, rows)]);

        async function onDuplicate(c) {
          try { await api.duplicateCampaign(c.id); toast('Campanha duplicada.', 'success'); renderCampanhasList(container, token); }
          catch (err) { toast(err.message, 'error'); }
        }
        async function onToggle(c) {
          const next = c.status === 'active' ? 'paused' : 'active';
          try { await api.setCampaignStatus(c.id, next); toast(next === 'active' ? 'Campanha ativada.' : 'Campanha pausada.', 'success'); renderCampanhasList(container, token); }
          catch (err) { toast(err.message, 'error'); }
        }
        async function onArchive(c) {
          const ok = await confirmModal({ title: 'Arquivar campanha', message: `Arquivar "${c.title}"? Ela deixará de aparecer no jogo.`, confirmLabel: 'Arquivar', danger: true });
          if (!ok) return;
          try { await api.setCampaignStatus(c.id, 'archived'); toast('Campanha arquivada.', 'success'); renderCampanhasList(container, token); }
          catch (err) { toast(err.message, 'error'); }
        }
      }, () => renderCampanhasList(container, token));
    }

    /* ================= Campanhas: formulário ================= */
    const TEMPLATES = [
      {
        key: 'desafio', title: 'Desafio do Chef John', desc: 'Supere o recorde do John na Corrida.',
        data: { title: 'Desafio do Chef John', bannerText: 'O Chef John fez 1.240 na Corrida. Você supera?', description: 'Supere o recorde pessoal do Chef John na Corrida da Pizza e ganhe um brinde.', kind: 'challenge', game: 'runner', metric: 'score', aggregation: 'best', challengerName: 'Chef John', challengerScore: 1240, target: 1241, multiplier: 1, weekdays: null, dailyStart: '', dailyEnd: '', prizeTitle: 'Refrigerante 2L grátis', prizeDescription: 'Um refrigerante de 2 litros grátis na próxima visita.', stock: 50, perPlayerLimit: 1, couponValidDays: 7 },
      },
      {
        key: 'turbinada', title: 'Horário turbinado', desc: 'Terça 18h-21h com pontos em dobro.',
        data: { title: 'Terça turbinada', bannerText: 'Toda terça vale o dobro de John Coin!', description: 'Jogue nas terças à noite e some pontos em dobro para ganhar seu brinde.', kind: 'challenge', game: null, metric: 'score', aggregation: 'sum', challengerName: '', challengerScore: '', target: 2000, multiplier: 2, weekdays: [2], dailyStart: '18:00', dailyEnd: '21:00', prizeTitle: 'Fatia grátis', prizeDescription: 'Uma fatia de pizza grátis na próxima visita.', stock: 100, perPlayerLimit: 1, couponValidDays: 10 },
      },
      {
        key: 'coletiva', title: 'Meta coletiva', desc: 'Penha entrega 1.000 pizzas juntos.',
        data: { title: 'Penha entrega 1.000 pizzas', bannerText: 'Ajude a Penha a bater 1.000 entregas!', description: 'Quando todos os jogadores juntos somarem 1.000 entregas na Corrida, todo mundo que participou ganha um brinde.', kind: 'collective', game: 'runner', metric: 'deliveries', aggregation: 'sum', challengerName: '', challengerScore: '', target: 1000, multiplier: 1, weekdays: null, dailyStart: '', dailyEnd: '', prizeTitle: 'Rodada de refrigerantes', prizeDescription: 'Um copo de refrigerante grátis para cada participante.', stock: null, perPlayerLimit: 1, couponValidDays: 14 },
      },
      {
        key: 'missao', title: 'Missão da Corrida', desc: '3 entregas em uma corrida.',
        data: { title: 'Missão da Corrida', bannerText: 'Complete 3 entregas numa única corrida!', description: 'Entregue 3 pizzas em uma única corrida e ganhe um brinde na hora.', kind: 'challenge', game: 'runner', metric: 'deliveries', aggregation: 'best', challengerName: '', challengerScore: '', target: 3, multiplier: 1, weekdays: null, dailyStart: '', dailyEnd: '', prizeTitle: 'Brownie grátis', prizeDescription: 'Um brownie de sobremesa grátis.', stock: 30, perPlayerLimit: 1, couponValidDays: 7 },
      },
    ];

    function defaultCampaignState() {
      const now = new Date(Date.now() + 5 * 60000);
      const later = new Date(Date.now() + 30 * 86400000);
      return {
        title: '', bannerText: '', description: '', kind: 'challenge', game: null, metric: 'score', aggregation: 'best',
        target: 100, multiplier: 1, startsAt: datetimeLocalBRFromISO(now.toISOString()), endsAt: datetimeLocalBRFromISO(later.toISOString()),
        weekdays: null, dailyStart: '', dailyEnd: '', prizeTitle: '', prizeDescription: '', stock: null, perPlayerLimit: 1,
        couponValidDays: 7, challengerName: '', challengerScore: '', status: 'draft',
      };
    }

    function renderCampaignForm(container, token, id) {
      if (id === null) {
        buildForm(defaultCampaignState(), null);
        return;
      }
      guardedLoad(container, token, api.listCampaigns, (data) => {
        const c = data.campaigns.find((x) => x.id === id);
        if (!c) { showEmpty(container, 'Campanha não encontrada.'); return; }
        const st = Object.assign({}, c, {
          startsAt: datetimeLocalBRFromISO(c.startsAt), endsAt: datetimeLocalBRFromISO(c.endsAt),
          dailyStart: c.dailyStart || '', dailyEnd: c.dailyEnd || '', challengerName: c.challengerName || '', challengerScore: c.challengerScore || '',
        });
        buildForm(st, id);
      }, () => renderCampaignForm(container, token, id));

      function buildForm(state, editingId) {
        let previewEl, summaryEl;
        const errorsEl = h('div', {});

        const templatesGrid = h('div', { class: 'template-grid' }, TEMPLATES.map((t) => h('button', { type: 'button', class: 'template-card', onclick: () => applyTemplate(t) }, [h('strong', {}, t.title), h('span', {}, t.desc)])));

        function applyTemplate(t) {
          Object.assign(state, t.data);
          rerenderFields();
        }

        // Field elements (kept stable so typing doesn't lose focus).
        const fTitle = h('input', { type: 'text', maxlength: '60', value: state.title, oninput: (e) => { state.title = e.target.value; refreshLive(); } });
        const fBanner = h('input', { type: 'text', maxlength: '90', value: state.bannerText, oninput: (e) => { state.bannerText = e.target.value; refreshLive(); } });
        const fDesc = h('textarea', { maxlength: '400', oninput: (e) => { state.description = e.target.value; refreshLive(); } }, state.description);

        const fKind = h('select', { onchange: (e) => { state.kind = e.target.value; refreshLive(); } }, [
          h('option', { value: 'challenge', selected: state.kind === 'challenge' }, 'Desafio (individual)'),
          h('option', { value: 'collective', selected: state.kind === 'collective' }, 'Meta coletiva'),
        ]);
        const fGame = h('select', { onchange: (e) => { state.game = e.target.value || null; refreshLive(); } }, [
          h('option', { value: '', selected: !state.game }, 'Qualquer jogo'),
          h('option', { value: 'catcher', selected: state.game === 'catcher' }, 'Pega Pizza'),
          h('option', { value: 'runner', selected: state.game === 'runner' }, 'Corrida da Pizza'),
          h('option', { value: 'ninja', selected: state.game === 'ninja' }, 'Ninja da Pizza'),
        ]);
        const fMetric = h('select', { onchange: (e) => { state.metric = e.target.value; refreshLive(); } }, [
          h('option', { value: 'score', selected: state.metric === 'score' }, 'Pontuação'),
          h('option', { value: 'deliveries', selected: state.metric === 'deliveries' }, 'Entregas (Corrida)'),
          h('option', { value: 'plays', selected: state.metric === 'plays' }, 'Partidas jogadas'),
        ]);
        const fAgg = h('select', { onchange: (e) => { state.aggregation = e.target.value; refreshLive(); } }, [
          h('option', { value: 'best', selected: state.aggregation === 'best' }, 'Melhor pontuação'),
          h('option', { value: 'sum', selected: state.aggregation === 'sum' }, 'Soma acumulada'),
        ]);
        const fTarget = h('input', { type: 'number', min: '1', value: state.target, oninput: (e) => { state.target = Number(e.target.value); refreshLive(); } });
        const fMultiplier = h('input', { type: 'number', min: '1', max: '5', step: '0.5', value: state.multiplier, oninput: (e) => { state.multiplier = Number(e.target.value); refreshLive(); } });
        const targetHintEl = h('small', { class: 'hint' }, targetHintText(state.metric));
        const metricGuideEl = h('div', { class: 'metric-guide' }, [
          h('div', { class: 'metric-guide-title' }, '⏱️ Guia de Estimativa de Gameplay (Equilíbrio dos 3 Jogos)'),
          h('div', { class: 'metric-guide-text' },
            'Pega Pizza, Corrida e Ninja estão equilibrados para render a mesma média de John Coins por tempo:'
          ),
          h('div', { class: 'metric-guide-pills' }, [
            h('span', { class: 'metric-guide-pill' }, [h('strong', {}, '1 minuto:'), '~370 – 400 JC']),
            h('span', { class: 'metric-guide-pill' }, [h('strong', {}, '2 minutos:'), '~950 – 1.050 JC']),
            h('span', { class: 'metric-guide-pill' }, [h('strong', {}, 'Recorde (1 partida):'), '300–600 JC (médio) | 1.000+ (difícil)']),
            h('span', { class: 'metric-guide-pill' }, [h('strong', {}, 'Soma acumulada:'), '2.000 JC (~5 min) | 5.000 JC (~12 min)']),
            h('span', { class: 'metric-guide-pill' }, [h('strong', {}, 'Entregas (Corrida):'), '~1 entrega a cada 45–60s']),
          ]),
        ]);
        const fChallengerName = h('input', { type: 'text', maxlength: '30', value: state.challengerName || '', oninput: (e) => { state.challengerName = e.target.value; refreshLive(); } });
        const fChallengerScore = h('input', { type: 'number', min: '0', value: state.challengerScore || '', oninput: (e) => { state.challengerScore = Number(e.target.value); if (state.challengerName) state.target = state.challengerScore + 1; refreshLive(); if (state.challengerName) fTarget.value = state.target; } });

        const fStarts = h('input', { type: 'datetime-local', value: state.startsAt, oninput: (e) => { state.startsAt = e.target.value; refreshLive(); } });
        const fEnds = h('input', { type: 'datetime-local', value: state.endsAt, oninput: (e) => { state.endsAt = e.target.value; refreshLive(); } });
        const chipRow = h('div', { class: 'chip-group' }, WEEKDAY_SHORT.map((label, idx) => {
          const active = Array.isArray(state.weekdays) && state.weekdays.includes(idx);
          const chip = h('button', { type: 'button', class: `chip ${active ? 'active' : ''}` }, label);
          chip.addEventListener('click', () => {
            const set = new Set(state.weekdays || []);
            if (set.has(idx)) set.delete(idx); else set.add(idx);
            state.weekdays = set.size ? Array.from(set).sort() : null;
            chip.classList.toggle('active');
            refreshLive();
          });
          return chip;
        }));
        const fDailyStart = h('input', { type: 'time', value: state.dailyStart || '', oninput: (e) => { state.dailyStart = e.target.value; refreshLive(); } });
        const fDailyEnd = h('input', { type: 'time', value: state.dailyEnd || '', oninput: (e) => { state.dailyEnd = e.target.value; refreshLive(); } });

        const fPrizeTitle = h('input', { type: 'text', maxlength: '60', value: state.prizeTitle, oninput: (e) => { state.prizeTitle = e.target.value; refreshLive(); } });
        const fPrizeDesc = h('textarea', { maxlength: '200', oninput: (e) => { state.prizeDescription = e.target.value; refreshLive(); } }, state.prizeDescription);
        const fUnlimited = h('input', { type: 'checkbox', checked: state.stock === null || state.stock === undefined, onchange: (e) => { state.stock = e.target.checked ? null : 10; fStock.disabled = e.target.checked; fStock.value = state.stock === null ? '' : state.stock; refreshLive(); } });
        const fStock = h('input', { type: 'number', min: '0', value: state.stock === null || state.stock === undefined ? '' : state.stock, disabled: state.stock === null || state.stock === undefined, oninput: (e) => { state.stock = e.target.value === '' ? null : Number(e.target.value); refreshLive(); } });
        const fLimit = h('input', { type: 'number', min: '1', value: state.perPlayerLimit, oninput: (e) => { state.perPlayerLimit = Number(e.target.value); refreshLive(); } });
        const fValidDays = h('input', { type: 'number', min: '1', max: '90', value: state.couponValidDays, oninput: (e) => { state.couponValidDays = Number(e.target.value); refreshLive(); } });
        const fStatus = h('select', { onchange: (e) => { state.status = e.target.value; } }, [
          h('option', { value: 'draft', selected: state.status === 'draft' }, 'Rascunho'),
          h('option', { value: 'active', selected: state.status === 'active' }, 'Ativa'),
          h('option', { value: 'paused', selected: state.status === 'paused' }, 'Pausada'),
        ]);

        function rerenderFields() {
          fTitle.value = state.title; fBanner.value = state.bannerText; fDesc.value = state.description;
          fKind.value = state.kind; fGame.value = state.game || ''; fMetric.value = state.metric; fAgg.value = state.aggregation;
          fTarget.value = state.target; fMultiplier.value = state.multiplier;
          fChallengerName.value = state.challengerName || ''; fChallengerScore.value = state.challengerScore || '';
          fDailyStart.value = state.dailyStart || ''; fDailyEnd.value = state.dailyEnd || '';
          fPrizeTitle.value = state.prizeTitle; fPrizeDesc.value = state.prizeDescription;
          const unlimited = state.stock === null || state.stock === undefined;
          fUnlimited.checked = unlimited; fStock.disabled = unlimited; fStock.value = unlimited ? '' : state.stock;
          fLimit.value = state.perPlayerLimit; fValidDays.value = state.couponValidDays;
          Array.from(chipRow.children).forEach((chip, idx) => chip.classList.toggle('active', Array.isArray(state.weekdays) && state.weekdays.includes(idx)));
          refreshLive();
        }

        function refreshLive() {
          const previewChildren = [
            h('div', { class: 'preview-banner' }, state.bannerText || 'Chamada da campanha'),
            h('div', { class: 'preview-body' }, [
              h('div', { class: 'preview-title' }, state.title || 'Título da campanha'),
              h('div', { class: 'preview-desc' }, state.description || 'Descrição da campanha para o jogador.'),
              h('div', { class: 'preview-prize' }, `🎁 ${state.prizeTitle || 'Prêmio'}`),
              h('div', { class: 'preview-badge-row' }, [
                state.multiplier > 1 ? h('span', { class: 'badge badge-live' }, `${state.multiplier}× John Coin`) : null,
                (weekdaysSummary(state.weekdays) || windowSummary(state.dailyStart, state.dailyEnd)) ? h('span', { class: 'badge badge-scheduled' }, [weekdaysSummary(state.weekdays), windowSummary(state.dailyStart, state.dailyEnd)].filter(Boolean).join(' ')) : null,
              ].filter(Boolean)),
            ]),
          ];
          setChildren(previewEl, previewChildren);
          const summaryState = Object.assign({}, state, { startsAt: isoFromDatetimeLocalBR(state.startsAt), endsAt: isoFromDatetimeLocalBR(state.endsAt) });
          summaryEl.textContent = humanSummary(summaryState);
          targetHintEl.textContent = targetHintText(state.metric);
        }

        previewEl = h('div', { class: 'preview-card' });
        summaryEl = h('p', {});

        const formGroups = h('div', { class: 'form-grid' }, [
          h('div', { class: 'form-group' }, [h('h3', {}, 'Chamada'), h('div', { class: 'field' }, [h('label', {}, 'Título'), fTitle]), h('div', { class: 'field' }, [h('label', {}, 'Chamada curta do card'), fBanner]), h('div', { class: 'field' }, [h('label', {}, 'Descrição (regras para o cliente)'), fDesc])]),
          h('div', { class: 'form-group' }, [h('h3', {}, 'Objetivo'), h('div', { class: 'form-row three' }, [
            h('div', { class: 'field' }, [h('label', {}, 'Tipo'), fKind]),
            h('div', { class: 'field' }, [h('label', {}, 'Jogo'), fGame]),
            h('div', { class: 'field' }, [h('label', {}, 'Métrica'), fMetric]),
          ]), h('div', { class: 'form-row three' }, [
            h('div', { class: 'field' }, [h('label', {}, 'Agregação'), fAgg]),
            h('div', { class: 'field' }, [h('label', {}, 'Meta (alvo)'), fTarget, targetHintEl]),
            h('div', { class: 'field' }, [h('label', {}, 'Multiplicador de John Coin'), fMultiplier]),
          ]), h('div', { class: 'form-row' }, [
            h('div', { class: 'field' }, [h('label', {}, 'Nome do desafiante (opcional)'), fChallengerName]),
            h('div', { class: 'field' }, [h('label', {}, 'Pontuação do desafiante'), fChallengerScore]),
          ]), metricGuideEl]),
          h('div', { class: 'form-group' }, [h('h3', {}, 'Quando (horário de Brasília)'), h('div', { class: 'form-row' }, [
            h('div', { class: 'field' }, [h('label', {}, 'Início'), fStarts]),
            h('div', { class: 'field' }, [h('label', {}, 'Fim'), fEnds]),
          ]), h('div', { class: 'field' }, [h('label', {}, 'Dias da semana (vazio = todos)'), chipRow]), h('div', { class: 'form-row' }, [
            h('div', { class: 'field' }, [h('label', {}, 'Janela diária — início'), fDailyStart]),
            h('div', { class: 'field' }, [h('label', {}, 'Janela diária — fim'), fDailyEnd]),
          ])]),
          h('div', { class: 'form-group' }, [h('h3', {}, 'Prêmio'), h('div', { class: 'form-row' }, [
            h('div', { class: 'field' }, [h('label', {}, 'Título do prêmio'), fPrizeTitle]),
            h('div', { class: 'field' }, [h('label', {}, 'Validade do cupom (dias)'), fValidDays]),
          ]), h('div', { class: 'field' }, [h('label', {}, 'Descrição do prêmio'), fPrizeDesc]), h('div', { class: 'form-row three' }, [
            h('div', { class: 'field' }, [h('label', { class: 'checkbox-field' }, [fUnlimited, 'Estoque ilimitado'])]),
            h('div', { class: 'field' }, [h('label', {}, 'Estoque'), fStock]),
            h('div', { class: 'field' }, [h('label', {}, 'Limite por jogador'), fLimit]),
          ]), h('div', { class: 'field' }, [h('label', {}, 'Status'), fStatus])]),
          h('div', { class: 'form-group' }, [h('h3', {}, 'Prévia ao vivo do card'), h('div', { class: 'preview-wrap' }, previewEl)]),
          h('div', { class: 'form-group' }, [h('h3', {}, 'Resumo em linguagem humana'), h('div', { class: 'summary-box' }, summaryEl)]),
          errorsEl,
          h('div', { class: 'form-actions' }, [
            h('a', { href: '#/campanhas', class: 'btn btn-ghost' }, 'Cancelar'),
            h('button', { class: 'btn btn-primary', onclick: onSave }, editingId ? 'Salvar alterações' : 'Criar campanha'),
          ]),
        ]);

        setChildren(container, [h('div', { class: 'card templates-card' }, [h('div', { class: 'section-heading' }, h('h2', {}, 'Modelos prontos')), templatesGrid]), formGroups]);
        rerenderFields();

        async function onSave() {
          const errors = validateCampaign(state);
          if (errors.length) {
            setChildren(errorsEl, h('div', { class: 'state-box error' }, errors.join(' ')));
            toast('Corrija os campos destacados.', 'error');
            return;
          }
          setChildren(errorsEl, []);
          const payload = Object.assign({}, state, {
            startsAt: isoFromDatetimeLocalBR(state.startsAt), endsAt: isoFromDatetimeLocalBR(state.endsAt),
            dailyStart: state.dailyStart || null, dailyEnd: state.dailyEnd || null,
            challengerName: state.challengerName || null, challengerScore: state.challengerName ? Number(state.challengerScore) : null,
            stock: state.stock === '' || state.stock === undefined ? null : state.stock,
          });
          try {
            if (editingId) { await api.updateCampaign(editingId, payload); toast('Campanha atualizada.', 'success'); }
            else { await api.createCampaign(payload); toast('Campanha criada.', 'success'); }
            goto('#/campanhas');
          } catch (err) {
            if (err.status === 401) { App.user = null; goto('#/login'); return; }
            toast(err.message, 'error');
          }
        }
      }
    }

    function validateCampaign(s) {
      const errors = [];
      if (!s.title || s.title.length > 60) errors.push('Título é obrigatório (até 60 caracteres).');
      if (!s.bannerText || s.bannerText.length > 90) errors.push('Chamada curta é obrigatória (até 90 caracteres).');
      if (!s.description) errors.push('Descrição é obrigatória.');
      if (!s.target || s.target <= 0) errors.push('Meta deve ser maior que zero.');
      if (s.multiplier < 1 || s.multiplier > 5) errors.push('Multiplicador deve ser entre 1 e 5.');
      const startsIso = isoFromDatetimeLocalBR(s.startsAt);
      const endsIso = isoFromDatetimeLocalBR(s.endsAt);
      if (!startsIso || !endsIso || new Date(endsIso) <= new Date(startsIso)) errors.push('O fim precisa ser depois do início.');
      if (!s.prizeTitle || s.prizeTitle.length > 60) errors.push('Título do prêmio é obrigatório (até 60 caracteres).');
      if (!s.prizeDescription || s.prizeDescription.length > 200) errors.push('Descrição do prêmio é obrigatória (até 200 caracteres).');
      if (s.stock !== null && s.stock !== undefined && s.stock < 0) errors.push('Estoque não pode ser negativo.');
      if (!s.perPlayerLimit || s.perPlayerLimit < 1) errors.push('Limite por pessoa deve ser ao menos 1.');
      if (!s.couponValidDays || s.couponValidDays < 1 || s.couponValidDays > 90) errors.push('Validade do cupom deve ser entre 1 e 90 dias.');
      return errors;
    }

    /* ================= Validar cupom ================= */
    function renderCupons(container) {
      const state = { history: [] };
      const input = h('input', {
        class: 'coupon-input', type: 'text', inputmode: 'text', autocomplete: 'off', placeholder: 'CJ-____-____',
        'aria-label': 'Código do cupom',
      });
      input.value = 'CJ-';
      const consultBtn = h('button', { class: 'btn btn-primary btn-block', disabled: true }, 'Consultar');
      const resultRegion = h('div', { 'aria-live': 'polite' });
      const historyRegion = h('div', { class: 'coupon-history' });

      input.addEventListener('input', () => {
        input.value = formatCouponCode(input.value);
        // Reformatting resets the caret in some browsers; pin it to the end
        // since the field is meant to be typed forward, not edited mid-string.
        input.setSelectionRange(input.value.length, input.value.length);
        consultBtn.disabled = !isCompleteCouponCode(input.value);
      });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !consultBtn.disabled) onConsult(); });
      consultBtn.addEventListener('click', onConsult);

      async function onConsult() {
        consultBtn.disabled = true;
        consultBtn.textContent = 'Consultando…';
        setChildren(resultRegion, h('div', { class: 'state-box' }, [h('div', { class: 'spinner' }), 'Consultando…']));
        const code = input.value;
        try {
          const res = await api.getCoupon(code);
          renderResult(res.coupon, code);
        } catch (err) {
          consultBtn.disabled = false;
          if (err.status === 401) { App.user = null; goto('#/login'); return; }
          if (err.status === 404) { renderResult(null, code); return; }
          if (err.network) { toast(err.message, 'error'); setChildren(resultRegion, []); return; }
          toast(err.message, 'error');
          setChildren(resultRegion, []);
        }
        consultBtn.textContent = 'Consultar';
        consultBtn.disabled = !isCompleteCouponCode(input.value);
      }

      function renderResult(coupon, code) {
        if (!coupon) {
          setChildren(resultRegion, h('div', { class: 'coupon-result bad' }, [h('div', { class: 'coupon-result-title' }, '🔴 Não encontrado'), h('p', { class: 'coupon-result-line' }, `O código ${code} não corresponde a nenhum cupom.`)]));
          pushHistory(code, 'Não encontrado');
          return;
        }
        if (coupon.status === 'issued') {
          const redeemBtn = h('button', { class: 'btn btn-primary btn-block', onclick: onRedeem }, 'Dar baixa');
          setChildren(resultRegion, h('div', { class: 'coupon-result ok' }, [
            h('div', { class: 'coupon-result-title' }, '🟢 Válido'),
            h('p', { class: 'coupon-result-line' }, [h('strong', {}, coupon.prizeTitle), ` — ${coupon.campaignTitle}`]),
            h('p', { class: 'coupon-result-line' }, [h('strong', {}, coupon.player.name), ` · ${coupon.player.phoneMasked}`]),
            h('p', { class: 'coupon-result-line' }, `Validade: ${brDateTime(coupon.expiresAt)}`),
            redeemBtn,
          ]));
          async function onRedeem() {
            const ok = await confirmModal({ title: 'Confirmar baixa', message: `Dar baixa em ${code}: ${coupon.prizeTitle} para ${coupon.player.name}?`, confirmLabel: 'Dar baixa' });
            if (!ok) return;
            redeemBtn.disabled = true;
            try {
              const res = await api.redeemCoupon(code);
              renderResult(res.coupon, code);
              toast('Cupom baixado com sucesso.', 'success');
            } catch (err) {
              if (err.status === 401) { App.user = null; goto('#/login'); return; }
              toast(err.message, 'error');
              redeemBtn.disabled = false;
            }
          }
          pushHistory(code, 'Válido');
          return;
        }
        if (coupon.status === 'redeemed') {
          setChildren(resultRegion, h('div', { class: 'coupon-result warn' }, [
            h('div', { class: 'coupon-result-title' }, '🟡 Já usado'),
            h('p', { class: 'coupon-result-line' }, `Usado em ${brDateTime(coupon.redeemedAt)}${coupon.redeemedBy ? ` por ${coupon.redeemedBy}` : ''}.`),
            h('p', { class: 'coupon-result-line' }, [h('strong', {}, coupon.player.name), ` · ${coupon.player.phoneMasked}`]),
          ]));
          pushHistory(code, 'Já usado');
          return;
        }
        const label = coupon.status === 'expired' ? 'Expirado' : 'Cancelado';
        setChildren(resultRegion, h('div', { class: 'coupon-result bad' }, [
          h('div', { class: 'coupon-result-title' }, `🔴 ${label}`),
          h('p', { class: 'coupon-result-line' }, [h('strong', {}, coupon.player.name), ` · ${coupon.player.phoneMasked}`]),
        ]));
        pushHistory(code, label);
      }

      function pushHistory(code, statusLabel) {
        state.history.unshift({ code, statusLabel, time: new Date().toISOString() });
        setChildren(historyRegion, state.history.slice(0, 10).map((item) => h('div', { class: 'coupon-history-item' }, [h('strong', {}, item.code), `${item.statusLabel} · ${brDateTime(item.time).split(' ')[1]}`])));
      }

      setChildren(container, h('div', { class: 'coupon-page' }, [
        h('div', { class: 'coupon-input-card' }, [
          h('label', { for: undefined, class: 'field' }, []),
          h('div', { class: 'field' }, [h('label', {}, 'Código do cupom'), input]),
          consultBtn,
        ]),
        resultRegion,
        h('div', {}, [h('h3', { style: 'font-size:13px;color:var(--ink-soft-2);margin-bottom:10px' }, 'Histórico desta sessão'), historyRegion]),
      ]));
      input.focus();
    }

    /* ================= Jogadores ================= */
    function renderJogadores(container, token) {
      const state = { q: '', page: 1 };
      let debounceTimer = null;

      function load() {
        guardedLoad(container, token, () => api.listPlayers(state.q, state.page), renderList, load);
      }

      function renderList(data) {
        const searchInput = h('input', { type: 'search', placeholder: 'Buscar por nome ou telefone', value: state.q, oninput: onSearch, 'aria-label': 'Buscar jogadores' });
        const csvBtn = h('button', { class: 'btn btn-secondary', onclick: onExport }, 'Exportar CSV');
        const toolbar = h('div', { class: 'players-toolbar' }, [h('div', { class: 'field' }, searchInput), csvBtn]);

        if (!data.players.length) {
          setChildren(container, [toolbar, h('div', { class: 'card' }, h('div', { class: 'state-box' }, 'Nenhum jogador encontrado.'))]);
          bindSearch(searchInput);
          return;
        }

        const table = h('table', { class: 'data-table' }, [
          h('thead', {}, h('tr', {}, ['Nome', 'WhatsApp', 'Cadastro', 'Partidas', 'Cupons', ''].map((th) => h('th', {}, th)))),
          h('tbody', {}, data.players.map(rowTr)),
        ]);
        const cards = h('div', { class: 'player-cards' }, data.players.map(rowCard));
        const pager = h('div', { class: 'pagination' }, [
          h('button', { class: 'btn btn-ghost btn-sm', disabled: state.page <= 1, onclick: () => { state.page--; load(); } }, '← Anterior'),
          h('span', {}, `Página ${data.page} de ${data.pages}`),
          h('button', { class: 'btn btn-ghost btn-sm', disabled: state.page >= data.pages, onclick: () => { state.page++; load(); } }, 'Próxima →'),
        ]);

        setChildren(container, [toolbar, h('div', { class: 'card' }, [table, cards]), pager]);
        bindSearch(searchInput);

        function rowTr(p) {
          return h('tr', {}, [
            h('td', {}, p.name), h('td', {}, p.phoneMasked), h('td', {}, brDateOnly(p.createdAt)),
            h('td', {}, String(p.plays)), h('td', {}, String(p.coupons)),
            h('td', {}, h('button', { class: 'btn btn-ghost btn-sm', onclick: () => onDelete(p) }, 'Excluir')),
          ]);
        }
        function rowCard(p) {
          return h('div', { class: 'player-card' }, [
            h('div', { class: 'player-card-top' }, [p.name, h('button', { class: 'btn btn-ghost btn-sm', onclick: () => onDelete(p) }, 'Excluir')]),
            h('div', { class: 'player-card-meta' }, `${p.phoneMasked} · desde ${brDateOnly(p.createdAt)}`),
            h('div', { class: 'player-card-meta' }, `${p.plays} partidas · ${p.coupons} cupons`),
          ]);
        }
        async function onDelete(p) {
          const ok = await confirmModal({ title: 'Excluir jogador (LGPD)', message: `Excluir os dados de ${p.name}? Essa ação anonimiza o cadastro e não pode ser desfeita.`, confirmLabel: 'Excluir', danger: true });
          if (!ok) return;
          try { await api.deletePlayer(p.id); toast('Dados do jogador excluídos.', 'success'); load(); }
          catch (err) { toast(err.message, 'error'); }
        }
      }

      function bindSearch(searchInput) {
        searchInput.addEventListener('input', () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => { state.q = searchInput.value; state.page = 1; load(); }, 350);
        });
      }
      function onSearch() { /* handled via bindSearch debounce */ }

      async function onExport() {
        try {
          const csv = await api.playersCsv();
          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = 'jogadores-sushinachos.csv';
          document.body.appendChild(a); a.click(); a.remove();
          URL.revokeObjectURL(url);
        } catch (err) {
          if (err.status === 401) { App.user = null; goto('#/login'); return; }
          toast(err.message, 'error');
        }
      }

      load();
    }

    /* ================= Ranking ================= */
    function renderRanking(container, token) {
      const state = { game: 'catcher', period: 'all' };
      function load() {
        guardedLoad(container, token, () => api.ranking(state.game, state.period), renderList, load);
      }
      function renderList(data) {
        const gameTabs = h('div', { class: 'tabs' }, [['catcher', 'Pega Pizza'], ['runner', 'Corrida'], ['ninja', 'Ninja']].map(([g, label]) =>
          h('button', { class: `tab ${state.game === g ? 'active' : ''}`, onclick: () => { state.game = g; load(); } }, label)));
        const periodTabs = h('div', { class: 'tabs' }, [['all', 'Geral'], ['month', 'Mensal']].map(([p, label]) =>
          h('button', { class: `tab ${state.period === p ? 'active' : ''}`, onclick: () => { state.period = p; load(); } }, label)));

        const entries = data.entries || [];
        const list = entries.length ? h('div', { class: 'card' }, entries.map((e) => h('div', { class: `rank-row ${e.hidden ? 'hidden-row' : ''}` }, [
          h('span', { class: 'rank-pos' }, `#${e.pos}`),
          h('span', { class: 'rank-name' }, e.name),
          h('span', { class: 'rank-score' }, numberBR(e.score)),
          h('button', { class: 'btn btn-ghost btn-sm rank-hide-btn', onclick: () => onHide(e) }, e.hidden ? 'Mostrar' : 'Ocultar'),
        ]))) : h('div', { class: 'card' }, h('div', { class: 'state-box' }, 'Sem pontuações neste período.'));

        setChildren(container, [gameTabs, periodTabs, list]);

        async function onHide(e) {
          try { await api.hideRanking(state.game, e.name, !e.hidden); toast(e.hidden ? 'Voltou a aparecer no ranking.' : 'Ocultado do ranking.', 'success'); load(); }
          catch (err) { toast(err.message, 'error'); }
        }
      }
      load();
    }

    /* ================= Usuários ================= */
    function renderUsuarios(container, token) {
      function load() {
        guardedLoad(container, token, api.listUsers, renderList, load);
      }
      function renderList(data) {
        const list = h('div', { class: 'user-list' }, data.users.map((u) => h('div', { class: `user-row ${u.disabledAt ? 'disabled' : ''}` }, [
          h('div', { class: 'user-row-info' }, [h('strong', {}, u.name), h('span', {}, u.email)]),
          h('span', { class: `role-pill ${u.role}` }, u.role === 'admin' ? 'Admin' : 'Caixa'),
          u.disabledAt ? h('span', { class: 'badge badge-ended' }, 'Desativado') : h('button', { class: 'btn btn-ghost btn-sm', onclick: () => onDisable(u) }, 'Desativar'),
        ])));

        const nameInput = h('input', { type: 'text', required: true });
        const emailInput = h('input', { type: 'email', required: true });
        const roleSelect = h('select', {}, [h('option', { value: 'caixa' }, 'Caixa'), h('option', { value: 'admin' }, 'Admin')]);
        const passInput = h('input', { type: 'password', required: true, minlength: '10' });
        const errBox = h('div', { class: 'hidden state-box error' });
        const form = h('form', { class: 'form-grid', onsubmit: onCreate }, [
          h('div', { class: 'form-group' }, [h('h3', {}, 'Novo usuário'), h('div', { class: 'form-row' }, [
            h('div', { class: 'field' }, [h('label', {}, 'Nome'), nameInput]),
            h('div', { class: 'field' }, [h('label', {}, 'E-mail'), emailInput]),
          ]), h('div', { class: 'form-row' }, [
            h('div', { class: 'field' }, [h('label', {}, 'Papel'), roleSelect]),
            h('div', { class: 'field' }, [h('label', {}, 'Senha (mín. 10 caracteres)'), passInput]),
          ]), errBox, h('div', { class: 'form-actions' }, h('button', { class: 'btn btn-primary', type: 'submit' }, 'Criar usuário'))]),
        ]);

        setChildren(container, [h('div', { class: 'card' }, list), form]);

        async function onDisable(u) {
          const ok = await confirmModal({ title: 'Desativar usuário', message: `Desativar o acesso de ${u.name}?`, confirmLabel: 'Desativar', danger: true });
          if (!ok) return;
          try { await api.disableUser(u.id); toast('Usuário desativado.', 'success'); load(); }
          catch (err) { toast(err.message, 'error'); }
        }
        async function onCreate(e) {
          e.preventDefault();
          errBox.classList.add('hidden');
          if (passInput.value.length < 10) { errBox.textContent = 'Senha deve ter ao menos 10 caracteres.'; errBox.classList.remove('hidden'); return; }
          try {
            await api.createUser({ name: nameInput.value, email: emailInput.value, role: roleSelect.value, password: passInput.value });
            toast('Usuário criado.', 'success');
            load();
          } catch (err) {
            errBox.textContent = err.message; errBox.classList.remove('hidden');
          }
        }
      }
      load();
    }

    boot();
  }

  /* ================= Exports for tests ================= */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PURE;
  }
})();
