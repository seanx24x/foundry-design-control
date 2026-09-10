import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('workspace exposes one predictable design-tool hierarchy', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /class="app-bar"/);
  assert.match(html, /id="layers-dock"/);
  assert.match(html, /id="product-preview"/);
  assert.match(html, /id="inspector-dock"/);
  assert.match(html, /class="canvas-toolbar"/);
  assert.match(html, /id="change-summary"/);
});

test('change summary is top-centered and review deletion restores through the live bridge', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.change-summary\s*\{[\s\S]*top:\s*60px/);
  assert.match(css, /\.change-summary\s*\{[\s\S]*left:\s*50%/);
  assert.match(css, /\.change-summary\s*\{[\s\S]*translateX\(-50%\)/);
  assert.match(source, /data-delete-change=/);
  assert.match(source, /requestCommand\('delete-change'/);
  assert.match(source, /foundry:workspace-result/);
});

test('review and project utilities are center workspace modes', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  for (const mode of [
    'review',
    'states',
    'components',
    'responsive',
    'system',
    'motion',
    'typography',
    'branches',
    'health',
    'memory',
    'recipes',
    'agent',
  ]) {
    assert.match(html, new RegExp(`data-mode-surface="${mode}"`));
  }
  assert.match(html, /Apply with agent/);
  assert.match(html, /Open overlay preview/);
  assert.match(html, /aria-label="Foundry workspaces"/);
  assert.match(
    html,
    /data-workspace-mode="states">\s*<i data-icon="layers"><\/i><span>State workbench<\/span>/,
  );
  assert.match(
    html,
    /data-workspace-mode="recipes">\s*<i data-icon="copy"><\/i><span>Visual recipes<\/span>/,
  );
  assert.match(html, /data-studio-action="stress-run"/);
  assert.match(html, /data-studio-action="memory-record"/);
  assert.match(css, /\.app-shell\s*\{[\s\S]*grid-template-rows:\s*48px minmax\(0, 1fr\)/);
  assert.match(css, /\.app-bar\s*\{[\s\S]*height:\s*48px;[\s\S]*display:\s*flex/);
  assert.doesNotMatch(
    css,
    /\.app-shell:not\(\[data-mode='canvas'\]\) \.app-bar\s*\{[\s\S]*display:\s*none/,
  );
});

test('workspace shortcuts never steal editable, composed, or modified keyboard input', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(source, /function editableTarget\(target\)/);
  assert.match(source, /function interactiveShortcutTarget\(target\)/);
  assert.match(
    source,
    /input, select, textarea, \[contenteditable\]:not\(\[contenteditable="false"\]\), \[role="textbox"\]/,
  );
  assert.match(source, /event\.isComposing \|\| event\.key === 'Process'/);
  assert.match(
    source,
    /event\.metaKey \|\|[\s\S]*event\.ctrlKey \|\|[\s\S]*event\.altKey \|\|[\s\S]*event\.shiftKey/,
  );
  assert.match(source, /editableTarget\(event\.target\)/);
  assert.match(source, /interactiveShortcutTarget\(event\.target\)/);
});

test('workspace tabs and panel resizing are fully keyboard operable', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(
    html,
    /id="dock-resizer"[\s\S]*role="separator"[\s\S]*aria-orientation="vertical"[\s\S]*aria-valuemin="320"[\s\S]*aria-valuemax="520"[\s\S]*tabindex="0"/,
  );
  assert.match(source, /function setDockWidth\(width/);
  assert.match(source, /dockResizer\.addEventListener\('keydown'/);
  assert.match(source, /ArrowLeft:[\s\S]*ArrowRight:[\s\S]*Home:\s*320,[\s\S]*End:\s*520/);
  assert.match(source, /function syncTabStops\(root = document\)/);
  assert.match(source, /\['ArrowLeft', 'ArrowRight', 'Home', 'End'\]/);
});

test('state workbench falls back to its first available state when canvas context is unmatched', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(source, /const requestedState = \$\('#canvas-state'\)\?\.value/);
  assert.match(source, /states\.some\(\(item\) => item\.id === requestedState\)/);
  assert.match(source, /: states\[0\]\?\.id \|\| 'current'/);
  assert.match(source, /aria-pressed="\$\{String\(active\)\}"/);
});

test('session polling preserves active edits and scroll while coalescing connection failures', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(source, /let pendingSessionRender = null/);
  assert.match(source, /function captureDirtyDrafts\(\)/);
  assert.match(source, /function captureWorkspaceScroll\(\)/);
  assert.match(source, /function flushPendingSessionRender\(\)/);
  assert.match(source, /function sessionRenderBlocked\(\)/);
  assert.match(source, /motionStudioInteracting \|\|[\s\S]*canvasPanning/);
  assert.match(source, /version: agent\.version \?\? null/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{ payload, presence \}\)/);
  assert.match(source, /document\.addEventListener\('focusout'/);
  assert.match(source, /message !== lastSessionLoadError/);
  assert.match(
    source,
    /setInterval\(\(\) => void loadSession\(\{ deferRender: true, isPoll: true \}\), 1500\)/,
  );
});

test('review distinguishes the live preview from the active agent listener', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(source, /let activeAgentPresence = \{ connected: false, presence: null \}/);
  assert.match(source, /\/v1\/sessions\/\$\{sessionId\}\/agent-presence/);
  assert.match(source, /const listenerConnected = Boolean\(activeAgentPresence\.connected\)/);
  assert.match(source, /Queue \$\{included\} for agent/);
  assert.match(source, /Agent currently offline/);
  assert.match(source, /Waiting for agent/);
  assert.match(source, /Agent handoff/);
  assert.match(source, /Queue resume for agent/);
  assert.match(
    source,
    /Batch queued\. A Foundry agent will claim it when its listener reconnects\./,
  );
});

test('the application bar reports runtime, preview, and listener status truthfully', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(html, /id="live-status"[\s\S]*data-status="connecting"[\s\S]*aria-live="polite"/);
  assert.match(source, /function renderConnectionStatus\(\)/);
  assert.match(source, /Runtime, preview, and Apply listener connected/);
  assert.match(source, /Apply listener is not active/);
  assert.match(source, /label: 'Reconnecting'/);
});

