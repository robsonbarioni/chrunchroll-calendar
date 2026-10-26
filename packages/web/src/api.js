import { Store, CrunchyrollClient, dates, config } from '@anime-week/core';
import { collect, backfill } from '@anime-week/collector/src/collect.js';

/**
 * Monta a semana: agrupa os lançamentos por dia LOCAL (no fuso configurado).
 * A consulta no banco usa uma folga de ±2 dias em UTC e o recorte final é
 * feito aqui pela chave de dia local, evitando erros de borda de fuso.
 */
export function buildWeek(store, { endKey, days, favoritesOnly, kinds }) {
  const win = dates.window(endKey, days);
  const rows = store.releasesBetween(win.utcFrom, win.utcTo, { favoritesOnly, kinds });

  const buckets = new Map(win.keys.map((k) => [k, []]));
  for (const r of rows) {
    const key = dates.dayKey(r.premiere_at);
    const bucket = buckets.get(key);
    if (!bucket) continue; // fora da janela após a conversão de fuso
    bucket.push({
      id: r.id,
      seriesId: r.series_id,
      seriesTitle: r.series_title,
      episodeLabel: r.episode_label,
      episodeNumber: r.episode_number,
      seasonNumber: r.season_number,
      title: r.title,
      premiereAt: r.premiere_at,
      time: dates.timeLabel(r.premiere_at),
      thumbnail: r.thumbnail,
      url: r.url,
      isPremiumOnly: !!r.is_premium_only,
      isFavorite: !!r.is_favorite,
      kind: r.kind,
      durationMin: r.duration_ms ? Math.round(r.duration_ms / 60000) : null,
      audioLocale: r.audio_locale,
    });
  }

  const todayK = dates.todayKey();
  const dayList = win.keys.map((key) => {
    const items = buckets.get(key).sort((a, b) => a.premiereAt.localeCompare(b.premiereAt));
    return {
      key,
      weekday: dates.weekdayLabel(key),
      dayOfMonth: Number(key.slice(8, 10)),
      isToday: key === todayK,
      isFuture: key > todayK,
      releases: items,
    };
  });

  return {
    days: dayList,
    range: { start: win.startKey, end: win.endKey, days, today: todayK },
    totals: {
      releases: dayList.reduce((n, d) => n + d.releases.length, 0),
      favorites: dayList.reduce((n, d) => n + d.releases.filter((r) => r.isFavorite).length, 0),
    },
    timezone: config.tz,
  };
}

/** Rotas da API. Cada handler recebe (ctx) e devolve um objeto JSON. */
export const routes = {
  'GET /api/week': ({ store, query }) => {
    const days = Math.min(Math.max(Number(query.get('days') ?? 7), 1), 31);
    const endKey = /^\d{4}-\d{2}-\d{2}$/.test(query.get('end') ?? '')
      ? query.get('end')
      : dates.todayKey();
    const kinds = (query.get('kinds') ?? 'episode,special').split(',').filter(Boolean);
    return buildWeek(store, {
      endKey, days,
      favoritesOnly: query.get('favorites') === '1',
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
      isFavorite: !!s.is_favorite,
      releaseCount: s.release_count,
      lastPremiere: s.last_premiere,
    })),
  }),

  'POST /api/favorites': ({ store, body }) => {
    if (!body?.seriesId) throw new HttpProblem(400, 'seriesId é obrigatório');
    const ok = store.setFavorite(body.seriesId, !!body.favorite);
    if (!ok) throw new HttpProblem(404, `Série ${body.seriesId} não encontrada`);
    return { seriesId: body.seriesId, favorite: !!body.favorite };
  },

  'GET /api/status': ({ store }) => ({
    ...store.stats(),
    timezone: config.tz,
    today: dates.todayKey(),
  }),

  'POST /api/collect': async ({ store, body }) => {
    const pages = Math.min(Math.max(Number(body?.pages ?? 2), 1), 20);
    const totals = await collect({ store, pages, log: () => {} });
    return totals;
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
