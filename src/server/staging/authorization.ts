const MAX_STAGING_BYTES = 100 * 1024 * 1024;

export function authorizeStagingUpload(input: {
  pathname: string;
  clientPayload: string | null;
  userId: string | null;
}) {
  if (!input.userId) throw new Error("Authentication is required for staging");

  let payload: { batchId?: unknown };
  try {
    payload = JSON.parse(input.clientPayload ?? "{}") as { batchId?: unknown };
  } catch {
    throw new Error("Staging upload payload is invalid");
  }
  if (
    typeof payload.batchId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      payload.batchId,
    )
  ) {
    throw new Error("Staging upload batch ID is invalid");
  }
  const prefix = `staging/${payload.batchId}/`;
  if (
    !input.pathname.startsWith(prefix) ||
    input.pathname.includes("..") ||
    !input.pathname.endsWith(".prp")
  ) {
    throw new Error("Staging object does not belong to this upload batch");
  }

  return {
    batchId: payload.batchId,
    userId: input.userId,
    allowedContentTypes: ["application/x-private-rollup"],
    maximumSizeInBytes: MAX_STAGING_BYTES,
  };
}
