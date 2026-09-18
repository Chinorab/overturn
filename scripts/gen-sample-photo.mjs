/**
 * Renders a sample letter as a "phone photo": the letter laid on a desk, slightly rotated,
 * soft shadow, JPEG. Shows the image path (no PDF) end to end.
 * Usage: node scripts/gen-sample-photo.mjs 07-experimental-ca-photo
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const id = process.argv[2] ?? "07-experimental-ca-photo";
const d = JSON.parse(readFileSync(path.join("data", "samples", `${id}.source.json`), "utf8"));
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const fmt = (iso) => {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
};

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  body { margin:0; width:1240px; height:1654px; background: radial-gradient(circle at 30% 20%, #cfc6b8, #8f8577 70%, #6e665b); font-family: Helvetica, Arial, sans-serif; overflow:hidden; }
  .paper { position:absolute; left:110px; top:70px; width:1000px; height:1500px; padding:70px 80px; box-sizing:border-box;
    background: linear-gradient(105deg, #fbfaf6 0%, #f4f2ec 55%, #ece9e2 100%); color:#1a1a1a; font-size:16.5px; line-height:1.5;
    transform: rotate(-2.4deg); box-shadow: 0 30px 60px rgba(0,0,0,.45), 0 4px 10px rgba(0,0,0,.25); }
  .paper:after { content:""; position:absolute; inset:0; background: linear-gradient(180deg, rgba(255,255,255,.18), rgba(0,0,0,.06) 60%, rgba(0,0,0,.12)); pointer-events:none; }
  .head { display:flex; justify-content:space-between; border-bottom:3px solid #1f3a5f; padding-bottom:10px; margin-bottom:22px; }
  .logo { font-weight:700; font-size:24px; color:#1f3a5f; letter-spacing:2px; }
  .small { font-size:12.5px; color:#444; text-align:right; }
  .box { border:1px solid #999; padding:10px 12px; margin:16px 0 18px; font-size:15px; }
  .box div { display:flex; } .box b { width:170px; }
  h1 { font-size:19px; margin:14px 0 10px; }
  p { margin:0 0 11px; }
  h2 { font-size:16px; margin:16px 0 6px; }
  .wm { position:absolute; left:120px; top:640px; transform:rotate(-30deg); font-size:64px; color:rgba(0,0,0,.08); font-weight:700; white-space:nowrap; }
  .foot { position:absolute; bottom:28px; left:80px; right:80px; font-size:11px; color:#666; text-align:center; }
</style></head><body>
<div class="paper">
  <div class="wm">SAMPLE - FICTIONAL DOCUMENT</div>
  <div class="head"><div class="logo">${esc(d.insurer.logo_text)}</div><div class="small">${esc(d.insurer.name)}<br>${esc(d.insurer.address)}<br>Member Services ${esc(d.insurer.phone)}</div></div>
  <p>${fmt(d.date)}</p>
  <p>${esc(d.member.name)}<br>${esc(d.member.address).replace(/\n/g, "<br>")}</p>
  <div class="box">
    <div><b>Member ID:</b><span>${esc(d.member.member_id)}</span></div>
    <div><b>Group:</b><span>${esc(d.member.group)}</span></div>
    <div><b>Reference #:</b><span>${esc(d.re.claim_number)}</span></div>
    <div><b>Provider:</b><span>${esc(d.re.provider)}</span></div>
    <div><b>Service:</b><span>${esc(d.re.service)}</span></div>
    <div><b>Date(s) of service:</b><span>${esc(d.re.service_date)}</span></div>
  </div>
  <h1>${esc(d.title)}</h1>
  <p>Dear ${esc(d.member.name.split(" ")[0])},</p>
  ${d.paragraphs.map((p) => `<p>${esc(p)}</p>`).join("")}
  <h2>${esc(d.appeal.heading)}</h2>
  <p>${esc(d.appeal.text)}</p>
  <p>${esc(d.appeal.external)}</p>
  <p style="margin-top:16px">Sincerely,<br>${esc(d.signature).replace(/\n/g, "<br>")}</p>
  <div class="foot">${esc(d.insurer.name)} · This is a synthetic document created for the Overturn demo. Names, identifiers, and addresses are fictional. Page 1 of 1</div>
</div>
</body></html>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1240, height: 1654 }, deviceScaleFactor: 1 });
await p.setContent(html);
await p.waitForTimeout(200);
const out = path.join("data", "samples", `${id}.jpg`);
await p.screenshot({ path: out, type: "jpeg", quality: 82 });
await b.close();
console.log("wrote", out);
