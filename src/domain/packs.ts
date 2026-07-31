import type { UploadStatus } from "./uploads";
import { UPLOAD_STATUS_ORDER } from "./uploads";

export type PackStatus =
  | "open"
  | "sealing"
  | "registering"
  | "written"
  | "verifying"
  | "verified"
  | "retrying"
  | "failed"
  | "expired";

export type ExpirationSeverity = "normal" | "attention" | "urgent" | "expired";

const DAY_MS = 24 * 60 * 60 * 1000;

export function getExpirationSeverity(
  expiresAt: string | Date,
  now: Date = new Date(),
): ExpirationSeverity {
  const expiresAtMs = new Date(expiresAt).getTime();
  const remainingDays = Math.ceil((expiresAtMs - now.getTime()) / DAY_MS);

  if (expiresAtMs <= now.getTime()) {
    return "expired";
  }

  if (remainingDays <= 7) {
    return "urgent";
  }

  if (remainingDays <= 30) {
    return "attention";
  }

  return "normal";
}

export function isUploadTransitionAllowed(
  from: UploadStatus,
  to: UploadStatus,
): boolean {
  if (from === "failed") {
    return to === "retrying";
  }

  if (from === "retrying") {
    return to === "staging" || to === "failed";
  }

  const fromIndex = UPLOAD_STATUS_ORDER.indexOf(from);
  const toIndex = UPLOAD_STATUS_ORDER.indexOf(to);

  return fromIndex >= 0 && toIndex === fromIndex + 1;
}
