import { config } from './config.js';

/** O Crunchyroll usa datas-sentinela (ano 9998) para "sem data definida". */
const SENTINEL_YEAR = 9000;

function saneDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCFullYear() >= SENTINEL_YEAR) return null;
  return d.toISOString();
}

/** Escolhe a melhor imagem (>= largura desejada, senão a maior). */
function pickImage(buckets, want = 320) {
  const list = buckets?.[0];
  if (!Array.isArray(list) || list.length === 0) return null;
  const sorted = [...list].sort((a, b) => a.width - b.width);
  return (sorted.find((i) => i.width >= want) ?? sorted[sorted.length - 1]).source ?? null;
}

/**
 * Este item é a versão de áudio ORIGINAL do episódio?
 *
 * É o filtro que separa "episódio novo" de "episódio antigo que ganhou
 * dublagem nova". Cada dublagem é publicada como um item próprio, com id e
 * `premium_available_date` próprios — e entra no feed de recém-adicionados
 * como se fosse um lançamento. Só a versão original marca a estreia real.
 */
export function isOriginalVersion(item) {
  const meta = item?.episode_metadata;
  if (!meta) return false;
  const mine = meta.versions?.find((v) => v.guid === item.id);
  if (mine && typeof mine.original === 'boolean') return mine.original;
  // Sem versões declaradas: confia na flag do próprio item.
  return meta.is_dubbed === false;
}

/** Instante de estreia, com fallbacks na ordem de confiabilidade. */
export function premiereAt(meta) {
  return (
    saneDate(meta.premium_available_date) ??
    saneDate(meta.available_date) ??
    saneDate(meta.free_available_date) ??
    saneDate(meta.episode_air_date) ??
    saneDate(meta.upload_date)
  );
}

/**
 * Chave de identidade de um episódio, independente de dublagem.
 * Dois itens com a mesma chave são o MESMO episódio — mantemos só um.
 */
export function dedupeKey(item) {
  const m = item.episode_metadata;
  if (m.episode_number != null) {
    return `${m.series_id}|S${m.season_number ?? 0}|E${m.episode_number}`;
  }
  // Especiais/filmes sem numeração: cai para o identificador do catálogo.
  return `${m.series_id}|${m.identifier || item.id}`;
}

/** Classifica o tipo de publicação, para a interface poder distinguir. */
export function classify(meta) {
  if (meta.is_clip) return 'clip';
  if (meta.episode_number == null) return 'special';
  return 'episode';
}

/** Converte um item cru da API no registro que gravamos no banco. */
export function toRelease(item, { locale = config.locale, seenAt = new Date().toISOString() } = {}) {
  const m = item.episode_metadata;
  const premiere = premiereAt(m);
  if (!premiere) return null;

  const epNum = m.episode_number ?? null;
  const label = epNum != null
    ? `T${m.season_number ?? 1} E${m.episode ?? epNum}`
    : (m.episode ? `${m.episode}` : 'Especial');

  const lang = locale.toLowerCase();
  const seriesSlug = m.series_slug_title ?? null;

  return {
    id: item.id,
    series_id: m.series_id,
    series_title: m.series_title ?? item.title ?? '(sem título)',
    series_slug: seriesSlug,
    // Guardado junto para o banco responder sozinho, sem precisar de join.
    series_url: seriesSlug
      ? `https://www.crunchyroll.com/${lang}/series/${m.series_id}/${seriesSlug}`
      : `https://www.crunchyroll.com/${lang}/series/${m.series_id}`,
    season_id: m.season_id ?? null,
    season_number: m.season_number ?? null,
    season_title: m.season_title ?? null,
    episode_number: epNum,
    episode_label: label,
    title: item.title ?? m.episode ?? '',
    description: item.description ?? m.description ?? null,
    premiere_at: premiere,
    audio_locale: m.audio_locale ?? null,
    duration_ms: m.duration_ms ?? null,
    thumbnail: pickImage(item.images?.thumbnail, 640),
    url: `https://www.crunchyroll.com/${lang}/watch/${item.id}/${item.slug_title ?? ''}`,
    is_premium_only: m.is_premium_only ? 1 : 0,
    kind: classify(m),
    dedupe_key: dedupeKey(item),
    first_seen_at: seenAt,
  };
}

/**
 * Adapta um episódio do endpoint CMS (`/cms/seasons/{id}/episodes`) ao formato
 * do browse. O CMS devolve os metadados no nível raiz, com os mesmos nomes de
 * campo, então basta envelopá-lo para reaproveitar todo o pipeline.
 */
export function fromCmsEpisode(episode) {
  return {
    id: episode.id,
    title: episode.title,
    slug_title: episode.slug_title,
    images: episode.images,
    episode_metadata: episode,
  };
}

/**
 * Dados de série extraídos de um item de episódio.
 *
 * Sem capa: o item de episódio só traz o quadro daquele episódio, que muda
 * toda semana. A capa oficial vem de `seriesArtwork()`, pelo endpoint da série.
 */
export function toSeries(item) {
  const m = item.episode_metadata;
  return {
    id: m.series_id,
    title: m.series_title ?? '(sem título)',
    slug_title: m.series_slug_title ?? null,
  };
}

/** Capas oficiais a partir do objeto de série do catálogo. */
export function seriesArtwork(series) {
  return {
    poster_wide: pickImage(series?.images?.poster_wide, 640),
    poster_tall: pickImage(series?.images?.poster_tall, 480),
  };
}

/**
 * Pipeline completo: filtra dublagens/clipes e colapsa duplicatas.
 * Entre duplicatas, mantém a de estreia mais ANTIGA (a publicação original).
 */
export function normalizeBatch(items, opts = {}) {
  const { includeClips = false } = opts;
  const byKey = new Map();
  const stats = { total: items.length, dubs: 0, clips: 0, noDate: 0, duplicates: 0, kept: 0 };

  for (const item of items) {
    if (!item?.episode_metadata?.series_id) continue;
    if (!isOriginalVersion(item)) { stats.dubs++; continue; }
    if (!includeClips && item.episode_metadata.is_clip) { stats.clips++; continue; }

    const rel = toRelease(item, opts);
    if (!rel) { stats.noDate++; continue; }

    const prev = byKey.get(rel.dedupe_key);
    if (prev) {
      stats.duplicates++;
      if (rel.premiere_at < prev.release.premiere_at) byKey.set(rel.dedupe_key, { release: rel, item });
      continue;
    }
    byKey.set(rel.dedupe_key, { release: rel, item });
  }

  const releases = [...byKey.values()].map((v) => v.release);
  const series = new Map();
  for (const v of byKey.values()) {
    const s = toSeries(v.item);
    if (!series.has(s.id)) series.set(s.id, s);
  }
  stats.kept = releases.length;
  return { releases, series: [...series.values()], stats };
}
