const present = (value) => value != null && String(value).trim() !== '';

// These are readouts, not editable overrides. Retain each evidence layer even
// when the strings happen to match; an indexed resolution is not a measurement.
export function systemValueRows(token, renderedValue, connected) {
  const rows = [{ id: 'authored', label: 'Authored', value: String(token?.value ?? '—') }];
  if (present(token?.resolvedValue))
    rows.push({ id: 'resolved', label: 'Resolved · index', value: String(token.resolvedValue) });
  if (connected && present(renderedValue))
    rows.push({ id: 'canvas', label: 'Canvas', value: String(renderedValue) });
  return rows;
}

export function systemScopeRows(token, candidate, usages = []) {
  const declarations =
    candidate?.sources ??
    token?.declarations?.map((item) => item.source) ??
    (token?.source ? [token.source] : []);
  const files = new Set(declarations.map((source) => source?.file).filter(Boolean)).size;
  const components = new Set(
    candidate?.componentIds ?? usages.map((item) => item.componentId).filter(Boolean),
  ).size;
  return [
    {
      label: candidate ? 'Authored locations' : 'Declarations',
      value: String(declarations.length),
    },
    { label: 'Source files', value: String(files) },
    { label: 'Mapped components', value: String(components) },
  ];
}

export function systemPromotionState(
  candidate,
  changes = [],
  { connected, pending = false, acknowledged = false } = {},
) {
  const staged =
    acknowledged ||
    Boolean(
      candidate &&
      changes.some(
        (change) =>
          change.target?.id === `token-source:${candidate.id}` &&
          /^designToken\.(?:promote|create)$/.test(change.property ?? '') &&
          !['rejected', 'applied'].includes(change.status),
      ),
    );
  const blocked = !candidate?.canStage || !candidate?.sources?.length;
  return {
    disabled: pending || staged || !connected || blocked,
    label: pending ? 'Adding to Review…' : staged ? 'In Review' : 'Add plan to Review',
    message: pending
      ? 'Waiting for Review acknowledgement. Source is unchanged.'
      : staged
        ? 'This plan is already in Review. Source is unchanged.'
        : !connected
          ? 'Reconnect Canvas before adding this plan.'
          : blocked
            ? candidate?.blockers?.[0] || 'Exact authored source locations are required.'
            : 'Adds a source plan to Review, not a live preview or source edit.',
    staged,
  };
}

export function systemPromotionWarning(candidate) {
  return candidate?.relation === 'near'
    ? 'Nearest match, not an exact value. This replacement may change appearance; review the target value before Apply.'
    : '';
}

export function systemPromotionValueRows(candidate, tokens = []) {
  const creating = candidate.recommendation === 'create-token';
  const target = tokens.find((item) => item.id === candidate.suggestedTokenId);
  return [
    { label: 'Token', value: candidate.suggestedTokenName },
    {
      label: creating ? 'Proposed value' : 'Target · index',
      value: creating
        ? candidate.value
        : (target?.resolvedValue ?? target?.value ?? 'Not resolved in index'),
    },
  ];
}
