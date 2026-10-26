import { config } from './config.js';

/**
 * Próximo horário de coleta, alinhado à grade do intervalo mais um offset.
 *
 * Com intervalo de 15 min e offset de 2 min, a grade é :02, :17, :32, :47.
 * O offset existe porque um episódio marcado para as 09:00 costuma levar
 * alguns segundos até aparecer no catálogo — consultar exatamente às 09:00
 * devolveria a lista sem ele.
 *
 * A conta é feita sobre o epoch. Como todo fuso real tem offset múltiplo de
 * 15 minutos, a grade cai nos mesmos minutos do relógio local.
 */
export function nextTick(now = Date.now(), {
  intervalMin = config.intervalMin,
  offsetSec = config.offsetSec,
} = {}) {
  const t = now instanceof Date ? now.getTime() : now;
  const intervalMs = intervalMin * 60_000;
  const offsetMs = offsetSec * 1000;

  let next = Math.floor((t - offsetMs) / intervalMs) * intervalMs + offsetMs;
  if (next <= t) next += intervalMs; // sempre estritamente no futuro
  return new Date(next);
}

/** Milissegundos até o próximo horário de coleta. */
export function msUntilNextTick(now = Date.now(), options = {}) {
  const t = now instanceof Date ? now.getTime() : now;
  return nextTick(t, options).getTime() - t;
}

/**
 * Dispara `task` em cada horário da grade, reagendando a cada execução.
 * Devolve uma função que cancela o agendamento.
 */
export function scheduleAligned(task, { onSchedule, ...options } = {}) {
  let timer = null;
  let stopped = false;

  const arm = () => {
    if (stopped) return;
    const at = nextTick(Date.now(), options);
    onSchedule?.(at);
    timer = setTimeout(async () => {
      try {
        await task(at);
      } finally {
        arm(); // reagenda mesmo se a tarefa falhar
      }
    }, Math.max(0, at.getTime() - Date.now()));
  };

  arm();
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}
