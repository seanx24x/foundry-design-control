import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  deliveryCriteriaSummary,
  deliveryNarrativeDraft,
  deliveryNarrativePayload,
  deliveryShellArgument,
} from '../public/next-delivery.js';
test('copied CLI arguments preserve spaces, quotes and shell metacharacters literally', () => {
  assert.equal(deliveryShellArgument('Signup at desktop'), "'Signup at desktop'");
  assert.equal(deliveryShellArgument("Sean's project"), "'Sean'\"'\"'s project'");
  assert.equal(deliveryShellArgument('$(not-a-command); $VALUE'), "'$(not-a-command); $VALUE'");
});
test('no criteria and pending checks never imply readiness', () => {
  assert.deepEqual(deliveryCriteriaSummary({}), { tone: 'neutral', text: 'No criteria recorded' });
  assert.deepEqual(
    deliveryCriteriaSummary({ acceptanceCriteria: [{ status: 'pending' }, { status: 'passed' }] }),
    { tone: 'neutral', text: '1 awaiting results' },
  );
});
test('blockers and failed criteria take priority over passed checks', () => {
  assert.equal(
    deliveryCriteriaSummary({
      blockers: ['Source missing'],
      acceptanceCriteria: [{ status: 'passed' }],
    }).tone,
    'warning',
  );
  assert.equal(
    deliveryCriteriaSummary({ acceptanceCriteria: [{ status: 'failed' }] }).tone,
    'error',
  );
});
test('all criteria passing is described as criteria evidence, not shipping', () => {
  assert.deepEqual(deliveryCriteriaSummary({ acceptanceCriteria: [{ status: 'passed' }] }), {
    tone: 'success',
    text: 'All criteria passed',
  });
});
test('narrative controls preserve intent and round trip line-based risks/questions', () => {
  const record = { intent: ' Keep intent\n', risks: ['One', 'Two'], questions: [] };
  const draft = deliveryNarrativeDraft(record);
  assert.equal(draft.risks, 'One\nTwo');
  assert.deepEqual(deliveryNarrativePayload({ ...draft, questions: ' A question \n\nAnother' }), {
    intent: record.intent,
    risks: record.risks,
    questions: ['A question', 'Another'],
    narrativeSource: 'authored',
  });
});
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const helper = readFileSync(new URL('../public/next-delivery.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/next-delivery.css', import.meta.url), 'utf8');
test('Next uses explicit narrative saves and existing session APIs', () => {
  assert.match(app, /if \(nextDelivery\) return;\s+const record = records.find/);
  assert.match(helper, /await saveNarrative\(record.id, deliveryNarrativePayload\(submitted\)\)/);
  assert.match(helper, /pending.has\(record.id\)/);
  assert.doesNotMatch(helper, /fetch\(|postMessage\(/);
});
test('verified record remains immutable and save failure retains notes', () => {
  assert.match(helper, /if \(!deliveryNarrativeReadOnly\(record\)\)/);
  assert.match(helper, /Your notes are preserved/);
  assert.match(helper, /current\[key\] === submitted\[key\]/);
});
test('navigation, draft focus and context are accessible across updates', () => {
  assert.match(helper, /aria-controls/);
  assert.match(helper, /ArrowRight/);
  assert.match(helper, /aria-labelledby/);
  assert.match(helper, /setSelectionRange/);
  assert.match(helper, /positions.set\(\s*activeKey/);
});
test('actions are scoped to the view and documentation refresh prevents duplicates', () => {
  assert.match(helper, /generate.hidden = tab !== 'documentation'/);
  assert.match(helper, /exportButton.disabled = !activeRecord/);
  assert.match(app, /deliveryGenerating \|\| !runtimeConnected/);
  assert.match(helper, /Nothing is exported or written until you run it/);
});
test('layout uses shared rails with local evidence-table scrolling', () => {
  assert.match(css, /300px minmax\(0, 1fr\) 300px/);
  assert.match(css, /max-width: none/);
  assert.match(css, /\.engineering-evidence-grid \{\s+overflow: auto/);
  assert.match(css, /overflow-wrap: anywhere/);
});