test('delivery milestones use an in-product, source-safe dialog', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(
    html,
    /id="delivery-milestone-dialog"[\s\S]*aria-labelledby="delivery-milestone-title"/,
  );
  assert.match(html, /id="delivery-milestone-name"[\s\S]*maxlength="80"[\s\S]*required/);
  assert.match(source, /\$\('#delivery-milestone-dialog'\)[\s\S]*dialog\.showModal\(\)/);
  assert.match(source, /\/delivery-milestones/);
  assert.doesNotMatch(source, /window\.prompt\('Milestone name'/);
});

test('visual agent grounds conversation in rendered context and isolates proposals', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /data-mode-surface="agent"/);
  assert.match(html, /id="visual-agent-context"/);
  assert.match(html, /id="visual-agent-region"/);
  assert.match(html, /Ask active agent/);
  assert.match(html, /New question/);
  assert.match(html, /id="visual-agent-review"/);
  assert.match(html, /visual-agent-compose-form/);
  assert.match(source, /function visualAgentContextSnapshot/);
  assert.match(source, /selection\?\.targets/);
  assert.match(source, /visual-agent-requests/);
  assert.match(source, /capture-agent-region/);
  assert.match(source, /Preview direction/);
  assert.match(source, /Move to Review/);
  assert.match(source, /visual-agent-conversation-head/);
  assert.match(source, /Source-safe directions/);
  assert.match(source, /verificationPlan/);
  assert.match(source, /\['agent', 'Visual agent', 'a', 'message'\]/);
  assert.match(css, /\.visual-agent-shell/);
  assert.match(css, /\.visual-agent-proposal-grid/);
});

