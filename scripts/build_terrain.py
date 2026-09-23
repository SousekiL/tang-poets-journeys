#!/usr/bin/env python3
"""Fetch Natural Earth's Gray Earth shaded relief and crop it to the map extent.

  assets/terrain.jpg   plate carree relief image, lon 58-142 / lat 8-60

app.js reprojects it per-pixel into the site's conic projection at load time,
so this file just needs to cover every place the map can show (incl. Suyab).

  python3 scripts/build_terrain.py    # needs Pillow (system python3 has it)
"""
import io
import urllib.request
import zipfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
URL = "https://naciscdn.org/naturalearth/50m/raster/GRAY_50M_SR_OB.zip"
LON0, LON1, LAT0, LAT1 = 58, 142, 8, 60
OUT = ROOT / "assets" / "terrain.jpg"


def main() -> None:
    with urllib.request.urlopen(URL, timeout=120) as r:
        zf = zipfile.ZipFile(io.BytesIO(r.read()))
    tif = next(n for n in zf.namelist() if n.lower().endswith(".tif"))
    img = Image.open(io.BytesIO(zf.read(tif))).convert("L")
    w, h = img.size

    # georeference from the world file if present, else assume global plate carree
    tfw = next((n for n in zf.namelist() if n.lower().endswith((".tfw", ".wld"))), None)
    if tfw:
        px, _ry, _rx, py, x0, y0 = [float(v) for v in zf.read(tfw).decode().split()]
        x_lo = (LON0 - x0) / px
        x_hi = (LON1 - x0) / px
        y_lo = (LAT1 - y0) / py
        y_hi = (LAT0 - y0) / py
    else:
        x_lo, x_hi = (LON0 + 180) / 360 * w, (LON1 + 180) / 360 * w
        y_lo, y_hi = (90 - LAT1) / 180 * h, (90 - LAT0) / 180 * h
    box = (int(x_lo), int(y_lo), int(x_hi), int(y_hi))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.crop(box).save(OUT, quality=84)
    print(f"wrote {OUT} {OUT.stat().st_size // 1024}KB, crop {box} of {w}x{h}")


if __name__ == "__main__":
    main()
