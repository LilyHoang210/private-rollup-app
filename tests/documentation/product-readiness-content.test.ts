import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("product readiness documentation", () => {
  it("documents the current Payment Vault reimbursement architecture without stale direct-payment blockers", () => {
    const files = [
      "README.md",
      "docs/THREAT_MODEL.md",
      "docs/ENCRYPTION_FORMAT.md",
      "e2e/payment-vault-upload.spec.ts",
    ];
    const combined = files
      .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
      .join("\n");

    expect(combined).toContain("Payment Vault reimburses the service signer");
    expect(combined).toContain("private Vercel Blob staging");
    expect(combined).not.toContain("SHELBY_DIRECT_PAYMENT_MODULE_ADDRESS");
    expect(combined).not.toContain("Durable upload staging and pack writing are not implemented");
    expect(combined).not.toContain("local-browser://");
    expect(combined).not.toContain("skips real vault-backed upload unless Shelbynet direct payment is configured");
  });
});
