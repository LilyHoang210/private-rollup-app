import { createHash } from "node:crypto";

export interface SharedPackInputMember {
  batchId: string;
  bytes: Uint8Array;
}

export interface SharedPackMemberRange {
  batchId: string;
  byteStart: number;
  byteLength: number;
  ciphertextSha256: string;
}

export async function assembleSharedPack(
  inputs: SharedPackInputMember[],
): Promise<{
  bytes: Uint8Array;
  sha256: string;
  members: SharedPackMemberRange[];
}> {
  if (inputs.length === 0) {
    throw new Error("A shared pack requires at least one member");
  }

  const batchIds = new Set(inputs.map((input) => input.batchId));
  if (batchIds.size !== inputs.length) {
    throw new Error("Shared pack members require unique batch IDs");
  }

  const byteLength = inputs.reduce((total, input) => {
    if (!input.batchId.trim() || input.bytes.byteLength === 0) {
      throw new Error("Shared pack members require an ID and encrypted bytes");
    }
    return total + input.bytes.byteLength;
  }, 0);
  const bytes = new Uint8Array(byteLength);
  const members: SharedPackMemberRange[] = [];
  let byteStart = 0;

  for (const input of inputs) {
    bytes.set(input.bytes, byteStart);
    members.push({
      batchId: input.batchId,
      byteStart,
      byteLength: input.bytes.byteLength,
      ciphertextSha256: sha256Hex(input.bytes),
    });
    byteStart += input.bytes.byteLength;
  }

  return { bytes, sha256: sha256Hex(bytes), members };
}

function sha256Hex(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}
