import { test, expect } from "@playwright/test";

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test("rag page loads and shows form", async ({ page }) => {
  await page.goto(`${BASE}/rag`);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("input[aria-label]")).toBeVisible();
  await expect(page.getByRole("button", { name: /ask/i })).toBeVisible();
});

test("rag submit button is disabled when input is empty", async ({ page }) => {
  await page.goto(`${BASE}/rag`);
  const btn = page.getByRole("button", { name: /ask/i });
  await expect(btn).toBeDisabled();
});

test("rag shows cited answer and citation markers after submit", async ({ page }) => {
  await page.goto(`${BASE}/rag`);
  await page.locator("input").fill("How do I prep ginger for stir-fry?");
  await page.getByRole("button", { name: /ask/i }).click();
  await expect(page.locator('[data-testid="rag-answer"]')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-testid="citation-marker"]').first()).toBeVisible({ timeout: 30_000 });
});

test("rag citation badges are clickable and expand detail", async ({ page }) => {
  await page.goto(`${BASE}/rag`);
  await page.locator("input").fill("What spices go in Sichuan cooking?");
  await page.getByRole("button", { name: /ask/i }).click();
  await expect(page.locator('[data-testid="citation-marker"]').first()).toBeVisible({ timeout: 30_000 });
  await page.locator('[data-testid="citation-marker"]').first().click();
  await expect(page.getByRole("tooltip")).toBeVisible();
});

test("rag shows error message on network failure", async ({ page }) => {
  // Point to an unreachable backend to trigger a network error
  await page.route("**/rag/answer", (route) => route.abort());
  await page.goto(`${BASE}/rag`);
  await page.locator("input").fill("test question");
  await page.getByRole("button", { name: /ask/i }).click();
  await expect(page.locator('[data-testid="error"]')).toBeVisible({ timeout: 10_000 });
});
