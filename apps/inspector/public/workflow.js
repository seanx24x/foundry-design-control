import { engineeringVerification } from 'foundry-design-protocol/engineering-verification';

export function shouldDisplayApplyRun(run, { mode, dismissedRunId, changes = [] } = {}) {
  if (mode !== 'review' || !run || run.state === 'cancelled' || run.id === dismissedRunId) {
    return false;
  }
  // Completed evidence belongs to the previous batch. New edits must remain reviewable,
  // including unresolved edits that cannot yet be included in an Apply run.
  if (run.state === 'passed') {
    return !changes.some((change) => ['draft', 'approved', 'unresolved'].includes(change.status));
  }
  // Never replace an in-flight run or its failure/retry controls with the draft ledger.
  return true;
}

function selectedMappingSource(item) {
  const candidates = item?.mappingCandidates ?? [];
  return (
    candidates.find((candidate) => candidate.id === item?.selectedMappingId) ??
    (!item?.selectedMappingId && candidates.length === 1 ? candidates[0] : undefined)
  )?.source;
}

export function reviewSource(change, operation) {
  for (const item of [operation, change]) {
    if (
      item &&
      ((item.mappingCandidates?.length > 1 && !item.selectedMappingId) ||
        (item.selectedMappingId &&
          !item.mappingCandidates?.some((candidate) => candidate.id === item.selectedMappingId)))
    )
      return undefined;
    const source = selectedMappingSource(item);
    if (source) return source;
  }
  return change.target?.source;
}

export function reviewMappingIssue(change, operations = []) {
  if (
    change.confidence === 'unresolved' ||
    (change.mappingCandidates?.length > 1 && !change.selectedMappingId)
  )
    return 'Resolve the source mapping before including this change.';
  const target = change.target;
  if (
    target?.platform === 'web' &&
    !target.locator?.foundryId &&
    !(target.source?.file && target.source.line)
  ) {
    return 'Preview only: this layer has no stable source identity. Add an exact source annotation, refresh the preview, and review the edit again. Your preview is preserved.';
  }
  const operation = operations.find((item) => item.id === change.operationId);
  if (
    operation?.status === 'unresolved' ||
    (operation?.mappingCandidates?.length > 1 && !operation.selectedMappingId)
  )
    return 'Resolve the operation source mapping before including this change. Your preview is preserved.';
  const source = reviewSource(change, operation);
  if (!source?.file || !source.line) {
    return 'Source mapping needed: the reviewed edit must identify an exact project file and line before Apply. Your preview is preserved.';
  }
  return null;
}

export function reviewBatchSummary(changes = [], operations = []) {
  const rows = changes.map((change) => {
    const operation = operations.find((item) => item.id === change.operationId);
    return {
      change,
      operation,
      source: reviewSource(change, operation),
      issue: reviewMappingIssue(change, operations),
    };
  });
  const mappingIssues = rows.filter((row) => row.issue).length;
  const knownFiles = [...new Set(rows.map((row) => row.source?.file).filter(Boolean))].sort();
  const missingSourceCount = rows.filter((row) => !row.source?.file).length;
  const styleCategories = ['layout', 'spacing', 'typography', 'color', 'border', 'effect'];
  const sourceCategories = [
    'content',
    'asset',
    'visibility',
    'accessibility',
    'responsive',
    'state',
    'motion',
  ];
  const styleOperations = ['resize', 'spacing', 'align', 'distribute', 'style'];
  const sourceOperations = ['content', 'motion', 'state', 'component-variant', 'token-refactor'];
  const types = new Set(
    rows.map(({ change, operation }) => {
      if (sourceOperations.includes(operation?.kind) || sourceCategories.includes(change.category))
        return 'Source operations';
      if (
        !styleCategories.includes(change.category) ||
        (operation && !styleOperations.includes(operation.kind))
      )
        return 'Unknown';
      if (['component', 'variant'].includes(change.scope)) return 'Shared styles';
      return change.scope === 'instance' ? 'Local styles' : 'Unknown';
    }),
  );
  return {
    total: changes.length,
    included: rows.filter(({ change, issue }) => change.status === 'approved' && !issue).length,
    mappingIssues,
    knownFiles,
    knownFileCount: knownFiles.length,
    missingSourceCount,
    filesLabel: !changes.length
      ? 'No changes'
      : missingSourceCount
        ? knownFiles.length
          ? `${knownFiles.length} known · Unknown`
          : 'Unknown'
        : String(knownFiles.length),
    mappingLabel: !changes.length ? 'No changes' : mappingIssues ? 'Needs review' : 'Mapped',
    riskLabel: !changes.length
      ? 'No changes'
      : mappingIssues
        ? 'Needs review'
        : types.has('Unknown')
          ? 'Unknown'
          : types.size > 1
            ? 'Mixed changes'
            : [...types][0],
  };
}

