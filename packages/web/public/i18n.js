// Tradução da interface. Sem dependências: catálogos literais + Intl do navegador.

/*
 * Bandeiras em SVG, não emoji: o Windows não traz glifo de bandeira e
 * renderizaria "US" e "BR" como letras soltas.
 */
const FLAG_US = `
<svg viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="22" height="15" fill="#fff"/>
  <g fill="#b22234">
    <rect width="22" height="1.15" y="0"/><rect width="22" height="1.15" y="2.31"/>
    <rect width="22" height="1.15" y="4.62"/><rect width="22" height="1.15" y="6.92"/>
    <rect width="22" height="1.15" y="9.23"/><rect width="22" height="1.15" y="11.54"/>
    <rect width="22" height="1.15" y="13.85"/>
  </g>
  <rect width="9.2" height="8.08" fill="#3c3b6e"/>
  <g fill="#fff">
    <circle cx="1.8" cy="1.5" r=".52"/><circle cx="4.6" cy="1.5" r=".52"/><circle cx="7.4" cy="1.5" r=".52"/>
    <circle cx="3.2" cy="3.1" r=".52"/><circle cx="6.0" cy="3.1" r=".52"/>
    <circle cx="1.8" cy="4.7" r=".52"/><circle cx="4.6" cy="4.7" r=".52"/><circle cx="7.4" cy="4.7" r=".52"/>
    <circle cx="3.2" cy="6.3" r=".52"/><circle cx="6.0" cy="6.3" r=".52"/>
  </g>
</svg>`;

const FLAG_BR = `
<svg viewBox="0 0 22 15" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect width="22" height="15" fill="#009b3a"/>
  <path d="M11 1.7 20.1 7.5 11 13.3 1.9 7.5Z" fill="#fedf00"/>
  <circle cx="11" cy="7.5" r="3.3" fill="#002776"/>
  <path d="M7.9 6.4a6.2 6.2 0 0 1 6.3 2.3" stroke="#fff" stroke-width=".85" fill="none"/>
</svg>`;

// A ordem aqui é a ordem das opções no seletor de idioma.
export const LANGS = {
  'pt-BR': { label: 'Português', short: 'PT-BR', flag: FLAG_BR },
  'en-US': { label: 'English', short: 'EN-US', flag: FLAG_US },
};

export const DEFAULT_LANG = 'en-US';

/**
 * Catálogos. Um valor pode ser uma string ou, quando depende de quantidade,
 * um objeto `{ one, other }` escolhido por `Intl.PluralRules`.
 * Os marcadores `{nome}` são trocados pelas variáveis passadas a `t()`.
 */
