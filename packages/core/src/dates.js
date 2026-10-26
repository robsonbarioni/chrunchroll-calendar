import { config } from './config.js';

const dayFmtCache = new Map();
function dayFormatter(tz) {
  if (!dayFmtCache.has(tz)) {
    dayFmtCache.set(tz, new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }));
  }
  return dayFmtCache.get(tz);
}

/** Converte um instante ISO para a chave de dia local (YYYY-MM-DD) no fuso dado. */
export function dayKey(iso, tz = config.tz) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return dayFormatter(tz).format(d);
}

/** Hora local HH:MM no fuso dado. */
export function timeLabel(iso, tz = config.tz) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
}

/** Hoje, como chave de dia local. */
export function todayKey(tz = config.tz) {
  return dayFormatter(tz).format(new Date());
}

/** Soma dias a uma chave YYYY-MM-DD (aritmética de calendário, sem fuso). */
export function addDays(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/**
 * Janela de `days` dias terminando em `endKey` (inclusive).
 * Devolve as chaves em ordem crescente mais os limites UTC com folga,
 * para que a consulta no banco cubra qualquer deslocamento de fuso.
 */
export function window(endKey, days = 7) {
  const keys = [];
  for (let i = days - 1; i >= 0; i--) keys.push(addDays(endKey, -i));
  return {
    keys,
    startKey: keys[0],
    endKey: keys[keys.length - 1],
    // ±2 dias de folga cobrem qualquer offset de fuso (máx. real ~14h).
    utcFrom: `${addDays(keys[0], -2)}T00:00:00.000Z`,
    utcTo: `${addDays(keys[keys.length - 1], 2)}T00:00:00.000Z`,
  };
}

/** Nome do dia da semana, em pt-BR, a partir da chave YYYY-MM-DD. */
export function weekdayLabel(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace('.', '');
}
