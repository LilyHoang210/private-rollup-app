import { describe, expect, it } from "vitest";
import { authorizeStagingUpload } from "../../src/server/staging/authorization";

describe("private ciphertext staging authorization", () => {
  it("allows only the authenticated upload batch pathname", () => {
    expect(
      authorizeStagingUpload({
        pathname: "staging/58ee7ca9-bd98-44ef-9aaf-28ec88d0414e/member.prp",
        clientPayload: JSON.stringify({
          batchId: "58ee7ca9-bd98-44ef-9aaf-28ec88d0414e",
        }),
        userId: `wallet:${"a".repeat(64)}`,
      }),
    ).toMatchObject({
      batchId: "58ee7ca9-bd98-44ef-9aaf-28ec88d0414e",
      maximumSizeInBytes: 100 * 1024 * 1024,
    });
  });

  it("rejects traversal, mismatched batches, and unauthenticated requests", () => {
    expect(() =>
      authorizeStagingUpload({
        pathname: "staging/other/member.prp",
        clientPayload: JSON.stringify({
          batchId: "58ee7ca9-bd98-44ef-9aaf-28ec88d0414e",
        }),
        userId: `wallet:${"a".repeat(64)}`,
      }),
    ).toThrow("does not belong");
    expect(() =>
      authorizeStagingUpload({
        pathname: "staging/../secret.prp",
        clientPayload: JSON.stringify({ batchId: ".." }),
        userId: `wallet:${"a".repeat(64)}`,
      }),
    ).toThrow();
    expect(() =>
      authorizeStagingUpload({
        pathname: "staging/batch/member.prp",
        clientPayload: JSON.stringify({ batchId: "batch" }),
        userId: null,
      }),
    ).toThrow("Authentication");
  });
});
