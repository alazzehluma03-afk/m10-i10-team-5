import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test("extract page loads with form", async ({ page }) => {
  await page.goto(`${BASE}/extract`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("textarea")).toBeVisible();
  await expect(page.getByRole("button", { name: /extract/i })).toBeVisible();
});

test("extract submit button is disabled when textarea is empty", async ({ page }) => {
  await page.goto(`${BASE}/extract`);
  await expect(page.getByRole("button", { name: /extract/i })).toBeDisabled();
});

test("extract renders entity spans for a known input", async ({ page }) => {
  await page.goto(`${BASE}/extract`);
  await page.locator("textarea").fill("Akira Kurosawa directed Seven Samurai in 1954.");
  await page.getByRole("button", { name: /extract/i }).click();
  await expect(page.locator('[data-testid="entity-span"]').first()).toBeVisible({ timeout: 10_000 });
});

test("extract shows error for an aborted request", async ({ page }) => {
  await page.route("**/extract", (route) => route.abort());
  await page.goto(`${BASE}/extract`);
  await page.locator("textarea").fill("Some test text with entities.");
  await page.getByRole("button", { name: /extract/i }).click();
  await expect(page.locator('[data-testid="error"]')).toBeVisible({ timeout: 10_000 });
});
