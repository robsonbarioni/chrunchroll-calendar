# Anime Week

[English](README.md) · **Português**

Calendário semanal dos lançamentos de anime do **Crunchyroll**, de segunda a
domingo, rodando na sua máquina. Mostra os episódios que saíram, prevê os dias
que ainda não chegaram e deixa você favoritar as séries que acompanha.

![O calendário da semana: a coluna de hoje em cores, com os episódios já
lançados, e os dias seguintes em cinza com o selo PREVISTO](docs/screenshot.pt-BR.png)

<p align="center"><sub>
Segunda-feira com o que já saiu; o resto da semana em cinza, previsto a partir
da semana anterior.
</sub></p>

**Por que existe:** a lista de "recém-adicionados" do Crunchyroll não é uma
lista de episódios novos. Quando uma série ganha dublagem nova, os episódios
antigos reaparecem no topo como se tivessem acabado de sair — na prática,
[~86% daquele feed é esse ruído](#como-os-episódios-novos-são-separados-das-dublagens).
Este projeto separa o que é estreia de verdade.

---

## Começando

Você precisa de **Node.js 22.5 ou mais novo** ([baixar](https://nodejs.org)) e
do **curl**, que já vem instalado no Windows 10+, macOS e Linux.

Não precisa de conta no Crunchyroll, nem de chave de API, nem de banco de dados
instalado. Também não há dependências de terceiros para baixar.

```bash
git clone https://github.com/robsonbarioni/chrunchroll-calendar.git
cd chrunchroll-calendar
npm install
npm start
```

Abra **http://localhost:5173**. O `npm start` faz a primeira coleta e sobe a
interface; da segunda vez em diante, `npm run web` já basta.

> **Windows:** rode pelo PowerShell, Prompt de Comando ou Git Bash — tanto faz.
> Os comandos são os mesmos.

---

## Usando

| | |
| --- | --- |
| **‹ › Hoje** | Anda de semana em semana. Também funciona com **←** e **→** |
| **✓** | Marca o episódio como visto, junto com todos os anteriores |
| **☆** | Favorita a série (o card inteiro abre o episódio) |
| **▦** | Abre a página da série no Crunchyroll |
| **★ Só favoritos** | Esconde tudo que você não acompanha |
| **Previsões** | Liga/desliga a projeção dos dias que ainda não chegaram |
| **Gerenciar séries** | Lista completa, com busca, para favoritar em lote |
| **Bandeiras** | Alternam entre inglês e português |
| **Atualizar** | Força uma busca agora, sem esperar o ciclo automático |

Passando o mouse sobre um card aparece o **quadro daquele episódio**, numa
prévia que acompanha o cursor e vira de lado ao chegar perto da borda. O card
em si mostra sempre a capa da série, que não muda de uma semana para outra — é
o que deixa cada série reconhecível de relance na grade.

### Acompanhando o que você já viu

Marcar um episódio com **✓** marca também **todos os episódios anteriores**
daquela série como vistos, inclusive de temporadas passadas — não é preciso
marcar um por um. Os cards vistos ficam apagados, para o que ainda falta assistir
se destacar. Clicar de novo no **✓** de um episódio visto desmarca ele e todos
os seguintes.

Em **Gerenciar séries**, cada série que você começou a marcar mostra se você
está **em dia** ou quantos episódios estão **não vistos**.

A ordem segue a data de estreia. Dois episódios da mesma série que estrearam no
mesmo instante são marcados juntos.

### Fica atualizado sozinho

Enquanto a interface estiver aberta, o servidor verifica o Crunchyroll **a cada
15 minutos**, sempre 2 minutos depois da marca: `:02`, `:17`, `:32`, `:47`. Esse
atraso é de propósito — um episódio marcado para as 09:00 leva alguns segundos
até entrar no catálogo, e consultar em cima da hora traria a lista sem ele.

Quando a semana na tela inclui hoje, a barra de cima mostra o frescor dos dados:

```
● verificado há 3 minutos
```

Verde quer dizer em dia, o ponto pulsa durante a verificação e fica laranja se
passaram duas janelas sem sucesso. A tela se atualiza sozinha quando chega
coisa nova — sem recarregar a página.

### As previsões

Os dias da semana corrente que ainda não chegaram repetem o que saiu sete dias
antes, com um visual bem diferente: **arte em cinza, contorno tracejado e o selo
`PREVISTO`** no lugar do número do episódio. Nada ali é um episódio confirmado.

A previsão erra em dois casos, e não há como evitá-los:

- **Fim de temporada.** Uma série de 12 episódios acaba e outra ocupa o horário.
  O Crunchyroll não expõe isso: o campo `number_of_episodes` conta os episódios
  *já publicados* e `is_complete` vem `false` até para séries encerradas.
- **Datas especiais.** Feriados e imprevistos no Japão suspendem a programação.

Por isso a previsão nunca arrisca um número de episódio, e cada card mostra em
quantas das últimas 4 semanas aquela série realmente saiu naquele dia — *"saiu
em 4 das últimas 4 semanas"* é um padrão firme, *"só na semana passada"* pede
desconfiança. O erro também se desfaz sozinho: na semana seguinte a previsão já
parte de uma semana sem aquele lançamento, e a série some da grade.

Dias que **já passaram** nunca recebem previsão. Um dia vazio no passado é um
fato, e preenchê-lo seria inventar um lançamento que não houve.

### Idioma

A interface está em **inglês** e **português**, e escolhe sozinha a partir do
idioma do navegador — `pt-BR`, `pt-PT` ou qualquer variante de português abre em
português; o resto abre em inglês. As bandeiras no canto superior direito
trocam a qualquer momento, e a escolha fica guardada.

A tradução vai além do texto: o idioma define também o formato das datas e
horas. Em inglês a semana aparece como `10/26 – 11/01` com horários em 12 h
(`09:30 AM`) e episódios como `S1 E4`; em português vira `26/10 – 01/11`, 24 h
(`09:30`) e `T1 E4`.

> Os **títulos e descrições dos episódios** não são traduzidos pela interface:
> vêm prontos do Crunchyroll no idioma de `CR_LOCALE` e ficam gravados assim no
> banco. Para tê-los em inglês, use `CR_LOCALE=en-US` e colete de novo.

### Vendo semanas antigas

As setas voltam no tempo até onde houver dados. A coleta normal enxerga cerca de
duas semanas para trás; para ir além, favorite as séries que te interessam e use
**Preencher histórico dos favoritos** no painel lateral. Ele percorre temporada
por temporada — em testes trouxe episódios de 2013.

Rodando o coletor de forma contínua, o histórico se acumula sozinho.

---

## Comandos

```bash
npm run web          # só a interface
npm run collect      # busca os lançamentos recentes
npm run watch        # fica coletando em segundo plano
npm run backfill     # histórico completo das séries favoritadas
npm run stats        # estado do banco e um gráfico dos últimos 7 dias
```

Alguns aceitam opções:

```bash
# coleta mais funda, para encher o histórico de uma vez
node packages/collector/src/cli.js collect --pages 10

# histórico completo de uma série específica
node packages/collector/src/cli.js backfill --series GQWH0M19X

# coletar a cada 30 min em vez de 15
node packages/collector/src/cli.js watch --interval 30
```

### Configuração

Opcional. Copie `.env.example` para `.env` e ajuste o que quiser:

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `TZ_DISPLAY` | `America/Sao_Paulo` | Fuso usado para agrupar por dia |
| `CR_LOCALE` | `pt-BR` | Idioma dos títulos e descrições vindos do Crunchyroll |
| `PORT` | `5173` | Porta da interface |
| `DB_PATH` | `./data/anime-week.db` | Onde fica o banco |
| `COLLECT_INTERVAL_MIN` | `15` | Intervalo entre verificações |
| `COLLECT_OFFSET_SEC` | `120` | Atraso sobre a marca do relógio |
| `COLLECT_PAGES` | `2` | Páginas buscadas por verificação |
| `AUTO_COLLECT` | `1` | `0` desliga a coleta automática |

Seus dados ficam todos em `data/anime-week.db`, um arquivo SQLite comum. Para
começar do zero, é só apagá-lo. Para levar os favoritos para outra máquina,
copie o arquivo.

### Rodando no Docker

Para deixar o calendário sempre no ar — e acessível de fora por um túnel — há
uma imagem pronta em `infra/`. Só é preciso o
[Docker Desktop](https://www.docker.com/products/docker-desktop/):

```bash
npm run deploy
```

Isso gera a imagem e (re)cria o container `anime-week`, que volta sozinho junto
com o Docker. Abra **http://localhost:5180**. Rode o mesmo comando depois de cada
alteração para publicar a versão nova.

- **Porta:** o app escuta na 5173 dentro do container e é publicado na **5180**
  do host, para não brigar com o `npm run web`.
- **Dados:** o banco fica em `infra/data/anime-week.db`, fora da imagem. Para
  levar os favoritos que você já tem, copie `data/anime-week.db` para lá antes do
  primeiro `deploy`.
- **Configuração:** opcional, em `infra/.env` (modelo em `infra/.env.example`).
- **URL externa:** aponte um hostname público do
  [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
  para `http://localhost:5180`.

> **O app não tem login.** Quem tiver a URL pode favoritar, marcar episódios
> como vistos e disparar coletas. Antes de publicar, coloque uma regra de acesso
> na frente (o Cloudflare Access, por exemplo).

---

## Problemas comuns

**O calendário está vazio.**
Rode `npm run collect` ou clique em **Atualizar**. Na primeira execução o banco
está vazio mesmo.

**`EADDRINUSE: address already in use :::5173`.**
Já existe algo na porta. Use outra: `PORT=5174 npm run web` (no PowerShell,
`$env:PORT=5174; npm run web`).

**`node:sqlite` não existe / erro de módulo.**
Sua versão do Node é anterior à 22.5. Confira com `node -v`.

**A coleta falha com erro de HTTP.**
Confira se o `curl` está disponível (`curl --version`). O Crunchyroll fica
atrás do Cloudflare e, se a sua região estiver bloqueada ou a rede exigir
proxy, a coleta não passa.

**Os horários não batem com os do site.**
Ajuste `TZ_DISPLAY` no `.env` para o seu fuso.

---

## Como funciona

### Como os episódios novos são separados das dublagens

Cada dublagem é publicada pelo Crunchyroll como um item próprio, com id e data
próprios. Quando uma série ganha dublagem nova, os episódios antigos entram no
feed de recém-adicionados carimbados com a data de hoje. Medindo na prática:
**~86% do feed é esse ruído** — uma página de 100 itens chegou a trazer 24
episódios da mesma série, todos no mesmo horário.

A separação tem duas camadas:

1. A requisição usa `is_dubbed=false`, e a API devolve só as versões de áudio
   original.
2. Localmente, cada item ainda é conferido contra o próprio `versions[]`
   (`original: true`), e episódios são colapsados pela identidade
   `série|temporada|episódio`. Entre duplicatas vence a estreia **mais antiga**,
   então uma re-publicação nunca empurra um episódio velho para a semana atual.

Resultado: o banco só contém áudios originais (`ja-JP`, `zh-CN`, `ko-KR`…), sem
nenhum locale de dublagem.

### As cores

A paleta sai do CSS do próprio Crunchyroll, escolhida pelo que mais aparece
por lá: `#8c8c8c` (463 ocorrências), `#151515` (188), `#000` (172), `#ff640a`
(141) e `#272727` (130). Vale notar que o laranja da marca hoje é **#ff640a** —
o `#f47521`, mais conhecido, é o antigo. O ciano `#00eee0` e o dourado
`#fab818` completam o conjunto, usados aqui no destaque do dia de hoje e nos
favoritos. As barras de rolagem seguem a mesma paleta.

### Por que curl e não o `fetch` do Node

O Crunchyroll fica atrás do Cloudflare, que faz fingerprint do stack TLS. O
`fetch` nativo do Node (undici) leva um desafio 403 mesmo mandando todos os
headers de um navegador; o curl passa. Por isso todo o tráfego sai por
`child_process` + curl.

### Autenticação

Usa o token anônimo do player web (`grant_type=client_id`), sem conta nem
credenciais suas. O calendário lista tudo, inclusive o que é premium — assistir
é que continua exigindo login no site.

### Fusos

As datas da API vêm em UTC. O agrupamento por dia usa o fuso de `TZ_DISPLAY`,
então um episódio das 01:30 UTC cai no dia anterior, como você veria no site. A
consulta ao banco abre ±2 dias de folga em UTC e o recorte final é feito pela
chave de dia local.

### Endpoints usados

| Endpoint | Para quê |
| --- | --- |
| `POST /auth/v1/token` | Token anônimo |
| `/content/v2/discover/browse?type=episode` | Feed de lançamentos |
| `/content/v2/discover/seasonal_tags` | Temporadas (`fall-2026`…) |
| `/content/v2/cms/series/{id}` | Capas oficiais da série |
| `/content/v2/cms/series/{id}/seasons` | Backfill |
| `/content/v2/cms/seasons/{id}/episodes` | Backfill |

A página `/simulcastcalendar`, que seria a fonte mais direta, foi descontinuada
— hoje redireciona para `/simulcasts`.

### Sobre a temporada na URL da série

Não é possível abrir a série já numa temporada específica. Verificado no
navegador: `?season=<id>` é ignorado, e trocar de temporada pelo próprio site
muda o conteúdo sem alterar a URL. O `season_id` do episódio fica guardado no
banco caso isso mude algum dia.

---

## Estrutura

Monorepo com npm workspaces, sem dependências de terceiros e sem etapa de build.

```
packages/
├── core/         biblioteca compartilhada
│   ├── http.js         transporte via curl
│   ├── crunchyroll.js  cliente da API
│   ├── normalize.js    filtro de dublagem e deduplicação
│   ├── dates.js        semanas, fusos e dias locais
│   ├── schedule.js     grade de coleta (intervalo + offset)
│   └── db.js           SQLite, via node:sqlite nativo
├── collector/    CLI de coleta e backfill
└── web/          API HTTP + interface
    ├── src/      servidor (node:http, sem framework)
    └── public/   calendário (HTML/CSS/JS puros) + i18n.js
infra/            Dockerfile, docker-compose.yml e o data/ do container
```

O banco guarda, para cada lançamento, o suficiente para reabri-lo anos depois
sem nova consulta à API: URL do episódio, URL da série, thumbnail, temporada,
descrição, duração e horário de estreia. Colunas novas entram por `ALTER TABLE`
na abertura, então bancos antigos migram sozinhos.

---

## Aviso

Projeto pessoal, sem vínculo com a Crunchyroll LLC. Usa endpoints públicos do
site para montar um calendário de uso próprio, no mesmo ritmo de quem navega
pelo site. Não baixa, não redistribui e não dá acesso a nenhum vídeo —
assistir continua sendo no Crunchyroll, com a sua conta.