// Fit rendered content to its actual host, never to a nominal studio width.
export function previewFitScale(width, height, hostWidth, hostHeight, gutter = 24) {
  if (![width, height, hostWidth, hostHeight].every((value) => Number(value) > 0)) return 1;
  return Math.max(
    0.01,
    Math.min(1, (hostWidth - gutter * 2) / width, (hostHeight - gutter * 2) / height),
  );
}

export function isAccessibilityFinding(issue) {
  return ['accessibility', 'target-size', 'contrast'].includes(issue.kind);
}

export function deliveryNarrativeReadOnly(record) {
  return ['verified', 'superseded'].includes(record?.status);
}

// The run, not listener presence, determines whether source work has begun.
export function applyLifecyclePresentation(
  run,
  { previewConnected, listenerConnected, deliveryRecords = [] } = {},
) {
  if (!run) return null;
  const presentation = (phase, label, detail, tone = 'neutral', busy = false) => ({
    phase,
    label,
    detail,
    action: 'review',
    step: 3,
    tone,
    busy,
  });
  const reconnect =
    previewConnected === false
      ? ' Reconnect the preview to measure the rebuilt result. Your reviewed batch is preserved.'
      : ' Keep the preview open for rendered verification.';
  const sourcePending = run.interruptedState
    ? 'Existing source work is preserved; resumed work has not begun.'
    : run.retryOf
      ? 'Earlier attempts may have changed source; work for this attempt has not begun.'
      : 'Source work has not begun.';
  switch (run.state) {
    case 'reviewing':
      return presentation(
        'Review',
        'Continue review',
        'Check exact values, source mapping and affected contexts. Source application has not been requested.',
      );
    case 'queued':
      return presentation(
        'Queued',
        'View queued review',
        `${listenerConnected ? 'The reviewed batch is waiting for a listener to claim it.' : 'The reviewed batch is saved and waiting for an agent listener to connect.'} ${sourcePending}`,
        'pending',
      );
    case 'claimed':
      return presentation(
        'Claimed',
        'Follow agent handoff',
        `The agent has received the reviewed batch. ${sourcePending}`,
        'pending',
        true,
      );
    case 'applying':
      return presentation(
        'Applying',
        'Follow source changes',
        `The agent is inspecting and updating the reviewed source. The result is not verified yet.${reconnect}`,
        'pending',
        true,
      );
    case 'rebuilding':
      return presentation(
        'Rebuilding',
        'Follow build checks',
        `Source changes are being checked and rebuilt. Rendered verification is still pending.${reconnect}`,
        'pending',
        true,
      );
    case 'verifying':
      return presentation(
        'Verifying',
        previewConnected === false ? 'Check verification connection' : 'Follow rendered checks',
        previewConnected === false
          ? 'Source application is acknowledged, but the preview is disconnected. Reconnect it to complete rendered verification. Your reviewed batch is preserved.'
          : 'Source application is acknowledged. Foundry is measuring the rebuilt product in every reviewed context.',
        'pending',
        previewConnected !== false,
      );
    case 'passed':
      if (
        deliveryRecords.some(
          (record) => record.applyRunId === run.id && record.status === 'verified',
        )
      ) {
        return {
          ...presentation(
            'Verified',
            'Open verified handoff',
            'The rebuilt product passed verification. Inspect the evidence and export the engineering brief.',
            'success',
          ),
          action: 'delivery',
          step: 4,
        };
      }
      return presentation(
        'Verification complete',
        'Check verification evidence',
        'The run passed its rendered checks. A verified Delivery record is not yet available; inspect the recorded evidence.',
        'pending',
      );
    case 'failed':
    case 'needs_attention':
      return presentation(
        'Needs attention',
        run.interruptedState ? 'Review interrupted application' : 'Review failed checks',
        run.interruptedState
          ? 'The application was interrupted and source changes may already exist. Review the recorded progress before choosing Resume with agent. Nothing resumes automatically.'
          : 'The application did not complete successfully. Review the failed checks before choosing Retry with agent. Nothing retries automatically.',
        'attention',
      );
    case 'cancelled':
      return presentation(
        'Cancelled',
        'Review stopped application',
        'This application was stopped. Review the recorded source changes and checks; stopping does not undo source edits or prove verification.',
      );
    default:
      return null;
  }
}

