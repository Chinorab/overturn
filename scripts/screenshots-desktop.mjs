/**
 * Desktop-format screenshots for the Devpost gallery, from a running instance.
 * Usage: BASE=https://overturn-peach.vercel.app node scripts/screenshots-desktop.mjs
 * Output: docs/screenshots/desktop/*.png (1440×900 at 1.5×)
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "docs/screenshots/desktop";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();

async function shot(name, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, colorScheme: "light" });
  const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem("overturn.theme", "light"); } catch {} });
  await fn(page);
  await page.mouse.move(0, 0);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await ctx.close();
  console.log("wrote", name);
}
const settle = (p) => p.waitForTimeout(2200);
const openSample = async (page, re) => {
  await page.goto(`${BASE}/start`); await settle(page);
  await page.getByRole("button", { name: re }).click();
  await page.getByRole("heading", { name: "Here is what your document says" }).waitFor();
  await page.waitForTimeout(800);
};
const toRights = async (page) => {
  await page.getByRole("button", { name: /Continue: my rights/ }).click();
  await page.getByRole("heading", { name: "Your rights and deadlines" }).waitFor();
  await page.waitForTimeout(800);
};
const toLetter = async (page) => {
  await page.getByRole("button", { name: "Draft my appeal letter" }).click();
  await page.getByRole("heading", { name: "Your appeal letter" }).waitFor();
  await page.waitForTimeout(1200);
};
const at = (page, locator, offset = 90) => locator.evaluate((el, o) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - o), offset);

await shot("01-home", async (p) => { await p.goto(`${BASE}/`); await settle(p); });
await shot("02-home-steps", async (p) => {
  await p.goto(`${BASE}/`); await settle(p);
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } });
  await at(p, p.getByRole("heading", { name: /Upload once/ }), 60); await p.waitForTimeout(1500);
});
await shot("03-start", async (p) => { await p.goto(`${BASE}/start`); await settle(p); });
await shot("04-understand", async (p) => { await openSample(p, /ER visit billed/); });
await shot("05-understand-quote", async (p) => {
  await openSample(p, /MRI denied/);
  const btn = p.getByRole("button", { name: "Where is this from?" }).first();
  await at(p, p.getByRole("heading", { name: /The facts, and where/ }), 80); await btn.click(); await p.waitForTimeout(400);
});
await shot("06-rights-questions", async (p) => { await openSample(p, /ER visit billed/); await toRights(p); });
await shot("07-rights-deadlines", async (p) => {
  await openSample(p, /MRI denied/); await toRights(p);
  await at(p, p.getByRole("heading", { name: "Your deadlines" }), 80);
  await p.getByText("How this date was calculated").first().click(); await p.waitForTimeout(400);
});
await shot("08-rights-nsa", async (p) => {
  await openSample(p, /ER visit billed/); await toRights(p);
  await at(p, p.getByRole("heading", { name: "What applies to your situation" }), 80);
});
await shot("09-letter", async (p) => {
  await openSample(p, /ER visit billed/); await toRights(p); await toLetter(p);
  await at(p, p.locator("section[aria-labelledby=letter]"), 70);
});
await shot("10-letter-send", async (p) => {
  await openSample(p, /ER visit billed/); await toRights(p); await toLetter(p);
  await at(p, p.getByRole("heading", { name: "What to attach" }), 80);
});
await shot("11-unsupported", async (p) => {
  await p.goto(`${BASE}/start`); await settle(p);
  await p.getByRole("button", { name: /Medicare Advantage denial/ }).click();
  await p.getByRole("heading", { name: /outside what Overturn covers/ }).waitFor(); await p.waitForTimeout(600);
});
await shot("12-learn", async (p) => { await p.goto(`${BASE}/learn`); await settle(p); });
await browser.close();
