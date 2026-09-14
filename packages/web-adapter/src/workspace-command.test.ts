import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

test('routes every correlated workspace command through one acknowledgement boundary', () => {
  assert.match(source, /async function executeWorkspaceCommand\(/);
  assert.match(source, /Unknown workspace command:/);
  assert.match(
    source,
    /executeWorkspaceCommand\(command, payload\)[\s\S]*?publishWorkspaceResult\(message\.requestId, \{[\s\S]*?ok: true,[\s\S]*?\.catch\(\(error\)/,
  );
  assert.match(source, /Workspace command is required/);
  assert.match(source, /The preview changed, but its source change could not be recorded/);
  assert.match(source, /return \{\s*applied: outcome\.applied,\s*recorded: outcome\.recorded,/);
});

test('publishes verification-frame readiness without an animation-frame dependency', () => {
  const publishStart = source.indexOf('function publishWorkspaceState');
  const publishEnd = source.indexOf('function publishCanvasInput', publishStart);
  const publish = source.slice(publishStart, publishEnd);
  assert.ok(publishStart > 0);
  assert.ok(publish.indexOf('if (verificationChild)') < publish.indexOf('requestAnimationFrame'));
  assert.match(publish, /if \(verificationChild\) \{\s*publish\(\);\s*return;/);
  assert.match(publish, /workspacePublishFrame = requestAnimationFrame\(publish\)/);
});

test('waits for an acknowledged and hydrated verification-frame ping', () => {
  const waitStart = source.indexOf('function waitForVerificationFrame');
  const waitEnd = source.indexOf('function requestVerificationPreviewContext', waitStart);
  const wait = source.slice(waitStart, waitEnd);
  assert.ok(waitStart > 0);
  assert.match(wait, /command: 'preview-ping'/);
  assert.match(wait, /requestId !== requestId/);
  assert.match(wait, /message\.payload\.snapshot\?\.verificationReady !== true/);
  assert.match(wait, /setInterval\(ping, 200\)/);
  assert.match(source, /verificationReady: verificationChild \? hydratedOnce : true/);
});

test('does not wait on a throttled paint frame when applying verification context', () => {
  const contextStart = source.indexOf('async function applyPreviewContext');
  const contextEnd = source.indexOf('function collectLayerElements', contextStart);
  const context = source.slice(contextStart, contextEnd);
  assert.ok(contextStart > 0);
  assert.match(context, /if \(verificationChild\) window\.setTimeout\(resolve, 0\)/);
  assert.match(context, /else requestAnimationFrame\(\(\) => resolve\(\)\)/);
});

test('exposes liveness, stable responsive audits, and atomic graph replacement', () => {
  for (const command of [
    'preview-ping',
    'audit-responsive',
    'set-responsive-edit-scope',
    'replace-design-graph',
  ]) {
    assert.match(source, new RegExp(`command === '${command}'`));
  }
  assert.match(source, /await waitForResponsiveAuditStability/);
  assert.match(source, /await document\.fonts\.ready/);
  assert.match(source, /stableLayout:/);
  assert.match(source, /elements: geometry/);
  assert.match(source, /findings,/);
  const replaceStart = source.indexOf('function replaceWorkspaceDesignGraph');
  const replaceEnd = source.indexOf('function typographyCommandTarget', replaceStart);
  const replacement = source.slice(replaceStart, replaceEnd);
  assert.ok(
    replacement.indexOf("for (const field of ['tokens'") <
      replacement.indexOf('designGraph = nextGraph'),
  );
  assert.ok(
    replacement.indexOf('revision conflict') < replacement.indexOf('designGraph = nextGraph'),
  );
  assert.ok(
    replacement.indexOf('restorePreviewState()') < replacement.indexOf('designGraph = nextGraph'),
  );
  assert.ok(
    replacement.indexOf('restoreConfiguredPreviewTheme()') <
      replacement.indexOf('designGraph = nextGraph'),
  );
  assert.ok(
    replacement.indexOf('previewThemeBaseline.attributes.clear()') <
      replacement.indexOf('designGraph = nextGraph'),
  );
  assert.ok(
    replacement.indexOf('designGraph = nextGraph') <
      replacement.indexOf('const reappliedContext = await applyPreviewContext'),
  );
  assert.match(replacement, /if \(!previewContextPreserved\)/);
  assert.match(replacement, /theme: 'current',\s*state: 'current'/);
  assert.match(replacement, /previewContext: \{\s*preserved: previewContextPreserved/);
  assert.match(replacement, /catch \(error\) \{[\s\S]*?designGraph = previousGraph/);
  assert.match(replacement, /previousThemeBaseline\.attributes/);
  assert.match(replacement, /const restoredContext = await applyPreviewContext/);
});

test('captures native focus before applying an authored focus state and restores it exactly', () => {
  const applyStart = source.indexOf('function applyAuthoredPreviewState');
  const applyEnd = source.indexOf('async function applyPreviewContext', applyStart);
  const applyState = source.slice(applyStart, applyEnd);
  assert.ok(applyStart > 0);
  assert.ok(
    applyState.indexOf('const previouslyFocused = deepestActiveElement(document)') <
      applyState.indexOf('applyPreviewStateAttributes(target, definition)'),
  );
  assert.match(applyState, /restoreOriginalFocus\(document, target, previouslyFocused\)/);

  const workbenchStart = source.indexOf('function applyWorkbenchState');
  const workbenchEnd = source.indexOf('function renderWorkbenchMatrix', workbenchStart);
  const workbench = source.slice(workbenchStart, workbenchEnd);
  assert.ok(workbenchStart > 0);
  assert.ok(
    workbench.indexOf('const previouslyFocused = deepestActiveElement(frameDocument)') <
      workbench.indexOf("if (pseudo === 'focus') framedTarget.focus"),
  );
  assert.match(workbench, /restoreOriginalFocus\(frameDocument, framedTarget, previouslyFocused\)/);
});

test('preflights authored hover and active selectors against the selected target', () => {
  const contextStart = source.indexOf('async function applyPreviewContext');
  const contextEnd = source.indexOf('function collectLayerElements', contextStart);
  const context = source.slice(contextStart, contextEnd);
  assert.match(context, /authoredPseudoCss\(document, pseudo, target\)/);
  assert.match(context, /pseudo === 'hover' \|\| pseudo === 'active'/);
  assert.match(
    context,
    /No readable same-origin authored :\$\{unmatchedAuthoredPseudo\} rule matches/,
  );
  assert.match(context, /does not support native focus/);
  assert.match(context, /does not support the native disabled state/);
  assert.ok(
    context.indexOf('const unmatchedAuthoredPseudo') <
      context.indexOf('applyPreviewMutationAtomically'),
  );
});

test('restores the previous preview context with the newest request revision', () => {
  const rollbackStart = source.indexOf('const rollbackContext =');
  const rollbackEnd = source.indexOf('return {', rollbackStart);
  const rollback = source.slice(rollbackStart, rollbackEnd);
  assert.ok(rollbackStart > 0);
  assert.match(rollback, /\.\.\.previousContext/);
  assert.match(rollback, /requestRevision: effectiveContext\.requestRevision/);
  assert.match(rollback, /applyPreviewContext\(rollbackContext, true\)/);
  assert.doesNotMatch(rollback, /applyPreviewContext\(previousContext, true\)/);
});

test('records responsive context sets and rejects an unmapped all-breakpoints edit', () => {
  assert.match(
    source,
    /contextSet: \{\s*breakpoints: contextBreakpoints,\s*themes: contextThemes,\s*states: contextStates,/,
  );
  assert.match(source, /All breakpoints requires a source-mapped target/);
  assert.match(source, /responsiveEditScope = \{\s*scope: 'breakpoint'/);
});

test('measures two-up typography without staging and keeps local fonts preview-only', () => {
  assert.match(source, /command === 'typography-compare'/);
  assert.match(
    source,
    /current,\s*candidate,\s*origin,\s*context: currentPreviewContext,\s*temporary: true,/,
  );
  assert.match(source, /changeCountDelta: recordedChangeCount - changeCountBefore/);
  assert.match(source, /const fontResources = await typographyComparisonResources/);
  assert.match(source, /fontResources,/);
  assert.match(source, /async function inlineTypographyRuleUrls/);
  assert.match(source, /src:local/);
  assert.match(source, /renderable: transferable/);
  assert.match(source, /loadedFaceStatus:/);
  assert.match(source, /lineCount: measuredTextLineCount/);
  assert.match(source, /const visibleSpecimen = \{/);
  assert.match(source, /fontVariationSettings: computed\.fontVariationSettings/);
  assert.match(source, /overflowWrap: computed\.overflowWrap/);
  assert.match(source, /visibleSpecimen,/);
  assert.match(source, /previewOnly: true,\s*changes: 0/);
  assert.match(source, /sourcePlan: integration/);
});

test('arms region capture only after preview listeners are installed', () => {
  assert.match(source, /command === 'arm-agent-region' \|\| command === 'capture-agent-region'/);
  assert.match(source, /if \(!visualAgentRegionCleanup\) throw new Error/);
  assert.match(source, /return \{ armed: true \}/);
});

test('legacy overlay exposes only authored product themes and states', () => {
  assert.doesNotMatch(
    source,
    /<label>Theme<select data-theme><option>current<\/option><option>light<\/option><option>dark<\/option>/,
  );
  assert.doesNotMatch(source, /data-workbench-state="(?:hover|focus|active|disabled)"/);
  assert.doesNotMatch(source, /data-workbench-motion/);
  assert.match(source, /\.\.\.designGraph\.themes\.map/);
  assert.match(source, /workbenchStates\.innerHTML = designGraph\.states/);
  assert.match(source, /const methods = previewStateMethods/);
  assert.match(source, /No authored preview method/);
});

test('keeps selection stress findings on the captured target subtree', () => {
  const scanStart = source.indexOf('function resolveActiveStressTarget');
  const scanEnd = source.indexOf('function renderHealthPanel', scanStart);
  const scan = source.slice(scanStart, scanEnd);
  assert.ok(scanStart > 0);
  assert.match(source, /activeStressTarget =\s*scope === 'selection'/);
  assert.match(
    source,
    /scope === 'selection'\) return selected\?\.isConnected \? \[selected\] : \[\]/,
  );
  assert.match(source, /stressScope === 'selection' && !selected\?\.isConnected/);
  assert.match(source, /const normalizedConditions = validateStressConditions\(conditions\)/);
  assert.match(source, /return scanDesignHealthOrThrow\(\)/);
  assert.match(source, /const findings = applyStressConditions/);
  assert.match(source, /findings: scanDesignHealthOrThrow\(\)/);
  assert.match(
    source,
    /scanDesignHealth\(\);\s*publishWorkspaceState\(\);\s*if \(healthScanError\) throw new Error\(healthScanError\)/,
  );
  assert.match(
    scan,
    /return activeStressTarget\.element\.isConnected \? activeStressTarget\.element : null/,
  );
  assert.doesNotMatch(scan, /resolveFoundrySelector/);
  assert.match(scan, /const healthScope = designHealthScope/);
  assert.match(scan, /healthScope === 'canvas' \|\| \(healthRoot && belongsToHealthRoot/);
  assert.match(source, /activeStressTarget = null/);
});
