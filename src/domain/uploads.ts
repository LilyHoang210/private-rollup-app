export type UploadStatus =
  | "encrypting"
  | "staging"
  | "staged"
  | "waiting_for_pack"
  | "packing"
  | "registering"
  | "written"
  | "verifying"
  | "available"
  | "retrying"
  | "failed";

export const UPLOAD_STATUS_ORDER: readonly UploadStatus[] = [
  "encrypting",
  "staging",
  "staged",
  "waiting_for_pack",
  "packing",
  "registering",
  "written",
  "verifying",
  "available",
];