test('design decision memory keeps project guidance contextual, correctable, and portable', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /Design Memory/);
  assert.match(html, /id="decision-memory-list"/);
  assert.match(html, /id="decision-memory-stage"/);
  assert.match(html, /id="decision-guidance"/);
  assert.match(html, /Approved/);
  assert.match(html, /Rejected/);
  assert.match(html, /Rule/);
  assert.match(source, /function renderDecisionGuidance/);
  assert.match(source, /save-design-decision/);
  assert.match(source, /update-design-decision/);
  assert.match(source, /remove-design-decision/);
  assert.match(source, /import-design-decisions/);
  assert.match(source, /foundry-design-decisions\.json/);
  assert.match(source, /Potential conflict/);
  assert.match(css, /\.decision-memory-shell/);
  assert.match(
    css,
    /\.decision-memory-empty\s*\{[\s\S]*min-height:\s*320px;[\s\S]*place-content:\s*center;[\s\S]*justify-items:\s*center/,
  );
  assert.match(css, /\.decision-relevance\[data-conflict='true'\]/);
  assert.match(css, /\.decision-guidance\[data-status='conflict'\]/);
});

test('visual recipes preserve intent, inspect compatibility, and enter review explicitly', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /data-mode-surface="recipes"/);
  assert.match(html, /id="visual-recipe-list"/);
  assert.match(html, /id="visual-recipe-stage"/);
  assert.match(html, /Capture treatment/);
  assert.match(html, /Portable treatments/);
  assert.match(html, /Duplicate selected recipe/);
  assert.match(source, /Suggested, never automatic/);
  assert.match(html, /Running a recipe only creates previews\s+for Review/);
  assert.match(source, /Destination mapping/);
  assert.match(source, /visual-recipe-map-columns/);
  assert.match(source, /function renderVisualRecipes/);
  assert.match(source, /save-visual-recipe/);
  assert.match(source, /duplicate-visual-recipe/);
  assert.match(source, /apply-visual-recipe/);
  assert.match(source, /import-visual-recipes/);
  assert.match(source, /foundry-visual-recipes\.json/);
  assert.match(source, /\['recipes', 'Visual recipes', 'r', 'copy'\]/);
  assert.match(css, /\.visual-recipes-shell/);
  assert.match(css, /\.visual-recipe-map-list/);
  assert.match(css, /\.recipe-compatibility/);
});

test('content and accessibility lab keeps stress previews temporary and corrections reviewable', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /Content Stress Lab/);
  assert.match(html, /id="stress-profile-list"/);
  assert.match(html, /id="apply-stress"/);
  assert.match(html, /id="stress-finding-groups"/);
  assert.match(html, /Temporary conditions remain outside the design change history/);
  assert.match(source, /apply-health-stress/);
  assert.match(source, /clear-health-stress/);
  assert.match(source, /preview-health-fix/);
  assert.match(html, /data-stress-group="source"/);
  assert.match(source, /\['health', 'Content stress lab', '4', 'activity'\]/);
  assert.match(css, /\.stress-lab-shell/);
  assert.match(css, /\.stress-finding-card/);
  assert.match(css, /\.stress-profile\.is-active/);
});

