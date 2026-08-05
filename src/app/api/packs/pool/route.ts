import { NextResponse } from "next/server";
import { summarizePackPools, type PackPoolSummary } from "@/server/packs/pool-summary";
import { listPackPoolBatchesRuntime } from "@/server/uploads/runtime-service";

export async function GET() {
  const batches = await listPackPoolBatchesRuntime();
  return NextResponse.json({
    pools: summarizePackPools({
      now: new Date(),
      batches,
    }).map(toPublicPool),
  });
}

function toPublicPool(pool: PackPoolSummary) {
  return {
    retentionDays: pool.retentionDays,
    queuedBytes: pool.queuedBytes,
    targetBytes: pool.targetBytes,
    maxBytes: pool.maxBytes,
    maxWaitSeconds: pool.maxWaitSeconds,
    waitingBatchCount: pool.waitingBatchCount,
    progressRatio: pool.progressRatio,
    oldestQueuedAt: pool.oldestQueuedAt,
    closesAt: pool.closesAt,
    secondsRemaining: pool.secondsRemaining,
    trigger: pool.trigger,
    nextTrigger: pool.nextTrigger,
  };
}
