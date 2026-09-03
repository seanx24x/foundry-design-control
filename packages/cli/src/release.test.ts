import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FOUNDRY_MCP_PACKAGE_SPEC,
  FOUNDRY_PACKAGE_SPEC,
  FOUNDRY_VERSION,
  releasePreflight,
} from './release.js';

test('pins the CLI and MCP bridge to the same release', () => {
  assert.equal(FOUNDRY_VERSION, '0.2.0-beta.9');
  assert.equal(FOUNDRY_PACKAGE_SPEC, 'foundry-design@0.2.0-beta.9');
  assert.equal(FOUNDRY_MCP_PACKAGE_SPEC, 'foundry-design-mcp-server@0.2.0-beta.9');
  assert.doesNotMatch(FOUNDRY_MCP_PACKAGE_SPEC, /@(beta|latest)$/);
});

test('prints the resolved release before a mutating action', () => {
  const output = releasePreflight('set up this project');
  assert.match(output, /^Foundry 0\.2\.0-beta\.9/m);
  assert.match(output, /CLI foundry-design@0\.2\.0-beta\.9/);
  assert.match(output, /Agent bridge: foundry-design-mcp-server@0\.2\.0-beta\.9/);
  assert.match(output, /Action: set up this project/);
});