test('design branches isolate alternatives, compare rendered directions, and promote explicitly', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /data-mode-surface="branches"/);
  assert.match(html, /id="design-branch-list"/);
  assert.match(html, /id="design-branch-previews"/);
  assert.match(html, /id="design-branch-decision-list"/);
  assert.match(html, /id="design-branch-record-list"/);
  assert.match(html, /id="design-branch-record-import"/);
  assert.match(html, /id="design-branch-record-export"/);
  assert.match(html, /id="design-branch-compose"/);
  assert.match(html, /Combine selected/);
  assert.match(source, /function renderDesignBranches/);
  assert.match(source, /switch-design-branch/);
  assert.match(source, /preview-design-branch/);
  assert.match(source, /design-branches\/activate/);
  assert.match(source, /design-branches\/\$\{encodeURIComponent\(chosen\.id\)\}\/promote/);
  assert.match(source, /function renderDesignBranchRecords/);
  assert.match(source, /design-branch-records\/\$\{encodeURIComponent/);
  assert.match(source, /Add to Memory/);
  assert.match(source, /Return to main/);
  assert.match(source, /\['branches', 'Design branches', 'b', 'branch'\]/);
  assert.match(css, /\.design-branches-shell/);
  assert.match(css, /\.design-branch-preview-viewport iframe/);
  assert.match(css, /\.design-branch-decision-row/);
  assert.match(css, /\.design-branch-record\[data-compatibility='stale'\]/);
});

test('typography studio connects font discovery, live previews, diagnostics, and review', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /data-mode-surface="typography"/);
  assert.match(html, /id="typography-font-list"/);
  assert.match(html, /id="typography-studio-stage"/);
  assert.match(html, /id="typography-studio-properties"/);
  assert.match(source, /function renderTypographyStudio/);
  assert.match(source, /queryLocalFonts/);
  assert.match(source, /google-fonts\?query=/);
  assert.match(source, /preview-treatment/);
  assert.match(source, /preview-scale/);
  assert.match(source, /review-google/);
  assert.match(source, /save-style/);
  assert.match(source, /Rendered type is stable/);
  assert.match(source, /\['typography', 'Typography studio', '0', 'typography'\]/);
  assert.match(css, /\.typography-studio-shell/);
  assert.match(css, /\.typography-specimen/);
  assert.match(css, /\.typography-audit/);
});

