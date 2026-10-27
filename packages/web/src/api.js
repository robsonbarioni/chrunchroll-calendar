import { Store, CrunchyrollClient, dates, config, nextTick } from '@anime-week/core';
import { collect, backfill } from '@anime-week/collector/src/collect.js';

/** Estado da coleta automática, preenchido pelo agendador do servidor. */
export const schedulerState = {
  running: false,
  nextAt: null,
  lastError: null,
};

const DAY_MS = 86_400_000;

/** Converte uma linha do banco no objeto que a interface consome. */
function toItem(r) {
  return {
    id: r.id,
    seriesId: r.series_id,
    seriesTitle: r.series_title,
    seriesUrl: r.series_url,
    episodeLabel: r.episode_label,
    episodeNumber: r.episode_number,
    seasonNumber: r.season_number,
    seasonId: r.season_id,
    seasonTitle: r.season_title,
    title: r.title,
    description: r.description,
    premiereAt: r.premiere_at,
    time: dates.timeLabel(r.premiere_at),
    // Capa fixa da série para o card; quadro do episódio para a prévia.
    seriesPoster: r.poster_wide,
    seriesPosterTall: r.poster_tall,
    thumbnail: r.thumbnail,
    url: r.url,
    isPremiumOnly: !!r.is_premium_only,
    isFavorite: !!r.is_favorite,
    // Visto = estreou até a marca da série (ver Store.setWatched).
    isWatched: !!r.watched_through_at && r.premiere_at <= r.watched_through_at,
    kind: r.kind,
    durationMin: r.duration_ms ? Math.round(r.duration_ms / 60000) : null,
    audioLocale: r.audio_locale,
    isProjection: false,
  };
}

/**
 * Transforma um lançamento da semana passada numa previsão para esta semana.
 *
 * Não é um episódio que existe: é a expectativa de que a série mantenha o
 * mesmo horário. Por isso o link aponta para a página da série, e não para
 * uma URL de episódio que ainda não foi publicada.
 */
function toProjection(item, { weeksSeen, weeksChecked }) {
  const at = new Date(new Date(item.premiereAt).getTime() + 7 * DAY_MS).toISOString();
  return {
    ...item,
    id: `proj:${item.id}`,
    premiereAt: at,
    time: dates.timeLabel(at),
    url: item.seriesUrl ?? item.url,
    isWatched: false,
    isProjection: true,
    // Em quantas das últimas semanas a série realmente saiu neste dia. Uma
    // temporada que acabou continua "prevista" por uma semana; esse número é
    // o que diz se o padrão é firme ou se é um caso isolado.
    weeksSeen,
    weeksChecked,
    projectedFrom: {
      premiereAt: item.premiereAt,
      day: dates.dayKey(item.premiereAt),
      episodeLabel: item.episodeLabel,
      title: item.title,
    },
  };
}

const LOOKBACK_WEEKS = 4;   // histórico usado para medir a firmeza do padrão

/**
 * Monta a semana a partir de `startKey` (uma segunda-feira).
 *
 * A consulta cobre também as semanas anteriores, porque os dias ainda por vir
 * recebem uma projeção do que saiu sete dias antes. O recorte por dia é feito
 * aqui pela chave de dia LOCAL, evitando erros de borda de fuso.
 */
export function buildWeek(store, { startKey, days, favoritesOnly, kinds, project = true }) {
  const win = dates.window(startKey, days);
  const rows = store.releasesBetween(
    `${dates.addDays(win.startKey, -(days * LOOKBACK_WEEKS + 2))}T00:00:00.000Z`,
    win.utcTo,
    { favoritesOnly, kinds },
  );

  // Balde por dia local, incluindo a semana anterior (fonte das projeções).
  const buckets = new Map();
  for (const r of rows) {
    const key = dates.dayKey(r.premiere_at);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(toItem(r));
  }

  const todayK = dates.todayKey();
  const currentWeek = dates.currentWeekStart();
  // Previsão só na semana corrente e só do instante atual em diante — inclusive
  // nos horários que ainda faltam hoje. Um horário que já passou sem episódio
  // é um fato — pode ter sido feriado no Japão ou fim de temporada — e
  // preencher essa lacuna depois seria inventar um lançamento que não houve.
  const canProject = project && win.startKey === currentWeek;
  const nowIso = new Date().toISOString();
  let projected = 0;

  const dayList = win.keys.map((key) => {
    const real = (buckets.get(key) ?? []).slice();
    const isFuture = key > todayK;

    if (key >= todayK && canProject) {
      const seen = new Set(real.map((r) => r.seriesId));
      // Semanas anteriores deste mesmo dia da semana, da mais recente à mais antiga.
      const history = Array.from({ length: LOOKBACK_WEEKS }, (_, i) =>
        new Set((buckets.get(dates.addDays(key, -7 * (i + 1))) ?? []).map((x) => x.seriesId)));

      for (const prev of buckets.get(dates.addDays(key, -7)) ?? []) {
        // Se a série já tem episódio confirmado nesse dia, a previsão sobra.
        if (seen.has(prev.seriesId)) continue;
        const proj = toProjection(prev, {
          weeksSeen: history.filter((w) => w.has(prev.seriesId)).length,
          weeksChecked: LOOKBACK_WEEKS,
        });
        // Hoje, só o que ainda está por vir.
        if (proj.premiereAt <= nowIso) continue;
        seen.add(prev.seriesId);
        real.push(proj);
        projected++;
      }
    }

    real.sort((a, b) => a.premiereAt.localeCompare(b.premiereAt));
    return {
      key,
      weekday: dates.weekdayLabel(key),
      dayOfMonth: Number(key.slice(8, 10)),
      isToday: key === todayK,
      isFuture,
      releaseCount: real.filter((r) => !r.isProjection).length,
      projectedCount: real.filter((r) => r.isProjection).length,
      releases: real,
    };
  });

  const all = dayList.flatMap((d) => d.releases);
  return {
    days: dayList,
    range: {
      start: win.startKey,
      end: win.endKey,
      days,
      today: todayK,
      currentWeekStart: currentWeek,
    },
    totals: {
      releases: all.filter((r) => !r.isProjection).length,
      projected,
      favorites: all.filter((r) => r.isFavorite && !r.isProjection).length,
    },
    timezone: config.tz,
  };
}

