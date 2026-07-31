import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { schemaTables } from "../../src/server/db/schema";

const requiredTables = [
  "users",
  "walletChallenges",
  "sessions",
  "vaultPublicKeys",
  "uploadBatches",
  "uploadItems",
  "packs",
  "packMembers",
  "receipts",
  "jobs",
  "outboxEvents",
] as const;

const forbiddenColumnPatterns = [
  /plaintext/i,
  /private.*key/i,
  /recovery.*phrase/i,
  /raw.*wallet.*signature/i,
  /file.*content/i,
  /unencrypted.*tag/i,
  /unencrypted.*path/i,
  /^filename$/i,
  /^relative.*path$/i,
  /^tags?$/i,
];

describe("database schema privacy boundary", () => {
  it("defines every MVP table explicitly", () => {
    expect(Object.keys(schemaTables).sort()).toEqual([...requiredTables].sort());
  });

  it("does not expose plaintext, secret, or sensitive metadata columns", () => {
    for (const table of Object.values(schemaTables)) {
      for (const columnName of Object.keys(getTableColumns(table))) {
        expect(
          forbiddenColumnPatterns.some((pattern) => pattern.test(columnName)),
          `Forbidden privacy-sensitive column: ${columnName}`,
        ).toBe(false);
      }
    }
  });
});
