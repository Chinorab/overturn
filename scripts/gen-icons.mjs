/**
 * Renders the Fraunces "O" used by the app icons, in paper white on a transparent
 * background. scripts/gen-icons.py then centres it on the brand teal and writes
 * app/icon.png, app/apple-icon.png and app/favicon.ico.
 *
 *   node scripts/gen-icons.mjs && python scripts/gen-icons.py
 *
 * Two cuts: the display optical size for the large icons, and the text optical size
 * (sturdier hairlines) for the 16–48 px favicon, where the thin strokes would vanish.
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const CUTS = [
  { name: "display", opsz: 144, weight: 600 },
  { name: "text", opsz: 9, weight: 700 },
];
const font = `<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400..800&display=swap" rel="stylesheet">`;

mkdirSync("tmp-icons", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1200 } });
for (const cut of CUTS) {
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8">${font}<style>
      html, body { margin:0; background:transparent; }
      div { width:1200px; height:1200px; display:flex; align-items:center; justify-content:center;
            font-family:"Fraunces", serif; font-size:900px; line-height:1; color:#faf8f4;
            font-weight:${cut.weight}; font-variation-settings:"opsz" ${cut.opsz}; }
    </style></head><body><div>O</div></body></html>`,
    { waitUntil: "networkidle" },
  );
  await page.evaluate(() => document.fonts.ready);
  await page.locator("div").screenshot({ path: `tmp-icons/glyph-${cut.name}.png`, omitBackground: true });
}
await browser.close();
