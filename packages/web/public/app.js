// Interface do calendário semanal. Sem framework, sem build.

import {
  LANGS, t, getLang, setLang, onLangChange, applyStatic,
  fmtTime, fmtWeekday, fmtDayMonth, fmtDate, fmtDateTime, fmtRelative,
} from './i18n.js';

const $ = (sel) => document.querySelector(sel);

const el = {
  calendar: $('#calendar'), meta: $('#meta'), range: $('#range'), banner: $('#banner'),
  prev: $('#prev'), next: $('#next'), today: $('#today'),
  favOnly: $('#favOnly'), refresh: $('#refresh'),
  showProj: $('#showProj'), projToggle: $('#projToggle'),
  freshness: $('#freshness'), freshnessText: $('#freshnessText'),
  openFavs: $('#openFavs'), closeFavs: $('#closeFavs'),
  drawer: $('#drawer'), scrim: $('#scrim'),
  seriesList: $('#seriesList'), seriesSearch: $('#seriesSearch'), backfillBtn: $('#backfillBtn'),
  langs: $('#langs'),
};

const DAYS = 7;
const STATUS_POLL_MS = 30_000;   // ritmo de atualização do rótulo de frescor

const state = {
  startKey: null,        // segunda-feira da semana exibida (YYYY-MM-DD)
  currentWeekStart: null,
  todayKey: null,
  timezone: null,
  favOnly: localStorage.getItem('favOnly') === '1',
  showProj: localStorage.getItem('showProj') !== '0',
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

/**
 * Rótulo do episódio no idioma corrente ("T1 E4" / "S1 E4").
 * O servidor grava um rótulo em português no banco; aqui ele é remontado a
 * partir dos números, que são os mesmos em qualquer idioma.
 */
function epLabel(r) {
  if (r.episodeNumber == null) return t('card.specialLabel');
  return r.seasonNumber
    ? t('card.episode', { season: r.seasonNumber, episode: r.episodeNumber })
    : t('card.episodeNoSeason', { episode: r.episodeNumber });
}

/** Hora do lançamento, no fuso de exibição e no formato do idioma. */
function localTime(r) {
  return state.timezone ? fmtTime(r.premiereAt, state.timezone) : null;
}

function prettyRange(start, end) {
  return `${fmtDayMonth(start)} – ${fmtDayMonth(end)} · ${end.slice(0, 4)}`;
}

let bannerTimer;
function banner(message, kind = '', ms = 4000) {
  clearTimeout(bannerTimer);
  el.banner.textContent = message;
  el.banner.className = `banner ${kind}`;
  el.banner.hidden = !message;
  if (message && ms) bannerTimer = setTimeout(() => { el.banner.hidden = true; }, ms);
}

// ---------- prévia do episódio ----------

/**
 * O card mostra a capa da série, que é fixa e se repete toda semana — é o que
 * deixa a série reconhecível de relance no calendário. O quadro daquele
 * episódio, que muda sempre, fica nesta prévia que aparece no hover.
 */
const preview = (() => {
  const box = document.createElement('div');
  box.className = 'preview';
  box.hidden = true;
  const img = document.createElement('img');
  img.alt = '';
  const cap = document.createElement('div');
  cap.className = 'cap';
  box.append(img, cap);
  document.body.append(box);

  let timer = null;
  const pointer = { x: 0, y: 0 };
  const OFFSET = 18;   // afastamento do cursor, para não tapar o que ele aponta

  /** Ancora a prévia no cursor, virando de lado ou para cima quando falta espaço. */
  function place() {
    if (box.hidden) return;
    const w = box.offsetWidth || 300;
    const h = box.offsetHeight || 200;

    let left = pointer.x + OFFSET;
    if (left + w > innerWidth - 8) left = pointer.x - w - OFFSET;  // não cabe à direita
    left = Math.max(8, Math.min(left, innerWidth - w - 8));

    let top = pointer.y + OFFSET;
    if (top + h > innerHeight - 8) top = pointer.y - h - OFFSET;   // não cabe abaixo
    top = Math.max(8, Math.min(top, innerHeight - h - 8));

    box.style.left = `${Math.round(left)}px`;
    box.style.top = `${Math.round(top)}px`;
  }

  // A imagem chega depois; reposiciona quando a altura real é conhecida.
  img.addEventListener('load', place);

  /** Atualiza a posição do cursor; chamado no mousemove de cada card. */
  function track(ev) {
    pointer.x = ev.clientX;
    pointer.y = ev.clientY;
    place();
  }

  function show(r, ev) {
    clearTimeout(timer);
    if (!r.thumbnail) return;
    if (ev) { pointer.x = ev.clientX; pointer.y = ev.clientY; }
    timer = setTimeout(() => {
      img.src = r.thumbnail;
      cap.textContent = r.isProjection
        ? t('forecast.preview', {
            episode: epLabel(r),
            date: fmtDate(r.projectedFrom.day),
            seen: r.weeksSeen, checked: r.weeksChecked,
          })
        : [epLabel(r), r.title].filter(Boolean).join(' · ');
      box.hidden = false;
      place();
    }, 260);   // evita piscar ao varrer o mouse pela coluna
  }

  function hide() {
    clearTimeout(timer);
    box.hidden = true;
  }

  addEventListener('scroll', hide, true);
  addEventListener('resize', hide);
  return { show, hide, track };
})();

// ---------- calendário ----------

function releaseCard(r) {
  const a = document.createElement('a');
  a.className = 'rel' + (r.isFavorite ? ' fav' : '') + (r.isProjection ? ' proj' : '') +
    (r.isWatched ? ' seen' : '');
  a.href = r.url;
  a.target = '_blank';
  a.rel = 'noopener';
  // Sem `title`: o balão nativo brigaria com a prévia do episódio.
  a.setAttribute('aria-label', r.isProjection
    ? t('card.forecastAria', {
        series: r.seriesTitle, time: localTime(r),
        episode: epLabel(r), date: fmtDate(r.projectedFrom.day),
      })
    : (r.title
        ? t('card.ariaWithTitle', { series: r.seriesTitle, episode: epLabel(r), title: r.title })
        : t('card.aria', { series: r.seriesTitle, episode: epLabel(r) }))
      + (r.durationMin ? t('card.ariaDuration', { minutes: r.durationMin }) : ''));
  a.addEventListener('mouseenter', (ev) => preview.show(r, ev));
  a.addEventListener('mousemove', preview.track);
  a.addEventListener('mouseleave', () => preview.hide());
  a.addEventListener('click', () => preview.hide());

  // --- arte, com horário e episódio sobrepostos ---
  const shot = document.createElement('span');
  shot.className = 'shot';

  const img = document.createElement('img');
  img.className = 'thumb';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = '';
  // Capa da série primeiro; o quadro do episódio só se a capa faltar.
  const art = r.seriesPoster || r.thumbnail;
  if (art) img.src = art;
  shot.append(img);

  // Sem selo de "premium": praticamente todo simulcast é premium, então o selo
  // não distinguiria nada e só cobriria a arte. O dado segue no banco e na API.

  const stamp = document.createElement('span');
  stamp.className = 'stamp';
  const time = document.createElement('span');
  time.className = 'time';
  time.textContent = localTime(r) ?? '--:--';
  const ep = document.createElement('span');
  ep.className = 'ep';
  // Numerar o episódio previsto seria chute: férias e especiais quebram a
  // sequência. O card diz só que a série é esperada naquele horário.
  ep.textContent = r.isProjection ? t('card.forecast') : epLabel(r);
  stamp.append(time, ep);
  if (r.kind === 'special' && !r.isProjection) {
    const b = document.createElement('span');
    b.className = 'badge-special';
    b.textContent = t('card.special');
    stamp.append(b);
  }
  shot.append(stamp);
  a.append(shot);

  // --- textos ---
  const info = document.createElement('div');
  info.className = 'info';

  const st = document.createElement('div');
  st.className = 'st';
  st.textContent = r.seriesTitle;
  info.append(st);

  // Sempre presente, mesmo vazio: reserva a linha e mantém todos os cards
  // com a mesma altura, para os dias alinharem na horizontal.
  const et = document.createElement('span');
  et.className = 'et';
  if (r.isProjection) {
    et.classList.add('hint');
    et.textContent = r.weeksSeen > 1
      ? t('forecast.steady', { seen: r.weeksSeen, checked: r.weeksChecked })
      : t('forecast.weak', { episode: epLabel(r) });
  } else {
    et.textContent = (r.title && r.title !== String(r.episodeNumber)) ? r.title : '';
  }
  info.append(et);

  a.append(info);

  // --- ações ---
  const tools = document.createElement('span');
  tools.className = 'tools';

  // Previsão não é episódio publicado: não há o que marcar como visto.
  if (!r.isProjection) {
    const seen = document.createElement('button');
    seen.className = 'tool seen' + (r.isWatched ? ' on' : '');
    seen.type = 'button';
    seen.textContent = '✓';
    seen.title = t(r.isWatched ? 'card.unmarkWatched' : 'card.markWatched');
    seen.setAttribute('aria-label', seen.title);
    seen.setAttribute('aria-pressed', String(r.isWatched));
    seen.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      toggleWatched(r.id, !r.isWatched);
    });
    tools.append(seen);
  }

  const star = document.createElement('button');
  star.className = 'tool star' + (r.isFavorite ? ' on' : '');
  star.type = 'button';
  star.textContent = r.isFavorite ? '★' : '☆';
  star.title = t(r.isFavorite ? 'card.unfavorite' : 'card.favorite');
  star.setAttribute('aria-label', star.title);
  star.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    toggleFavorite(r.seriesId, !r.isFavorite);
  });
  tools.append(star);

  if (r.seriesUrl) {
    const series = document.createElement('a');
    series.className = 'tool series';
    series.href = r.seriesUrl;
    series.target = '_blank';
    series.rel = 'noopener';
    series.title = t('card.openSeries', { title: r.seriesTitle }) +
      (r.seasonTitle ? `
${t('card.seasonNote', { season: r.seasonTitle })}` : '');
    series.setAttribute('aria-label', t('card.openSeriesAria', { title: r.seriesTitle }));
    // Ícone de grade/catálogo.
    series.innerHTML =
      '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1.5 2h5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5Zm8 0h5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5Zm-8 7h5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5Zm8 0h5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5Z"/></svg>';
    series.addEventListener('click', (ev) => ev.stopPropagation());
    tools.append(series);
  }

  a.append(tools);
  return a;
}