const CATALOG = {
  'en-US': {
    'app.title': 'Anime Week — weekly releases',
    'app.name': 'Anime Week',

    'nav.prev': 'Previous week',
    'nav.next': 'Next week',
    'nav.today': 'Today',
    'nav.todayTitle': 'Back to the current week',

    'toggle.favorites': '★ Favorites only',
    'toggle.favoritesTitle': 'Show only the series you follow',
    'toggle.projections': 'Forecast',
    'toggle.projectionsTitle':
      'On days that have not arrived yet, repeat what aired last week',

    'action.manage': 'Manage series',
    'action.refresh': 'Refresh',
    'action.refreshTitle': 'Look for new releases on Crunchyroll now',
    'action.refreshBusy': 'Looking…',
    'action.close': 'Close',

    'drawer.title': 'Series',
    'drawer.hint':
      'Tick the series you follow. The ★ Favorites only filter then shows just those.',
    'drawer.search': 'Search series…',
    'drawer.backfill': 'Fetch full history of favorites',
    'drawer.backfillTitle': 'Download every episode of the series you favorited',
    'drawer.backfillBusy': 'Fetching…',
    'drawer.empty': 'No series found.',
    'drawer.emptyDb': 'No series yet. Click Refresh.',
    'drawer.episodes': { one: '{count} episode', other: '{count} episodes' },
    'drawer.lastOn': 'last on {date}',
    'drawer.upToDate': 'up to date',
    'drawer.unwatched': { one: '{count} unwatched', other: '{count} unwatched' },
    'drawer.favorite': 'Add {title} to favorites',
    'drawer.unfavorite': 'Remove {title} from favorites',

    'day.empty': 'nothing here',
    'day.emptyFuture': 'nothing forecast',

    'card.episode': 'S{season} E{episode}',
    'card.episodeNoSeason': 'E{episode}',
    'card.specialLabel': 'Special',
    'card.forecast': 'forecast',
    'card.special': 'special',
    'card.favorite': 'Add series to favorites',
    'card.unfavorite': 'Remove series from favorites',
    'card.markWatched': 'Mark as watched (and every earlier episode)',
    'card.unmarkWatched': 'Mark as unwatched (and every later episode)',
    'card.openSeries': 'Open {title} on Crunchyroll',
    'card.openSeriesAria': 'Open the series page for {title}',
    'card.seasonNote':
      'The site always opens on season 1; this episode belongs to "{season}"',
    'card.aria': '{series} — {episode}',
    'card.ariaWithTitle': '{series} — {episode}: {title}',
    'card.ariaDuration': ' ({minutes} min)',
    'card.forecastAria':
      'Forecast: {series} around {time}, based on {episode} from {date}',

    'forecast.steady': 'aired {seen} of the last {checked} weeks',
    'forecast.weak': 'only last week ({episode})',
    'forecast.preview':
      'Forecast — last one was {episode} on {date}. Aired on this weekday {seen} of the last {checked} weeks.',

    'fresh.checking': 'checking…',
    'fresh.failed': 'check failed',
    'fresh.never': 'never checked',
    'fresh.checked': 'checked {when}',
    'fresh.lastCheck': 'Last check: {stamp}',
    'fresh.noCheck': 'No check yet',
    'fresh.next': 'Next: {time} — every {interval} min, {offset}s past the mark',
    'fresh.autoOff': 'Automatic checking is off',
    'fresh.error': 'Error: {message}',

    'rel.now': 'just now',
    'rel.minutes': { one: '{count} minute ago', other: '{count} minutes ago' },
    'rel.hours': { one: '{count} hour ago', other: '{count} hours ago' },
    'rel.days': { one: '{count} day ago', other: '{count} days ago' },

    'meta.releases': {
      one: '{count} release this week',
      other: '{count} releases this week',
    },
    'meta.favoritesOnly': 'favorites only',
    'meta.fromFavorites': '{count} from series you follow',
    'meta.projected': {
      one: '{count} forecast from last week',
      other: '{count} forecast from last week',
    },
    'meta.timezone': 'times in {timezone}',

    'msg.loadFailed': 'Could not load the week: {message}',
    'msg.favoriteFailed': 'Could not change the favorite: {message}',
    'msg.watchedFailed': 'Could not mark as watched: {message}',
    'msg.seriesFailed': 'Could not list the series: {message}',
    'msg.collectDone': 'Done: {inserted} new, {updated} already known',
    'msg.collectDubs': ', {count} dubs discarded',
    'msg.collectFailed': 'Collection failed: {message}',
    'msg.backfillDone':
      'History: {series} series, {episodes} episodes ({inserted} new).',
    'msg.emptyDb': 'The database is empty. Click "Refresh" to fetch the releases.',

    'lang.label': 'Language',
  },

  'pt-BR': {
    'app.title': 'Anime Week — lançamentos da semana',
    'app.name': 'Anime Week',

    'nav.prev': 'Semana anterior',
    'nav.next': 'Semana seguinte',
    'nav.today': 'Hoje',
    'nav.todayTitle': 'Voltar para a semana atual',

    'toggle.favorites': '★ Só favoritos',
    'toggle.favoritesTitle': 'Mostrar apenas as séries que você acompanha',
    'toggle.projections': 'Previsões',
    'toggle.projectionsTitle':
      'Nos dias que ainda não chegaram, repetir o que saiu na semana passada',

    'action.manage': 'Gerenciar séries',
    'action.refresh': 'Atualizar',
    'action.refreshTitle': 'Buscar novos lançamentos no Crunchyroll agora',
    'action.refreshBusy': 'Buscando…',
    'action.close': 'Fechar',

    'drawer.title': 'Séries',
    'drawer.hint':
      'Marque as séries que você acompanha. O filtro ★ Só favoritos passa a mostrar apenas elas.',
    'drawer.search': 'Buscar série…',
    'drawer.backfill': 'Preencher histórico dos favoritos',
    'drawer.backfillTitle':
      'Baixar todos os episódios das séries que você favoritou',
    'drawer.backfillBusy': 'Preenchendo…',
    'drawer.empty': 'Nenhuma série encontrada.',
    'drawer.emptyDb': 'Nenhuma série no banco. Clique em Atualizar.',
    'drawer.episodes': { one: '{count} episódio', other: '{count} episódios' },
    'drawer.lastOn': 'último em {date}',
    'drawer.upToDate': 'em dia',
    'drawer.unwatched': { one: '{count} não visto', other: '{count} não vistos' },
    'drawer.favorite': 'Favoritar {title}',
    'drawer.unfavorite': 'Desfavoritar {title}',

    'day.empty': 'nada aqui',
    'day.emptyFuture': 'sem previsão',

    'card.episode': 'T{season} E{episode}',
    'card.episodeNoSeason': 'E{episode}',
    'card.specialLabel': 'Especial',
    'card.forecast': 'previsto',
    'card.special': 'especial',
    'card.favorite': 'Favoritar esta série',
    'card.unfavorite': 'Remover dos favoritos',
    'card.markWatched': 'Marcar como visto (e todos os anteriores)',
    'card.unmarkWatched': 'Desmarcar como visto (e todos os seguintes)',
    'card.openSeries': 'Abrir {title} no Crunchyroll',
    'card.openSeriesAria': 'Abrir a página da série {title}',
    'card.seasonNote':
      'O site sempre abre na 1ª temporada; este episódio é de "{season}"',
    'card.aria': '{series} — {episode}',
    'card.ariaWithTitle': '{series} — {episode}: {title}',
    'card.ariaDuration': ' ({minutes} min)',
    'card.forecastAria':
      'Previsão: {series} por volta das {time}, com base em {episode} de {date}',

    'forecast.steady': 'saiu em {seen} das últimas {checked} semanas',
    'forecast.weak': 'só na semana passada ({episode})',
    'forecast.preview':
      'Previsão — último foi {episode} em {date}. Saiu neste dia em {seen} das últimas {checked} semanas.',

    'fresh.checking': 'verificando…',
    'fresh.failed': 'falha ao verificar',
    'fresh.never': 'nunca verificado',
    'fresh.checked': 'verificado {when}',
    'fresh.lastCheck': 'Última verificação: {stamp}',
    'fresh.noCheck': 'Nenhuma verificação ainda',
    'fresh.next': 'Próxima: {time} — a cada {interval} min, {offset}s após a grade',
    'fresh.autoOff': 'Verificação automática desligada',
    'fresh.error': 'Erro: {message}',

    'rel.now': 'agora mesmo',
    'rel.minutes': { one: 'há {count} minuto', other: 'há {count} minutos' },
    'rel.hours': { one: 'há {count} hora', other: 'há {count} horas' },
    'rel.days': { one: 'há {count} dia', other: 'há {count} dias' },

    'meta.releases': {
      one: '{count} lançamento nesta semana',
      other: '{count} lançamentos nesta semana',
    },
    'meta.favoritesOnly': 'só favoritos',
    'meta.fromFavorites': '{count} de séries que você acompanha',
    'meta.projected': {
      one: '{count} previsto a partir da semana passada',
      other: '{count} previstos a partir da semana passada',
    },
    'meta.timezone': 'horários em {timezone}',

    'msg.loadFailed': 'Não foi possível carregar a semana: {message}',
    'msg.favoriteFailed': 'Não foi possível favoritar: {message}',
    'msg.watchedFailed': 'Não foi possível marcar como visto: {message}',
    'msg.seriesFailed': 'Não foi possível listar as séries: {message}',
    'msg.collectDone': 'Pronto: {inserted} novos, {updated} já conhecidos',
    'msg.collectDubs': ', {count} dublagens descartadas',
    'msg.collectFailed': 'Falha na coleta: {message}',
    'msg.backfillDone':
      'Histórico: {series} séries, {episodes} episódios ({inserted} novos).',
    'msg.emptyDb': 'O banco está vazio. Clique em "Atualizar" para buscar os lançamentos.',

    'lang.label': 'Idioma',
  },
};

