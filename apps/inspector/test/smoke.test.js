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
  ]) {
    assert.match(html, new RegExp(`data-mode-surface="${mode}"`));
  }
  assert.match(html, /Apply with agent/);
  assert.match(html, /Open overlay preview/);
  assert.match(html, /data-close-mode="health"/);
  assert.match(html, /data-close-mode="memory"/);
  assert.match(html, /aria-label="Close Design health"/);
  assert.match(html, /aria-label="Close Design memory"/);
});

test('design branches isolate alternatives, compare rendered directions, and promote explicitly', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /data-mode-surface="branches"/);
  assert.match(html, /id="design-branch-list"/);
  assert.match(html, /id="design-branch-previews"/);
  assert.match(html, /id="design-branch-decision-list"/);
  assert.match(html, /Only a chosen direction enters Review and apply/);
  assert.match(source, /function renderDesignBranches/);
  assert.match(source, /switch-design-branch/);
  assert.match(source, /preview-design-branch/);
  assert.match(source, /design-branches\/activate/);
  assert.match(source, /design-branches\/\$\{encodeURIComponent\(chosen\.id\)\}\/promote/);
  assert.match(source, /\['branches', 'Design branches', 'b', 'branch'\]/);
  assert.match(css, /\.design-branches-shell/);
  assert.match(css, /\.design-branch-preview-viewport iframe/);
  assert.match(css, /\.design-branch-decision-row/);
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

test('motion studio exposes live transport, editable timing, keyframes, and motion health', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /data-mode-surface="motion"/);
  assert.match(html, /id="motion-studio-list"/);
  assert.match(html, /id="motion-studio-stage"/);
  assert.match(html, /id="motion-studio-properties"/);
  assert.match(source, /function renderMotionStudio/);
  assert.match(source, /data-studio-action="scrub"/);
  assert.match(source, /data-studio-property="iterations"/);
  assert.match(source, /data-studio-property="direction"/);
  assert.match(source, /data-studio-property="fill"/);
  assert.match(source, /Reduced motion needs review/);
  assert.match(html, /Playback controls are previews/);
  assert.match(source, /\['motion', 'Motion studio', '9', 'play'\]/);
  assert.match(css, /\.motion-studio-shell/);
  assert.match(css, /\.motion-studio-rail/);
  assert.match(css, /\.motion-studio-properties/);
});

test('design system traces native tokens, usages, drift, and impact without applying changes', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /data-mode-surface="system"/);
  assert.match(html, /id="design-system-token-list"/);
  assert.match(html, /id="design-system-detail"/);
  assert.match(source, /function renderDesignSystem/);
  assert.match(source, /project\.tokenUsages/);
  assert.match(source, /project\.designSystemFindings/);
  assert.match(source, /Changing this token can affect/);
  assert.match(source, /No automatic changes/);
  assert.match(source, /\['system', 'Design system', '8', 'sparkles'\]/);
  assert.match(css, /\.design-system-shell/);
  assert.match(css, /\.design-finding-list/);
});

test('responsive lab keeps native iframe viewports and temporary stress state separate', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /id="responsive-width"/);
  assert.match(html, /data-responsive-stress="browser-zoom"/);
  assert.match(html, /data-responsive-scope="all"/);
  assert.match(source, /frame\.width = responsiveCustomWidth/);
  assert.match(source, /--preview-width/);
  assert.match(source, /preview-responsive-stress/);
  assert.match(source, /documentScrollWidth > snapshot\.viewportWidth/);
  assert.match(source, /\['responsive', 'Responsive design lab', '7', 'layout'\]/);
  assert.match(css, /\.responsive-frame-viewport iframe/);
  assert.match(css, /transform-origin:\s*top center/);
});

test('component workshop exposes live instances, safe scopes, variants, and visual states', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /id="component-workshop-list"/);
  assert.match(html, /id="component-workshop-detail"/);
  assert.match(source, /function normalizedWorkshopComponents/);
  assert.match(source, /select-component-instance/);
  assert.match(source, /preview-component-variant/);
  assert.match(source, /preview-component-state/);
  assert.match(
    source,
    /Broader scopes remain unavailable until Foundry has an exact source target/,
  );
  assert.match(source, /\['components', 'Component workshop', '6', 'component'\]/);
  assert.match(css, /\.component-workshop-shell/);
  assert.match(css, /\.workshop-state-grid/);
});

test('apply progress reuses the review hierarchy and reports the complete run', async () => {
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const source = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(html, /id="apply-run" aria-live="polite"/);
  assert.match(source, /class="mode-head apply-head"/);
  assert.match(source, /class="apply-progress-list"/);
  assert.match(source, /class="review-footer apply-footer"/);
  assert.match(source, /Changed files/);
  assert.match(source, /Rendered verification/);
  assert.match(source, /run\.state === 'passed'/);
  assert.match(source, /run\.interruptedState \? 'resume' : 'retry'/);
  assert.match(source, /Resume with agent/);
  assert.match(css, /\.apply-surface\s*\{[\s\S]*flex-direction:\s*column/);
  assert.doesNotMatch(css, /\.apply-card\s*\{/);
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

test('visual foundations use bundled typefaces and a strict dock contract', async () => {
  const css = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');
  assert.match(css, /fonts\/inter\.woff2/);
  assert.match(css, /fonts\/jetbrains-mono\.woff2/);
  assert.match(css, /--dock:\s*384px/);
  assert.match(css, /--blue:\s*#2f6fed/);
  assert.match(css, /\.layer-meta[\s\S]*font:\s*600 8px\/1 var\(--mono\)/);
  assert.match(css, /::-webkit-color-swatch[\s\S]*border-radius:\s*4px/);
  assert.match(css, /html,[\s\S]*body\s*\{[\s\S]*font-size:\s*12px/);
  assert.match(css, /\.mode-head h1\s*\{[\s\S]*font-size:\s*24px/);
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
  assert.match(source, /Trigger this transition in Interact mode/);
  assert.match(css, /\.motion-card/);
  assert.match(css, /\.motion-timeline/);
  assert.match(css, /\.motion-track-rail/);
  assert.match(css, /\.motion-keyframe\.is-selected/);
});
