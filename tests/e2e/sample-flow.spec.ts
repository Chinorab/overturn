import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * SC-001 / SC-006: the whole sample flow on a phone-sized viewport, keyboard-reachable,
 * with an axe scan on every screen. No API call is made (samples are cached).
 */
async function expectNoA11yViolations(page: import("@playwright/test").Page, screen: string) {
  // Scroll through once so scroll-revealed sections are shown, then let transitions finish: axe reads computed opacity.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForFunction(() => !document.querySelector('[data-reveal=""]'));
  await page.waitForTimeout(1000);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, `${screen}: ${serious.map((v) => `${v.id} (${v.nodes.length})`).join(", ")}`).toEqual([]);
}

async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("home: hero, primary call to action, and framing above the fold", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your insurer said no");
  await expect(page.getByText("Start with my document").first()).toBeInViewport();
  await expect(page.getByText(/Free · Nothing stored · No account/)).toBeVisible();
  await expect(page.getByText(/information, not legal advice/i).first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page, "home");
});

test("start: framing is visible above the fold, samples need no upload", async ({ page }) => {
  await page.goto("/start");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Nothing stored · Information, not legal advice/)).toBeInViewport();
  await expect(page.getByRole("tab", { name: /Try a sample/ })).toBeInViewport();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page, "landing");
});

test("sample flow: understand → rights → letter → download, on a phone", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: /ER visit billed out of network/ }).click();

  // Understand
  await expect(page.getByRole("heading", { name: "Here is what your document says" })).toBeVisible();
  await expect(page.getByText("Written by AI from your document")).toBeVisible();
  await expect(page.getByText(/180 days to file an internal appeal/)).toBeVisible();
  await page.getByRole("button", { name: "Where is this from?" }).first().click();
  await expect(page.locator("blockquote").first()).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page, "understand");
  await page.getByRole("button", { name: /Continue: my rights/ }).click();

  // Rights (sample defaults are pre-filled: TX, marketplace, emergency)
  await expect(page.getByRole("heading", { name: "Your rights and deadlines" })).toBeVisible();
  await expect(page.getByText("Emergency care: no surprise bills", { exact: false })).toBeVisible();
  const firstRule = page.locator("article").first();
  await expect(firstRule).toContainText("No Surprises Act");
  await expect(firstRule.getByRole("link", { name: /Source/ })).toHaveAttribute("href", /^https:\/\//);
  await expect(firstRule.getByText("From the rules dataset, not AI")).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page, "rights");
  await page.getByRole("button", { name: "Draft my appeal letter" }).click();

  // Letter (cached)
  await expect(page.getByRole("heading", { name: "Your appeal letter" })).toBeVisible();
  await expect(page.getByText(/still to fill in the letter/)).toBeVisible();
  await expect(page.locator("mark.placeholder-chip").first()).toBeVisible();
  await expect(page.getByText("45 CFR 149.110", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before you send" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page, "letter");

  // Fill-in form replaces the standard blanks at once
  await page.getByLabel("Your full name").fill("Jasmine R. Whitfield");
  await page.getByRole("button", { name: "Put these in the letter" }).click();
  await expect(page.locator("section[aria-labelledby=letter]")).toContainText("Jasmine R. Whitfield");
  await expect(page.locator("section[aria-labelledby=letter]")).not.toContainText("[ADD: your full name]");

  // Edit persists
  await page.getByRole("button", { name: /Edit section: Purpose|Edit section: intro/ }).click();
  const box = page.getByRole("textbox", { name: /Editing:/ });
  await box.fill("EDITED PARAGRAPH FOR TEST");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("EDITED PARAGRAPH FOR TEST")).toBeVisible();

  // Download produces a PDF
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download PDF" }).click()]);
  expect(download.suggestedFilename()).toBe("appeal-letter.pdf");
});

test("unsupported document stops honestly", async ({ page }) => {
  await page.goto("/start");
  await page.getByRole("button", { name: /Medicare Advantage denial/ }).click();
  await expect(page.getByRole("heading", { name: /outside what Overturn covers/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Official appeal instructions/ })).toHaveAttribute("href", /medicare\.gov/);
  await expectNoA11yViolations(page, "unsupported");
});

test("keyboard only: a sample can be opened without a mouse", async ({ page }) => {
  await page.goto("/start");
  await page.keyboard.press("Tab"); // skip link
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.getByRole("button", { name: /MRI denied/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Here is what your document says" })).toBeVisible();
});

test("learn and about pages render from the rules dataset and pass axe", async ({ page }) => {
  await page.goto("/learn");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("How appealing");
  await expect(page.getByText("You have at least 180 days to file an internal appeal")).toBeVisible();
  await expect(page.getByRole("link", { name: /Source/ }).first()).toHaveAttribute("href", /^https:\/\//);
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page, "learn");
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "Information, not advice" })).toBeVisible();
  await expectNoA11yViolations(page, "about");
});
