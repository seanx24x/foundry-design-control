import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  FOUNDRY_UI_CONTROL_SIZES,
  FOUNDRY_UI_GRID,
  FOUNDRY_UI_ICON_SIZES,
  FOUNDRY_UI_RADII,
  FOUNDRY_UI_TYPE_SIZES,
  nearestFoundryGridValue,
} from './ui-foundations.js';

test('Foundry UI foundations use the 4px grid', () => {
  for (const value of [
    ...FOUNDRY_UI_ICON_SIZES,
    ...FOUNDRY_UI_CONTROL_SIZES,
    ...FOUNDRY_UI_RADII,
    ...FOUNDRY_UI_TYPE_SIZES,
  ]) {
    assert.equal(value % FOUNDRY_UI_GRID, 0, String(value));
  }
});

test('grid rounding uses the nearest multiple with ties away from zero', () => {
  assert.equal(nearestFoundryGridValue(5), 4);
  assert.equal(nearestFoundryGridValue(6), 8);
  assert.equal(nearestFoundryGridValue(10), 12);
  assert.equal(nearestFoundryGridValue(-6), -8);
});

test('the Foundry interface contains no off-grid pixel literals', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const values = [...source.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
  const offGrid = values.filter(
    (value) => value !== 0 && Math.abs(value) !== 1 && Math.abs(value) % FOUNDRY_UI_GRID !== 0,
  );
  assert.deepEqual(
    [...new Set(offGrid)].sort((a, b) => a - b),
    [],
  );
});

test('the smallest supported interface text is 12px', () => {
  assert.equal(Math.min(...FOUNDRY_UI_TYPE_SIZES), 12);
});

test('embedded mode keeps canvas measurement visible and moves chrome to the workspace', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /__foundry_embedded/);
  assert.match(source, /foundry:workspace-state/);
  assert.match(source, /foundry:workspace-command/);
  assert.match(source, /foundry:canvas-input/);
  assert.match(source, /workspaceCanvasTool/);
  assert.match(source, /handleEmbeddedCanvasWheel/);
  assert.match(source, /event\.origin !== runtimeOrigin/);
  assert.match(source, /if \(!selector\.trim\(\)\) return null/);
  assert.match(source, /data-add-effect="drop-shadow"/);
  assert.match(source, /data-shadow-part=/);
  assert.match(source, /'spread'/);
  assert.match(source, /backdropFilter/);
  assert.match(source, /Available when the project exposes a mapped effect recipe/);
  assert.match(source, /data-review-delete=/);
  assert.match(source, /deleteReviewChange/);
  assert.match(source, /restorePreviewChange/);
  assert.match(source, /foundry:workspace-result/);
  assert.match(source, /--fdc-canvas-center/);
});

test('overlay selects use one accessible theme-aware menu system', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /className = 'fdc-select-trigger'/);
  assert.match(source, /setAttribute\('role', 'combobox'\)/);
  assert.match(source, /setAttribute\('role', 'listbox'\)/);
  assert.match(source, /role="option"/);
  assert.match(source, /moveFdcSelectFocus/);
  assert.match(source, /typeahead/);
  assert.match(source, /select\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(source, /selectAccessibleLabel/);
  assert.match(source, /restoreValue\(breakpoint, selectedBreakpoint, 'current'\)/);
  assert.match(source, /:host\(\[data-interface-theme="light"\]\) \.fdc-select-menu/);
});

test('Typography Studio separates source-safe project fonts from local previews', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /data-open-typography-studio/);
  assert.match(source, /data-typography-search/);
  assert.match(source, /queryLocalFonts/);
  assert.match(source, /origin === 'local'/);
  assert.match(source, /await applyControlValue/);
  assert.match(source, /Local fonts remain preview-only/);
});

test('Typography Studio requires a source strategy for new Google Fonts', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /\/google-fonts\?query=/);
  assert.match(source, /data-google-font/);
  assert.match(source, /data-font-strategy/);
  assert.match(source, /data-review-google-font/);
  assert.match(source, /font integration strategy:/);
  assert.match(source, /Google Fonts CSS2 preview loaded/);
  assert.match(source, /data-font-weight/);
  assert.match(source, /data-font-style/);
  assert.match(source, /data-font-axis/);
  assert.match(source, /Script coverage/);
  assert.match(source, /googleFontVariationSettings/);
  assert.match(source, /variable axes:/);
});

test('Typography Studio reports rendered face and wrapping diagnostics', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /typographyDiagnosticsMarkup/);
  assert.match(source, /document\.fonts\.check/);
  assert.match(source, /measuredTextLineCount/);
  assert.match(source, /Rendered type/);
  assert.match(source, /Face and wrapping look stable at this viewport/);
});

test('Typography Studio previews treatments and scale values before review', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /typographyLabMarkup/);
  assert.match(source, /data-type-treatment/);
  assert.match(source, /data-preview-type-scale/);
  assert.match(source, /data-type-scale-fluid/);
  assert.match(source, /reviewTypeTreatment/);
  assert.match(source, /reviewTypeScale/);
  assert.match(source, /Typography Studio modular scale:/);
});

test('Typography Studio saves source-accountable project styles with context validation', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /Save as style/);
  assert.match(source, /Saved project styles/);
  assert.match(source, /source intent: create or update a project-native typography token/);
  assert.match(source, /buildTypographyValidationPlan/);
  assert.match(source, /typographyValidationEvidence/);
  assert.match(source, /data-apply-type-style/);
  assert.match(source, /writeProjectTypographyStyles/);
});

test('Typography Studio reviews an exact font source plan and verifies rendered type in every context', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /Reviewed source plan/);
  assert.match(source, /Add font and source plan/);
  assert.match(source, /buildFontIntegrationPlan/);
  assert.match(source, /font integration plan:/);
  assert.match(source, /parseTypographyVerificationContexts/);
  assert.match(source, /requested font face did not report loaded/);
  assert.match(source, /text clips in one or more validation contexts/);
  assert.match(source, /verificationResultValue/);
});

test('the review flow queues approved changes when the coding agent is offline', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /sessionRequest\('\/agent-presence'\)/);
  assert.match(source, /Queue \$\{selectedCount\} for agent/);
  assert.match(source, /will claim it when the Foundry listener reconnects/);
  assert.doesNotMatch(source, /selectedCount === 0 \|\| !activeAgentPresence\.connected/);
});

test('the apply handoff exposes recovery and verifies independently of review visibility', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  assert.match(source, /claimed: 'Handoff received'/);
  assert.match(source, /Foundry safely returned this batch to the queue/);
  assert.match(source, /applyButton\.dataset\.action = 'reconnect'/);
  assert.match(source, /Stop apply/);
  assert.match(source, /Confirm stop/);
  assert.match(source, /Press Confirm stop within 5 seconds/);
  assert.match(source, /Foundry is keeping the handoff active while source work begins/);
  assert.match(source, /if \(latestRun\?\.state === 'verifying'\) maybeVerifyRun\(latestRun\)/);
  assert.match(source, /startSessionPolling\(\)/);
});
