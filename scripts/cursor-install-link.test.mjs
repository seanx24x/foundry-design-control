import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCursorInstallConfig,
  buildCursorInstallUrl,
  parseCursorInstallUrl,
  replaceCursorInstallUrl,
  validateCursorInstallDocument,
  validateCursorInstallUrl,
} from './cursor-install-link.mjs';

const version = '0.2.0-beta.21';
const expectedUrl =
  'cursor://anysphere.cursor-deeplink/mcp/install?name=foundry-design-control&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsIi0tcHJlZmVyLW9ubGluZSIsImZvdW5kcnktZGVzaWduLW1jcC1zZXJ2ZXJAMC4yLjAtYmV0YS4yMSJdLCJlbnYiOnsiRk9VTkRSWV9ERVNJR05fUlVOVElNRV9VUkwiOiJodHRwOi8vMTI3LjAuMC4xOjQzODcifX0%3D';

test('builds and parses the canonical Cursor install link', () => {
  assert.equal(buildCursorInstallUrl(version), expectedUrl);
  assert.deepEqual(parseCursorInstallUrl(expectedUrl), buildCursorInstallConfig(version));
});

test('replaces one stale link without disturbing its Markdown', () => {
  const stale = buildCursorInstallUrl('0.2.0-beta.16');
  const markdown = `Before\n\n[Add Foundry to Cursor](${stale})\n\nAfter\n`;
  assert.equal(
    replaceCursorInstallUrl(markdown, version, 'DISTRIBUTION.md'),
    `Before\n\n[Add Foundry to Cursor](${expectedUrl})\n\nAfter\n`,
  );
});

test('requires exactly one link in every canonical document', () => {
  assert.throws(
    () => validateCursorInstallDocument('No link', version, 'README.md'),
    /exactly one/,
  );
  assert.throws(
    () => validateCursorInstallDocument(`${expectedUrl}\n${expectedUrl}`, version, 'README.md'),
    /exactly one/,
  );
});

test('rejects malformed and stale configurations', () => {
  assert.throws(
    () =>
      parseCursorInstallUrl(
        'cursor://anysphere.cursor-deeplink/mcp/install?name=foundry-design-control&config=not-base64',
      ),
    /base64/,
  );
  assert.throws(
    () => validateCursorInstallUrl(buildCursorInstallUrl('0.2.0-beta.16'), version),
    /does not exactly match/,
  );
  const wrongConfig = {
    ...buildCursorInstallConfig(version),
    command: 'node',
  };
  const wrongUrl = `cursor://anysphere.cursor-deeplink/mcp/install?name=foundry-design-control&config=${encodeURIComponent(Buffer.from(JSON.stringify(wrongConfig)).toString('base64'))}`;
  assert.throws(() => validateCursorInstallUrl(wrongUrl, version), /does not exactly match/);
});
