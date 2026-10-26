import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36';

/**
 * O Crunchyroll fica atrás do Cloudflare, que faz fingerprint do stack TLS.
 * O `fetch` nativo do Node (undici) recebe um desafio 403; o curl passa.
 * Por isso todo o tráfego sai pelo curl, que já vem no Windows 10+/macOS/Linux.
 */
const BASE_HEADERS = [
  ['User-Agent', USER_AGENT],
  ['Accept', 'application/json, text/plain, */*'],
  ['Accept-Language', 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'],
  ['Referer', 'https://www.crunchyroll.com/pt-br/videos/new'],
  ['sec-ch-ua', '"Google Chrome";v="155", "Chromium";v="155", "Not(A:Brand";v="24"'],
  ['sec-ch-ua-mobile', '?0'],
  ['sec-ch-ua-platform', '"Windows"'],
];

const MARKER = '\n__HTTP_STATUS__';

export class HttpError extends Error {
  constructor(status, url, body) {
    super(`HTTP ${status} em ${url}`);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

/** Executa uma requisição via curl e devolve { status, body }. */
export async function request(url, { method = 'GET', headers = {}, body, timeout = 45 } = {}) {
  const args = [
    '--silent', '--show-error', '--compressed',
    '--max-time', String(timeout),
    '--write-out', MARKER + '%{http_code}',
    '--url', url,
  ];
  for (const [k, v] of BASE_HEADERS) args.push('-H', `${k}: ${v}`);
  for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`);
  if (method !== 'GET') args.push('-X', method);
  if (body != null) args.push('--data', body);

  let stdout;
  try {
    ({ stdout } = await execFileAsync('curl', args, { maxBuffer: 128 * 1024 * 1024 }));
  } catch (err) {
    throw new Error(`Falha ao executar curl para ${url}: ${err.message}`);
  }
  const idx = stdout.lastIndexOf(MARKER);
  if (idx === -1) throw new Error(`Resposta do curl sem marcador de status (${url})`);
  return {
    status: Number(stdout.slice(idx + MARKER.length).trim()),
    body: stdout.slice(0, idx),
  };
}

/** Igual a request(), porém exige 2xx e devolve JSON. Repete em erros transitórios. */
export async function requestJson(url, options = {}, { retries = 3, retryDelayMs = 1200 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { status, body } = await request(url, options);
      if (status >= 200 && status < 300) {
        try {
          return JSON.parse(body);
        } catch {
          throw new HttpError(status, url, body.slice(0, 400));
        }
      }
      // 4xx (fora de 408/429) não melhora com retry.
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
        throw new HttpError(status, url, body.slice(0, 400));
      }
      lastErr = new HttpError(status, url, body.slice(0, 400));
    } catch (err) {
      if (err instanceof HttpError && err.status >= 400 && err.status < 500 &&
          err.status !== 408 && err.status !== 429) throw err;
      lastErr = err;
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}
