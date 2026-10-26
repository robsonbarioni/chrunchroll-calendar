import { requestJson } from './http.js';
import { config } from './config.js';

const ORIGIN = 'https://www.crunchyroll.com';
// Credencial pública do player web, usada para obter um token anônimo
// (base64 de "cr_web:"). Não representa nenhuma conta de usuário.
const PUBLIC_CLIENT_BASIC = 'Basic Y3Jfd2ViOg==';

export class CrunchyrollClient {
  #token = null;
  #expiresAt = 0;

  constructor({ locale = config.locale } = {}) {
    this.locale = locale;
  }

  /** Token anônimo, renovado automaticamente 60s antes de expirar. */
  async #auth() {
    if (this.#token && Date.now() < this.#expiresAt - 60_000) return this.#token;
    const json = await requestJson(`${ORIGIN}/auth/v1/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: PUBLIC_CLIENT_BASIC,
      },
      body: 'grant_type=client_id',
    });
    if (!json.access_token) throw new Error('Token anônimo não retornado pelo Crunchyroll');
    this.#token = json.access_token;
    this.#expiresAt = Date.now() + (json.expires_in ?? 300) * 1000;
    return this.#token;
  }

  async #get(pathname, params = {}) {
    const url = new URL(pathname, ORIGIN);
    for (const [k, v] of Object.entries({ locale: this.locale, ...params })) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const token = await this.#auth();
    return requestJson(url.toString(), { headers: { Authorization: `Bearer ${token}` } });
  }

  /**
   * Uma página de episódios ordenados por "recém-adicionados".
   *
   * `is_dubbed=false` é o filtro decisivo: faz a API devolver apenas as versões
   * de áudio original. Sem ele, ~86% do resultado são re-publicações de
   * episódios antigos que acabaram de ganhar uma dublagem nova.
   */
  async browseEpisodes({ start = 0, n = 100, originalAudioOnly = true } = {}) {
    const json = await this.#get('/content/v2/discover/browse', {
      type: 'episode',
      sort_by: 'newly_added',
      n,
      start,
      ...(originalAudioOnly ? { is_dubbed: false } : {}),
    });
    return { items: json.data ?? [], total: json.total ?? 0 };
  }

  /** Temporadas de lançamento disponíveis (ex.: fall-2026). */
  async seasonalTags() {
    const json = await this.#get('/content/v2/discover/seasonal_tags');
    return (json.data ?? []).map((t) => ({
      id: t.id,
      title: t.localization?.title ?? t.id,
    }));
  }

  /** Temporadas (seasons) de uma série. */
  async seriesSeasons(seriesId) {
    const json = await this.#get(`/content/v2/cms/series/${seriesId}/seasons`);
    return json.data ?? [];
  }

  /** Episódios de uma season específica. */
  async seasonEpisodes(seasonId) {
    const json = await this.#get(`/content/v2/cms/seasons/${seasonId}/episodes`);
    return json.data ?? [];
  }

  /** Metadados de uma série. */
  async series(seriesId) {
    const json = await this.#get(`/content/v2/cms/series/${seriesId}`);
    return (json.data ?? [])[0] ?? null;
  }
}
