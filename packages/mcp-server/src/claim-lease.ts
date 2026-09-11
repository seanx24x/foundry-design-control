export interface ClaimLeaseRequestClient {
  request(path: string, options?: RequestInit, token?: string): Promise<unknown>;
}

export interface ClaimLease {
  sessionId: string;
  token?: string;
  runId: string;
  claimAttemptId: string;
  claimCapability?: string;
  kind?: 'apply' | 'visual';
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

  capability(runId: string, claimAttemptId: string): string | undefined {
    const active = this.claims.get(runId);
    if (!active || active.claimAttemptId !== claimAttemptId) return undefined;
    return active.claimCapability;
  }

  async pulse(runId: string): Promise<void> {
    const active = this.claims.get(runId);
    if (!active || active.renewing) return;
    active.renewing = true;
    try {
      const payload = (await this.client.request(
        active.kind === 'visual'
          ? `/v1/sessions/${encodeURIComponent(active.sessionId)}/visual-agent-requests/${encodeURIComponent(active.runId)}/heartbeat`
          : `/v1/sessions/${encodeURIComponent(active.sessionId)}/apply-runs/${encodeURIComponent(active.runId)}/heartbeat`,
        {
          method: 'POST',
          body: JSON.stringify({
            claimAttemptId: active.claimAttemptId,
            ...(active.claimCapability ? { claimCapability: active.claimCapability } : {}),
          }),
        },
        active.token,
      )) as {
        applyRuns?: Array<{
          id: string;
          state: string;
          claimAttemptId?: string;
        }>;
        visualAgentRequests?: Array<{
          id: string;
          status: string;
          claimAttemptId?: string;
        }>;
      };
      const run:
        { id: string; state?: string; status?: string; claimAttemptId?: string } | undefined =
        active.kind === 'visual'
          ? payload.visualAgentRequests?.find((candidate) => candidate.id === active.runId)
          : payload.applyRuns?.find((candidate) => candidate.id === active.runId);
      active.failedPulses = 0;
      if (
        !run ||
        !(active.kind === 'visual'
          ? ['thinking'].includes(run.status ?? '')
          : ['claimed', 'applying', 'rebuilding', 'verifying'].includes(run.state ?? '')) ||
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