// Pure view models. Navigation never mutates selection, preview context or the ledger.
export function workflowStep({
  session,
  selection,
  previewConnected,
  listenerConnected,
  readiness,
}) {
  const changes = (session?.changeSet?.changes ?? []).filter((item) => item.status !== 'rejected');
  const pending = changes.filter((item) => item.status !== 'applied');
  const runs = [...(session?.applyRuns ?? [])].sort((a, b) =>
    String(b.requestedAt ?? b.createdAt ?? '').localeCompare(
      String(a.requestedAt ?? a.createdAt ?? ''),
    ),
  );
  const run = runs[0];
  const lifecycle = applyLifecyclePresentation(run, {
    previewConnected,
    listenerConnected,
    deliveryRecords: session?.deliveryRecords,
  });
  if (run && !['passed', 'cancelled'].includes(run.state) && lifecycle) {
    return lifecycle;
  }
  if (pending.length) {
    return {
      phase: 'Staged',
      label: `Review ${pending.length} ${pending.length === 1 ? 'edit' : 'edits'}`,
      detail:
        previewConnected === false
          ? 'Your staged edits are saved. Reconnect the preview, then check values, source mapping and every affected context in Review.'
          : listenerConnected
            ? 'Check exact values, source mapping and every affected context before Apply.'
            : 'Your staged edits are saved for Review. You can queue an approved batch to wait for an agent listener.',
      action: 'review',
      step: 2,
    };
  }
  if (lifecycle) return lifecycle;
  if (!previewConnected || readiness?.capabilities?.inspect === false) {
    return {
      phase: 'Connect',
      label: 'Check connection',
      detail:
        'Connect a rendered preview before selecting or editing. Your saved work is preserved; configuration alone is not a live connection.',
      action: 'readiness',
      step: 0,
    };
  }
  if (!selection) {
    return {
      phase: 'Explore',
      label: 'Start first edit',
      detail:
        'Choose a visible layer in Canvas. Foundry will show its measured values and source confidence.',
      action: 'canvas',
      step: 1,
    };
  }
  const sourceMapped =
    typeof selection.source === 'string'
      ? selection.confidence === 'instrumented' &&
        /^.+:[1-9]\d*(?::[1-9]\d*)?$/.test(selection.source)
      : selection.source?.file || selection.source?.path;
  const mapped = selection.confidence && selection.confidence !== 'unresolved' && sourceMapped;
  return {
    phase: 'Temporary preview',
    label: mapped ? 'Refine selection' : 'Inspect source mapping',
    detail: mapped
      ? 'Adjust one measured property in the inspector. Preview changes stay temporary until staged, reviewed and applied.'
      : 'This selection is not source-mapped. Inspect it freely; resolve its mapping before source application.',
    action: 'selection',
    step: 1,
  };
}

export function affectedContexts(change) {
  const context = change.context ?? {};
  const sets = change.contextSet ?? {
    breakpoints: [context.breakpoint ?? 'current'],
    themes: [context.theme ?? 'current'],
    states: [context.state ?? 'current'],
  };
  return sets.breakpoints.flatMap((breakpoint) =>
    sets.themes.flatMap((theme) => sets.states.map((state) => ({ breakpoint, theme, state }))),
  );
}

export function engineeringEvidence(record, runs) {
  const run = runs.find((candidate) => candidate.id === record.applyRunId);
  const changes = run?.reviewedChangeSet?.changes ?? [];
  return changes.flatMap((change) =>
    affectedContexts(change).map((context) => {
      const verification = engineeringVerification(record, run, change, context);
      return {
        change,
        context,
        ...verification,
        result: verification.result
          ? { ...verification.result, reason: verification.reason ?? verification.result.reason }
          : undefined,
        // The before value is a captured measurement, not an invented before screenshot.
        beforeProvenance: `Captured ${change.createdAt ?? 'before review'}`,
      };
    }),
  );
}
// A completed reasoning-only answer is not a queued proposal request.
export function visualAgentResponsePresentation(request) {
  const count = request?.proposals?.length ?? 0;
  const answered = request?.status === 'ready' && count === 0;
  return {
    answered,
    label: answered
      ? 'Answered'
      : request?.status === 'ready'
        ? `${count} ready`
        : (request?.status ?? '').replaceAll('_', ' '),
  };
}
