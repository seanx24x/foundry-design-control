import type {
  ApplyRun,
  ChangeContext,
  DeliveryRecord,
  DesignChange,
  VerificationResult,
} from './index.js';
import { verificationValueMatches } from './verification-value.js';

export function matchingDeliveryCaptures(record: DeliveryRecord) {
  const pairs: Array<{
    before: DeliveryRecord['evidence'][number];
    after: DeliveryRecord['evidence'][number];
  }> = [];
  for (const after of record.evidence) {
    const proof = after.capture;
    if (
      !proof ||
      !proof.conditions ||
      proof.phase !== 'rebuilt' ||
      proof.applyRunId !== record.applyRunId ||
      !record.appliedRevision ||
      proof.sourceRevision !== record.appliedRevision
    )
      continue;
    const before = record.evidence.find((item) => {
      const baseline = item.capture;
      return (
        baseline?.phase === 'before' &&
        baseline.conditions &&
        baseline.conditions.motion === proof.conditions!.motion &&
        baseline.conditions.browser === proof.conditions!.browser &&
        baseline.conditions.platform === proof.conditions!.platform &&
        baseline.conditions.deviceScaleFactor === proof.conditions!.deviceScaleFactor &&
        baseline.targetId === proof.targetId &&
        baseline.sourceRevision === record.baselineRevision &&
        Boolean(record.baselineRevision) &&
        baseline.viewport.width === proof.viewport.width &&
        baseline.viewport.height === proof.viewport.height &&
        baseline.context.breakpoint === proof.context.breakpoint &&
        baseline.context.theme === proof.context.theme &&
        baseline.context.state === proof.context.state
      );
    });
    if (before) pairs.push({ before, after });
  }
  return pairs;
}

function exactValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => exactValue(value, right[index]))
    );
  const a = Object.keys(left).sort();
  const b = Object.keys(right).sort();
  return (
    a.length === b.length &&
    a.every(
      (key, index) =>
        key === b[index] &&
        exactValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
    )
  );
}

export function engineeringVerification(
  record: DeliveryRecord,
  run: ApplyRun | undefined,
  change: DesignChange,
  context: ChangeContext,
): { status: 'passed' | 'failed' | 'untested'; result?: VerificationResult; reason?: string } {
  if (
    !run ||
    run.id !== record.applyRunId ||
    !run.changeIds.includes(change.id) ||
    !record.changeIds.includes(change.id)
  )
    return { status: 'untested', reason: 'No matching frozen Apply contract.' };
  // Completion deliberately releases the active lease. Its acknowledged attempt
  // remains frozen on the run and is the authority for historical evidence.
  const completedAttempt =
    ['passed', 'needs_attention'].includes(run.state) &&
    run.completedAt &&
    Number.isFinite(Date.parse(run.completedAt))
      ? run.applyResultClaimAttemptId
      : undefined;
  const claimAttempt = run.claimAttemptId ?? completedAttempt;
  if (
    !claimAttempt ||
    run.applyResultClaimAttemptId !== claimAttempt ||
    !run.applyResultAcknowledgedAt ||
    !['verifying', 'passed', 'needs_attention'].includes(run.state)
  )
    return {
      status: 'untested',
      reason: 'The current Apply attempt has no acknowledged verification lifecycle.',
    };
  const acknowledgedAt = Date.parse(run.applyResultAcknowledgedAt);
  const results = record.verificationResults.filter(
    (item) =>
      item.changeId === change.id &&
      item.property === change.property &&
      item.applyRunId === run.id &&
      item.claimAttemptId === claimAttempt &&
      item.context &&
      item.context.breakpoint === context.breakpoint &&
      item.context.theme === context.theme &&
      item.context.state === context.state &&
      exactValue(item.requested, change.after) &&
      Number.isFinite(Date.parse(item.verifiedAt)) &&
      Date.parse(item.verifiedAt) >= acknowledgedAt,
  );
  const result = results.sort((a, b) => Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt))[0];
  if (!result)
    return {
      status: 'untested',
      reason: 'No matching rendered evidence for this request and attempt.',
    };
  if (!result.passed) return { status: 'failed', result };
  if (!verificationValueMatches(change.property, result.rendered, change.after, change.unit))
    return { status: 'failed', result, reason: 'Recorded pass contradicts the reviewed value.' };
  if (!run.validationResults.length || run.validationResults.some((item) => !item.passed))
    return { status: 'untested', result, reason: 'Source validation is missing or failed.' };
  if (record.appliedRevision && run.appliedRevision !== record.appliedRevision)
    return { status: 'untested', result, reason: 'Delivery and Apply source revisions differ.' };
  if (
    change.target?.platform === 'web' &&
    (!result.geometry ||
      result.geometry.width <= 0 ||
      result.geometry.height <= 0 ||
      !result.evidence.length)
  )
    return {
      status: 'untested',
      result,
      reason: 'Visible browser geometry and evidence are missing.',
    };
  return { status: 'passed', result };
}
