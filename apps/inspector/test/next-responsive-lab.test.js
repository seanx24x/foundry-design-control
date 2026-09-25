import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { responsiveFrameLabel, responsiveAuditLabel } from '../public/next-responsive-lab.js';

test('connected geometry is explicitly not audited', () => {
  assert.equal(responsiveFrameLabel({}, {}), 'Geometry available · not audited');
  assert.equal(responsiveFrameLabel({ connection: 'connecting' }), 'Connecting preview…');
  assert.equal(
    responsiveFrameLabel({ connection: 'live' }),
    'Preview connected · awaiting geometry',
  );
});
test('measured findings are not reported as a passed layout', () => {
  assert.equal(
    responsiveFrameLabel({ auditStatus: 'passed', audit: { findings: [{}] } }),
    'Measured · 1 finding',
  );
  assert.equal(
    responsiveFrameLabel({ auditStatus: 'passed', audit: { findings: [] } }),
    'Measured · no findings',
  );
});
test('offline and stale evidence cannot masquerade as current measurements', () => {
  const state = { connection: 'offline', auditStatus: 'passed', audit: { findings: [] } };
  assert.equal(responsiveFrameLabel(state, {}, true), 'Preview disconnected');
  assert.equal(
    responsiveFrameLabel({ ...state, connection: 'live' }, {}, true),
    'Previous audit · run again',
  );
});
test('audit failures and measuring states remain explicit', () => {
  assert.equal(responsiveFrameLabel({ auditStatus: 'timeout' }), 'Audit timed out');
  assert.equal(responsiveFrameLabel({ auditStatus: 'failed' }), 'Audit incomplete');
  assert.equal(responsiveFrameLabel({ auditStatus: 'running' }), 'Measuring layout…');
  assert.equal(responsiveAuditLabel(null, false, 0, 5, false), 'Not audited');
  assert.equal(responsiveAuditLabel(null, true, 2, 5, false), 'Measuring 2 of 5 frames');
  assert.equal(responsiveAuditLabel({ failed: 1 }, false, 5, 5, false), 'Audit incomplete');
  assert.equal(responsiveAuditLabel({ failed: 0 }, false, 5, 5, true), 'Previous audit');
});
test('layout reuses live frames and acknowledged actions instead of making new commands', () => {
  const source = readFileSync(new URL('../public/next-responsive-lab.js', import.meta.url), 'utf8');
  assert.match(source, /main.append\(grid\)/);
  assert.match(source, /card.hidden = renderingView === 'selected'/);
  assert.match(source, /renderingView = running \? 'all' : view/);
  assert.match(source, /comparisonDetails.append\(comparison\)/);
  assert.doesNotMatch(source, /\.src\s*=|requestCommand\(|requestFrameCommand\(|fetch\(/);
});
test('changed widths, selected targets and stress modes mark previous audits stale', () => {
  const source = readFileSync(new URL('../public/next-responsive-lab.js', import.meta.url), 'utf8');
  assert.match(source, /staleAudits.add\(state.audit\)/);
  assert.match(source, /selection\?\.selector/);
  assert.match(source, /next.containerWidth/);
  assert.match(source, /Conditions changed since this audit/);
});
test('responsive layout keeps fixed rails and allows previews to fill available width', () => {
  const css = readFileSync(new URL('../public/next-responsive-lab.css', import.meta.url), 'utf8');
  assert.match(css, /grid-template-columns: 300px minmax\(0, 1fr\) 300px/);
  assert.match(css, /grid-template-rows: 44px minmax\(0, 1fr\) 44px/);
  assert.match(css, /\.responsive-lab-footer \{[^}]*display: flex !important/);
  assert.match(css, /@container \(max-width: 760px\)/);
  assert.match(css, /\.responsive-viewport-grid \{[^}]*grid-auto-rows: max-content/);
  assert.match(css, /\.responsive-frame-viewport iframe \{[^}]*border: 0/);
});
test('responsive initialization waits for the loaded frame and adapter handshake', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(
    source,
    /frame.dataset.responsiveLoaded === 'true' &&\s*frame.dataset.responsiveNeedsSync === 'true'/,
  );
  assert.match(source, /if \(frame.dataset.responsiveReady === 'true'\)/);
  assert.match(
    source,
    /frame.dataset.responsiveReady = 'false';\s*frame.dataset.responsiveLoaded = 'false';\s*frame.src = responsivePreviewUrl/,
  );
});
test('late replies from discarded responsive frames cannot overwrite replacement state', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const sync = source.slice(
    source.indexOf('async function applyResponsiveFrameContext'),
    source.indexOf('function responsiveFrameElements'),
  );
  assert.equal(
    (
      sync.match(
        /!frame.isConnected \|\| responsiveFrames.get\(frame.contentWindow\) !== viewportId/g,
      ) ?? []
    ).length,
    2,
  );
});
test('Next audits bring each frame into view sequentially and restore the previous scroll', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const helper = readFileSync(new URL('../public/next-responsive-lab.js', import.meta.url), 'utf8');
  assert.match(app, /nextResponsiveLab\?\.prepareAuditFrame\(viewportId\)/);
  assert.match(app, /for \(const item of frames\) results.push\(await auditFrame\(item\)\)/);
  assert.match(helper, /grid.scrollTop = auditScrollTop/);
  assert.match(
    helper,
    /scrollIntoView\(\{ block: 'start', inline: 'nearest', behavior: 'instant' \}\)/,
  );
});
