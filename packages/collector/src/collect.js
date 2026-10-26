import {
  CrunchyrollClient, Store, normalizeBatch, fromCmsEpisode, seriesArtwork, dates, config,
} from '@anime-week/core';

const PAGE_SIZE = 100;

/**
 * Busca a capa oficial das séries que ainda não têm uma.
 *
 * O item de episódio só carrega o quadro daquele episódio, que muda toda
 * semana — ruim para achar a série de relance no calendário. A capa da série
 * é fixa, então vale uma requisição por série, uma única vez.
 */
export async function enrichArtwork({ store, client, limit = 400, concurrency = 4 } = {}) {
  const pending = store.seriesMissingArtwork(limit);
  if (pending.length === 0) return { fetched: 0, failed: 0 };

  let cursor = 0, fetched = 0, failed = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const id = pending[cursor++];
      try {
        const series = await client.series(id);
        if (series) { store.setSeriesArtwork(id, seriesArtwork(series)); fetched++; }
        else failed++;
      } catch {
        failed++; // tenta de novo na próxima coleta
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { fetched, failed };
}

/**
 * Coleta os lançamentos recentes a partir do feed de "recém-adicionados".
 *
 * Os episódios de estreia recente aparecem agrupados no topo do feed; depois
 * deles vem catálogo antigo que acabou de ser (re)publicado. Gravamos tudo —
 * o catálogo antigo entra no banco com a data de estreia real, enriquecendo o
 * histórico sem poluir a semana atual.
 */
export async function collect({
  store, client, pages = 3, days = 7, log = console.log,
} = {}) {
  const own = !store;
  store = store ?? new Store();
  client = client ?? new CrunchyrollClient();

  const startedAt = Date.now();
  const win = dates.window(dates.todayKey(), days);
  const totals = { fetched: 0, dubs: 0, clips: 0, inserted: 0, updated: 0, inWindow: 0, pages: 0 };

  try {
    for (let page = 0; page < pages; page++) {
      const { items, total } = await client.browseEpisodes({
        start: page * PAGE_SIZE, n: PAGE_SIZE,
      });
      if (items.length === 0) {
        log(`  página ${page + 1}: vazia, encerrando`);
        break;
      }
      totals.pages++;
      totals.fetched += items.length;

      const { releases, series, stats } = normalizeBatch(items);
      totals.dubs += stats.dubs;
      totals.clips += stats.clips;

      store.upsertSeries(series);
      const res = store.upsertReleases(releases);
      totals.inserted += res.inserted;
      totals.updated += res.updated;

      const inWindow = releases.filter((r) => {
        const k = dates.dayKey(r.premiere_at);
        return k >= win.startKey && k <= win.endKey;
      }).length;
      totals.inWindow += inWindow;

      log(`  página ${page + 1}/${pages}: ${items.length} itens · ${releases.length} episódios ` +
          `(${inWindow} na janela) · +${res.inserted} novos, ~${res.updated} atualizados` +
          (page === 0 ? ` · catálogo: ${total}` : ''));
    }

    const art = await enrichArtwork({ store, client });
    if (art.fetched) log(`  capas de série buscadas: ${art.fetched}`);
    totals.artwork = art.fetched;

    store.setMeta('last_collected_at', new Date().toISOString());
    totals.elapsedMs = Date.now() - startedAt;
    return totals;
  } finally {
    if (own) store.close();
  }
}

/**
 * Preenche o histórico completo de séries específicas, percorrendo
 * temporada por temporada. É assim que a navegação para semanas antigas
 * passa a ter dados além do que o feed recente alcança.
 */
export async function backfill({
  store, client, seriesIds, log = console.log,
} = {}) {
  const own = !store;
  store = store ?? new Store();
  client = client ?? new CrunchyrollClient();

  const totals = { series: 0, seasons: 0, episodes: 0, inserted: 0, updated: 0, failed: [] };
  try {
    for (const seriesId of seriesIds) {
      let seasons;
      try {
        seasons = await client.seriesSeasons(seriesId);
      } catch (err) {
        log(`  ! ${seriesId}: falha ao listar temporadas (${err.message})`);
        totals.failed.push(seriesId);
        continue;
      }
      totals.series++;

      // Só temporadas de áudio original: as dublagens vêm como temporadas
      // separadas e repetiriam os mesmos episódios.
      const original = seasons.filter((s) => {
        const mine = s.versions?.find((v) => v.season_guid === s.id);
        return mine ? mine.original : s.is_dubbed === false;
      });

      let name = seriesId, eps = 0, ins = 0, upd = 0;
      for (const season of original) {
        let list;
        try {
          list = await client.seasonEpisodes(season.id);
        } catch (err) {
          log(`  ! ${seriesId}/${season.id}: ${err.message}`);
          continue;
        }
        totals.seasons++;
        const { releases, series } = normalizeBatch(list.map(fromCmsEpisode));
        if (releases.length === 0) continue;
        name = releases[0].series_title;
        store.upsertSeries(series);
        const res = store.upsertReleases(releases);
        eps += releases.length; ins += res.inserted; upd += res.updated;
      }
      totals.episodes += eps; totals.inserted += ins; totals.updated += upd;
      log(`  ${name}: ${original.length} temporada(s), ${eps} episódios (+${ins} novos)`);
    }
    return totals;
  } finally {
    if (own) store.close();
  }
}
