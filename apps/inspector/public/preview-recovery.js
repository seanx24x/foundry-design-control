// Recover temporary decisions only. Completed source work is never replayed.
export function recoverablePreviewChanges(direction, context = {}) {
  return (direction?.changes ?? []).filter((change) => {
    if (!['draft', 'approved'].includes(change.status)) return false;
    return ['breakpoint', 'theme', 'state'].every((axis) => {
      const values = change.contextSet?.[`${axis}s`];
      return (values?.length ? values : [change.context?.[axis] ?? 'current']).includes(
        context[axis] ?? 'current',
      );
    });
  });
}

export function previewRecoveryBlocked(runs = []) {
  return runs.some((run) =>
    ['queued', 'claimed', 'applying', 'rebuilding', 'verifying'].includes(run.state),
  );
}

// A deliberate reconnect may restore the measuring surface during verification,
// but must not reload it while the reviewed source transaction is still pending.
// Temporary edit replay stays blocked during verification by the separate rule above.
export function previewReconnectBlocked(runs = []) {
  return runs.some((run) => ['queued', 'claimed', 'applying', 'rebuilding'].includes(run.state));
}
