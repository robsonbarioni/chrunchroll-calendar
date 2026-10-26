import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../../..');

// Carrega .env simples (sem dependências) se existir.
function loadEnv() {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv();

export const config = {
  locale: process.env.CR_LOCALE || 'pt-BR',
  /** Fuso para agrupar lançamentos por dia. */
  tz: process.env.TZ_DISPLAY || 'America/Sao_Paulo',
  dbPath: path.resolve(ROOT, process.env.DB_PATH || './data/anime-week.db'),
  port: Number(process.env.PORT || 5173),
  /** Minutos entre coletas automáticas. */
  intervalMin: Number(process.env.COLLECT_INTERVAL_MIN || 15),
  /** Atraso aplicado sobre a grade, para dar tempo do episódio ser indexado. */
  offsetSec: Number(process.env.COLLECT_OFFSET_SEC || 120),
  /** O servidor web coleta sozinho? */
  autoCollect: (process.env.AUTO_COLLECT ?? '1') !== '0',
  /** Páginas buscadas em cada coleta automática. */
  autoPages: Number(process.env.COLLECT_PAGES || 2),
};
