# Anime Week

Calendário semanal dos lançamentos de anime do Crunchyroll: um coletor que
grava o histórico e uma interface que mostra os últimos 7 dias, com navegação
para semanas anteriores e marcação de favoritos.

```
┌─ ter 20 ─┬─ qua 21 ─┬─ qui 22 ─┬─ sex 23 ─┬─ sáb 24 ─┬─ dom 25 ─┬─ seg 26 ─┐
│ 10:30 E3 │ 10:00 E3 │ 09:30 E4 │ 00:00 E8 │ 06:30 E4 │ 06:00 E4 │ 09:30 E4 │
│ 11:30 E3 │ 10:00 E3 │ 13:05 E7 │ 12:00 E4 │ 10:00 E5 │ 06:00 E16│ 10:00 E5 │
│    …     │    …     │          │    …     │    …     │    …     │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

## O problema que isto resolve

O feed de "recém-adicionados" do Crunchyroll **não** é uma lista de episódios
novos. Cada dublagem é publicada como um item próprio, com id e data próprios —
então, quando uma série ganha dublagem nova, os 24 episódios antigos reaparecem
no topo do feed como se fossem lançamentos de hoje.

Medido na prática: **~86% do feed é ruído de dublagem.** Uma página de 100 itens
chegou a trazer 24 episódios da mesma série, todos carimbados no mesmo horário.

A solução tem duas camadas:

1. **No servidor** — a requisição usa `is_dubbed=false`, que faz a API devolver
   só as versões de áudio original.
2. **No cliente** — cada item é conferido contra o próprio `versions[]`
   (`original: true`), e episódios são colapsados pela identidade
   `série|temporada|episódio`. Entre duplicatas, vence a estreia **mais antiga**:
   uma re-publicação nunca empurra um episódio velho para a semana atual.

Resultado: o banco só contém áudios originais (`ja-JP`, `zh-CN`, `ko-KR`…),
sem nenhum locale de dublagem.

## Instalação

Precisa de **Node.js 22.5+** (usa o `node:sqlite` nativo) e de **curl**, que já
vem no Windows 10+, macOS e Linux. Não há dependências de terceiros.

```bash
npm install          # apenas liga os workspaces entre si
cp .env.example .env # opcional: ajusta fuso, porta, caminho do banco
```

## Uso

```bash
npm run collect      # busca os lançamentos recentes
npm run web          # abre a interface em http://localhost:5173
```

Ou os dois de uma vez:

```bash
npm start
```

### Comandos do coletor

| Comando | O que faz |
| --- | --- |
| `npm run collect` | Coleta os lançamentos recentes (`--pages N`, padrão 3) |
| `npm run watch` | Coleta em loop na grade alinhada (`--interval`, `--offset`) |
| `npm run backfill` | Puxa o histórico completo das séries favoritadas |
| `npm run stats` | Mostra o estado do banco e um gráfico dos 7 dias |

```bash
# histórico completo de uma série específica
node packages/collector/src/cli.js backfill --series GQWH0M19X