function renderWeek(week) {
  state.week = week;
  state.todayKey = week.range.today;
  state.timezone = week.timezone;   // precisa estar pronto antes dos cards
  el.range.textContent = prettyRange(week.range.start, week.range.end);
  el.calendar.replaceChildren();

  for (const day of week.days) {
    const col = document.createElement('section');
    col.className = 'day' + (day.isToday ? ' is-today' : '') + (day.isFuture ? ' is-future' : '');

    const head = document.createElement('header');
    head.className = 'day-head';
    const count = day.releaseCount || (day.projectedCount ? `~${day.projectedCount}` : '');
    head.innerHTML =
      `<span class="wd">${fmtWeekday(day.key)}</span>` +
      `<span class="dm">${day.dayOfMonth}</span>` +
      `<span class="n">${count}</span>`;
    col.append(head);

    const body = document.createElement('div');
    body.className = 'day-body';
    if (day.releases.length === 0) {
      const p = document.createElement('p');
      p.className = 'empty';
      p.textContent = t(day.isFuture ? 'day.emptyFuture' : 'day.empty');
      body.append(p);
    } else {
      for (const r of day.releases) body.append(releaseCard(r));
    }
    col.append(body);
    el.calendar.append(col);
  }

  const { releases, favorites, projected } = week.totals;
  const parts = [t('meta.releases', { count: releases })];
  parts.push(state.favOnly
    ? t('meta.favoritesOnly')
    : t('meta.fromFavorites', { count: favorites }));
  if (projected) parts.push(t('meta.projected', { count: projected }));
  parts.push(t('meta.timezone', { timezone: week.timezone }));
  el.meta.textContent = parts.join(' · ');

  // A semana atual é a última navegável: adiante só haveria previsão.
  el.next.disabled = week.range.start >= week.range.currentWeekStart;

  // O indicador de frescor só faz sentido quando hoje está visível.
  state.showsToday = week.days.some((d) => d.isToday);
  renderFreshness();
}

