(() => {
  "use strict";

  const COLORS = { red: "#7a1f35", blue: "#1f3358", green: "#1e5a3c", gold: "#9a7b2f", plum: "#5b3a6b" };
  const POET_COLOR = {
    李白: COLORS.red, 杜甫: COLORS.blue, 王维: COLORS.green, 白居易: COLORS.gold,
    韩愈: COLORS.blue, 柳宗元: COLORS.green, 李商隐: COLORS.plum, 杜牧: COLORS.gold,
    苏轼: COLORS.red, 李清照: COLORS.plum, 陆游: COLORS.blue, 辛弃疾: COLORS.green,
    欧阳修: COLORS.gold, 王安石: COLORS.blue, 李煜: COLORS.red, 李璟: COLORS.plum,
  };
  // China main body (no South China Sea inset). MultiPoint avoids spherical polygon winding issues.
  const CHINA_FRAME = { type: "MultiPoint", coordinates: [[73.5, 39.5], [80, 45], [87, 49.2], [122.5, 53.6], [135, 48.3], [131, 43], [122, 39], [122.5, 25], [109.5, 18.2], [97.5, 21], [85, 27.5]] };
  const COUNTRY_LABELS = {
    MNG: [103, 46.5, "蒙古", "Mongolia"], KAZ: [70, 47.5, "哈萨克斯坦", "Kazakhstan"], KGZ: [74.5, 41.6, "吉尔吉斯斯坦", "Kyrgyzstan"],
    IND: [79, 22, "印度", "India"], VNM: [105.8, 20.6, "越南", "Vietnam"], PRK: [126.8, 40.3, "朝鲜", "N. Korea"],
    KOR: [128, 36.2, "韩国", "S. Korea"], JPN: [138.5, 36.8, "日本", "Japan"], RUS: [112, 56.5, "俄罗斯", "Russia"],
    MMR: [96, 21.5, "缅甸", "Myanmar"], NPL: [84, 28.3, "尼泊尔", "Nepal"], PAK: [69.5, 30, "巴基斯坦", "Pakistan"],
  };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s) => document.querySelector(s);

  const S = {
    lang: "zh", dyn: "tang", mode: "overview", poet: null,
    index: [], byName: new Map(), byId: new Map(),
    steps: [], active: -1, W: 0, H: 0, dpr: 1,
    cam: null, camAnim: null, scene: null, draws: new Map(), raf: 0,
  };
  window.__xingji = S;
  const t = (k, ...a) => { const v = I18N[S.lang][k]; return typeof v === "function" ? v(...a) : v; };

  // ---------------- map ----------------
  const svg = d3.select("#map"), world = d3.select("#world"), overlay = d3.select("#overlay");
  const canvas = $("#routes"), ctx = canvas.getContext("2d");
  let projection, geoPath, topo, routePaths = new Map();

  function freeArea() {
    const bar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bar")) || 56;
    if (S.W <= 760) return { x0: 8, y0: bar + 8, x1: S.W - 8, y1: S.H * 0.52 };
    const card = Math.min(380, S.W * 0.4) + 2 * Math.min(48, S.W * 0.035);
    return { x0: card + 16, y0: bar + 16, x1: S.W - 24, y1: S.H - 24 };
  }

  function setupProjection() {
    const r = $("#stage").getBoundingClientRect();
    S.W = r.width; S.H = r.height; S.dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = S.W * S.dpr; canvas.height = S.H * S.dpr;
    projection = d3.geoConicEqualArea().parallels([25, 47]).rotate([-105, 0])
      .fitExtent([[0, 0], [S.W, S.H]], CHINA_FRAME);
    geoPath = d3.geoPath(projection);
  }

  function drawBase() {
    world.selectAll("*").remove();
    const countries = topojson.feature(topo, topo.objects.countries).features;
    world.append("g").selectAll("path").data(countries).join("path")
      .attr("class", (d) => "land" + (d.properties.iso === "CHN" ? " cn" : "")).attr("d", geoPath);
    world.append("path").attr("class", "prov")
      .attr("d", geoPath(topojson.mesh(topo, topo.objects.provinces, (a, b) => a !== b)));
    world.append("path").attr("class", "coast")
      .attr("d", geoPath(topojson.mesh(topo, topo.objects.countries, (a, b) => a === b)));
    world.append("path").attr("class", "border")
      .attr("d", geoPath(topojson.mesh(topo, topo.objects.countries, (a, b) => a !== b)));
    world.append("g").attr("id", "clabels").selectAll("text")
      .data(Object.values(COUNTRY_LABELS)).join("text")
      .attr("class", "country-label")
      .attr("transform", ([x, y]) => `translate(${projection([x, y])})`)
      .text(([, , zh, en]) => S.lang === "zh" ? zh : en);
  }

  function buildRoutePaths() {
    routePaths = new Map();
    for (const p of S.index) {
      const path = new Path2D();
      p.route.forEach((ll, i) => { const [x, y] = projection(ll); i ? path.lineTo(x, y) : path.moveTo(x, y); });
      routePaths.set(p.id, path);
    }
  }

  // camera: view = [cx, cy, w] in base projected coords, w = visible width of the free area
  function viewForBox([[x0, y0], [x1, y1]], { kMin = 0, kMax = Infinity, pad = 0.82, minSpan = 0 } = {}) {
    const F = freeArea(), fw = F.x1 - F.x0, fh = F.y1 - F.y0;
    const bw = Math.max(x1 - x0, minSpan), bh = Math.max(y1 - y0, minSpan * fh / fw);
    let k = Math.min(fw / bw, fh / bh) * pad;
    k = Math.max(kMin, Math.min(kMax, k));
    return [(x0 + x1) / 2, (y0 + y1) / 2, fw / k];
  }
  function transformOf([cx, cy, w]) {
    const F = freeArea(), k = (F.x1 - F.x0) / w;
    return { k, x: (F.x0 + F.x1) / 2 - k * cx, y: (F.y0 + F.y1) / 2 - k * cy };
  }
  const homeView = () => viewForBox(geoPath.bounds(CHINA_FRAME), { pad: 0.96 });
  const homeK = () => transformOf(homeView()).k;
  function boxOf(points) {
    const xy = points.map((ll) => projection(ll));
    return [[d3.min(xy, (d) => d[0]), d3.min(xy, (d) => d[1])], [d3.max(xy, (d) => d[0]), d3.max(xy, (d) => d[1])]];
  }

  function flyTo(view) {
    if (!S.cam || reduced) { S.cam = view; S.camAnim = null; return kick(); }
    const interp = d3.interpolateZoom(S.cam, view);
    S.camAnim = { interp, start: performance.now(), dur: Math.max(700, Math.min(1600, interp.duration * 0.9)) };
    kick();
  }

  function animateDraw(key, to, dur = 1400) {
    const cur = S.draws.get(key);
    const from = cur ? currentDraw(cur, performance.now()) : 0;
    S.draws.set(key, reduced ? { from: to, to, start: 0, dur: 1 } : { from, to, start: performance.now(), dur });
    kick();
  }
  function currentDraw(d, now) {
    const u = Math.min(1, (now - d.start) / d.dur);
    return d.from + (d.to - d.from) * d3.easeCubicInOut(u);
  }

  function kick() { if (!S.raf) S.raf = requestAnimationFrame(frame); }
  function frame(now) {
    S.raf = 0;
    let running = false;
    if (S.camAnim) {
      const u = Math.min(1, (now - S.camAnim.start) / S.camAnim.dur);
      S.cam = S.camAnim.interp(d3.easeCubicInOut(u));
      if (u < 1) running = true; else S.camAnim = null;
    }
    for (const d of S.draws.values()) if (now - d.start < d.dur) running = true;
    render(now);
    if (running) kick();
  }

  // ---------------- rendering ----------------
  function render(now) {
    if (!S.cam) return;
    const tr = transformOf(S.cam);
    world.attr("transform", `translate(${tr.x},${tr.y}) scale(${tr.k})`);
    world.select("#clabels").selectAll("text").style("font-size", `${11 / tr.k}px`).style("letter-spacing", `${2 / tr.k}px`);
    world.select(".prov").attr("opacity", tr.k > homeK() * 1.3 ? 1 : 0.55);
    const sc = S.scene || {};
    drawCanvas(tr, sc);
    const scr = (ll) => { const [x, y] = projection(ll); return [x * tr.k + tr.x, y * tr.k + tr.y]; };
    overlay.selectAll("*").remove();
    if (S.mode === "overview") renderOverviewOverlay(sc, scr, now);
    else renderPoetOverlay(sc, scr, now, tr);
    updateScale(tr);
  }

  function drawCanvas(tr, sc) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const alpha = sc.canvasAlpha ?? 0.1;
    if (alpha <= 0) return;
    ctx.setTransform(S.dpr * tr.k, 0, 0, S.dpr * tr.k, S.dpr * tr.x, S.dpr * tr.y);
    ctx.strokeStyle = `rgba(31,27,22,${alpha})`;
    ctx.lineWidth = 0.8 / tr.k;
    ctx.lineJoin = "round";
    for (const p of S.index) if (p.dynasty === S.dyn) ctx.stroke(routePaths.get(p.id));
  }

  function partial(pts, u) {
    if (u <= 0 || pts.length === 0) return pts.slice(0, 1);
    const n = Math.min(pts.length - 1, Math.floor(u));
    const out = pts.slice(0, n + 1);
    const f = u - n;
    if (f > 0 && n + 1 < pts.length) {
      const [a, b] = [pts[n], pts[n + 1]];
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
    return out;
  }
  const line = d3.line();

  function renderOverviewOverlay(sc, scr, now) {
    const g = overlay.append("g");
    // faded poets underneath; current poets reversed so the first-named one is drawn on top
    const hs = sc.highlights || [];
    for (const h of hs.filter((x) => x.faded).concat(hs.filter((x) => !x.faded).reverse())) {
      const p = S.byName.get(h.name);
      if (!p) continue;
      const pts = p.route.map(scr);
      const d = S.draws.get("ov:" + p.id);
      const u = d ? currentDraw(d, now) : pts.length - 1;
      g.append("path").attr("class", "route").attr("d", line(partial(pts, u)))
        .attr("stroke", h.color).attr("stroke-width", h.faded ? 1.1 : 2.2).attr("stroke-opacity", h.faded ? 0.35 : 0.95);
      if (!h.faded) {
        const [bx, by] = pts[0];
        g.append("circle").attr("cx", bx).attr("cy", by).attr("r", 3.5).attr("fill", h.color).attr("class", "stop");
        const tip = partial(pts, u).at(-1);
        g.append("text").attr("class", "poet-tag").attr("x", tip[0] + 7).attr("y", tip[1] - 6)
          .attr("fill", h.color).text(S.lang === "zh" ? p.name : p.en);
      }
    }
  }

  function renderPoetOverlay(sc, scr, now, tr) {
    const P = S.poet;
    if (!P) return;
    const color = COLORS.red;
    const pts = P.stops.map((s) => scr([s.lng, s.lat]));
    const g = overlay.append("g");
    const d = S.draws.get("poet");
    const u = d ? currentDraw(d, now) : sc.upto ?? pts.length - 1;
    g.append("path").attr("class", "route ghost").attr("d", line(pts)).attr("stroke", color).attr("stroke-width", 1);
    g.append("path").attr("class", "route").attr("d", line(partial(pts, u)))
      .attr("stroke", color).attr("stroke-width", 2).attr("stroke-opacity", 0.9);

    const [f0, f1] = sc.focus || [-1, -1];
    // layers: future (faint) < visited < focus, so revisited places are not hidden by later ghost dots
    const future = g.append("g"), visitedG = g.append("g"), focusG = g.append("g");
    pts.forEach((p, i) => {
      const inFocus = i >= f0 && i <= f1;
      const visited = i <= u + 1e-6;
      if (!visited && !sc.showAll) {
        future.append("circle").attr("cx", p[0]).attr("cy", p[1]).attr("r", 1.4).attr("fill", color).attr("fill-opacity", 0.3);
        return;
      }
      (inFocus ? focusG : visitedG).append("circle").attr("cx", p[0]).attr("cy", p[1]).attr("r", inFocus ? 4 : 2.2)
        .attr("fill", color).attr("fill-opacity", inFocus ? 1 : 0.55).attr("class", "stop");
    });
    // birth + current marker
    const bpt = pts[0];
    g.append("circle").attr("cx", bpt[0]).attr("cy", bpt[1]).attr("r", sc.birth ? 7 : 4.5).attr("fill", "none")
      .attr("stroke", color).attr("stroke-width", 1.4);
    // disputed alternative birthplaces: dashed connector + hollow ring + label
    if (sc.birth && P.alt_birth) {
      for (const a of P.alt_birth) {
        const [ax, ay] = scr([a.lng, a.lat]);
        g.append("line").attr("class", "alt-link").attr("stroke", color)
          .attr("x1", bpt[0]).attr("y1", bpt[1]).attr("x2", ax).attr("y2", ay);
        g.append("circle").attr("class", "alt-birth").attr("cx", ax).attr("cy", ay).attr("r", 6).attr("stroke", color);
        g.append("text").attr("class", "place-label").attr("x", ax + 9).attr("y", ay - 5)
          .text(S.lang === "zh" ? `${a.zh}（存疑）` : `${a.en} (disputed)`);
      }
    }
    if (sc.current != null && pts[sc.current]) {
      const c = pts[sc.current];
      g.append("circle").attr("class", "halo").attr("cx", c[0]).attr("cy", c[1]).attr("r", 14).attr("stroke", color);
      g.append("circle").attr("cx", c[0]).attr("cy", c[1]).attr("r", 5).attr("fill", color).attr("class", "stop");
    }
    renderLabels(g, sc, pts, tr);
  }

  function renderLabels(g, sc, pts, tr) {
    const P = S.poet, idx = sc.labels || [];
    const taken = [];
    const F = freeArea();
    const seen = new Set();
    for (const i of idx) {
      const s = P.stops[i];
      if (!s) continue;
      const nm = S.lang === "zh" ? (s.place.modern + (s.place.ancient ? `（${s.place.ancient}）` : "")) : s.place.en;
      if (seen.has(nm)) continue;
      const [x, y] = pts[i];
      if (x < F.x0 - 40 || x > S.W || y < F.y0 - 20 || y > S.H) continue;
      const w = nm.length * (S.lang === "zh" ? 13 : 7) + 8, h = 16;
      const box = [x + 8, y - 14, x + 8 + w, y - 14 + h];
      if (taken.some((b) => !(box[2] < b[0] || box[0] > b[2] || box[3] < b[1] || box[1] > b[3]))) continue;
      taken.push(box); seen.add(nm);
      const tx = g.append("text").attr("class", "place-label" + (sc.smallLabels ? " small" : "")).attr("x", x + 8).attr("y", y - 3).text(nm);
      if (sc.years && s.y0) tx.append("tspan").attr("class", "yr").attr("dx", 5).text(s.y0);
    }
  }

  function updateScale(tr) {
    const F = freeArea(), cx = (F.x0 + F.x1) / 2, cy = (F.y0 + F.y1) / 2, px = 90;
    const a = projection.invert([(cx - tr.x) / tr.k, (cy - tr.y) / tr.k]);
    const b = projection.invert([(cx + px - tr.x) / tr.k, (cy - tr.y) / tr.k]);
    if (!a || !b) return;
    const km = d3.geoDistance(a, b) * 6371;
    const nice = [50, 100, 200, 250, 500, 1000, 2000].find((v) => v >= km * 0.6) || 2000;
    $("#scale").innerHTML = `<i style="width:${(nice / km) * px}px"></i>${nice} km`;
  }

  // ---------------- steps ----------------
  const stepsEl = $("#steps");
  let observer;

  function setSteps(steps) {
    S.steps = steps;
    S.active = -1;
    S.draws.clear();
    stepsEl.innerHTML = steps.map((s, i) => `<section class="step" data-i="${i}"><div class="card">${s.html()}</div></section>`).join("");
    wireCards();
    observer?.disconnect();
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) activate(+e.target.dataset.i);
    }, { rootMargin: "-45% 0px -45% 0px" });
    stepsEl.querySelectorAll(".step").forEach((el) => observer.observe(el));
    activate(0);
  }

  function refreshStepText() {
    stepsEl.querySelectorAll(".step").forEach((el, i) => { el.querySelector(".card").innerHTML = S.steps[i].html(); });
    wireCards();
  }

  function wireCards() {
    stepsEl.querySelectorAll("[data-poet]").forEach((b) => b.addEventListener("click", () => openPoet(+b.dataset.poet)));
    stepsEl.querySelectorAll("[data-act]").forEach((b) => b.addEventListener("click", () => {
      const a = b.dataset.act;
      if (a === "overview") openOverview();
      if (a === "search") { $("#poet-input").focus(); }
      if (a === "top") window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    }));
  }

  function activate(i) {
    if (i === S.active || !S.steps[i]) return;
    const prev = S.active;
    S.active = i;
    S.steps[i].enter(prev);
    kick();
  }

  // ---------------- overview mode ----------------
  function poetBtn(name) {
    const p = S.byName.get(name);
    if (!p) return "";
    return `<button class="btn" data-poet="${p.id}">${S.lang === "zh" ? p.name : p.en}</button>`;
  }

  function overviewSteps() {
    const story = STORY[S.dyn];
    const list = S.index.filter((p) => p.dynasty === S.dyn);
    const nStops = d3.sum(list, (p) => p.n);
    const steps = [{
      html: () => story.intro[S.lang](list.length, nStops.toLocaleString()),
      enter: () => { S.scene = { canvasAlpha: 0.13, highlights: [] }; flyTo(homeView()); },
    }];
    const shown = [];
    story.steps.forEach((st) => {
      const present = st.poets.filter((n) => S.byName.has(n));
      const before = shown.slice();
      shown.push(...present.filter((n) => !shown.includes(n)));
      steps.push({
        html: () => st[S.lang] + `<div class="btns">${present.map(poetBtn).join("")}</div>`,
        enter: () => {
          const highlights = before.filter((n) => !present.includes(n)).map((n) => ({ name: n, color: POET_COLOR[n] || COLORS.red, faded: true }))
            .concat(present.map((n) => ({ name: n, color: POET_COLOR[n] || COLORS.red })));
          S.scene = { canvasAlpha: 0.06, highlights };
          present.forEach((n, j) => { const p = S.byName.get(n); S.draws.delete("ov:" + p.id); animateDraw("ov:" + p.id, p.route.length - 1, 1800 + j * 300); });
          const box = boxOf(present.flatMap((n) => S.byName.get(n).route));
          flyTo(viewForBox(box, { kMin: homeK(), kMax: homeK() * 2 }));
        },
      });
    });
    steps.push({
      html: () => story.outro[S.lang] + `<div class="btns">${story.outro.picks.map(poetBtn).join("")}</div>`,
      enter: () => {
        S.scene = { canvasAlpha: 0.12, highlights: shown.map((n) => ({ name: n, color: POET_COLOR[n] || COLORS.red, faded: true })) };
        flyTo(homeView());
      },
    });
    return steps;
  }

  function openOverview(push = true) {
    S.mode = "overview"; S.poet = null;
    if (push) setHash();
    setSteps(overviewSteps());
    window.scrollTo(0, 0);
  }

  // ---------------- poet mode ----------------
  const L = (o) => (o && typeof o === "object" ? (o[S.lang] ?? o.zh) : o) ?? "";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function placeName(s) {
    return S.lang === "zh"
      ? esc(s.place.modern + (s.place.ancient ? `（${s.place.ancient}）` : "") + (s.place.spot || ""))
      : esc(s.place.en);
  }

  function poemsHtml(stops, wanted) {
    let poems = stops.flatMap((s) => s.poems).filter((p) => p.excerpt);
    if (wanted?.length) {
      // look in this stage first, then anywhere in the poet's data (dates in sources don't always match the stage)
      const nt = (s) => s.replace(/[\s·・，,。（）()]/g, "");
      const all = S.poet.stops.flatMap((s) => s.poems).filter((p) => p.excerpt);
      const find = (pool, w) => pool.filter((p) => nt(p.title).includes(nt(w))).sort((a, b) => a.title.length - b.title.length)[0];
      const hit = wanted.map((w) => find(poems, w) || find(all, w)).filter((p, i, arr) => p && arr.indexOf(p) === i);
      if (hit.length) poems = hit;
    }
    return poems.slice(0, 2).map((p) => `<div class="poem"><div class="t">《${esc(p.title)}》${p.date ? " · " + esc(p.date) : ""}</div><div class="x">${esc(p.excerpt)}</div></div>`).join("");
  }

  function poetSteps(P) {
    const n = P.stops.length, stages = P.stages || [];
    const allLL = P.stops.map((s) => [s.lng, s.lat]);
    const overview = viewForBox(boxOf(allLL), { kMin: homeK() * 0.8, kMax: homeK() * 4 });
    const kOv = transformOf(overview).k;
    const importance = (i) => { const s = P.stops[i]; return s.works * 2 + s.events.join("").length / 20 + s.poems.length * 3; };
    const topIdx = (from, to, k) => d3.range(from, to + 1).sort((a, b) => importance(b) - importance(a)).slice(0, k);
    const lifespan = t("lifespan", P.birth, P.death);
    const refs = P.refs ? `<div class="src">${t("refs")}：${esc(P.refs)}<br>${t("source")}</div>` : `<div class="src">${t("source")}</div>`;
    const steps = [];

    steps.push({
      html: () => {
        const intro = P.intro ? `<p class="lead">${L(P.intro)}</p>` : `<p class="lead">${S.lang === "zh"
          ? `${esc(P.name)}一生留下 ${n} 处行迹，到过 ${P.places} 个地方。`
          : `${esc(P.en)} left ${n} recorded stops across ${P.places} places.`}</p>`;
        return `<p class="kicker">${t("overviewKicker")} · ${esc(S.lang === "zh" ? P.period : P.period_en)}</p>
          <h2>${esc(S.lang === "zh" ? P.name : P.en)}</h2>
          <p class="en-name">${S.lang === "zh" ? esc(P.en) : esc(P.name)} · ${lifespan}</p>${intro}
          <div class="stats"><div><b>${n}</b><span>${t("stops")}</span></div><div><b>${P.places}</b><span>${t("places")}</span></div>
          <div><b>${P.km.toLocaleString()}</b><span>${t("km")}</span></div><div><b>${P.works}</b><span>${t("works")}</span></div></div>
          ${P.curated ? "" : `<p class="raw-note">${t("rawNote")}</p>`}<p class="note">${t("scrollHint")}</p>${refs}`;
      },
      enter: () => {
        S.scene = { canvasAlpha: 0.035, upto: n - 1, focus: [-1, -1], labels: [0, n - 1, ...topIdx(0, n - 1, 10)], smallLabels: true, showAll: true };
        S.draws.delete("poet"); animateDraw("poet", n - 1, reduced ? 1 : 2200);
        flyTo(overview);
      },
    });

    const b = P.stops[0];
    steps.push({
      html: () => {
        const evs = `<ul class="events">${b.events.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
        const text = P.birth_note ? `<p>${L(P.birth_note)}</p>` : (S.lang === "zh" ? evs : `<p class="raw-note">${t("rawEn")}</p>${evs}`);
        return `<p class="kicker">${t("birthKicker")} · ${esc(b.label || P.birth || "")}</p><h3>${placeName(b)}</h3>${text}${poemsHtml([b])}`;
      },
      enter: () => {
        S.scene = { canvasAlpha: 0.03, upto: 0, focus: [0, 0], current: 0, birth: true, labels: [0], years: true };
        animateDraw("poet", 0, 600);
        const birthLL = [[b.lng, b.lat], ...(P.alt_birth || []).map((a) => [a.lng, a.lat])];
        flyTo(viewForBox(boxOf(birthLL), { kMin: homeK() * 0.55, kMax: kOv * 1.6, minSpan: 40 }));
      },
    });

    stages.forEach((st, si) => {
      const seg = P.stops.slice(st.from, st.to + 1);
      steps.push({
        html: () => {
          const ages = seg.map((s) => s.age).filter(Boolean);
          const ageTxt = ages.length ? " · " + t("age", ages[0].split("-")[0] + (ages.length > 1 || ages[0].includes("-") ? "–" + ages.at(-1).split("-").at(-1) : "")) : "";
          const yrs = st.y0 ? ` · ${st.y0}${st.y1 && st.y1 !== st.y0 ? "–" + st.y1 : ""}` : "";
          let body;
          if (st.text) body = `<p>${L(st.text)}</p>`;
          else {
            const evs = (st.events || []).slice(0, 5).map((e) => `<li>${esc(e)}</li>`).join("");
            body = `${S.lang === "en" ? `<p class="raw-note">${t("rawEn")}</p>` : ""}<ul class="events">${evs}</ul>`;
          }
          const places = [...new Set(seg.map((s) => (S.lang === "zh" ? s.place.modern : s.place.en.split(" (")[0])))];
          const chips = places.slice(0, 10).map((p) => `<span>${esc(p)}</span>`).join("") + (places.length > 10 ? `<span>${t("moreStops", places.length - 10)}</span>` : "");
          return `<p class="kicker">${t("stageKicker", si + 1, stages.length)}${yrs}${ageTxt}</p><h3>${esc(L(st.title))}</h3>${body}${poemsHtml(seg, st.poems)}<div class="chips">${chips}</div>`;
        },
        enter: () => {
          S.scene = { canvasAlpha: 0.02, upto: st.to, focus: [st.from, st.to], current: st.to, labels: topIdx(st.from, st.to, 7), years: true };
          animateDraw("poet", st.to, Math.min(2400, 500 + (st.to - st.from) * 90));
          const ll = P.stops.slice(Math.max(0, st.from - 1), st.to + 1).map((s) => [s.lng, s.lat]);
          flyTo(viewForBox(boxOf(ll), { kMin: kOv, kMax: kOv * 2.6, minSpan: 60 }));
        },
      });
    });

    const last = P.stops[n - 1];
    steps.push({
      html: () => {
        const who = S.lang === "zh" ? P.name : P.en;
        const outro = P.outro ? `<p>${L(P.outro)}</p>` : "";
        return `<p class="kicker">${t("endKicker")} · ${lifespan}</p><h3>${esc(t("endTitle", who, S.lang === "zh" ? last.place.modern : last.place.en.split(" (")[0], last.y1 || P.death))}</h3>${outro}
          <div class="btns"><button class="btn primary" data-act="search">${t("another")}</button><button class="btn" data-act="overview">${t("backOverview")}</button></div>${refs}`;
      },
      enter: () => {
        S.scene = { canvasAlpha: 0.05, upto: n - 1, focus: [n - 1, n - 1], current: n - 1, labels: [0, n - 1, ...topIdx(0, n - 1, 8)], smallLabels: true, showAll: true };
        animateDraw("poet", n - 1, 900);
        flyTo(overview);
      },
    });
    return steps;
  }

  async function openPoet(id, push = true) {
    const meta = S.byId.get(id);
    if (!meta) return;
    if (meta.dynasty !== S.dyn && STORY[meta.dynasty]) { S.dyn = meta.dynasty; $("#dynasty").value = S.dyn; }
    const P = await fetch(`data/poets/${id}.json`).then((r) => r.json());
    S.mode = "poet"; S.poet = P;
    $("#poet-input").value = S.lang === "zh" ? P.name : P.en;
    if (push) setHash();
    setSteps(poetSteps(P));
    window.scrollTo(0, 0);
  }

  // ---------------- controls ----------------
  const input = $("#poet-input"), list = $("#poet-list");
  let hits = [], sel = -1;
  const featured = () => new Set([...STORY[S.dyn].outro.picks]);
  const norm = (s) => s.toLowerCase().replace(/[\s'’-]/g, "");

  function search(q) {
    const pool = S.index.filter((p) => p.dynasty === S.dyn);
    const f = featured();
    if (!q) return pool.filter((p) => f.has(p.name)).concat(pool.filter((p) => !f.has(p.name)).sort((a, b) => b.n - a.n)).slice(0, 60);
    const nq = norm(q);
    const all = S.index.filter((p) => p.name.includes(q) || norm(p.en).includes(nq) || p.en.split(" ").map((w) => w[0]).join("").toLowerCase() === nq);
    return all.sort((a, b) => (a.dynasty === S.dyn ? 0 : 1) - (b.dynasty === S.dyn ? 0 : 1) || b.n - a.n).slice(0, 60);
  }

  function showList() {
    hits = search(input.value.trim());
    sel = -1;
    const f = featured();
    list.innerHTML = hits.length ? hits.map((p, i) => `<li role="option" id="opt-${i}" data-id="${p.id}"><span class="nm">${f.has(p.name) ? '<span class="star">★</span> ' : ""}${esc(p.name)} <small>${esc(p.en)}</small></span><span class="meta">${p.birth ?? "?"}–${p.death ?? "?"} · ${p.n}</span></li>`).join("")
      : `<li aria-disabled="true">${t("noMatch")}</li>`;
    list.hidden = false; input.setAttribute("aria-expanded", "true");
  }
  function hideList() { list.hidden = true; input.setAttribute("aria-expanded", "false"); }
  function highlight(i) {
    sel = Math.max(0, Math.min(hits.length - 1, i));
    list.querySelectorAll("li").forEach((li, j) => li.setAttribute("aria-selected", j === sel));
    list.querySelector(`#opt-${sel}`)?.scrollIntoView({ block: "nearest" });
    input.setAttribute("aria-activedescendant", `opt-${sel}`);
  }
  input.addEventListener("focus", () => { input.select(); showList(); });
  input.addEventListener("input", showList);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); highlight(sel + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); highlight(sel - 1); }
    else if (e.key === "Enter") { const p = hits[sel >= 0 ? sel : 0]; if (p) { hideList(); input.blur(); openPoet(p.id); } }
    else if (e.key === "Escape") { hideList(); input.blur(); }
  });
  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest("li[data-id]");
    if (li) { e.preventDefault(); hideList(); input.blur(); openPoet(+li.dataset.id); }
  });
  input.addEventListener("blur", () => setTimeout(hideList, 120));

  $("#dynasty").addEventListener("change", (e) => { S.dyn = e.target.value; input.value = ""; openOverview(); });
  $("#brand").addEventListener("click", (e) => { e.preventDefault(); input.value = ""; openOverview(); });
  $("#lang").addEventListener("click", () => { setLang(S.lang === "zh" ? "en" : "zh"); setHash(); });

  function setLang(l) {
    S.lang = l;
    document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
    $("#lang").textContent = l === "zh" ? "EN" : "中";
    document.title = l === "zh" ? "行迹 · 唐宋诗人行旅图" : "Xingji · Journeys of Tang & Song Poets";
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    if (topo) drawBase();
    if (S.poet) input.value = l === "zh" ? S.poet.name : S.poet.en;
    if (S.steps.length) refreshStepText();
    kick();
  }

  function setHash() {
    const h = new URLSearchParams();
    if (S.mode === "poet" && S.poet) h.set("poet", S.poet.id); else h.set("dynasty", S.dyn);
    if (S.lang === "en") h.set("lang", "en");
    history.replaceState(null, "", "#" + h.toString());
  }
  function readHash() { return new URLSearchParams(location.hash.slice(1)); }

  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      setupProjection(); drawBase(); buildRoutePaths();
      const i = S.active; S.active = -1; S.cam = null; activate(Math.max(0, i));
    }, 200);
  });

  // ---------------- boot ----------------
  async function boot() {
    const h = readHash();
    setLang(h.get("lang") === "en" ? "en" : "zh");
    if (STORY[h.get("dynasty")]) { S.dyn = h.get("dynasty"); $("#dynasty").value = S.dyn; }
    const loading = document.createElement("div");
    loading.className = "loading"; loading.textContent = t("loading");
    $("#stage").appendChild(loading);
    const [tp, idx] = await Promise.all([
      fetch("data/basemap/basemap.topo.json").then((r) => r.json()),
      fetch("data/poets_index.json").then((r) => r.json()),
    ]);
    loading.remove();
    topo = tp; S.index = idx;
    for (const p of idx) { S.byId.set(p.id, p); if (!S.byName.has(p.name)) S.byName.set(p.name, p); }
    setupProjection(); drawBase(); buildRoutePaths();
    const pid = +h.get("poet");
    if (pid && S.byId.has(pid)) openPoet(pid, false); else openOverview(false);
  }
  boot();
})();
