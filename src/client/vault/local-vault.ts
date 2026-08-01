import type { RecoveryKit } from "@/client/crypto/hpke";

export const LOCAL_VAULT_PUBLIC_KEY = "private-rollup:vault-public:v1";

export interface LocalVaultPublicMaterial {
  algorithm: "DHKEM_X25519_HKDF_SHA256";
  publicKey: string;
  ownerFingerprint: string;
  createdAt: string;
}

export function saveLocalVaultPublicMaterial(
  kit: RecoveryKit,
  storage: Storage | undefined = browserStorage(),
) {
  if (!storage) return;
  const material: LocalVaultPublicMaterial = {
    algorithm: kit.algorithm,
    publicKey: kit.publicKey,
    ownerFingerprint: kit.ownerFingerprint,
    createdAt: kit.createdAt,
  };
  storage.setItem(LOCAL_VAULT_PUBLIC_KEY, JSON.stringify(material));
}

export function readLocalVaultPublicMaterial(
  storage: Storage | undefined = browserStorage(),
): LocalVaultPublicMaterial | undefined {
  if (!storage) return undefined;
  try {
    const value = JSON.parse(storage.getItem(LOCAL_VAULT_PUBLIC_KEY) || "null") as
      | LocalVaultPublicMaterial
      | null;
    if (
      value?.algorithm !== "DHKEM_X25519_HKDF_SHA256" ||
      !value.publicKey ||
      !value.ownerFingerprint
    ) {
      return undefined;
    }
    return value;
  } catch {
    return undefined;
  }
}

export function downloadRecoveryKit(kit: RecoveryKit) {
  const blob = new Blob([JSON.stringify(kit, null, 2)], {
    type: "application/json",
  });
  const createObjectUrl = globalThis.URL?.createObjectURL;
  if (!createObjectUrl) return;
  const url = createObjectUrl(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "recovery-kit.json";
  anchor.click();
  globalThis.URL.revokeObjectURL?.(url);
}

function browserStorage() {
  return typeof window === "undefined" ? undefined : window.localStorage;
}