// ---------- frescor dos dados ----------

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
    text = t('fresh.checking');
  } else if (sched.lastError) {
    cls += ' err';
    text = t('fresh.failed');
  } else if (!last) {
    cls += ' stale';
    text = t('fresh.never');
  } else {
    if (stale) cls += ' stale';
    text = t('fresh.checked', { when: fmtRelative(last) });
  }

  const lines = [
    last ? t('fresh.lastCheck', { stamp: fmtDateTime(last, tz) }) : t('fresh.noCheck'),
    sched.enabled && sched.nextAt
      ? t('fresh.next', {
          time: fmtTime(sched.nextAt, tz),
          interval: sched.intervalMin,
          offset: sched.offsetSec,
        })
      : t('fresh.autoOff'),
  ];
  if (sched.lastError) lines.push(t('fresh.error', { message: sched.lastError }));

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
  const params = new URLSearchParams({
    days: String(DAYS),
    favorites: state.favOnly ? '1' : '0',
    project: state.showProj ? '1' : '0',
  });
  if (state.startKey) params.set('start', state.startKey);
  try {
    const week = await api(`/api/week?${params}`);
    // Sem semana escolhida, o servidor devolve a atual — adotamos a dele.
    state.startKey = week.range.start;
    state.currentWeekStart = week.range.currentWeekStart;
    renderWeek(week);
  } catch (err) {
    banner(t('msg.loadFailed', { message: err.message }), 'err', 0);
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
    banner(t('msg.favoriteFailed', { message: err.message }), 'err');
  }
}

// ---------- vistos ----------

