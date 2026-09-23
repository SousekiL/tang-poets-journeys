#!/usr/bin/env python3
"""Turn cached cnkgraph payloads into front-end data.

  data/poets_index.json    one row per poet (for filters + overview routes)
  data/poets/<id>.json     full stops, poems, stages for one poet

Curated stage texts (data/curated/<id>.json) override the automatic stages.

  .venv/bin/python scripts/build_data.py
"""
from __future__ import annotations

import gzip
import json
import math
import re
from collections import Counter
from html import unescape
from pathlib import Path

from pypinyin import Style, lazy_pinyin

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw" / "cnkgraph"
OUT = ROOT / "data" / "poets"
CURATED = ROOT / "data" / "curated"
INDEX = ROOT / "data" / "poets_index.json"

TANG = {"初唐", "盛唐", "中唐", "晚唐", "唐"}
SONG = {"北宋", "南宋", "宋"}
PERIOD_EN = {"初唐": "Early Tang", "盛唐": "High Tang", "中唐": "Mid Tang", "晚唐": "Late Tang",
             "唐": "Tang", "五代": "Five Dynasties", "北宋": "Northern Song", "南宋": "Southern Song",
             "宋": "Song", "金": "Jin", "元": "Yuan", "隋": "Sui"}
SURNAME_FIX = {"单": "Shan", "尉迟": "Yuchi", "曾": "Zeng", "解": "Xie", "乐": "Yue", "万俟": "Moqi"}
COMPOUND_SURNAMES = {"欧阳": "Ouyang", "司马": "Sima", "上官": "Shangguan", "诸葛": "Zhuge",
                     "皇甫": "Huangfu", "夏侯": "Xiahou", "司空": "Sikong", "令狐": "Linghu",
                     "宇文": "Yuwen", "慕容": "Murong", "长孙": "Zhangsun", "公孙": "Gongsun",
                     "独孤": "Dugu", "司徒": "Situ", "尉迟": "Yuchi", "万俟": "Moqi"}


def plain(html: str | None, keep_comments: bool = False) -> str:
    t = html or ""
    if not keep_comments:
        t = re.sub(r"<span class='inlineComment2'>.*?</span>", "", t, flags=re.S)
    t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"\s+", " ", unescape(t)).strip()


def pinyin_name(name: str) -> str:
    for sur, en in {**COMPOUND_SURNAMES, **SURNAME_FIX}.items():
        if name.startswith(sur):
            rest = "".join(lazy_pinyin(name[len(sur):]))
            return f"{en} {rest.capitalize()}".strip()
    py = lazy_pinyin(name)
    if len(py) == 1:
        return py[0].capitalize()
    return f"{py[0].capitalize()} {''.join(py[1:]).capitalize()}"


def pinyin_place(name: str) -> str:
    return "".join(lazy_pinyin(name, style=Style.NORMAL)).capitalize() if name else ""


def split_place(title: str) -> dict:
    """'江油（昌明）大匡山' -> modern 江油, ancient 昌明, spot 大匡山."""
    m = re.match(r"^([^（(]+)(?:[（(]([^）)]+)[）)])?(.*)$", title.strip())
    modern, ancient, spot = (m.group(1), m.group(2) or "", m.group(3).strip()) if m else (title, "", "")
    return {"zh": title, "modern": modern.strip(), "ancient": ancient.strip(), "spot": spot,
            "en": pinyin_place(modern.strip()) + (f" ({pinyin_place(ancient)})" if ancient else "")}


def years(label: str) -> tuple[int | None, int | None]:
    ys = [int(y) for y in re.findall(r"(-?\d{3,4})年", label)]
    return (ys[0], ys[-1]) if ys else (None, None)


