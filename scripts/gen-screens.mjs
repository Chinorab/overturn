/**
 * Renders the three product screens shown on the home page, light and dark, from the
 * MRI sample (the same case as the hero). The app chrome is hidden so the page does not
 * show a header inside a header. Usage: BASE=http://localhost:3000 node scripts/gen-screens.mjs
 */
import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = "public/screens";
const HIDE = "header.sticky, nav[aria-label=Progress], nextjs-portal, .fixed.bottom-0 { display: none !important } body::before { display: none !important }";
const browser = await chromium.launch();

async function capture(name, theme, prepare) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 2, colorScheme: theme });
  const page = await ctx.newPage();
  await page.addInitScript((t) => {
    try {
      localStorage.setItem("overturn.theme", t);
    } catch {}
  }, theme);
  await page.goto(`${BASE}/start`);
  await page.getByRole("button", { name: /MRI denied/ }).click();
  await page.getByRole("heading", { name: "Here is what your document says" }).waitFor();
  await page.addStyleTag({ content: HIDE });
  await prepare(page);
  await page.mouse.move(0, 0); // no hover affordances in the capture
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}${theme === "dark" ? "-dark" : ""}.png` });
  await ctx.close();
  console.log("wrote", name, theme);
}

const toRights = async (page) => {
  await page.getByRole("button", { name: /Continue: my rights/ }).click();
  await page.getByRole("heading", { name: "Your rights and deadlines" }).waitFor();
  await page.addStyleTag({ content: HIDE });
};
const toLetter = async (page) => {
  await page.getByRole("button", { name: "Draft my appeal letter" }).click();
  await page.getByRole("heading", { name: "Your appeal letter" }).waitFor();
  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(800);
};
const scrollToHeading = async (page, name) => {
  await page.getByRole("heading", { name }).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16));
};

for (const theme of ["light", "dark"]) {
  await capture("understand", theme, async (page) => {
    await scrollToHeading(page, "Here is what your document says");
  });
  await capture("rights", theme, async (page) => {
    await toRights(page);
    await scrollToHeading(page, "Your deadlines");
  });
  await capture("letter", theme, async (page) => {
    await toRights(page);
    await toLetter(page);
    await page.locator("section[aria-labelledby=letter]").evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 16));
  });
}
await browser.close();