async function toggleWatched(releaseId, watched) {
  try {
    await api('/api/watched', {
      method: 'POST',
      body: JSON.stringify({ releaseId, watched }),
    });
    await loadWeek();
    if (!el.drawer.hidden) await loadSeries();
  } catch (err) {
    banner(t('msg.watchedFailed', { message: err.message }), 'err');
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
      p.textContent = t(q ? 'drawer.empty' : 'drawer.emptyDb');
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
      star.setAttribute('aria-label',
        t(s.isFavorite ? 'drawer.unfavorite' : 'drawer.favorite', { title: s.title }));
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
      sub.textContent = t('drawer.episodes', { count: s.releaseCount }) +
        (s.lastPremiere
          ? ` · ${t('drawer.lastOn', { date: fmtDate(s.lastPremiere.slice(0, 10)) })}`
          : '');
      // Só para séries que o usuário já começou a marcar: é o "estou em dia?".
      if (s.unwatchedCount != null) {
        const w = document.createElement('div');
        w.className = 'swatch' + (s.unwatchedCount === 0 ? ' done' : '');
        w.textContent = s.unwatchedCount === 0
          ? t('drawer.upToDate')
          : t('drawer.unwatched', { count: s.unwatchedCount });
        sub.append(' · ', w);
      }
      info.append(name, sub);
      row.append(info);

      row.addEventListener('click', () => toggleFavorite(s.id, !s.isFavorite));
      el.seriesList.append(row);
    }
  } catch (err) {
    banner(t('msg.seriesFailed', { message: err.message }), 'err');
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

el.refresh.addEventListener('click', () => withBusy(el.refresh, t('action.refreshBusy'), async () => {
  try {
    const res = await api('/api/collect', { method: 'POST', body: JSON.stringify({ pages: 2 }) });
    await pollStatus({ reloadOnChange: false });
    await loadWeek();
    banner(
      t('msg.collectDone', { inserted: res.inserted, updated: res.updated }) +
      (res.dubs ? t('msg.collectDubs', { count: res.dubs }) : '') + '.',
      res.inserted ? 'ok' : '',
    );
  } catch (err) {
    banner(t('msg.collectFailed', { message: err.message }), 'err', 8000);
  }
}));

el.backfillBtn.addEventListener('click', () => withBusy(el.backfillBtn, t('drawer.backfillBusy'), async () => {
  try {
    const res = await api('/api/backfill', { method: 'POST', body: JSON.stringify({}) });
    await loadWeek();
    await loadSeries();
    banner(t('msg.backfillDone', {
      series: res.series, episodes: res.episodes, inserted: res.inserted,
    }), 'ok', 6000);
  } catch (err) {
    banner(err.message, 'err', 7000);
  }
}));

el.prev.addEventListener('click', () => { state.startKey = addDays(state.startKey, -DAYS); loadWeek(); });
el.next.addEventListener('click', () => { state.startKey = addDays(state.startKey, DAYS); loadWeek(); });
el.today.addEventListener('click', () => { state.startKey = state.currentWeekStart; loadWeek(); });

el.favOnly.checked = state.favOnly;
el.favOnly.addEventListener('change', () => {
  state.favOnly = el.favOnly.checked;
  localStorage.setItem('favOnly', state.favOnly ? '1' : '0');
  loadWeek();
});

el.showProj.checked = state.showProj;
el.showProj.addEventListener('change', () => {
  state.showProj = el.showProj.checked;
  localStorage.setItem('showProj', state.showProj ? '1' : '0');
  loadWeek();
});

// Idioma: detectado pelo navegador na primeira visita, trocável nas bandeiras.
const flagButtons = new Map();
for (const [code, { label, flag }] of Object.entries(LANGS)) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'flag';
  btn.innerHTML = flag;
  btn.title = label;
  btn.setAttribute('aria-label', label);
  btn.addEventListener('click', () => setLang(code));
  el.langs.append(btn);
  flagButtons.set(code, btn);
}

function markCurrentFlag() {
  for (const [code, btn] of flagButtons) {
    btn.setAttribute('aria-pressed', String(code === getLang()));
  }
}
markCurrentFlag();

onLangChange(() => {
  markCurrentFlag();
  applyStatic();
  if (state.week) renderWeek(state.week);   // datas e textos dos cards
  renderFreshness();
  if (!el.drawer.hidden) loadSeries();
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

applyStatic();

// Mantém o rótulo de frescor vivo e detecta coletas feitas pelo servidor.
setInterval(pollStatus, STATUS_POLL_MS);

// Ao voltar para a aba, confere na hora em vez de esperar o próximo ciclo.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) pollStatus();
});

loadWeek().then(async () => {
  await pollStatus({ reloadOnChange: false });
  if (state.status?.releases === 0) {
    banner(t('msg.emptyDb'), '', 0);
  }
});