ITEM_RE = re.compile(r'onclick="ViewPoint\((\d+), (\d+)\)">(.*?)</div>', re.S)
POEM_RE = re.compile(
    r"<div id='poem_title_(\d+)' class='poemTitle[^']*'><a href='/Writing/\d+[^']*'[^>]*>(.*?)</a>"
    r"(?:<span class='authorDate'>(.*?)</span>)?<span class='poemAuthor'><span class='inlineComment1'>\s*([^·<]*)·\s*</span>"
    r"<a href='javascript: ShowPoemAuthorProfile\((\d+)", re.S)


def poem_excerpt(html: str, pid: str) -> str:
    lines = []
    for k in range(2):
        m = re.search(rf"id='poem_sentence_{k}_{pid}'>(.*?)<div id='poem_sentence_{k}_{pid}_comment'>", html, re.S)
        if m:
            s = plain(m.group(1))
            if s:
                lines.append(s)
    text = "".join(lines)
    return text[:60] + ("…" if len(text) > 60 else "")


def marker_blocks(detail: str, people_id: str) -> list[dict]:
    """Split a place marker's Detail into year blocks with events and the poet's own poems."""
    blocks = []
    parts = re.split(r"<div class='label1'", detail)
    for part in parts[1:]:
        ys = [int(y) for pair in re.findall(r"beginYear=(-?\d+)&endYear=(-?\d+)", part) for y in pair if y != "0"]
        y0, y1 = (min(ys), max(ys)) if ys else (None, None)
        poems = []
        starts = [m.start() for m in re.finditer(r"<div id='poem_title_\d+' class='poemTitle", part)]
        for a, b in zip(starts, starts[1:] + [len(part)]):
            chunk = part[a:b]
            head = re.match(r"<div id='poem_title_(\d+)'[^>]*><a [^>]*>(.*?)</a>", chunk, re.S)
            author = re.search(r"ShowPoemAuthorProfile\((\d+)", chunk)
            if not head or not author or author.group(1) != people_id:
                continue
            pid, title = head.groups()
            date = re.search(r"<span class='authorDate'>(.*?)</span>", chunk)
            period = re.search(r"<span class='inlineComment1'>\s*([^·<]*)·", chunk)
            title = re.sub(r"<sup.*?</sup>", "", title, flags=re.S)
            poems.append({"id": int(pid), "title": plain(title), "date": plain(date.group(1)).strip("（）()") if date else "",
                          "period": period.group(1).strip() if period else "", "excerpt": poem_excerpt(chunk, pid)})
        notes = [plain(n) for n in re.findall(r"<span class='inlineComment2'>(.*?)</span>", part, re.S)]
        blocks.append({"y0": y0, "y1": y1, "poems": poems, "notes": [n.strip("（）()") for n in notes if n]})
    return blocks