const STORAGE_KEY = 'lang';

/**
 * Idioma escolhido antes > idioma do navegador, se houver catálogo > en-US.
 * `pt` casa com `pt-BR`, `pt-PT` etc.
 */
function detect() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && CATALOG[saved]) return saved;
  } catch { /* navegação privada: segue para a detecção */ }

  for (const tag of navigator.languages ?? [navigator.language]) {
    if (!tag) continue;
    if (CATALOG[tag]) return tag;
    const base = tag.split('-')[0].toLowerCase();
    const match = Object.keys(CATALOG).find((l) => l.split('-')[0] === base);
    if (match) return match;
  }
  return DEFAULT_LANG;
}

let current = detect();
const listeners = new Set();

export function getLang() { return current; }

export function setLang(lang) {
  if (!CATALOG[lang] || lang === current) return;
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* sem persistência */ }
  document.documentElement.lang = lang;
  for (const fn of listeners) fn(lang);
}

export function onLangChange(fn) { listeners.add(fn); }

function interpolate(text, vars) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (hit, name) =>
    (name in vars ? String(vars[name]) : hit));
}

/** Texto traduzido. Com `count`, escolhe singular/plural pela regra do idioma. */
export function t(key, vars) {
  const entry = CATALOG[current][key] ?? CATALOG[DEFAULT_LANG][key];
  if (entry === undefined) return key;          // chave faltando: mostra a chave
  if (typeof entry === 'string') return interpolate(entry, vars);

  const rule = new Intl.PluralRules(current).select(vars?.count ?? 0);
  return interpolate(entry[rule] ?? entry.other, vars);
}

