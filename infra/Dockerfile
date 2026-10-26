# syntax=docker/dockerfile:1
# Build context = raiz do repositório (definido em infra/docker-compose.yml)

FROM node:24-alpine

# O cliente do Crunchyroll sai pelo curl (ver packages/core/src/http.js):
# o fetch nativo do Node toma 403 do Cloudflare. O tzdata dá nome aos fusos
# usados no agrupamento por dia.
RUN apk add --no-cache curl tzdata

WORKDIR /app

# Não há dependências de terceiros: o `npm ci` só cria os links dos workspaces
# (@anime-week/core, collector, web) em node_modules.
COPY package.json package-lock.json ./
COPY packages/ packages/
RUN npm ci --omit=dev --no-audit --no-fund

# Banco SQLite persistente — montado como volume no compose
RUN mkdir -p /data && chown node:node /data
ENV NODE_ENV=production \
    DB_PATH=/data/anime-week.db \
    PORT=5173

USER node
EXPOSE 5173

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Só a interface: o próprio servidor faz a coleta de partida (se o banco
# estiver velho) e depois a cada 15 minutos.
CMD ["node", "packages/web/src/server.js"]
