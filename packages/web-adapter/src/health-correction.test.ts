import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

// Exercise the production browser-closure functions with controlled DOM/network
// dependencies. In particular, the computed read remains at a transition's start.
function browserFunction(start: string, end: string, dependencies: Record<string, unknown>) {
  const offset = source.indexOf(start);
  assert.ok(offset >= 0);
  const code = ts.transpileModule(source.slice(offset, source.indexOf(end, offset)), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const name = /function (\w+)/.exec(start)?.[1];
  assert.ok(name);
  return new Function(...Object.keys(dependencies), `${code}; return ${name};`)(
    ...Object.values(dependencies),
  );
}

function healthFixture(
  recorded = true,
  initialValue = '',
  initialPriority = '',
  destination: { branchId?: string; branchName?: string } = {},
  customRecord?: (...args: unknown[]) => Promise<boolean>,
) {
  const properties = new Map([['min-height', { value: initialValue, priority: initialPriority }]]);
  const records: unknown[][] = [];
  const history: unknown[] = [];
  const toasts: string[] = [];
  const issue = {
    title: 'Touch target is too small',
    category: 'target-size',
    previewed: false,
    recordedBranchId: undefined as string | undefined,
    recordedBranchName: undefined as string | undefined,
    fix: { changes: [{ property: 'minHeight', value: 44, unit: 'px' }] },
    element: {
      isConnected: true,
      style: {
        getPropertyValue: (property: string) => properties.get(property)?.value ?? '',
        getPropertyPriority: (property: string) => properties.get(property)?.priority ?? '',
        setProperty: (property: string, value: string, priority = '') =>
          properties.set(property, { value, priority }),
        removeProperty: (property: string) => properties.delete(property),
      },
    },
  };
  const preview = browserFunction('async function previewHealthFix(', 'function openHealth(', {
    simpleStyleControl: () => ({
      read: () => 40,
      apply: (value: number) => issue.element.style.setProperty('min-height', `${value}px`),
      category: 'accessibility',
      label: 'Min height',
    }),
    healthChangeLabel: () => 'Min height',
    healthCategory: () => 'accessibility',
    record: async (...args: unknown[]) => {
      records.push(args);
      assert.equal(history.length, 0, 'unacknowledged corrections do not enter undo history');
      if (customRecord) return customRecord(...args);
      if (recorded)
        (args[6] as { onRecorded?: (destination: unknown) => void }).onRecorded?.(destination);
      return recorded;
    },
    pushHistory: (entry: unknown) => history.push(entry),
    select() {},
    updateOutline() {},
    renderHealthPanel() {},
    publishWorkspaceState() {},
    showToast: (message: string) => toasts.push(message),
  }) as (input: typeof issue) => Promise<void>;
  return { issue, preview, records, history, properties, toasts };
}

test('health correction records requested 44px, not a transitional computed 40px', async () => {
  const fixture = healthFixture();
  await fixture.preview(fixture.issue);
  assert.equal(fixture.records.length, 1);
  assert.equal(fixture.records[0]?.[1], 40);
  assert.equal(fixture.records[0]?.[2], 44);
  assert.equal(
    (fixture.records[0]?.[6] as { requireRecordedChange: boolean }).requireRecordedChange,
    true,
  );
  assert.equal(fixture.properties.get('min-height')?.value, '44px');
  assert.equal(fixture.history.length, 1);
  assert.equal(fixture.issue.previewed, true);
  assert.deepEqual(fixture.toasts, ['Health correction added to review']);
});

test('failed health recording restores the exact inline declaration and remains retryable', async () => {
  for (const [value, priority] of [
    ['', ''],
    ['40px', 'important'],
  ]) {
    const fixture = healthFixture(false, value, priority);
    await assert.rejects(fixture.preview(fixture.issue), /could not be saved/);
    assert.equal(fixture.issue.element.style.getPropertyValue('min-height'), value);
    assert.equal(fixture.issue.element.style.getPropertyPriority('min-height'), priority);
    assert.equal(fixture.issue.previewed, false);
    assert.equal(fixture.history.length, 0);
    assert.deepEqual(fixture.toasts, []);
  }
});

test('unavailable health corrections reject rather than acknowledge success', async () => {
  const fixture = healthFixture();
  fixture.issue.element.isConnected = false;
  await assert.rejects(fixture.preview(fixture.issue), /no longer available/);
  assert.equal(fixture.records.length, 0);
  assert.equal(fixture.issue.previewed, false);
});

test('strict correction acknowledgement requires the operation and requested value in Review', async () => {
  for (const responseKind of ['recorded', 'empty', 'wrong-operation', 'wrong-value']) {
    const toasts: string[] = [];
    const record = browserFunction('async function record(', 'function renderToolTabs(', {
      selected: null,
      sessionId: 'test-session',
      token: 'test-token',
      showToast: (message: string) => toasts.push(message),
      targetFor: () => ({ id: 'target', label: 'Reveal', source: { file: 'style.css', line: 10 } }),
      scope: { value: 'instance' },
      candidatesForElement: () => [{ id: 'mapping', intent: 'style', evidence: [] }],
      matchingTokens: () => [],
      designGraph: null,
      responsiveEditScope: { activeBreakpoint: 'current', scope: 'breakpoint' },
      currentPreviewContext: { viewport: { id: 'current' } },
      breakpoint: { value: 'current' },
      theme: { value: 'current' },
      state: { value: 'current' },
      sessionRequest: async (_path: string, request: { body: string }) => {
        const { change } = JSON.parse(request.body);
        if (responseKind === 'wrong-operation') change.operationId = 'other';
        if (responseKind === 'wrong-value') change.after = 40;
        return { changeSet: { changes: responseKind === 'empty' ? [] : [change] } };
      },
      recordedChangeCount: 0,
      lastRecordedSummary: '',
      completeOnboardingStep() {},
      updateChangeCount() {},
      publishWorkspaceState() {},
    }) as (...args: unknown[]) => Promise<boolean>;
    const control = { category: 'accessibility', property: 'minHeight', label: 'Minimum height' };
    const result = await record(control, 40, 44, {}, 'Correction', [], {
      requireRecordedChange: true,
    });
    assert.equal(result, responseKind === 'recorded');
    if (responseKind !== 'recorded') assert.match(toasts[0] ?? '', /did not retain/);
    if (responseKind === 'empty') {
      assert.equal(
        await record(control, 44, 40, {}, 'Return to baseline'),
        true,
        'ordinary acknowledged edits may remove their ledger item by returning to baseline',
      );
    }
  }
});

test('health correction saved in an active direction is not described as main Review', async () => {
  const fixture = healthFixture(true, '', '', {
    branchId: 'direction',
    branchName: 'Quiet direction',
  });
  await fixture.preview(fixture.issue);
  assert.equal(fixture.issue.previewed, true);
  assert.equal(fixture.issue.recordedBranchId, 'direction');
  assert.equal(fixture.issue.recordedBranchName, 'Quiet direction');
  assert.equal(fixture.properties.get('min-height')?.value, '44px');
  assert.match(fixture.toasts[0] ?? '', /saved to direction “Quiet direction”/);
  assert.match(fixture.toasts[0] ?? '', /Promote the direction to add it to Review/);
  assert.doesNotMatch(fixture.toasts[0] ?? '', /added to review/i);
});

test('active branch acknowledgement uses its own ledger and rejects missing or unrelated branches', async () => {
  for (const responseKind of [
    'active-branch',
    'missing-branch',
    'unrelated-branch',
    'empty-branch',
  ]) {
    const toasts: string[] = [];
    const record = browserFunction('async function record(', 'function renderToolTabs(', {
      selected: null,
      sessionId: 'test-session',
      token: 'test-token',
      showToast: (message: string) => toasts.push(message),
      targetFor: () => ({ id: 'target', label: 'Reveal', source: { file: 'style.css', line: 10 } }),
      scope: { value: 'instance' },
      candidatesForElement: () => [{ id: 'mapping', intent: 'style', evidence: [] }],
      matchingTokens: () => [],
      designGraph: null,
      responsiveEditScope: { activeBreakpoint: 'current', scope: 'breakpoint' },
      currentPreviewContext: { viewport: { id: 'current' } },
      breakpoint: { value: 'current' },
      theme: { value: 'current' },
      state: { value: 'current' },
      sessionRequest: async (_path: string, request: { body: string }) => {
        const { change } = JSON.parse(request.body);
        return {
          // A main-ledger match must never substitute for the active branch.
          changeSet: { changes: responseKind === 'active-branch' ? [] : [change] },
          activeDesignBranchId: 'direction',
          designBranches:
            responseKind === 'missing-branch'
              ? []
              : [
                  {
                    id: responseKind === 'unrelated-branch' ? 'other' : 'direction',
                    name: 'Quiet direction',
                    changes: responseKind === 'empty-branch' ? [] : [change],
                  },
                ],
        };
      },
      recordedChangeCount: 0,
      lastRecordedSummary: '',
      completeOnboardingStep() {},
      updateChangeCount() {},
      publishWorkspaceState() {},
    }) as (...args: unknown[]) => Promise<boolean>;
    const fixture = healthFixture(true, '40px', 'important', {}, record);
    if (responseKind === 'active-branch') {
      await fixture.preview(fixture.issue);
      assert.equal(fixture.issue.previewed, true);
      assert.equal(fixture.issue.recordedBranchId, 'direction');
      assert.equal(fixture.properties.get('min-height')?.value, '44px');
      assert.match(toasts[0] ?? '', /Change saved to direction/);
      assert.match(fixture.toasts[0] ?? '', /Health correction saved to direction/);
    } else {
      await assert.rejects(fixture.preview(fixture.issue), /could not be saved/);
      assert.equal(fixture.issue.previewed, false);
      assert.equal(fixture.issue.recordedBranchId, undefined);
      assert.deepEqual(fixture.properties.get('min-height'), {
        value: '40px',
        priority: 'important',
      });
      assert.equal(fixture.history.length, 0);
      assert.deepEqual(fixture.toasts, []);
      assert.match(toasts[0] ?? '', /could not be confirmed|did not retain/);
    }
  }
});
