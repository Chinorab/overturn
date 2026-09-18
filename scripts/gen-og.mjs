/** Renders the Open Graph / social preview image to public/og.png (1200×630). */
import { chromium } from "@playwright/test";

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;600&family=Source+Serif+4:wght@600&display=swap" rel="stylesheet">
<style>
  body { margin:0; width:1200px; height:630px; background:#faf8f4; font-family:"Public Sans", system-ui, sans-serif; color:#1b1f24; position:relative; overflow:hidden; }
  .bar { position:absolute; inset:0 0 auto 0; height:10px; background:#134e5e; }
  .wrap { position:absolute; left:72px; top:70px; right:72px; }
  .brand { font-weight:600; color:#134e5e; font-size:28px; letter-spacing:-.01em; }
  h1 { font-family:"Source Serif 4", Georgia, serif; font-weight:600; font-size:64px; line-height:1.08; margin:26px 0 0; color:#134e5e; letter-spacing:-.01em; }
  h1 span { color:#1b1f24; }
  p { font-size:26px; line-height:1.4; color:#4f5b62; margin:26px 0 0; max-width:900px; }
  .pills { position:absolute; left:72px; bottom:56px; display:flex; gap:12px; }
  .pill { border:1.5px solid #d9dfe2; background:#fff; border-radius:999px; padding:10px 18px; font-size:20px; color:#134e5e; }
  .card { position:absolute; right:72px; bottom:56px; width:330px; background:#fffdf9; border:2px solid rgba(19,78,94,.35); border-radius:22px; padding:20px 22px; box-shadow:0 18px 40px rgba(0,0,0,.10); }
  .card .k { font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:#134e5e; font-weight:600; }
  .card .d { font-family:"Source Serif 4", serif; font-size:30px; font-weight:600; margin-top:8px; line-height:1.15; }
  .card .s { font-size:18px; color:#4f5b62; margin-top:6px; }
</style></head><body>
<div class="bar"></div>
<div class="wrap">
  <div class="brand">Overturn</div>
  <h1>Your insurer said no.<br><span>Understand why. Know your deadline. Answer back.</span></h1>
  <p>Reads your denial letter, shows the rights and deadlines that apply with the law behind each one, and drafts the appeal. Information, not legal advice.</p>
</div>
<div class="pills"><div class="pill">Free</div><div class="pill">Nothing stored</div><div class="pill">Sources for every rule</div></div>
<div class="card"><div class="k">Internal appeal deadline</div><div class="d">Sunday, March 7, 2027</div><div class="s">170 days left · 29 CFR 2560.503-1</div></div>
</body></html>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.setContent(html);
await p.waitForLoadState("networkidle");
await p.waitForTimeout(500);
await p.screenshot({ path: "public/og.png", type: "png" });
await b.close();
console.log("wrote public/og.png");
