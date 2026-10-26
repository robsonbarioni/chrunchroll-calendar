import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS series (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  slug_title   TEXT,
  poster_wide  TEXT,
  is_favorite  INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL
);

-- A chave primária é a identidade do EPISÓDIO (série|temporada|episódio),
-- não o id do item. Assim, a mesma linha é reaproveitada se o episódio
-- reaparecer no feed em outra versão de áudio.
CREATE TABLE IF NOT EXISTS releases (
  dedupe_key      TEXT PRIMARY KEY,
  id              TEXT NOT NULL,
  series_id       TEXT NOT NULL,
  series_title    TEXT NOT NULL,
  season_number   INTEGER,
  episode_number  INTEGER,
  episode_label   TEXT,
  title           TEXT,
  premiere_at     TEXT NOT NULL,
  audio_locale    TEXT,
  duration_ms     INTEGER,
  thumbnail       TEXT,
  url             TEXT,
  is_premium_only INTEGER NOT NULL DEFAULT 0,
  kind            TEXT NOT NULL DEFAULT 'episode',
  first_seen_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_releases_premiere ON releases(premiere_at DESC);
CREATE INDEX IF NOT EXISTS idx_releases_series   ON releases(series_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_releases_id ON releases(id);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);
`;

export class Store {
  constructor(dbPath = config.dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec(SCHEMA);
  }

  close() { this.db.close(); }

  // ---------- séries ----------

  upsertSeries(list) {
    const stmt = this.db.prepare(`
      INSERT INTO series (id, title, slug_title, poster_wide, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title       = excluded.title,
        slug_title  = COALESCE(excluded.slug_title, series.slug_title),
        poster_wide = COALESCE(excluded.poster_wide, series.poster_wide),
        updated_at  = excluded.updated_at
    `);
    const now = new Date().toISOString();
    this.db.exec('BEGIN');
    try {
      for (const s of list) stmt.run(s.id, s.title, s.slug_title ?? null, s.poster_wide ?? null, now);
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }

  listSeries({ q = '', favoritesOnly = false } = {}) {
    const where = [];
    const args = [];
    if (favoritesOnly) where.push('s.is_favorite = 1');
    if (q) { where.push('s.title LIKE ?'); args.push(`%${q}%`); }
    return this.db.prepare(`
      SELECT s.id, s.title, s.slug_title, s.poster_wide, s.is_favorite,
             COUNT(r.dedupe_key) AS release_count,
             MAX(r.premiere_at)  AS last_premiere
      FROM series s
      LEFT JOIN releases r ON r.series_id = s.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      GROUP BY s.id
      ORDER BY s.is_favorite DESC, last_premiere DESC NULLS LAST, s.title ASC
    `).all(...args);
  }

  setFavorite(seriesId, favorite) {
    const r = this.db.prepare('UPDATE series SET is_favorite = ? WHERE id = ?')
      .run(favorite ? 1 : 0, seriesId);
    return r.changes > 0;
  }

  favoriteIds() {
    return this.db.prepare('SELECT id FROM series WHERE is_favorite = 1').all().map((r) => r.id);
  }

  // ---------- lançamentos ----------

  /**
   * Grava lançamentos. Em conflito, mantém a estreia mais ANTIGA: se o mesmo
   * episódio reaparecer com data mais nova (típico de re-publicação por
   * dublagem), a data original prevalece e ele NÃO sobe para o topo da semana.
   */
  upsertReleases(list) {
    const stmt = this.db.prepare(`
      INSERT INTO releases (
        dedupe_key, id, series_id, series_title, season_number, episode_number,
        episode_label, title, premiere_at, audio_locale, duration_ms, thumbnail,
        url, is_premium_only, kind, first_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(dedupe_key) DO UPDATE SET
        title       = COALESCE(NULLIF(excluded.title, ''), releases.title),
        thumbnail   = COALESCE(excluded.thumbnail, releases.thumbnail),
        premiere_at = MIN(releases.premiere_at, excluded.premiere_at)
    `);
    // Um mesmo episódio pode reaparecer com outro id (outra versão de áudio).
    // O índice único em `id` impediria o upsert por dedupe_key, então
    // removemos antes qualquer linha órfã que carregue esse id em outra chave.
    const dropStale = this.db.prepare('DELETE FROM releases WHERE id = ? AND dedupe_key <> ?');
    const exists = this.db.prepare('SELECT 1 AS x FROM releases WHERE dedupe_key = ?');

    let inserted = 0, updated = 0;
    this.db.exec('BEGIN');
    try {
      for (const r of list) {
        dropStale.run(r.id, r.dedupe_key);
        if (exists.get(r.dedupe_key)) updated++; else inserted++;
        stmt.run(
          r.dedupe_key, r.id, r.series_id, r.series_title, r.season_number,
          r.episode_number, r.episode_label, r.title, r.premiere_at, r.audio_locale,
          r.duration_ms, r.thumbnail, r.url, r.is_premium_only, r.kind, r.first_seen_at,
        );
      }
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
    return { inserted, updated };
  }

  count() {
    return this.db.prepare('SELECT COUNT(*) AS n FROM releases').get().n;
  }

  /** Lançamentos num intervalo UTC, já com o estado de favorito da série. */
  releasesBetween(utcFrom, utcTo, { favoritesOnly = false, kinds = ['episode', 'special'] } = {}) {
    const placeholders = kinds.map(() => '?').join(',');
    return this.db.prepare(`
      SELECT r.*, COALESCE(s.is_favorite, 0) AS is_favorite, s.poster_wide
      FROM releases r
      LEFT JOIN series s ON s.id = r.series_id
      WHERE r.premiere_at >= ? AND r.premiere_at < ?
        AND r.kind IN (${placeholders})
        ${favoritesOnly ? 'AND COALESCE(s.is_favorite, 0) = 1' : ''}
      ORDER BY r.premiere_at DESC
    `).all(utcFrom, utcTo, ...kinds);
  }

  stats() {
    const row = this.db.prepare(`
      SELECT COUNT(*) AS releases, MIN(premiere_at) AS oldest, MAX(premiere_at) AS newest
      FROM releases
    `).get();
    const s = this.db.prepare(`
      SELECT COUNT(*) AS series, SUM(is_favorite) AS favorites FROM series
    `).get();
    return {
      releases: row.releases, oldest: row.oldest, newest: row.newest,
      series: s.series, favorites: s.favorites ?? 0,
      lastCollectedAt: this.getMeta('last_collected_at'),
    };
  }

  // ---------- meta ----------

  getMeta(key) {
    return this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value ?? null;
  }

  setMeta(key, value) {
    this.db.prepare(`
      INSERT INTO meta (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));
  }
}