/** Rotas da API. Cada handler recebe (ctx) e devolve um objeto JSON. */
export const routes = {
  'GET /api/week': ({ store, query }) => {
    const days = Math.min(Math.max(Number(query.get('days') ?? 7), 1), 31);
    const asked = query.get('start');
    // Qualquer dia informado é puxado para a segunda-feira daquela semana.
    const startKey = /^\d{4}-\d{2}-\d{2}$/.test(asked ?? '')
      ? dates.weekStart(asked)
      : dates.currentWeekStart();
    const kinds = (query.get('kinds') ?? 'episode,special').split(',').filter(Boolean);
    return buildWeek(store, {
      startKey, days,
      favoritesOnly: query.get('favorites') === '1',
      project: query.get('project') !== '0',
      kinds,
    });
  },

  'GET /api/series': ({ store, query }) => ({
    series: store.listSeries({
      q: query.get('q') ?? '',
      favoritesOnly: query.get('favorites') === '1',
    }).map((s) => ({
      id: s.id,
      title: s.title,
      poster: s.poster_wide,
      posterTall: s.poster_tall,
      isFavorite: !!s.is_favorite,
      releaseCount: s.release_count,
      lastPremiere: s.last_premiere,
      watchedThrough: s.watched_through_at,
      unwatchedCount: s.watched_through_at ? s.unwatched_count : null,
    })),
  }),

  'POST /api/favorites': ({ store, body }) => {
    if (!body?.seriesId) throw new HttpProblem(400, 'seriesId é obrigatório');
    const ok = store.setFavorite(body.seriesId, !!body.favorite);
    if (!ok) throw new HttpProblem(404, `Série ${body.seriesId} não encontrada`);
    return { seriesId: body.seriesId, favorite: !!body.favorite };
  },

  'POST /api/watched': ({ store, body }) => {
    if (!body?.releaseId) throw new HttpProblem(400, 'releaseId é obrigatório');
    const res = store.setWatched(body.releaseId, !!body.watched);
    if (!res) throw new HttpProblem(404, `Episódio ${body.releaseId} não encontrado`);
    return res;
  },

  'GET /api/status': ({ store }) => ({
    ...store.stats(),
    timezone: config.tz,
    today: dates.todayKey(),
    now: new Date().toISOString(),
    scheduler: {
      enabled: config.autoCollect,
      running: schedulerState.running,
      intervalMin: config.intervalMin,
      offsetSec: config.offsetSec,
      nextAt: schedulerState.nextAt ?? (config.autoCollect ? nextTick().toISOString() : null),
      lastError: schedulerState.lastError,
    },
  }),

  'POST /api/collect': async ({ store, body }) => {
    if (schedulerState.running) throw new HttpProblem(409, 'Já existe uma coleta em andamento');
    const pages = Math.min(Math.max(Number(body?.pages ?? 2), 1), 20);
    schedulerState.running = true;
    try {
      const totals = await collect({ store, pages, log: () => {} });
      schedulerState.lastError = null;
      return { ...totals, collectedAt: store.getMeta('last_collected_at') };
    } finally {
      schedulerState.running = false;
    }
  },

  'POST /api/backfill': async ({ store, body }) => {
    const ids = body?.seriesIds?.length ? body.seriesIds : store.favoriteIds();
    if (ids.length === 0) throw new HttpProblem(400, 'Nenhuma série favoritada para preencher');
    return backfill({ store, seriesIds: ids, log: () => {} });
  },

  'GET /api/seasons': async () => ({ seasons: await new CrunchyrollClient().seasonalTags() }),
};

export class HttpProblem extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
