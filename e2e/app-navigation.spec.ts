import { expect, test } from "@playwright/test";

test("primary app navigation reaches every top-level screen", async ({ page }) => {
  await page.goto("/app");

  await page.getByRole("link", { name: "File Upload" }).first().click();
  await expect(page.getByRole("heading", { name: "Upload Queue" })).toBeVisible();

  await page.getByRole("link", { name: "Blob Packs" }).first().click();
  await expect(page.getByRole("heading", { name: "Pack Participation" })).toBeVisible();

  await page.getByRole("link", { name: "Recovery" }).first().click();
  await expect(page.getByRole("heading", { name: "Recovery Console" })).toBeVisible();

  await page.getByRole("link", { name: "Setup Wizard" }).first().click();
  await expect(page.getByRole("heading", { name: "Secure Setup Wizard" })).toBeVisible();

  await page.getByRole("link", { name: "Dashboard" }).first().click();
  await expect(page.getByRole("heading", { name: "Dashboard Overview" })).toBeVisible();
});

test("secondary navigation opens dedicated support and documentation pages", async ({ page }) => {
  await page.goto("/app/recovery");

  await page.getByRole("link", { name: "Documentation" }).click();
  await expect(page).toHaveURL(/\/app\/documentation$/);
  await expect(page.getByRole("heading", { name: "Documentation" })).toBeVisible();

  await page.getByRole("link", { name: "Support" }).click();
  await expect(page).toHaveURL(/\/app\/support$/);
  await expect(page.getByRole("heading", { name: "Support" })).toBeVisible();
});
