import { expect, test } from "@playwright/test";

test("connects demo wallet and renders app shell navigation", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /Secure storage/i })).toBeVisible();
  await page.getByRole("button", { name: "Connect Aptos wallet" }).click();
  await expect(page.getByText("Demo session created on aptos-testnet.")).toBeVisible();

  await page.getByRole("link", { name: "Support" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard Overview" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" }).first()).toHaveAttribute(
    "data-action",
    "nav.dashboard",
  );
});
