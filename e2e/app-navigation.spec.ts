import { expect, test } from "@playwright/test";

test("primary app navigation reaches every top-level screen", async ({ page }) => {
  await page.goto("/app");

  await page.getByRole("link", { name: "Upload" }).first().click();
  await expect(page.getByRole("heading", { name: "Upload Queue" })).toBeVisible();

  await page.getByRole("link", { name: "Packs" }).first().click();
  await expect(page.getByRole("heading", { name: "Pack Participation" })).toBeVisible();

  await page.getByRole("link", { name: "Recovery" }).first().click();
  await expect(page.getByRole("heading", { name: "Recovery Console" })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).first().click();
  await expect(page.getByRole("heading", { name: "Dashboard Overview" })).toBeVisible();
});
