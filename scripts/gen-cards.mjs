/** Title and end cards for the demo video, 1920×1080, in the site's type and palette. */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

mkdirSync("docs/video", { recursive: true });
const head = `<meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,400..600;1,9..144,400..600&display=swap" rel="stylesheet">
<style>
  body { margin:0; width:1920px; height:1080px; background:#faf8f4; font-family:"Public Sans", system-ui, sans-serif; color:#1b1f24; position:relative; overflow:hidden; }
  .halo { position:absolute; inset:0; background: radial-gradient(60% 50% at 20% 0%, rgba(19,78,94,.10) 0%, transparent 70%), radial-gradient(40% 40% at 90% 20%, rgba(138,90,11,.08) 0%, transparent 70%); }
  .bar { position:absolute; inset:0 0 auto 0; height:14px; background:#134e5e; }
  .wrap { position:absolute; left:140px; right:140px; top:120px; }
  .brand { font-family:"Fraunces", serif; font-variation-settings:"opsz" 32, "SOFT" 40; font-weight:600; color:#134e5e; font-size:52px; }
  h1 { font-family:"Fraunces", serif; font-variation-settings:"opsz" 144, "SOFT" 30; font-weight:500; font-size:104px; line-height:1.02; margin:40px 0 0; color:#134e5e; letter-spacing:-.022em; }
  h1 span { color:#1b1f24; } h1 em { font-style:italic; font-variation-settings:"opsz" 144, "SOFT" 60, "WONK" 1; }
  p { font-size:36px; line-height:1.4; color:#4f5b62; margin:36px 0 0; max-width:1500px; }
  .stats { position:absolute; left:140px; right:140px; bottom:90px; display:flex; gap:80px; border-top:1px solid rgba(19,78,94,.12); padding-top:40px; }
  .stat b { display:block; font-family:"Fraunces", serif; font-weight:500; font-size:76px; color:#134e5e; letter-spacing:-.02em; font-variant-numeric: tabular-nums; }
  .stat span { font-size:26px; color:#4f5b62; display:block; max-width:380px; margin-top:6px; line-height:1.3; }
  .src { position:absolute; right:140px; bottom:40px; font-size:22px; color:#4f5b62; }
  .urls { position:absolute; left:140px; bottom:100px; font-size:40px; color:#134e5e; line-height:1.6; }
  .urls small { display:block; font-size:24px; color:#4f5b62; letter-spacing:.02em; margin-top:8px; }
  .legal { position:absolute; right:140px; bottom:100px; font-size:28px; color:#4f5b62; text-align:right; }
</style>`;

const title = `<!doctype html><html><head>${head}</head><body><div class="halo"></div><div class="bar"></div>
<div class="wrap"><div class="brand">Overturn</div>
<h1>Your insurer said no.<br><span>Understand why. Know your deadline. <em>Answer back.</em></span></h1>
<p>Understand and contest a health insurance denial. Information, not legal advice.</p></div>
<div class="stats">
  <div class="stat"><b>19%</b><span>of in-network claims on HealthCare.gov were denied in 2024</span></div>
  <div class="stat"><b>&lt; 1%</b><span>of those denials were appealed</span></div>
  <div class="stat"><b>34%</b><span>of the appeals that were filed succeeded</span></div>
</div><div class="src">Source: KFF, 2024</div></body></html>`;

const end = `<!doctype html><html><head>${head}</head><body><div class="halo"></div><div class="bar"></div>
<div class="wrap"><div class="brand">Overturn</div>
<h1>Understand the letter.<br><span>Know the deadline. <em>Answer back.</em></span></h1>
<p>The model reads. The code decides. You send.</p></div>
<div class="urls">overturn-peach.vercel.app<small>LIVE</small><br>github.com/Chinorab/overturn<small>SOURCE · MIT</small></div>
<div class="legal">Information, not legal advice.<br>Nothing stored. Built for LexHack 2026.</div></body></html>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
for (const [name, html] of [["card-title", title], ["card-end", end]]) {
  await p.setContent(html); await p.waitForLoadState("load"); await p.waitForTimeout(800);
  await p.screenshot({ path: `docs/video/${name}.png` }); console.log("wrote", name);
}
await b.close();