test('motion studio exposes native adapters, paths, synchronized comparison, timing curves, keyframes, and motion health', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /data-mode-surface="motion"/);
  assert.match(html, /id="motion-studio-list"/);
  assert.match(html, /id="motion-studio-stage"/);
  assert.match(html, /id="motion-studio-properties"/);
  assert.match(source, /function renderMotionStudio/);
  assert.match(source, /mode === 'motion' && previousMode !== 'motion'/);
  assert.match(source, /const resetPropertiesScroll = motionStudioResetPropertiesScroll/);
  assert.match(source, /if \(resetPropertiesScroll\) properties\.scrollTop = 0/);
  assert.match(
    source,
    /if \(nextMotionId !== motionStudioId\) motionStudioResetPropertiesScroll = true/,
  );
  assert.match(source, /function renderNativeMotionSource/);
  assert.match(source, /Motion for React/);
  assert.match(source, /React Spring/);
  assert.match(source, /data-native-adapter/);
  assert.match(source, /data-studio-action="scrub"/);
  assert.match(source, /data-studio-property="iterations"/);
  assert.match(source, /data-studio-property="direction"/);
  assert.match(source, /data-studio-property="fill"/);
  assert.match(source, /function renderMotionCurveEditor/);
  assert.match(source, /data-curve-kind-select="cubic-bezier"/);
  assert.match(source, /data-curve-kind-select="spring"/);
  assert.match(source, /data-curve-handle="1"/);
  assert.match(source, /commitMotionCurve/);
  assert.match(source, /Preview curve/);
  assert.match(source, /function renderMotionPathEditor/);
  assert.match(source, /data-path-point/);
  assert.match(source, /action: 'path-point'/);
  assert.match(source, /function renderMotionComparison/);
  assert.match(source, /data-comparison-action="play"/);
  assert.match(source, /motionPathSample/);
  assert.match(source, /Play together/);
  assert.match(source, /Reduced motion needs review/);
  assert.match(html, /Playback controls are previews/);
  assert.match(source, /\['motion', 'Motion studio', '9', 'play'\]/);
  assert.match(css, /\.motion-studio-shell/);
  assert.match(css, /\.motion-studio-rail/);
  assert.match(css, /\.motion-studio-properties/);
  assert.match(css, /\.motion-native-source/);
  assert.match(css, /\.motion-native-properties/);
  assert.match(css, /\.motion-curve-editor/);
  assert.match(css, /\.motion-path-editor/);
  assert.match(css, /\.motion-comparison/);
  assert.match(css, /\.motion-selection-summary\s*\{[\s\S]*justify-content:\s*stretch/);
  assert.match(css, /\.motion-studio-stage > \.motion-studio-empty\s*\{[\s\S]*width:\s*100%/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test('design system resolves aliases and stages recurring-value promotion through review', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /data-mode-surface="system"/);
  assert.match(html, /id="design-system-token-list"/);
  assert.match(html, /id="design-system-detail"/);
  assert.match(source, /function renderDesignSystem/);
  assert.match(source, /project\.tokenUsages/);
  assert.match(source, /project\.designSystemFindings/);
  assert.match(source, /project\.tokenPromotions/);
  assert.match(source, /Alias chain/);
  assert.match(source, /Add plan to Review/);
  assert.match(source, /stage-token-promotion/);
  assert.match(source, /Changing this token can affect/);
  assert.match(source, /No automatic changes/);
  assert.match(source, /\['system', 'Design system', '8', 'sparkles'\]/);
  assert.match(source, /renderIcons\(\$\('\[data-mode-surface="system"\]'\)\)/);
  assert.doesNotMatch(source, /renderIcons\(\$\('#design-system-mode'\)\)/);
  assert.match(css, /\.design-system-shell/);
  assert.match(
    css,
    /\.design-system-detail\s*\{[\s\S]*overflow-x:\s*hidden;[\s\S]*overflow-y:\s*scroll;[\s\S]*scrollbar-gutter:\s*auto/,
  );
  assert.match(css, /\.design-system-detail-head\s*\{[\s\S]*box-shadow:\s*none/);
  assert.match(css, /\.design-finding-list/);
  assert.match(css, /\.alias-chain/);
});

test('responsive lab keeps native iframe viewports and temporary stress state separate', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /id="responsive-width"/);
  assert.match(html, /data-responsive-target="container"/);
  assert.match(html, /id="responsive-capture-before"/);
  assert.match(html, /id="responsive-comparison-grid"/);
  assert.match(html, /data-responsive-stress="browser-zoom"/);
  assert.match(html, /data-responsive-scope="all"/);
  assert.match(source, /frame\.width = responsiveCustomWidth/);
  assert.match(source, /--preview-width/);
  assert.match(source, /preview-responsive-stress/);
  assert.match(source, /preview-responsive-container/);
  assert.match(source, /projectDesign\(\)\.containerQueries/);
  assert.match(source, /function responsiveComparisonSnapshot/);
  assert.match(source, /documentScrollWidth > snapshot\.viewportWidth/);
  assert.match(
    source,
    /const hasDistinctLabel = label\.toLowerCase\(\) !== widthLabel\.toLowerCase\(\)/,
  );
  assert.match(source, /hasDistinctLabel \? `<span>\$\{widthLabel\}<\/span>` : ''/);
  assert.match(source, /\['responsive', 'Responsive design lab', '7', 'layout'\]/);
  assert.match(css, /\.responsive-frame-viewport iframe/);
  assert.match(css, /\.responsive-comparison-grid/);
  assert.match(css, /transform-origin:\s*top center/);
  assert.match(
    css,
    /\.responsive-boundaries\s*\{[\s\S]*overflow-x:\s*auto;[\s\S]*overflow-y:\s*hidden;[\s\S]*scrollbar-width:\s*none/,
  );
  assert.match(css, /\.responsive-boundaries::\-webkit-scrollbar\s*\{[\s\S]*display:\s*none/);
  assert.match(
    css,
    /\.responsive-boundaries button\.is-single-label\s*\{[\s\S]*justify-content:\s*center/,
  );
  assert.match(
    css,
    /\.responsive-boundaries button\.has-secondary-label\s*\{[\s\S]*min-width:\s*144px/,
  );
  assert.match(css, /\.responsive-boundaries\s*\{[\s\S]*background:\s*var\(--surface\)/);
});

test('component workshop exposes source-backed variants, drift repair, safe scopes, and visual states', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /id="component-workshop-list"/);
  assert.match(html, /id="component-workshop-detail"/);
  assert.match(html, /class="workshop-browser-head"/);
  assert.match(html, /id="component-workshop-contract"/);
  assert.match(source, /function normalizedWorkshopComponents/);
  assert.match(source, /select-component-instance/);
  assert.match(source, /preview-component-variant/);
  assert.match(source, /preview-component-state/);
  assert.match(source, /Create source variant/);
  assert.match(source, /stage-component-variant/);
  assert.match(source, /Cross-instance drift/);
  assert.match(source, /repair-component-variant-drift/);
  assert.match(source, /function workshopVariantDrift/);
  assert.match(
    source,
    /Broader scopes remain unavailable until Foundry has an exact source target/,
  );
  assert.match(source, /\['components', 'Component workshop', '6', 'component'\]/);
  assert.match(css, /\.component-workshop-shell/);
  assert.match(css, /\.workshop-state-grid/);
  assert.match(css, /\.workshop-authoring-form/);
  assert.match(css, /\.workshop-drift-list/);
});

test('apply progress reuses the review hierarchy and reports the complete run', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /id="apply-run" aria-live="polite"/);
  assert.match(source, /class="mode-head apply-head"/);
  assert.match(source, /class="apply-workspace"/);
  assert.match(source, /class="apply-evidence"/);
  assert.match(source, /class="apply-progress-list"/);
  assert.match(source, /class="review-footer apply-footer"/);
  assert.match(source, /Changed files/);
  assert.match(source, /Rendered verification/);
  assert.match(source, /run\.state === 'passed'/);
  assert.match(source, /run\.interruptedState \? 'resume' : 'retry'/);
  assert.match(source, /Resume with agent/);
  assert.match(css, /\.apply-workspace\s*\{[\s\S]*grid-template-columns:/);
  assert.match(css, /\.apply-evidence\s*\{[\s\S]*flex-direction:\s*column/);
  assert.doesNotMatch(css, /\.apply-card\s*\{/);
});

test('review values append units only to unitless numeric data', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(source, /if \(!suffix\) return rendered/);
  assert.match(source, /typeof value === 'number'/);
  assert.match(source, /return `\$\{rendered\}\$\{suffix\}`/);
  assert.doesNotMatch(source, /return `\$\{rendered\}\$\{unit \?\? ''\}`/);
});

test('active source runs require an explicit second action before cancellation', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(source, /Stop apply/);
  assert.match(source, /Confirm stop/);
  assert.match(source, /Press Confirm stop within 5 seconds/);
  assert.match(source, /Foundry is keeping the handoff active while source work begins/);
  assert.match(source, /cancelConfirmationUntil = now \+ 5_000/);
});

test('canvas preserves native viewport dimensions and exposes explicit navigation', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /data-canvas-mode="pan"/);
  assert.match(html, /id="canvas-zoom"/);
  assert.match(html, /Actual size/);
  assert.match(html, /Fit width/);
  assert.match(source, /activeSession\?\.changeSet\?\.context\?\.viewport/);
  assert.match(source, /activeSession\?\.designGraph/);
  assert.match(source, /function projectDesign\(\)/);
  assert.match(source, /frame\.style\.width = `\$\{viewport\.width\}px`/);
  assert.match(source, /translate3d\(\$\{canvasView\.x\}px, \$\{canvasView\.y\}px, 0\) scale/);
  assert.match(source, /Math\.max\(0\.05, Math\.min\(4/);
  assert.match(source, /foundry:canvas-input/);
  assert.match(css, /\.preview-frame\s*\{[\s\S]*position:\s*absolute/);
  assert.match(css, /\.preview-frame\s*\{[\s\S]*border:\s*0/);
  assert.match(css, /transform-origin:\s*0 0/);
  assert.match(css, /\.layers-dock\s*\{[\s\S]*grid-column:\s*1/);
  assert.match(css, /\.center-workspace\s*\{[\s\S]*grid-column:\s*2/);
  assert.match(css, /\.inspector-dock\s*\{[\s\S]*grid-column:\s*3/);
});

test('workspace dropdowns use the Foundry listbox system', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(source, /role', 'combobox'/);
  assert.match(source, /role', 'listbox'/);
  assert.match(source, /role="option"/);
  assert.match(source, /moveSelectFocus/);
  assert.match(source, /typeahead/);
  assert.match(source, /select\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(source, /selectAccessibleLabel/);
  assert.match(css, /\.foundry-select-menu/);
  assert.match(css, /max-height/);
});

test('search fields focus without nested selection rings', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.search-field:focus-within\s*\{[\s\S]*box-shadow:\s*none/);
  assert.match(
    css,
    /\.search-field > input:focus,[\s\S]*\.search-field > input:focus-visible\s*\{[\s\S]*outline:\s*none;[\s\S]*box-shadow:\s*none/,
  );
});

test('visual foundations use the Google Sans-led type stack and four-pixel system', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  const visualSystem = css.slice(css.indexOf('/* Foundry v3 visual system'));
  const darkTokens = visualSystem.match(/:root\[data-theme='dark'\]\s*\{([^}]+)\}/)?.[1] ?? '';
  assert.match(css, /fonts\/inter\.woff2/);
  assert.match(css, /fonts\/jetbrains-mono\.woff2/);
  assert.match(css, /'Google Sans Flex', 'Foundry Inter'/);
  assert.match(css, /'Google Sans Code', 'Foundry JetBrains Mono'/);
  assert.match(css, /--dock:\s*320px/);
  assert.match(css, /--bg:\s*#eff0f1/);
  assert.match(css, /--selection:\s*#e44d00/);
  assert.match(css, /--blue:\s*var\(--selection\)/);
  assert.match(css, /\.layer-meta[\s\S]*font:\s*600 8px\/1 var\(--mono\)/);
  assert.match(css, /::-webkit-color-swatch[\s\S]*border-radius:\s*4px/);
  assert.match(css, /html,[\s\S]*body\s*\{[\s\S]*font-size:\s*12px/);
  assert.match(css, /\.mode-head h1\s*\{[\s\S]*font-size:\s*20px/);
  assert.match(darkTokens, /--selection:\s*#ff681f/);
  assert.match(darkTokens, /--blue:\s*var\(--selection\)/);
  assert.match(darkTokens, /--blue-soft:\s*var\(--selection-soft\)/);
  assert.match(css, /\.state-preview-viewport\s*\{[\s\S]*background:\s*var\(--surface\)/);
  assert.match(
    css,
    /\.danger-button\s*\{[\s\S]*color:\s*var\(--red\);[\s\S]*background:\s*var\(--red-soft\)/,
  );
  assert.match(
    visualSystem,
    /\.workspace-rail \.rail-button\.is-active\s*\{[\s\S]*color:\s*var\(--selection\);[\s\S]*border-color:\s*var\(--selection\);[\s\S]*background:\s*var\(--selection-soft\);/,
  );
  assert.doesNotMatch(visualSystem, /\.rail-button\.is-active:not\(/);
});

test('every focused workspace inherits the compact Canvas frame contract', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /--workspace-header-height:\s*48px/);
  assert.match(
    css,
    /\.centered-mode:not\(\[hidden\]\),[\s\S]*\.apply-surface\s*\{[\s\S]*grid-template-rows:\s*var\(--workspace-header-height\) minmax\(0, 1fr\)/,
  );
  assert.match(
    css,
    /\.centered-mode > \.mode-head,[\s\S]*\.apply-surface > \.mode-head\s*\{[\s\S]*height:\s*var\(--workspace-header-height\);[\s\S]*border-bottom:\s*1px solid var\(--line\)/,
  );
  assert.match(
    css,
    /@media \(max-width: 1040px\)[\s\S]*\.review-workspace,[\s\S]*\.apply-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) !important/,
  );
});

test('the workspace exposes one main landmark and valid nested regions', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.equal(html.match(/<main\b/g)?.length ?? 0, 1);
  assert.equal(html.match(/<\/main>/g)?.length ?? 0, 1);
  assert.match(html, /responsive-stress-group"\s*role="group"/);
  assert.match(html, /responsive-scope-group"\s*role="group"/);
});

test('workspace empty states share one icon, title, and body composition', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(source, /stress-empty foundry-empty-state/);
  assert.match(source, /decision-memory-empty foundry-empty-state/);
  assert.match(source, /motion-studio-empty foundry-empty-state/);
  assert.match(source, /typography-studio-empty foundry-empty-state/);
  assert.match(source, /visual-recipe-empty foundry-empty-state/);
  assert.match(source, /visual-agent-empty foundry-empty-state/);
  assert.match(source, /delivery-empty foundry-empty-state/);
  assert.match(source, /branch-decisions-empty foundry-empty-state/);
  assert.match(
    css,
    /\.foundry-empty-state\s*,\s*\.delivery-empty\s*\{[\s\S]*grid-auto-rows:\s*max-content/,
  );
  assert.match(css, /\.foundry-empty-state > svg[\s\S]*width:\s*24px;[\s\S]*height:\s*24px/);
  assert.match(
    css,
    /\.foundry-empty-state > p[\s\S]*max-width:\s*360px;[\s\S]*line-height:\s*18px/,
  );
});

test('workspace uses real Keyline vectors and validates the embedded bridge', async () => {
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(source, /@iconify-icons\/keyline-icons/);
  assert.match(source, /event\.source !== preview\.contentWindow/);
  assert.match(source, /event\.origin !== previewOrigin/);
  assert.match(source, /foundry:workspace-command/);
  assert.match(source, /foundry:workspace-state/);
  assert.match(source, /data-add-effect="drop-shadow"/);
  assert.match(source, /data-shadow-part=/);
  assert.match(source, /'spread'/);
  assert.match(source, /focusedInspectorEdit/);
  assert.match(source, /restoreInspectorEdit/);
  assert.match(source, /inspectorContent\?\.contains/);
  assert.match(source, /scheduleEffectCommit/);
  assert.match(source, /Background blur/);
  assert.match(source, /Available when the project exposes a mapped effect recipe/);
  assert.match(source, /function motionEditorMarkup/);
  assert.match(source, /sendCommand\('motion-action'/);
  assert.match(source, /data-motion-action="scrub"/);
  assert.match(source, /data-motion-keyframe-index/);
  assert.match(source, /keyframe-\$\{action\}/);
  assert.match(source, /data-layer-selector="\$\{escapeAttribute\(layer\.selector\)\}"/);
  assert.match(source, /Keyframes/);
  assert.match(source, /role="group" aria-label="Editable transform motion path"/);
  assert.match(source, /role="slider"[\s\S]*aria-valuenow=/);
  assert.match(source, /Trigger this transition in Interact mode/);
  assert.match(css, /\.motion-card/);
  assert.match(css, /\.motion-timeline/);
  assert.match(css, /\.motion-track-rail/);
  assert.match(css, /\.motion-keyframe\.is-selected/);
});
