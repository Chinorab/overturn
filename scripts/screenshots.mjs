/**
 * Takes the Devpost / README screenshots from a running instance.
 * Usage: BASE=http://localhost:3000 node scripts/screenshots.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "docs/screenshots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function phone(name, fn, { full = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "light" });
  const page = await ctx.newPage();
  await fn(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  await ctx.close();
  console.log("wrote", name);
}

async function desktop(name, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, colorScheme: "light" });
  const page = await ctx.newPage();
  await fn(page);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await ctx.close();
  console.log("wrote", name);
}

const openSample = async (page, re) => {
  await page.goto(`${BASE}/`);
  await page.getByRole("button", { name: re }).click();
  await page.getByRole("heading", { name: "Here is what your document says" }).waitFor();
};
const toRights = async (page) => {
  await page.getByRole("button", { name: /Continue: my rights/ }).click();
  await page.getByRole("heading", { name: "Your rights and deadlines" }).waitFor();
};
const toLetter = async (page) => {
  await page.getByRole("button", { name: "Draft my appeal letter" }).click();
  await page.getByRole("heading", { name: "Your appeal letter" }).waitFor();
  await page.waitForTimeout(600);
};

await phone("01-landing", async (p) => {
  await p.goto(`${BASE}/`);
});

await phone("02-understand-summary", async (p) => {
  await openSample(p, /ER visit billed/);
});

await phone("03-understand-quote", async (p) => {
  await openSample(p, /MRI denied/);
  const btn = p.getByRole("button", { name: "Where is this from?" }).nth(8);
  await btn.scrollIntoViewIfNeeded();
  await btn.click();
  await p.locator("blockquote").first().scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, -200));
});

await phone("04-rights-questions", async (p) => {
  await openSample(p, /ER visit billed/);
  await toRights(p);
  await p.getByText("Where does your health plan come from?").scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, -80));
});

await phone("05-rights-nsa", async (p) => {
  await openSample(p, /ER visit billed/);
  await toRights(p);
  await p.locator("article").first().scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, -90));
});

await phone("06-deadline-clock", async (p) => {
  await openSample(p, /MRI denied/);
  await toRights(p);
  const clock = p.getByRole("heading", { name: "Your deadlines" });
  await clock.scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, -20));
  await p.getByText("How this date was calculated").first().click();
});

await phone("07-letter", async (p) => {
  await openSample(p, /ER visit billed/);
  await toRights(p);
  await toLetter(p);
});

await phone("08-letter-send", async (p) => {
  await openSample(p, /ER visit billed/);
  await toRights(p);
  await toLetter(p);
  await p.getByRole("heading", { name: "What to attach" }).scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, -20));
});

await phone("09-unsupported", async (p) => {
  await p.goto(`${BASE}/`);
  await p.getByRole("button", { name: /Medicare Advantage denial/ }).click();
  await p.getByRole("heading", { name: /outside what Overturn covers/ }).waitFor();
});

await phone("11-learn", async (p) => {
  await p.goto(`${BASE}/learn`);
});

await desktop("10-desktop-rights", async (p) => {
  await openSample(p, /ER visit billed/);
  await toRights(p);
  await p.getByRole("heading", { name: "Your deadlines" }).scrollIntoViewIfNeeded();
  await p.evaluate(() => window.scrollBy(0, -40));
});

await browser.close();