// ---------- datas e horas ----------

const cache = new Map();
function formatter(kind, options) {
  const id = `${current}|${kind}|${JSON.stringify(options)}`;
  if (!cache.has(id)) cache.set(id, new Intl.DateTimeFormat(current, options));
  return cache.get(id);
}

/** HH:MM no fuso de exibição, no padrão do idioma (en-US usa 12 h). */
export function fmtTime(iso, timeZone) {
  return formatter('time', { timeZone, hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso));
}

/** Dia da semana abreviado, a partir de uma chave YYYY-MM-DD. */
export function fmtWeekday(dayKey) {
  return formatter('wd', { timeZone: 'UTC', weekday: 'short' })
    .format(dateFromKey(dayKey))
    .replace('.', '');
}

/** Dia e mês na ordem do idioma: 26/10 em pt-BR, 10/26 em en-US. */
export function fmtDayMonth(dayKey) {
  return formatter('dm', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })
    .format(dateFromKey(dayKey));
}

/** Data curta completa, para listas. */
export function fmtDate(dayKey) {
  return formatter('d', { timeZone: 'UTC', dateStyle: 'short' })
    .format(dateFromKey(dayKey));
}

/** Data e hora completas, para tooltips. */
export function fmtDateTime(iso, timeZone) {
  return formatter('dt', { timeZone, dateStyle: 'short', timeStyle: 'medium' })
    .format(new Date(iso));
}

/** "há 3 minutos" / "3 minutes ago", a partir de um instante no passado. */
export function fmtRelative(iso, nowMs = Date.now()) {
  const min = Math.round((nowMs - new Date(iso).getTime()) / 60000);
  if (min < 1) return t('rel.now');
  if (min < 60) return t('rel.minutes', { count: min });
  const hours = Math.round(min / 60);
  if (hours < 24) return t('rel.hours', { count: hours });
  return t('rel.days', { count: Math.round(hours / 24) });
}

function dateFromKey(dayKey) {
  const [y, m, d] = dayKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// ---------- textos fixos do HTML ----------

/**
 * Traduz o HTML estático. Cada elemento aponta a chave em `data-i18n`
 * (conteúdo), `data-i18n-title`, `data-i18n-label` (aria-label) ou
 * `data-i18n-placeholder`.
 */
export function applyStatic(root = document) {
  for (const node of root.querySelectorAll('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of root.querySelectorAll('[data-i18n-title]')) {
    node.title = t(node.dataset.i18nTitle);
  }
  for (const node of root.querySelectorAll('[data-i18n-label]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nLabel));
  }
  for (const node of root.querySelectorAll('[data-i18n-placeholder]')) {
    node.placeholder = t(node.dataset.i18nPlaceholder);
  }
  document.title = t('app.title');
  document.documentElement.lang = current;
}
