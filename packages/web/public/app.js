// Interface do calendário semanal. Sem framework, sem build.

const $ = (sel) => document.querySelector(sel);

const el = {
  calendar: $('#calendar'), meta: $('#meta'), range: $('#range'), banner: $('#banner'),
  prev: $('#prev'), next: $('#next'), today: $('#today'),
  favOnly: $('#favOnly'), refresh: $('#refresh'),
  freshness: $('#freshness'), freshnessText: $('#freshnessText'),
  openFavs: $('#openFavs'), closeFavs: $('#closeFavs'),
  drawer: $('#drawer'), scrim: $('#scrim'),
  seriesList: $('#seriesList'), seriesSearch: $('#seriesSearch'), backfillBtn: $('#backfillBtn'),
};

const DAYS = 7;
const STATUS_POLL_MS = 30_000;   // ritmo de atualização do rótulo de frescor

const state = {
  endKey: null,          // último dia da janela exibida (YYYY-MM-DD)
  todayKey: null,
  favOnly: localStorage.getItem('favOnly') === '1',
  week: null,
  status: null,
  showsToday: false,     // a semana visível contém o dia de hoje?
  lastCollectedAt: null, // usado para detectar que uma coleta nova chegou
};

// ---------- utilidades ----------

async function api(path, options) {
  const res = await fetch(path, {
    ...options,
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
  return data;
}

function addDays(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

function prettyRange(start, end) {
  const f = (k) => {
    const [, m, d] = k.split('-');
    return `${d}/${m}`;
  };
  return `${f(start)} – ${f(end)} · ${end.slice(0, 4)}`;
}

let bannerTimer;
function banner(message, kind = '', ms = 4000) {
  clearTimeout(bannerTimer);
  el.banner.textContent = message;
  el.banner.className = `banner ${kind}`;
  el.banner.hidden = !message;
  if (message && ms) bannerTimer = setTimeout(() => { el.banner.hidden = true; }, ms);
}

// ---------- calendário ----------

function releaseCard(r) {
  const a = document.createElement('a');
  a.className = 'rel' + (r.isFavorite ? ' fav' : '');
  a.href = r.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.title = `${r.seriesTitle} — ${r.episodeLabel}` + (r.title ? `: ${r.title}` : '') +
            (r.durationMin ? ` (${r.durationMin} min)` : '');

  const img = document.createElement('img');
  img.className = 'thumb';
  img.loading = 'lazy';
  img.alt = '';
  if (r.thumbnail) img.src = r.thumbnail;
  a.append(img);

  const info = document.createElement('div');
  info.className = 'info';

  const line = document.createElement('div');
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = r.time ?? '--:--';
  line.append(time);
  const ep = document.createElement('span');
  ep.className = 'ep';
  ep.textContent = r.episodeLabel;
  line.append(ep);
  if (r.kind === 'special') {
    const b = document.createElement('span');
    b.className = 'badge-special';
    b.textContent = 'especial';
    line.append(b);
  }
  info.append(line);

  const st = document.createElement('span');
  st.className = 'st';
  st.textContent = r.seriesTitle;
  info.append(st);

  if (r.title && r.title !== String(r.episodeNumber)) {
    const et = document.createElement('span');
    et.className = 'et';
    et.textContent = r.title;
    info.append(et);
  }
  a.append(info);

  const star = document.createElement('button');
  star.className = 'star' + (r.isFavorite ? ' on' : '');
  star.type = 'button';
  star.textContent = r.isFavorite ? '★' : '☆';
  star.title = r.isFavorite ? 'Remover dos favoritos' : 'Favoritar esta série';
  star.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    toggleFavorite(r.seriesId, !r.isFavorite);
  });
  a.append(star);

  return a;
}

function renderWeek(week) {
  state.week = week;
  state.todayKey = week.range.today;
  el.range.textContent = prettyRange(week.range.start, week.range.end);
  el.calendar.replaceChildren();

  for (const day of week.days) {
    const col = document.createElement('section');
    col.className = 'day' + (day.isToday ? ' is-today' : '') + (day.isFuture ? ' is-future' : '');

    const head = document.createElement('header');
    head.className = 'day-head';
    head.innerHTML =
      `<span class="wd">${day.weekday}</span>` +
      `<span class="dm">${day.dayOfMonth}</span>` +
      `<span class="n">${day.releases.length || ''}</span>`;
    col.append(head);

    const body = document.createElement('div');
    body.className = 'day-body';
    if (day.releases.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = day.isFuture ? 'ainda não anunciado' : 'nada aqui';
      body.append(p);
    } else {
      for (const r of day.releases) body.append(releaseCard(r));
    }
    col.append(body);
    el.calendar.append(col);
  }

  const { releases, favorites } = week.totals;
  el.meta.textContent =
    `${releases} lançamento${releases === 1 ? '' : 's'} nesta janela` +
    (state.favOnly ? ' (só favoritos)' : ` · ${favorites} de séries favoritadas`) +
    ` · horários em ${week.timezone}`;

  // No futuro não há o que mostrar além de hoje.
  el.next.disabled = week.range.end >= state.todayKey;

  // O indicador de frescor só faz sentido quando hoje está visível.
  state.showsToday = week.days.some((d) => d.isToday);
  renderFreshness();
}

// ---------- frescor dos dados ----------

function relativeTime(iso, nowMs = Date.now()) {
  const min = Math.round((nowMs - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'agora mesmo';
  if (min === 1) return 'há 1 minuto';
  if (min < 60) return `há ${min} minutos`;
  const h = Math.round(min / 60);
  if (h === 1) return 'há 1 hora';
  if (h < 24) return `há ${h} horas`;
  const d = Math.round(h / 24);
  return d === 1 ? 'há 1 dia' : `há ${d} dias`;
}

function clock(iso, tz) {
  return new Date(iso).toLocaleTimeString('pt-BR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
}

function fullStamp(iso, tz) {
  return new Date(iso).toLocaleString('pt-BR', { timeZone: tz });
}

/**
 * Mostra quando foi a última verificação — apenas quando a semana na tela
 * inclui o dia de hoje, já que em semanas passadas o dado não muda mais.
 */
function renderFreshness() {
  const s = state.status;
  if (!state.showsToday || !s) {
    el.freshness.hidden = true;
    return;
  }

  const tz = s.timezone;
  const sched = s.scheduler ?? {};
  const last = s.lastCollectedAt;
  const ageMin = last ? (Date.now() - new Date(last).getTime()) / 60000 : Infinity;
  // Tolera uma coleta perdida antes de sinalizar atraso.
  const stale = ageMin > (sched.intervalMin ?? 15) * 2 + 2;

  let cls = 'fresh';
  let text;

  if (sched.running) {
    cls += ' busy';
    text = 'verificando…';
  } else if (sched.lastError) {
    cls += ' err';
    text = 'falha ao verificar';
  } else if (!last) {
    cls += ' stale';
    text = 'nunca verificado';
  } else {
    if (stale) cls += ' stale';
    text = `verificado ${relativeTime(last)}`;
  }

  const lines = [
    last ? `Última verificação: ${fullStamp(last, tz)}` : 'Nenhuma verificação ainda',
    sched.enabled && sched.nextAt
      ? `Próxima: ${clock(sched.nextAt, tz)} — a cada ${sched.intervalMin} min, ` +
        `${sched.offsetSec}s após a grade`
      : 'Verificação automática desligada',
  ];
  if (sched.lastError) lines.push(`Erro: ${sched.lastError}`);

  el.freshness.className = cls;
  el.freshness.title = lines.join('\n');
  el.freshnessText.textContent = text;
  el.freshness.hidden = false;
}

/**
 * Consulta o estado do servidor. Quando detecta que uma coleta nova entrou,
 * recarrega a semana sozinho — é o que mantém a tela atualizada sem recarregar
 * a página.
 */
async function pollStatus({ reloadOnChange = true } = {}) {
  try {
    const s = await api('/api/status');
    const isFirst = state.status === null;
    const changed = s.lastCollectedAt !== state.lastCollectedAt;

    state.status = s;
    state.lastCollectedAt = s.lastCollectedAt;
    if (s.today) state.todayKey = s.today;

    if (changed && !isFirst && reloadOnChange) {
      await loadWeek();          // loadWeek já chama renderFreshness
    } else {
      renderFreshness();
    }
  } catch {
    // Servidor fora do ar: preserva o último rótulo conhecido.
  }
}

async function loadWeek() {
  const params = new URLSearchParams({ days: String(DAYS), favorites: state.favOnly ? '1' : '0' });
  if (state.endKey) params.set('end', state.endKey);
  try {
    const week = await api(`/api/week?${params}`);
    if (!state.endKey) state.endKey = week.range.end;
    renderWeek(week);
  } catch (err) {
    banner(`Não foi possível carregar a semana: ${err.message}`, 'err', 0);
  }
}

// ---------- favoritos ----------

async function toggleFavorite(seriesId, favorite) {
  try {
    await api('/api/favorites', {
      method: 'POST',
      body: JSON.stringify({ seriesId, favorite }),
    });
    await loadWeek();
    if (!el.drawer.hidden) await loadSeries();
  } catch (err) {
    banner(`Erro ao favoritar: ${err.message}`, 'err');
  }
}

async function loadSeries() {
  const q = el.seriesSearch.value.trim();
  try {
    const { series } = await api(`/api/series?${new URLSearchParams({ q })}`);
    el.seriesList.replaceChildren();
    if (series.length === 0) {
      const p = document.createElement('p');
      p.className = 'drawer-hint';
      p.textContent = q ? 'Nenhuma série encontrada.' : 'Nenhuma série no banco. Clique em Atualizar.';
      el.seriesList.append(p);
      return;
    }
    for (const s of series) {
      const row = document.createElement('div');
      row.className = 'srow';

      const star = document.createElement('button');
      star.className = 'sstar' + (s.isFavorite ? ' on' : '');
      star.type = 'button';
      star.textContent = s.isFavorite ? '★' : '☆';
      star.setAttribute('aria-label', s.isFavorite ? `Desfavoritar ${s.title}` : `Favoritar ${s.title}`);
      row.append(star);

      const img = document.createElement('img');
      img.loading = 'lazy';
      img.alt = '';
      if (s.poster) img.src = s.poster;
      row.append(img);

      const info = document.createElement('div');
      info.className = 'sinfo';
      const name = document.createElement('div');
      name.className = 'sname';
      name.textContent = s.title;
      const sub = document.createElement('div');
      sub.className = 'ssub';
      sub.textContent = `${s.releaseCount} episódio${s.releaseCount === 1 ? '' : 's'}` +
        (s.lastPremiere ? ` · último em ${s.lastPremiere.slice(0, 10).split('-').reverse().join('/')}` : '');
      info.append(name, sub);
      row.append(info);

      row.addEventListener('click', () => toggleFavorite(s.id, !s.isFavorite));
      el.seriesList.append(row);
    }
  } catch (err) {
    banner(`Erro ao listar séries: ${err.message}`, 'err');
  }
}

function openDrawer(open) {
  el.drawer.hidden = !open;
  el.scrim.hidden = !open;
  if (open) { loadSeries(); el.seriesSearch.focus(); }
}

// ---------- ações ----------

async function withBusy(button, label, fn) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = label;
  try { await fn(); }
  finally { button.disabled = false; button.textContent = original; }
}

el.refresh.addEventListener('click', () => withBusy(el.refresh, 'Buscando…', async () => {
  try {
    const t = await api('/api/collect', { method: 'POST', body: JSON.stringify({ pages: 2 }) });
    await pollStatus({ reloadOnChange: false });
    await loadWeek();
    banner(
      `Coleta concluída: ${t.inserted} novo${t.inserted === 1 ? '' : 's'}, ` +
      `${t.updated} já conhecido${t.updated === 1 ? '' : 's'}` +
      (t.dubs ? `, ${t.dubs} dublagem(ns) descartada(s)` : '') + '.',
      t.inserted ? 'ok' : '',
    );
  } catch (err) {
    banner(`Falha na coleta: ${err.message}`, 'err', 8000);
  }
}));

el.backfillBtn.addEventListener('click', () => withBusy(el.backfillBtn, 'Preenchendo…', async () => {
  try {
    const t = await api('/api/backfill', { method: 'POST', body: JSON.stringify({}) });
    await loadWeek();
    await loadSeries();
    banner(`Histórico: ${t.series} série(s), ${t.episodes} episódios (+${t.inserted} novos).`, 'ok', 6000);
  } catch (err) {
    banner(err.message, 'err', 7000);
  }
}));

el.prev.addEventListener('click', () => { state.endKey = addDays(state.endKey, -DAYS); loadWeek(); });
el.next.addEventListener('click', () => { state.endKey = addDays(state.endKey, DAYS); loadWeek(); });
el.today.addEventListener('click', () => { state.endKey = state.todayKey; loadWeek(); });

el.favOnly.checked = state.favOnly;
el.favOnly.addEventListener('change', () => {
  state.favOnly = el.favOnly.checked;
  localStorage.setItem('favOnly', state.favOnly ? '1' : '0');
  loadWeek();
});

el.openFavs.addEventListener('click', () => openDrawer(true));
el.closeFavs.addEventListener('click', () => openDrawer(false));
el.scrim.addEventListener('click', () => openDrawer(false));

let searchTimer;
el.seriesSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadSeries, 180);
});

document.addEventListener('keydown', (ev) => {
  if (ev.target.matches('input')) {
    if (ev.key === 'Escape') ev.target.blur();
    return;
  }
  if (ev.key === 'Escape' && !el.drawer.hidden) openDrawer(false);
  else if (ev.key === 'ArrowLeft') el.prev.click();
  else if (ev.key === 'ArrowRight' && !el.next.disabled) el.next.click();
});

// ---------- início ----------

// Mantém o rótulo de frescor vivo e detecta coletas feitas pelo servidor.
setInterval(pollStatus, STATUS_POLL_MS);

// Ao voltar para a aba, confere na hora em vez de esperar o próximo ciclo.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) pollStatus();
});

loadWeek().then(async () => {
  await pollStatus({ reloadOnChange: false });
  if (state.status?.releases === 0) {
    banner('Banco vazio. Clique em "Atualizar" para buscar os lançamentos.', '', 0);
  }
});
