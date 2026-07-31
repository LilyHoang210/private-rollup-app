import { describe, expect, it } from "vitest";
import {
  MAX_BATCH_FILES,
  MAX_FILE_SIZE_BYTES,
  PACK_STRATEGY_THRESHOLD_BYTES,
  parseRetentionCohort,
  selectPackStrategy,
} from "../../src/domain/files";

describe("file domain rules", () => {
  it("uses shared packs only for files smaller than 10 MiB", () => {
    expect(PACK_STRATEGY_THRESHOLD_BYTES).toBe(10 * 1024 * 1024);
    expect(selectPackStrategy(PACK_STRATEGY_THRESHOLD_BYTES - 1)).toBe(
      "shared_pack",
    );
    expect(selectPackStrategy(PACK_STRATEGY_THRESHOLD_BYTES)).toBe(
      "dedicated_blob",
    );
  });

  it("accepts only locked retention cohorts", () => {
    expect(parseRetentionCohort(30)).toBe(30);
    expect(parseRetentionCohort(90)).toBe(90);
    expect(parseRetentionCohort(365)).toBe(365);
    expect(() => parseRetentionCohort(7)).toThrow("Unsupported retention cohort");
  });

  it("keeps MVP upload guardrails explicit", () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(2 * 1024 * 1024 * 1024);
    expect(MAX_BATCH_FILES).toBe(1000);
  });
});
