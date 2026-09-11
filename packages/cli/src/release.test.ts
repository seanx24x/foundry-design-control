import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  FOUNDRY_MCP_PACKAGE_SPEC,
  FOUNDRY_PACKAGE_SPEC,
  FOUNDRY_VERSION,
  releasePreflight,
} from './release.js';

test('pins the CLI and MCP bridge to the same release', () => {
  assert.equal(FOUNDRY_VERSION, '0.2.0-beta.21');
  assert.equal(FOUNDRY_PACKAGE_SPEC, 'foundry-design@0.2.0-beta.21');
  assert.equal(FOUNDRY_MCP_PACKAGE_SPEC, 'foundry-design-mcp-server@0.2.0-beta.21');
  assert.doesNotMatch(FOUNDRY_MCP_PACKAGE_SPEC, /@(beta|latest)$/);
});

test('prints the resolved release before a mutating action', () => {
  const output = releasePreflight('set up this project');
  assert.match(output, new RegExp(`^Foundry ${FOUNDRY_VERSION.replaceAll('.', '\\.')}`, 'm'));
  assert.match(output, new RegExp(`CLI ${FOUNDRY_PACKAGE_SPEC.replaceAll('.', '\\.')}`));
  assert.match(
    output,
    new RegExp(`Agent bridge: ${FOUNDRY_MCP_PACKAGE_SPEC.replaceAll('.', '\\.')}`),
  );
  assert.match(output, /Action: set up this project/);
});

test('publishes the acknowledged Apply sequence in the bundled agent contract', () => {
  const skill = readFileSync(
    new URL('../../../skills/foundry-design-control/SKILL.md', import.meta.url),
    'utf8',
  );
  const contract = readFileSync(
    new URL(
      '../../../skills/foundry-design-control/references/apply-run-contract.md',
      import.meta.url,
    ),
    'utf8',
  );
  for (const contents of [skill, contract]) {
    const rebuilding = contents.indexOf('`rebuilding`');
    const acknowledgement = contents.indexOf('`foundry_design_record_apply_result`');
    const verifying = contents.indexOf('`verifying`', acknowledgement);
    assert.ok(rebuilding >= 0, 'Apply instructions must report rebuilding');
    assert.ok(acknowledgement > rebuilding, 'Apply result must be acknowledged after rebuilding');
    assert.ok(
      verifying > acknowledgement,
      'verifying must follow the Apply-result acknowledgement',
    );
    assert.match(contents, /exactly once/);
    assert.match(contents, /one-use[^\n]*verification challenge/);
  }
});
