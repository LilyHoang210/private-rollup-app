import { expect, test } from "@playwright/test";

test("shows detected wallet guidance and renders app shell navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Secure storage/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect wallet" })).toBeVisible();
  await page.getByRole("button", { name: "Connect wallet" }).click();
  await expect(page.getByRole("dialog", { name: "Choose a wallet" })).toBeVisible();
  await expect(page.getByText("No Aptos wallet extension detected.")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("link", { name: "Support" }).click();
  await expect(page.getByRole("heading", { name: "Support" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" }).first()).toHaveAttribute(
    "data-action",
    "nav.dashboard",
  );
});