# coleta mais profunda, para encher o histórico de uma vez
node packages/collector/src/cli.js collect --pages 10
```

## Coleta automática

O servidor web verifica o Crunchyroll sozinho a cada 15 minutos, **2 minutos
depois da grade** — às `:02`, `:17`, `:32` e `:47`. O atraso existe porque um
episódio marcado para as 09:00 leva alguns segundos até aparecer no catálogo:
consultar exatamente às 09:00 devolveria a lista sem ele.

Enquanto a semana visível contém o dia de hoje, a barra superior mostra quando
foi a última verificação:

```
● verificado há 3 minutos        ← passe o mouse para ver a próxima
```

O ponto fica verde quando está em dia, pulsa durante a verificação, e vira
laranja se passaram duas janelas sem sucesso. Em semanas passadas o indicador
some, porque ali o dado não muda mais. A tela se atualiza sozinha quando uma
coleta nova entra — sem recarregar a página.

Ajuste pelo `.env`:

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `COLLECT_INTERVAL_MIN` | `15` | Intervalo entre verificações |
| `COLLECT_OFFSET_SEC` | `120` | Atraso sobre a grade |
| `COLLECT_PAGES` | `2` | Páginas buscadas por verificação |
| `AUTO_COLLECT` | `1` | `0` desliga a coleta do servidor |

Para coletar sem manter a interface aberta, `npm run watch` usa a mesma grade.

### Na interface

- **‹ › Hoje** ou **← →** navegam entre as semanas.
- **☆** em qualquer card favorita a série.
- **▦** abre a página da série no Crunchyroll (o card em si abre o episódio).
- **★ Só favoritos** filtra o calendário para as séries que você acompanha.
- **Gerenciar séries** abre a lista completa, com busca.
- **Atualizar** dispara uma coleta sem sair da página.
- **Preencher histórico dos favoritos** baixa todas as temporadas das séries
  favoritadas — é assim que semanas antigas ganham dados.

#### Capa fixa, prévia no hover

O card mostra a **capa da série**, não um quadro do episódio. A capa se repete
toda semana, então bate o olho e você acha a série que procura; o quadro do
episódio mudaria a cada semana e atrapalharia esse reconhecimento. O quadro
continua guardado e aparece numa prévia flutuante ao passar o mouse, junto do
número do episódio e do título.

As duas artes são buscadas uma vez por série (`poster_wide` 16:9 para o card,
`poster_tall` 2:3 guardada para uso futuro) e ficam no banco.

## Estrutura

```
packages/
├── core/         @anime-week/core      — biblioteca compartilhada
│   ├── http.js         transporte via curl
│   ├── crunchyroll.js  cliente da API (token anônimo, browse, CMS)
│   ├── normalize.js    filtro de dublagem e deduplicação
│   ├── dates.js        janelas semanais e conversão de fuso
│   ├── schedule.js     grade de coleta (intervalo + offset)
│   └── db.js           SQLite (node:sqlite)
├── collector/    @anime-week/collector — CLI de coleta e backfill
└── web/          @anime-week/web       — API HTTP + interface
    ├── src/      servidor (node:http, sem framework)
    └── public/   calendário (HTML/CSS/JS puros, sem build)
```

Os dados ficam em `data/anime-week.db` (fora do versionamento).

## Notas técnicas

**Por que curl e não `fetch`.** O Crunchyroll fica atrás do Cloudflare, que faz
fingerprint do stack TLS. O `fetch` nativo do Node (undici) leva um desafio
403 mesmo com todos os headers de navegador; o curl passa. Por isso todo o
tráfego sai por `child_process` + curl.

**Autenticação.** Usa o token anônimo do player web (`grant_type=client_id`),
sem conta nem credenciais. Conteúdo premium aparece no calendário marcado,
mas assistir continua exigindo login no site.

**Fusos.** As datas da API vêm em UTC. O agrupamento por dia usa o fuso de
`TZ_DISPLAY` (padrão `America/Sao_Paulo`), então um episódio das 01:30 UTC cai
no dia anterior — como você veria no site. A consulta ao banco abre ±2 dias de
folga em UTC e o recorte final é feito pela chave de dia local.

**Alcance do histórico.** O feed recente cobre cerca de 50 episódios originais
por semana antes de virar catálogo antigo, então `collect` enxerga ~2 semanas
para trás. Para ir além, rode `backfill`: ele percorre série por série e já
trouxe episódios de 2013 nos testes. Rodando `watch` continuamente, o histórico
se acumula sozinho.

**O que o banco guarda.** Cada lançamento carrega o suficiente para ser
reaberto anos depois sem nova consulta à API: `url` (página do episódio),
`series_url` (página da série), `thumbnail`, `season_id`, `season_title`,
`description`, duração e horário de estreia. As capas da série ficam em
`series.poster_wide` / `poster_tall`. Colunas novas entram por `ALTER TABLE`
na abertura do banco, então bancos antigos migram sozinhos.

**Temporada na URL da série.** Não dá. Testei no navegador: `?season=<id>` é
ignorado, e trocar de temporada pelo próprio site muda o conteúdo sem alterar
a URL — a seleção é só estado do cliente. Por isso o botão **▦** abre a série
na temporada que o Crunchyroll escolher (normalmente a 1ª). O `season_id` do
episódio fica guardado, então, se algum dia a URL passar a aceitá-lo, é uma
linha de mudança.

**Endpoints usados.**

| Endpoint | Uso |
| --- | --- |
| `POST /auth/v1/token` | token anônimo |
| `/content/v2/discover/browse?type=episode` | feed de lançamentos |
| `/content/v2/discover/seasonal_tags` | temporadas (`fall-2026`…) |
| `/content/v2/cms/series/{id}` | capas oficiais da série |
| `/content/v2/cms/series/{id}/seasons` | backfill |
| `/content/v2/cms/seasons/{id}/episodes` | backfill |

A página `/simulcastcalendar`, que seria a fonte mais direta, foi descontinuada
— hoje ela redireciona para `/simulcasts`.
