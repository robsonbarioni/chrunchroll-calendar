# Anime Week

**English** · [Português](README.pt-BR.md)

A weekly calendar of **Crunchyroll** anime releases, Monday through Sunday,
running on your own machine. It shows the episodes that aired, forecasts the
days that have not arrived yet, and lets you favorite the series you follow.

![The week at a glance: today's column in full colour with the episodes that
already aired, and the following days greyed out with a FORECAST
badge](docs/screenshot.png)

<p align="center"><sub>
Monday with what already aired; the rest of the week greyed out, forecast from
the previous week.
</sub></p>

**Why it exists:** Crunchyroll's "recently added" list is not a list of new
episodes. When a series gets a new dub, its old episodes resurface at the top as
if they had just come out — in practice,
[~86% of that feed is this noise](#telling-new-episodes-from-dubs). This project
separates the real premieres from the rest.

---

## Getting started

There are two ways to run it: **directly with Node**, the simplest for trying it
out, or **in Docker**, to keep it always on in the background.

### With Node

You need **Node.js 22.5 or newer** ([download](https://nodejs.org)) and **curl**,
which already ships with Windows 10+, macOS and Linux.

No Crunchyroll account, no API key, no database to install. There are no
third-party dependencies to download either.

```bash
git clone https://github.com/robsonbarioni/chrunchroll-calendar.git
cd chrunchroll-calendar
npm install
npm start
```

Open **http://localhost:5173**. `npm start` runs the first collection and brings
up the interface; from then on, `npm run web` is enough.

> **Windows:** PowerShell, Command Prompt or Git Bash all work. The commands are
> the same.

### With Docker

You only need [Docker Desktop](https://www.docker.com/products/docker-desktop/)
— no Node or curl on the machine; the image brings both.

```bash
git clone https://github.com/robsonbarioni/chrunchroll-calendar.git
cd chrunchroll-calendar
npm run docker
```

Open **http://localhost:5180**. `npm run docker` builds the image and
(re)creates the `anime-week` container, which runs the collection on its own
every 15 minutes and comes back up whenever Docker starts. Run the same command
after any change to ship the new version.

```bash
npm run docker        # build the image and start (or recreate) the container
npm run docker:logs   # follow the container's log
npm run docker:stop   # stop and remove the container (the data stays)
```

> No Node installed? `npm` comes with it; without it, run the same thing with
> `docker compose -f infra/docker-compose.yml up -d --build`.

- **Port:** the app listens on 5173 inside the container and is published on
  **5180** on the host, so it does not clash with `npm run web`.
- **Data:** the database lives in `infra/data/anime-week.db`, outside the image,
  so rebuilding never loses favorites. To carry over what you already collected
  with Node, copy `data/anime-week.db` there before the first `npm run docker`.
- **Configuration:** optional, in `infra/.env` (template in
  `infra/.env.example`).
- **Exposing it outside your network:** a tunnel such as
  [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
  can point at `http://localhost:5180`.

> **The app has no login.** Whoever reaches it can favorite, mark episodes as
> watched and trigger collections. Before exposing it, put an access rule in
> front of it (Cloudflare Access, for example).

---

## Using it

| | |
| --- | --- |
| **‹ › Today** | Moves week by week. **←** and **→** work too |
| **✓** | Marks the episode as watched, along with every earlier one |
| **☆** | Favorites the series (the card itself opens the episode) |
| **▦** | Opens the series page on Crunchyroll |
| **★ Favorites only** | Hides everything you do not follow |
| **Forecast** | Turns the projection of upcoming days on and off |
| **Manage series** | Full list, searchable, for favoriting in bulk |
| **Language** | Dropdown with the flag: PT-BR or EN-US |
| **Refresh** | Forces a check right now, without waiting for the cycle |

Hovering a card brings up **that episode's still frame**, in a preview that
follows the cursor and flips sides near the screen edge. The card itself always
shows the series artwork, which does not change from one week to the next —
that is what makes each series recognisable at a glance in the grid.

### Keeping track of what you have watched

Marking an episode with **✓** also marks **every earlier episode** of that
series as watched, previous seasons included — there is no need to tick them one
by one. Watched cards are dimmed, so what is still left to see stands out.
Clicking **✓** again on a watched episode unmarks it and every episode after it.

Under **Manage series**, each series you have started marking shows whether you
are **up to date** or how many episodes are **unwatched**.

Order follows the premiere date. Two episodes of the same series that premiered
at the exact same moment are marked together.

### It keeps itself current

While the interface is open, the server checks Crunchyroll **every 15 minutes**,
always 2 minutes past the mark: `:02`, `:17`, `:32`, `:47`. That delay is
deliberate — an episode scheduled for 09:00 takes a few seconds to land in the
catalogue, and asking right on the hour would return the list without it.

When the week on screen includes today, the top bar shows how fresh the data is:

```
● checked 3 minutes ago
```

Green means up to date, the dot pulses during a check, and it turns orange if
two windows have gone by without success. The screen refreshes itself when
something new arrives — no page reload.

### The forecast

Days of the current week that have not arrived yet repeat what aired seven days
earlier, with a deliberately different look: **greyed-out artwork, a dashed
outline and a `FORECAST` badge** where the episode number would be. Nothing
there is a confirmed episode.

The forecast is wrong in two cases, and there is no way around them:

- **End of season.** A 12-episode series ends and another takes over the slot.
  Crunchyroll does not expose this: `number_of_episodes` counts the episodes
  *already published*, and `is_complete` stays `false` even for finished series.
- **Special dates.** Holidays and unexpected events in Japan suspend the
  schedule.

So the forecast never risks an episode number, and every card shows how many of
the last 4 weeks that series actually aired on that weekday — *"aired 4 of the
last 4 weeks"* is a steady pattern, *"only last week"* deserves scepticism. The
error also undoes itself: the following week the forecast starts from a week
without that release, and the series drops off the grid.

Days that have **already passed** never get a forecast. An empty day in the past
is a fact, and filling it in would be inventing a release that never happened.

### Language

The interface comes in **English** and **Portuguese**, and picks one from your
browser — `pt-BR`, `pt-PT` or any Portuguese variant opens in Portuguese,
everything else opens in English. The flags in the top right switch at any time,
and the choice is remembered.

The translation goes beyond the words: the language also drives date and time
formats. In English the week reads `10/26 – 11/01` with 12-hour times
(`09:30 AM`) and episodes as `S1 E4`; in Portuguese it becomes `26/10 – 01/11`,
24-hour (`09:30`) and `T1 E4`.

> **Episode titles and descriptions are not translated** by the interface: they
> arrive ready-made from Crunchyroll in whatever `CR_LOCALE` asks for, and are
> stored that way. For English ones, set `CR_LOCALE=en-US` and collect again.

### Looking at past weeks

The arrows go back as far as there is data. A normal collection sees about two
weeks into the past; to go further, favorite the series you care about and use
**Fetch full history of favorites** in the side panel. It walks season by
season — in testing it pulled episodes from 2013.

Leaving the collector running builds the history up on its own.

---

## Commands

```bash
npm run web          # interface only
npm run collect      # fetch recent releases
npm run watch        # keep collecting in the background
npm run backfill     # full history of favorited series
npm run stats        # database state and a chart of the last 7 days
```

Some take options:

```bash
# deeper collection, to fill the history in one go
node packages/collector/src/cli.js collect --pages 10

# full history of one specific series
node packages/collector/src/cli.js backfill --series GQWH0M19X

# collect every 30 min instead of 15
node packages/collector/src/cli.js watch --interval 30
```

### Configuration

Optional. Copy `.env.example` to `.env` and adjust what you want:

| Variable | Default | What it does |
| --- | --- | --- |
| `TZ_DISPLAY` | `America/Sao_Paulo` | Timezone used to group releases by day |
| `CR_LOCALE` | `pt-BR` | Language of titles and descriptions from Crunchyroll |
| `PORT` | `5173` | Interface port |
| `DB_PATH` | `./data/anime-week.db` | Where the database lives |
| `COLLECT_INTERVAL_MIN` | `15` | Interval between checks |
| `COLLECT_OFFSET_SEC` | `120` | Delay past the clock mark |
| `COLLECT_PAGES` | `2` | Pages fetched per check |
| `AUTO_COLLECT` | `1` | `0` turns automatic collection off |

All your data lives in `data/anime-week.db`, an ordinary SQLite file. To start
over, just delete it. To carry your favorites to another machine, copy it.

---

## Common problems

**The calendar is empty.**
Run `npm run collect` or click **Refresh**. On the first run the database really
is empty.

**`EADDRINUSE: address already in use :::5173`.**
Something is already on that port. Use another one: `PORT=5174 npm run web` (in
PowerShell, `$env:PORT=5174; npm run web`).

**`node:sqlite` does not exist / module error.**
Your Node is older than 22.5. Check with `node -v`.

**Collection fails with an HTTP error.**
Make sure `curl` is available (`curl --version`). Crunchyroll sits behind
Cloudflare, so if your region is blocked or your network needs a proxy, the
collection will not get through.

**The times do not match the website.**
Set `TZ_DISPLAY` in `.env` to your own timezone.

---

## How it works

### Telling new episodes from dubs

Crunchyroll publishes each dub as its own item, with its own id and its own
date. When a series gets a new dub, its old episodes enter the recently-added
feed stamped with today's date. Measured in practice: **~86% of the feed is this
noise** — one page of 100 items came back with 24 episodes of the same series,
all at the same timestamp.

The filtering happens in two layers:

1. The request uses `is_dubbed=false`, so the API returns only original-audio
   versions.
2. Locally, each item is still checked against its own `versions[]`
   (`original: true`), and episodes are collapsed by the identity
   `series|season|episode`. Among duplicates the **earliest** premiere wins, so a
   re-publication never pushes an old episode into the current week.

The result: the database holds original audio only (`ja-JP`, `zh-CN`, `ko-KR`…),
with no dub locales at all.

### The colours

The palette comes from Crunchyroll's own CSS, picked by what shows up most
there: `#8c8c8c` (463 occurrences), `#151515` (188), `#000` (172), `#ff640a`
(141) and `#272727` (130). Worth noting that the brand orange today is
**#ff640a** — the better-known `#f47521` is the old one. The cyan `#00eee0` and
the gold `#fab818` round it out, used here for today's highlight and for
favorites. The scrollbars follow the same palette.

### Why curl and not Node's `fetch`

Crunchyroll sits behind Cloudflare, which fingerprints the TLS stack. Node's
native `fetch` (undici) gets a 403 challenge even when sending every browser
header; curl gets through. So all traffic goes out via `child_process` + curl.

### Authentication

Uses the web player's anonymous token (`grant_type=client_id`), with no account
and none of your credentials. The calendar lists everything, premium included —
it is watching that still requires signing in on the site.

### Timezones

The API returns dates in UTC. Grouping by day uses the `TZ_DISPLAY` timezone, so
an episode at 01:30 UTC falls on the previous day, exactly as you would see it on
the site. The database query opens ±2 days of slack in UTC and the final cut is
made by the local day key.

### Endpoints used

| Endpoint | What for |
| --- | --- |
| `POST /auth/v1/token` | Anonymous token |
| `/content/v2/discover/browse?type=episode` | Release feed |
| `/content/v2/discover/seasonal_tags` | Seasons (`fall-2026`…) |
| `/content/v2/cms/series/{id}` | Official series artwork |
| `/content/v2/cms/series/{id}/seasons` | Backfill |
| `/content/v2/cms/seasons/{id}/episodes` | Backfill |

The `/simulcastcalendar` page, which would have been the most direct source, has
been retired — it now redirects to `/simulcasts`.

### On selecting a season in the series URL

It cannot be done. Verified in the browser: `?season=<id>` is ignored, and
switching seasons on the site itself changes the content without changing the
URL. The episode's `season_id` is kept in the database in case that ever
changes.

---

## Layout

A monorepo with npm workspaces, no third-party dependencies and no build step.

```
packages/
├── core/         shared library
│   ├── http.js         curl transport
│   ├── crunchyroll.js  API client
│   ├── normalize.js    dub filtering and deduplication
│   ├── dates.js        weeks, timezones and local days
│   ├── schedule.js     collection grid (interval + offset)
│   └── db.js           SQLite, via the native node:sqlite
├── collector/    collection and backfill CLI
└── web/          HTTP API + interface
    ├── src/      server (node:http, no framework)
    └── public/   calendar (plain HTML/CSS/JS) + i18n.js
infra/            Dockerfile, docker-compose.yml and the container's data/
```

For each release the database keeps enough to reopen it years later without
going back to the API: episode URL, series URL, thumbnail, season, description,
duration and premiere time. New columns arrive through `ALTER TABLE` on open, so
older databases migrate themselves.

---

## Disclaimer

A personal project, not affiliated with Crunchyroll LLC. It uses the site's
public endpoints to build a calendar for your own use, at the same pace as
someone browsing the site. It does not download, does not redistribute and gives
access to no video — watching still happens on Crunchyroll, with your account.
