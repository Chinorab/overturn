import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * SC-001 / SC-006: the whole sample flow on a phone-sized viewport, keyboard-reachable,
 * with an axe scan on every screen. No API call is made (samples are cached).
 */
async function expectNoA11yViolations(page: import("@playwright/test").Page, screen: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, `${screen}: ${serious.map((v) => `${v.id} (${v.nodes.length})`).join(", ")}`).toEqual([]);
}

async function expectNoHorizontalScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("landing: framing is visible above the fold, samples need no upload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const framing = page.getByText("Information, not advice.");
  await expect(framing).toBeInViewport();
  await expect(page.getByText("Nothing stored.")).toBeInViewport();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page, "landing");
});

test("sample flow: understand → rights → letter → download, on a phone", async ({ page }) => {
  await page.goto("/");
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
  await expect(page.getByText(/blanks to fill in/)).toBeVisible();
  await expect(page.locator("mark.placeholder-chip").first()).toBeVisible();
  await expect(page.getByText("45 CFR 149.110", { exact: false }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Before you send" })).toBeVisible();
  await expectNoHorizontalScroll(page);
  await expectNoA11yViolations(page, "letter");

  // Edit persists
  await page.getByRole("button", { name: /Edit section: Purpose|Edit section: intro/ }).click();
  const box = page.getByRole("textbox", { name: /Editing:/ });
  await box.fill("EDITED PARAGRAPH FOR TEST");
  await page.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText("EDITED PARAGRAPH FOR TEST")).toBeVisible();

  // Download produces a PDF
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF" }).click()]);
  expect(download.suggestedFilename()).toBe("appeal-letter.pdf");
});

test("unsupported document stops honestly", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Medicare Advantage denial/ }).click();
  await expect(page.getByRole("heading", { name: /outside what Overturn covers/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Official appeal instructions/ })).toHaveAttribute("href", /medicare\.gov/);
  await expectNoA11yViolations(page, "unsupported");
});

test("keyboard only: a sample can be opened without a mouse", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab"); // skip link
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.getByRole("button", { name: /MRI denied/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Here is what your document says" })).toBeVisible();
});
