#!/usr/bin/env python3
"""Fetch the complete 唐宋文学编年地图 (cnkgraph.com/Map/PoetLife) dataset.

Step 1 enumerates every author by sweeping year windows of /Api/Biography
(each window returns one trace per author active in it), merged with
data/authors_seed.txt. Step 2 downloads each author's full biography payload
and caches it gzipped under data/raw/cnkgraph/.

Source policy: cnkgraph Web API is for research / learning, non-commercial use.
Keep the request rate low and credit the source.

  python3 scripts/fetch_cnkgraph.py            # enumerate + fetch missing
  python3 scripts/fetch_cnkgraph.py --refresh  # re-download everything
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "cnkgraph"
AUTHORS = ROOT / "data" / "authors.json"
SEED = ROOT / "data" / "authors_seed.txt"
BASE = "https://cnkgraph.com/Api/Biography"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Referer": "https://cnkgraph.com/Map/PoetLife",
    "Accept": "application/json, text/javascript, */*; q=0.01",
}
TITLE_RE = re.compile(r"^(?P<name>[^\s(（]+)\s*[(（](?P<b>[^—\-–)）]*)[—\-–](?P<d>[^)）]*)[)）]")


def get(query: str) -> dict:
    url = f"{BASE}?{query}"
    for attempt in range(5):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=120) as r:
                raw = r.read().decode("utf-8").strip()
            if not raw:
                raise ValueError("empty response")
            return json.loads(raw)
        except Exception as e:  # noqa: BLE001
            if attempt == 4:
                raise
            print(f"  retry {attempt + 1}: {e}", file=sys.stderr)
            time.sleep(1.5 * 2**attempt)
    raise RuntimeError("unreachable")


def plain(html: str | None) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


def enumerate_authors(delay: float) -> list[str]:
    cache_path = RAW.parent / "enum_windows.json"
    cache: dict[str, list[str]] = json.loads(cache_path.read_text(encoding="utf-8")) if cache_path.exists() else {}
    # Windows after 1330 return HTTP 500 on the server side; the Tang–Song scope ends well before that.
    windows = [(lo, lo + 9) for lo in range(590, 1330, 10)]
    while windows:
        lo, hi = windows.pop(0)
        key = f"{lo}-{hi}"
        if key in cache:
            continue
        try:
            payload = get(f"scope=&author=&beginYear={lo}&endYear={hi}")
        except Exception as e:  # noqa: BLE001
            if hi > lo:  # server sometimes fails on busy windows; split in half
                mid = (lo + hi) // 2
                windows[:0] = [(lo, mid), (mid + 1, hi)]
                print(f"[enum] {key} failed ({e}); splitting")
            else:
                print(f"[enum] {key} failed ({e}); skipped", file=sys.stderr)
            continue
        found = [m.group("name") for t in payload.get("Traces") or []
                 if (m := TITLE_RE.match(plain(t.get("Title"))))]
        cache[key] = found
        cache_path.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        print(f"[enum] {key}: {len(found)}")
        time.sleep(delay)
    return sorted({n for v in cache.values() for n in v})


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--delay", type=float, default=0.8)
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--skip-enum", action="store_true")
    args = ap.parse_args()
    RAW.mkdir(parents=True, exist_ok=True)

    seed = [s.strip() for s in SEED.read_text(encoding="utf-8").splitlines() if s.strip()]
    if args.skip_enum and AUTHORS.exists():
        authors = json.loads(AUTHORS.read_text(encoding="utf-8"))
    else:
        swept = enumerate_authors(args.delay)
        authors = sorted(set(swept) | set(seed))
        AUTHORS.write_text(json.dumps(authors, ensure_ascii=False, indent=0), encoding="utf-8")
        print(f"[enum] swept {len(swept)}, merged with seed -> {len(authors)} authors")

    failed = []
    for i, name in enumerate(authors, 1):
        out = RAW / f"{name}.json.gz"
        if out.exists() and not args.refresh:
            continue
        q = f"scope=&author={urllib.parse.quote(name)}&beginYear=0&endYear=0"
        try:
            payload = get(q)
        except Exception as e:  # noqa: BLE001
            print(f"[warn] {name}: {e}", file=sys.stderr)
            failed.append(name)
            continue
        if not payload.get("Traces"):
            print(f"[warn] {name}: no traces", file=sys.stderr)
            failed.append(name)
        else:
            with gzip.open(out, "wt", encoding="utf-8") as f:
                json.dump(payload, f, ensure_ascii=False)
            print(f"[ok] ({i}/{len(authors)}) {name}")
        time.sleep(args.delay)
    print(f"done; failed: {failed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
