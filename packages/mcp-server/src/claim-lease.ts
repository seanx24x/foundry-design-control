export interface ClaimLeaseRequestClient {
  request(path: string, options?: RequestInit, token?: string): Promise<unknown>;
}

export interface ClaimLease {
  sessionId: string;
  token?: string;
  runId: string;
  claimAttemptId: string;
}

interface ActiveClaimLease extends ClaimLease {
  timer: ReturnType<typeof setInterval>;
  renewing: boolean;
  failedPulses: number;
}

export class ClaimLeaseKeeper {
  private readonly claims = new Map<string, ActiveClaimLease>();

  constructor(
    private readonly client: ClaimLeaseRequestClient,
    private readonly intervalMs = 10_000,
    private readonly maxFailedPulses = 3,
  ) {}

  start(claim: ClaimLease): void {
    this.stop(claim.runId);
    const active: ActiveClaimLease = {
      ...claim,
      renewing: false,
      failedPulses: 0,
      timer: setInterval(() => void this.pulse(claim.runId), this.intervalMs),
    };
    active.timer.unref?.();
    this.claims.set(claim.runId, active);
  }

  stop(runId: string): void {
    const active = this.claims.get(runId);
    if (!active) return;
    clearInterval(active.timer);
    this.claims.delete(runId);
  }

  stopAll(): void {
    for (const runId of this.claims.keys()) this.stop(runId);
  }

  has(runId: string): boolean {
    return this.claims.has(runId);
  }

  async pulse(runId: string): Promise<void> {
    const active = this.claims.get(runId);
    if (!active || active.renewing) return;
    active.renewing = true;
    try {
      const payload = (await this.client.request(
        `/v1/sessions/${encodeURIComponent(active.sessionId)}/apply-runs/${encodeURIComponent(active.runId)}/heartbeat`,
        {
          method: 'POST',
          body: JSON.stringify({ claimAttemptId: active.claimAttemptId }),
        },
        active.token,
      )) as {
        applyRuns?: Array<{
          id: string;
          state: string;
          claimAttemptId?: string;
        }>;
      };
      const run = payload.applyRuns?.find((candidate) => candidate.id === active.runId);
      active.failedPulses = 0;
      if (
        run?.state !== 'claimed' ||
        !run.claimAttemptId ||
        run.claimAttemptId !== active.claimAttemptId
      ) {
        this.stop(runId);
      }
    } catch {
      active.failedPulses += 1;
      if (active.failedPulses >= this.maxFailedPulses) this.stop(runId);
    } finally {
      const current = this.claims.get(runId);
      if (current) current.renewing = false;
    }
  }
}
