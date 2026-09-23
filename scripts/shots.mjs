// Dev helper: screenshot each scroll step.  node scripts/shots.mjs "<hash>" [width] [height] [steps...]
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || "playwright");

const [hash = "", w = "1280", h = "800", ...only] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
page.on("console", (m) => m.type() === "error" && console.log("console:", m.text()));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto(`http://127.0.0.1:8765/${hash}`);
await page.waitForSelector(".step");
await page.waitForTimeout(2500);
const n = await page.$$eval(".step", (s) => s.length);
const steps = only.length ? only.map(Number) : [...Array(n).keys()];
for (const i of steps) {
  await page.evaluate((i) => document.querySelectorAll(".step")[i].scrollIntoView({ block: "center" }), i);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: `data/tmp/shot-${i}.png` });
}
console.log("steps", n);
await browser.close();
