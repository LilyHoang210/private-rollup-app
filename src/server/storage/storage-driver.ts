export type StorageDriverMode = "ready" | "control_plane_only";

export interface StorageDriverStatus {
  ready: boolean;
  driver: "shelby" | "local";
  network: string;
  missing: string[];
  mode: StorageDriverMode;
}

const REQUIRED_SHELBY_ENV = [
  "SHELBY_ACCOUNT_PRIVATE_KEY",
  "SHELBY_LOCATION",
] as const;

export function getStorageDriverStatus(
  env: NodeJS.ProcessEnv = process.env,
): StorageDriverStatus {
  const driver = env.SHELBY_DRIVER === "shelby" ? "shelby" : "local";
  const network = env.SHELBY_NETWORK?.trim() || "shelbynet";

  if (driver !== "shelby") {
    return {
      ready: false,
      driver,
      network,
      missing: ["SHELBY_DRIVER"],
      mode: "control_plane_only",
    };
  }

  const missing = REQUIRED_SHELBY_ENV.filter((key) => !env[key]?.trim());

  return {
    ready: missing.length === 0,
    driver,
    network,
    missing,
    mode: missing.length === 0 ? "ready" : "control_plane_only",
  };
}
