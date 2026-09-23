#!/usr/bin/env bash
# Build data/basemap/basemap.topo.json
#   countries: Natural Earth 10m admin-0, China point-of-view edition
#              (Taiwan, 藏南, 阿克赛钦 inside China; HK/Macau merged into China)
#   provinces: DataV (Aliyun) China provinces, nine-dash feature removed; used only for internal lines
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=data/tmp
mkdir -p "$TMP" data/basemap
[ -f "$TMP/ne_10m_admin_0_countries_chn.shp" ] || {
  curl -sL -o "$TMP/chn.zip" https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries_chn.zip
  (cd "$TMP" && unzip -o -q chn.zip)
}
[ -f "$TMP/datav.json" ] || curl -sL -o "$TMP/datav.json" https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json

python3 - <<'EOF'
import json
d = json.load(open("data/tmp/datav.json"))
d["features"] = [f for f in d["features"] if isinstance(f["properties"].get("adcode"), int)]
for f in d["features"]:
    p = f["properties"]
    f["properties"] = {"adcode": p["adcode"], "name": p["name"]}
json.dump(d, open("data/tmp/provinces.json", "w"), ensure_ascii=False)
EOF

npx -y mapshaper@0.6.102 \
  -i "$TMP/ne_10m_admin_0_countries_chn.shp" name=countries \
  -clip bbox=25,-12,165,62 \
  -each 'iso = (ADM0_A3=="HKG"||ADM0_A3=="MAC") ? "CHN" : ADM0_A3, zh = NAME_ZH, en = NAME_EN' \
  -dissolve iso copy-fields=zh,en \
  -each 'if (iso=="CHN") { zh="中国"; en="China" }' \
  -simplify 8% keep-shapes \
  -filter-slivers min-area=30km2 \
  -i "$TMP/provinces.json" name=provinces \
  -simplify 6% keep-shapes \
  -o data/basemap/basemap.topo.json format=topojson target=countries,provinces combine-layers quantization=1e5
ls -la data/basemap
