export interface ApplyRunView {
  state: string;
  interruptedState?: 'applying' | 'rebuilding' | 'verifying';
  requeueCount?: number;
  error?: string;
  messages?: Array<{ message: string }>;
}

export interface ApplyRunAction {
  action: 'resume' | 'retry' | 'reconnect' | 'status';
  label: string;
  disabled: boolean;
}

export const ACTIVE_APPLY_STATES = [
  'queued',
  'claimed',
  'applying',
  'rebuilding',
  'verifying',
] as const;

export function isActiveApplyRun(run: ApplyRunView): boolean {
  return ACTIVE_APPLY_STATES.includes(run.state as (typeof ACTIVE_APPLY_STATES)[number]);
}

export function applyRunAction(
  run: ApplyRunView,
  agentConnected: boolean,
  labels: Record<string, string>,
): ApplyRunAction {
  if (run.state === 'needs_attention' && run.interruptedState) {
    return { action: 'resume', label: 'Resume with agent', disabled: false };
  }
  if (run.state === 'needs_attention' || run.state === 'failed') {
    return { action: 'retry', label: 'Retry with agent', disabled: false };
  }
  if ((run.state === 'queued' || run.state === 'claimed') && !agentConnected) {
    return { action: 'reconnect', label: 'Reconnect agent', disabled: false };
  }
  return {
    action: 'status',
    label:
      run.state === 'passed'
        ? 'Verified'
        : isActiveApplyRun(run)
          ? (labels[run.state] ?? run.state)
          : 'Run complete',
    disabled: true,
  };
}

export function applyRunMessage(run: ApplyRunView, agentConnected: boolean): string {
  if (run.state === 'queued') {
    return (run.requeueCount ?? 0) > 0
      ? 'The previous agent did not begin source work, so Foundry safely returned this batch to the queue.'
      : 'The reviewed changes are queued and ready for an active coding agent.';
  }
  if (run.state === 'claimed') {
    return agentConnected
      ? 'The agent received this batch. Foundry is keeping the handoff active while source work begins.'
      : 'The agent disconnected before source work began. Foundry will return this batch to the queue shortly.';
  }
  return run.messages?.at(-1)?.message ?? run.error ?? 'Apply run created.';
}