def haversine(a, b) -> float:
    lat1, lon1, lat2, lon2 = map(math.radians, (a["lat"], a["lng"], b["lat"], b["lng"]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(h))


def auto_stages(stops: list[dict]) -> list[dict]:
    """Stop 0 is the birthplace screen; the rest is cut into 6-18 geographically/temporally coherent stages."""
    n = len(stops)
    if n <= 1:
        return []
    rest = list(range(1, n))
    k = max(1, min(18, round(len(rest) / 7) if len(rest) > 12 else min(len(rest), 6)))
    k = min(k, len(rest))
    scores = []
    for i in rest[:-1]:
        a, b = stops[i], stops[i + 1]
        gap = max(0, (b["y0"] or 0) - (a["y1"] or a["y0"] or 0))
        prov = (a.get("region") or "")[:4] != (b.get("region") or "")[:4]
        scores.append((haversine(a, b) / 250 + gap / 2.5 + (0.8 if prov else 0), i))
    cuts: list[int] = []
    min_size = 2 if len(rest) >= 2 * k else 1
    for _, i in sorted(scores, reverse=True):
        if len(cuts) >= k - 1:
            break
        cand = sorted(cuts + [i])
        bounds = [0] + [c for c in cand] + [n - 1]
        sizes = [bounds[j + 1] - bounds[j] for j in range(len(bounds) - 1)]
        if min(sizes) >= min_size:
            cuts = cand
    stages, start = [], 1
    for c in cuts + [n - 1]:
        stages.append({"from": start, "to": c})
        start = c + 1
    return stages


def stage_auto_text(stops: list[dict], st: dict) -> dict:
    seg = stops[st["from"]: st["to"] + 1]
    places = [s["place"]["modern"] for s in seg]
    main = Counter(places).most_common(1)[0][0]
    uniq = list(dict.fromkeys(places))
    y0 = next((s["y0"] for s in seg if s["y0"] is not None), None)
    y1 = next((s["y1"] for s in reversed(seg) if s["y1"] is not None), None)
    title = "、".join(uniq[:3]) + ("等地" if len(uniq) > 3 else "")
    evs = []
    for s in seg:
        for e in s["events"]:
            if e not in evs:
                evs.append(e)
    return {"title": {"zh": title, "en": ", ".join(pinyin_place(p) for p in uniq[:3])},
            "main": main, "y0": y0, "y1": y1, "events": evs[:6]}


def resolve_curated(stops: list[dict], stages: list[dict]) -> list[dict]:
    """Curated stages give a year range; map it onto stop indices (stop 0 = birth screen)."""
    out, start = [], 1
    for i, st in enumerate(stages):
        last = i == len(stages) - 1
        end = len(stops) - 1 if last else start - 1
        while not last and end + 1 < len(stops) and (stops[end + 1]["y0"] or 0) <= st["years"][1]:
            end += 1
        if end < start:
            print(f"  [warn] curated stage {st['years']} {st['title']['zh']} matched no stops; skipped")
            continue
        auto = stage_auto_text(stops, {"from": start, "to": end})
        out.append({**auto, **st, "from": start, "to": end})
        start = end + 1
    return out


def clean_event(line: str) -> str:
    line = re.sub(r"^\s*-?\d{3,4}年[^，,]{0,6}[，,]\s*", "", line).strip()
    return line.rstrip("。") + "。" if line else ""


def parse(payload: dict) -> dict | None:
    t = payload["Traces"][0]
    title_html = t.get("Title") or ""
    pid = re.search(r"/People/(\d+)", title_html)
    head = plain(re.sub(r"<small.*", "", title_html, flags=re.S), keep_comments=True)
    m = re.match(r"^([^\s(（]+)\s*[(（]([^—\-–)）]*)[—\-–]([^)）]*)[)）]", head)
    if not (pid and m):
        return None
    name = m.group(1)
    b, d = years(m.group(2) + "年")[0], years(m.group(3) + "年")[0]
    detail = t.get("Detail") or ""
    refs = re.search(r"引用书目：(.*?)(?:　录入整理：(.*?))?</p>", detail, re.S)
    line_markers = (t.get("Lines") or [{}])[0].get("Markers") or []

    blocks_by_place: dict[str, list] = {}
    for mk in t.get("Markers") or []:
        blocks_by_place.setdefault(plain(mk.get("Title")), []).extend(marker_blocks(mk.get("Detail") or "", pid.group(1)))

    stops, used, periods = [], set(), Counter()
    for idx, _line, body in ITEM_RE.findall(detail):
        idx = int(idx)
        if idx >= len(line_markers):
            continue
        mk = line_markers[idx]
        place = plain(re.search(r'<span class="text-success">(.*?)</span>', body).group(1))
        meta = plain((re.search(r'<small class="text-secondary">(.*?)</small>', body) or [None, ""])[1])
        label = meta.split("，")[0]
        y0, y1 = years(label)
        if y0 is not None and y1 is not None and y0 > y1:
            y0, y1 = y1, y0
        age = re.search(r"(\d+(?:-\d+)?)岁", meta)
        works = re.search(r"作品：(\d+)", meta)
        events = [clean_event(plain(x)) for x in re.split(r"<br\s*/?>", body.split("</small>", 1)[-1])]
        poems, notes = [], []
        hi = y1 or y0
        for blk in blocks_by_place.get(place, []):
            if y0 is None or blk["y0"] is None:
                continue
            blk_hit = blk["y0"] <= hi and blk["y1"] >= y0
            for p in blk["poems"]:
                periods[p["period"]] += 1
                py = years(p["date"])[0] if p["date"] else None
                if p["id"] not in used and ((py is not None and y0 <= py <= hi) or (py is None and blk_hit)):
                    used.add(p["id"])
                    poems.append({k: v for k, v in p.items() if k != "period"})
            if blk_hit:
                notes.extend(n for n in blk["notes"] if n not in notes)
        stops.append({
            "place": split_place(place), "lat": round(mk["Latitude"], 4), "lng": round(mk["Longitude"], 4),
            "region": mk.get("RegionId") or "", "label": label, "y0": y0, "y1": y1,
            "age": age.group(1) if age else None, "works": int(works.group(1)) if works else 0,
            "events": [e for e in events if e], "poems": poems[:8], "notes": notes[:2],
        })
    if not stops:
        return None

    period = periods.most_common(1)[0][0] if periods else ""
    if "唐" in period and period != "南唐" or (not period and b and b < 890):
        dyn = "tang"
    elif "宋" in period or (not period and b and 950 < b < 1270):
        dyn = "song"
    elif period in ("五代", "南唐") or (not period and b and 890 <= b <= 950):
        dyn = "wudai"
    else:
        dyn = "other"
    total_km = sum(haversine(stops[i], stops[i + 1]) for i in range(len(stops) - 1))
    return {
        "id": int(pid.group(1)), "name": name, "en": pinyin_name(name), "birth": b, "death": d,
        "period": period, "period_en": PERIOD_EN.get(period, period), "dynasty": dyn,
        "refs": refs.group(1).strip() if refs else "", "compilers": (refs.group(2) or "").strip() if refs else "",
        "km": round(total_km), "places": len({s["place"]["modern"] for s in stops}),
        "works": sum(s["works"] for s in stops), "stops": stops,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for f in sorted(RAW.glob("*.json.gz")):
        with gzip.open(f, "rt", encoding="utf-8") as fh:
            poet = parse(json.load(fh))
        if not poet:
            print(f"[skip] {f.name}")
            continue
        cur_path = next((p for p in (CURATED / f"{poet['id']}.json", CURATED / f"{poet['name']}.json") if p.exists()), None)
        curated = json.loads(cur_path.read_text(encoding="utf-8")) if cur_path else None
        if curated:
            poet["stages"] = resolve_curated(poet["stops"], curated["stages"])
            poet["intro"] = curated.get("intro")
            poet["birth_note"] = curated.get("birth_note")
            poet["alt_birth"] = curated.get("alt_birth")
            poet["outro"] = curated.get("outro")
        else:
            poet["stages"] = [{**st, **stage_auto_text(poet["stops"], st)} for st in auto_stages(poet["stops"])]
        poet["curated"] = bool(curated)
        (OUT / f"{poet['id']}.json").write_text(json.dumps(poet, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        route = []
        for s in poet["stops"]:
            pt = [round(s["lng"], 2), round(s["lat"], 2)]
            if not route or route[-1] != pt:
                route.append(pt)
        index.append({"id": poet["id"], "name": poet["name"], "en": poet["en"], "dynasty": poet["dynasty"],
                      "period": poet["period"], "birth": poet["birth"], "death": poet["death"],
                      "n": len(poet["stops"]), "km": poet["km"], "curated": poet["curated"], "route": route})
    index.sort(key=lambda p: (p["birth"] or 9999, p["name"]))
    INDEX.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    c = Counter(p["dynasty"] for p in index)
    print(f"wrote {len(index)} poets: {dict(c)}")


if __name__ == "__main__":
    main()
