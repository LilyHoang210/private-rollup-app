import { expect, test } from "@playwright/test";

test("explains Payment Vault, pack conditions, and local recovery before real upload", async ({ page }) => {
  await page.goto("/app/upload");

  await expect(page.getByRole("heading", { name: "Upload Files" })).toBeVisible();
  await page.setInputFiles('input[type="file"]', {
    name: "vault-e2e.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("private rollup vault e2e source"),
  });

  await expect(page.getByText("Review upload cost")).toBeVisible();
  await expect(page.getByText("The Payment Vault pays Shelby.")).toBeVisible();
  await expect(page.getByText("Shared Pack")).toBeVisible();
  await page.getByRole("button", { name: "Pay and upload" }).click();
  await expect(
    page.getByText("Initialize your vault and save recovery-kit.json before uploading."),
  ).toBeVisible();

  await page.goto("/app/packs");
  await expect(page.getByText("Waiting Pack Pool")).toBeVisible();
  await expect(page.getByText("Uploads when").first()).toBeVisible();
  await expect(page.getByText("Settlement status").first()).toBeVisible();

  await page.goto("/app/documentation");
  await expect(
    page.getByRole("heading", { name: "Payment Vault contract" }),
  ).toBeVisible();
  await expect(page.getByText("How upload payment works")).toBeVisible();
  await expect(page.getByText("How to claim a refund")).toBeVisible();
  await expect(
    page.getByText("private-rollup files pull <file-id> --receipt ./receipt.json --output ./restored"),
  ).toBeVisible();
});

test("legacy storage upload API is closed in favor of durable Payment Vault packs", async ({ request }) => {
  const response = await request.post("/api/storage/upload", { data: {} });

  expect(response.status()).toBe(410);
  await expect(response.json()).resolves.toMatchObject({
    error: "LEGACY_STORAGE_UPLOAD_DISABLED",
  });
});
