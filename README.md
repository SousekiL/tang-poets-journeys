# 行迹 · 唐宋诗人行旅图 / Journeys of Tang & Song Poets

A scroll-driven bilingual (中文/English) map of where Tang, Five Dynasties and
Song poets actually went — 360 poets, ~14,000 recorded stops, drawn on a
paper-textured map of China and its neighbours.

Open `index.html` over any static file server. No build step, no framework;
D3 v7 + TopoJSON from `assets/vendor/`.

```bash
python3 -m http.server 8765   # then visit http://127.0.0.1:8765/
```

## What you see

- **Overview mode** (default): every route of the selected dynasty drawn at
  once in faint ink; scrolling introduces individual poets one by one.
- **Poet mode** (`#poet=<id>`): full route → birthplace → one screen per life
  stage → final resting place, with rewritten bilingual notes and the poems
  attached to each stop.
- Disputed locations (e.g. Li Bai's Suyab vs Jiangyou birthplaces) are drawn
  as dashed markers rather than silently resolved.
- Filters: dynasty (唐 / 五代 / 宋) and a poet search that accepts Chinese
  names or pinyin. State lives in the URL hash (`#dynasty=tang`,
  `#poet=15188`, `&lang=en`).

## Data

All itineraries come from **唐宋文学编年地图 / 搜韵 (cnkgraph.com)**,
fetched through its `Biography` API and cached under `data/raw/cnkgraph/`
(not committed — ~49 MB). Per-poet JSON in `data/poets/` and the
`data/poets_index.json` manifest are generated; do not hand-edit them.

The curated stage texts in `data/curated/` are rewritten summaries with
added historical context, not copies of the source prose. Each poet file
keeps the source's own bibliography (`refs`) and compilers.

**Use restrictions:** the underlying data is published for research and
learning; it is not ours. Contact 搜韵 before any commercial reuse. The site
attributes the source in the footer and on every poet page.

### Rebuilding

```bash
# 1. fetch raw payloads (resumable; caches into data/raw/cnkgraph/)
.venv/bin/python scripts/fetch_cnkgraph.py

# 2. raw -> poets_index.json + data/poets/<id>.json (needs pypinyin)
.venv/bin/python scripts/build_data.py

# 3. basemap: Natural Earth (China-POS admin-0) + China provinces -> topojson
scripts/build_basemap.sh   # requires ogr2ogr, topojson-server/-simplify
```

Curated narratives live in `data/curated/<姓名或 id>.json`; each stage gives a
`years` range which `build_data.py` maps onto the poet's stops. Unmatched
stages warn and are skipped. Optional per-poet fields: `intro`, `birth_note`,
`alt_birth` (list of disputed birthplaces, drawn dashed), `outro`.

## Map notes

- Projection: Albers-style conic equal area (parallels 25°/47°N, centred on
  105°E), framed on the Chinese mainland — no nine-dash line, no South China
  Sea inset.
- Admin-0 boundaries use Natural Earth's China point-of-view dataset;
  province boundaries come from the same lineage. Taiwan, Hong Kong, Macau
  and surrounding countries render where the data supports them.

## Layout

```
index.html            shell: sticky map + scroll steps + controls
assets/app.js         map, camera, route drawing, scrolly engine
assets/story.js       overview narration per dynasty (zh/en)
assets/i18n.js        UI strings (zh/en)
data/curated/         hand-written stage texts for featured poets
data/poets/           generated per-poet data (do not edit)
scripts/              fetch / build pipelines
```
