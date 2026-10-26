#!/usr/bin/env node
import { Store, CrunchyrollClient, config, dates, nextTick, scheduleAligned } from '@anime-week/core';
import { collect, backfill } from './collect.js';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) out[k] = v;
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
      else out[k] = true;
    } else out._.push(a);
  }
  return out;
}

const HELP = `
anime-week — coletor de lançamentos do Crunchyroll

  collect              Coleta os lançamentos recentes
    --pages N          Páginas de 100 itens a buscar (padrão: 3)
    --days N           Janela considerada "recente" no relatório (padrão: 7)

  backfill             Preenche o histórico completo de séries
    --favorites        Apenas as séries favoritadas (padrão)
    --all              Todas as séries já vistas no banco
    --series ID,ID     Séries específicas, por id

  watch                Coleta em loop, na grade alinhada
    --interval N       Minutos entre coletas (padrão: ${config.intervalMin})
    --offset N         Segundos após a grade (padrão: ${config.offsetSec})

  stats                Mostra o estado do banco
  seasons              Lista as temporadas de lançamento disponíveis
`;

const cmd = process.argv[2];
const args = parseArgs(process.argv.slice(3));

function stamp() {
  return new Date().toLocaleTimeString('pt-BR', { timeZone: config.tz });
}

async function main() {
  switch (cmd) {
    case 'collect': {
      console.log(`[${stamp()}] Coletando lançamentos…`);
      const t = await collect({ pages: Number(args.pages ?? 3), days: Number(args.days ?? 7) });
      console.log(
        `[${stamp()}] Pronto em ${(t.elapsedMs / 1000).toFixed(1)}s — ` +
        `${t.fetched} itens lidos, ${t.dubs} dublagens descartadas, ` +
        `${t.inserted} novos, ${t.updated} atualizados, ${t.inWindow} na janela de ${args.days ?? 7} dias.`,
      );
      break;
    }

    case 'backfill': {
      const store = new Store();
      let ids;
      if (args.series) {
        ids = String(args.series).split(',').map((s) => s.trim()).filter(Boolean);
      } else if (args.all) {
        ids = store.listSeries().map((s) => s.id);
      } else {
        ids = store.favoriteIds();
        if (ids.length === 0) {
          console.log('Nenhuma série favoritada. Favorite na interface web, ' +
                      'ou use --all / --series ID.');
          store.close();
          return;
        }
      }
      console.log(`[${stamp()}] Preenchendo histórico de ${ids.length} série(s)…`);
      const t = await backfill({ store, seriesIds: ids });
      console.log(
        `[${stamp()}] Pronto — ${t.series} séries, ${t.seasons} temporadas, ` +
        `${t.episodes} episódios (+${t.inserted} novos).` +
        (t.failed.length ? ` Falhas: ${t.failed.join(', ')}` : ''),
      );
      store.close();
      break;
    }

    case 'watch': {
      const intervalMin = Number(args.interval ?? config.intervalMin);
      const offsetSec = Number(args.offset ?? config.offsetSec);
      const store = new Store();
      const client = new CrunchyrollClient();
      const pages = Number(args.pages ?? config.autoPages);

      const at = (d) => d.toLocaleTimeString('pt-BR', { timeZone: config.tz, hour: '2-digit', minute: '2-digit' });
      console.log(`Modo watch: a cada ${intervalMin} min, ${offsetSec}s após a grade ` +
                  `(próxima às ${at(nextTick(Date.now(), { intervalMin, offsetSec }))}). Ctrl+C para parar.`);

      const run = async () => {
        try {
          const t = await collect({ store, client, pages, log: () => {} });
          console.log(`[${stamp()}] +${t.inserted} novos, ~${t.updated} atualizados.`);
        } catch (err) {
          console.error(`[${stamp()}] Erro na coleta: ${err.message}`);
        }
      };
      await run();

      const stopScheduler = scheduleAligned(run, {
        intervalMin, offsetSec,
        onSchedule: (when) => console.log(`[${stamp()}] próxima coleta às ${at(when)}`),
      });
      const stop = () => { stopScheduler(); store.close(); process.exit(0); };
      process.on('SIGINT', stop);
      process.on('SIGTERM', stop);
      break;
    }

    case 'stats': {
      const store = new Store();
      const s = store.stats();
      console.log(`Banco:        ${config.dbPath}`);
      console.log(`Fuso:         ${config.tz}`);
      console.log(`Lançamentos:  ${s.releases}`);
      console.log(`Séries:       ${s.series} (${s.favorites} favoritas)`);
      console.log(`Período:      ${(s.oldest ?? '—').slice(0, 10)} → ${(s.newest ?? '—').slice(0, 10)}`);
      console.log(`Última coleta:${s.lastCollectedAt ? ' ' + s.lastCollectedAt : ' nunca'}`);
      const win = dates.window(dates.todayKey(), 7);
      const week = store.releasesBetween(win.utcFrom, win.utcTo);
      const byDay = new Map(win.keys.map((k) => [k, 0]));
      for (const r of week) {
        const k = dates.dayKey(r.premiere_at);
        if (byDay.has(k)) byDay.set(k, byDay.get(k) + 1);
      }
      console.log('\nÚltimos 7 dias:');
      for (const [k, n] of byDay) {
        console.log(`  ${k} ${dates.weekdayLabel(k).padEnd(4)} ${'█'.repeat(n)} ${n}`);
      }
      store.close();
      break;
    }

    case 'seasons': {
      const client = new CrunchyrollClient();
      for (const t of await client.seasonalTags()) console.log(`  ${t.id.padEnd(14)} ${t.title}`);
      break;
    }

    default:
      console.log(HELP);
      process.exit(cmd ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(`Erro: ${err.message}`);
  process.exit(1);
});
