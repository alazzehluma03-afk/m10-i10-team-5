import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test("kg page loads with form", async ({ page }) => {
  await page.goto(`${BASE}/kg`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("input")).toBeVisible();
  await expect(page.getByRole("button", { name: /ask/i })).toBeVisible();
});

test("kg submit button is disabled when input is empty", async ({ page }) => {
  await page.goto(`${BASE}/kg`);
  await expect(page.getByRole("button", { name: /ask/i })).toBeDisabled();
});

test("kg renders rows for a seeded question", async ({ page }) => {
  await page.goto(`${BASE}/kg`);
  await page.locator("input").fill("Find Sichuan recipes");
  await page.getByRole("button", { name: /ask/i }).click();
  await expect(page.locator('[data-testid="kg-row"]').first()).toBeVisible({ timeout: 10_000 });
});

test("kg shows supported patterns on unsupported question", async ({ page }) => {
  await page.goto(`${BASE}/kg`);
  await page.locator("input").fill("Who invented spaghetti?");
  await page.getByRole("button", { name: /ask/i }).click();
  await expect(page.locator('[data-testid="error"]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="supported-patterns"]')).toBeVisible({ timeout: 10_000 });
});

test("kg shows error for an aborted request", async ({ page }) => {
  await page.route("**/kg/query", (route) => route.abort());
  await page.goto(`${BASE}/kg`);
  await page.locator("input").fill("Find Italian recipes");
  await page.getByRole("button", { name: /ask/i }).click();
  await expect(page.locator('[data-testid="error"]')).toBeVisible({ timeout: 10_000 });
});
