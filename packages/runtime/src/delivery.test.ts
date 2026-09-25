import assert from 'node:assert/strict';
import test from 'node:test';
import { renderDeliveryValue, sanitizeDeliveryText, sanitizeProjectPath } from './delivery.js';

test('delivery values append units only to unitless numeric values', () => {
  assert.equal(renderDeliveryValue(44, 'px'), '44px');
  assert.equal(renderDeliveryValue('44', 'px'), '44px');
  assert.equal(renderDeliveryValue('44px', 'px'), '44px');
  assert.equal(renderDeliveryValue('calc(100% - 4px)', 'px'), 'calc(100% - 4px)');
  assert.equal(renderDeliveryValue('auto', 'px'), 'auto');
});

test('sanitizes project paths and runtime credentials for portable delivery output', () => {
  assert.equal(
    sanitizeProjectPath('/Users/design/project', '/Users/design/project/src/Button.tsx'),
    'src/Button.tsx',
  );
  assert.equal(
    sanitizeProjectPath('/Users/design/project', '/private/other/secret.ts'),
    'secret.ts',
  );
  assert.equal(sanitizeProjectPath('/Users/design/project', '../outside.ts'), 'outside.ts');
  assert.equal(
    sanitizeDeliveryText(
      'Open /Users/design/project?__foundry_token=secret&session=abc&__foundry_session=ses_secret with x-foundry-token: value',
      '/Users/design/project',
    ),
    'Open .?__foundry_token=[redacted]&session=[redacted]&__foundry_session=[redacted] with x-foundry-token: [redacted]',
  );
  assert.equal(sanitizeDeliveryText('Portable text', ''), 'Portable text');
  assert.equal(
    sanitizeDeliveryText('Open C:\\project\\src\\Button.tsx?token=secret', 'C:\\project'),
    'Open .\\src\\Button.tsx?token=[redacted]',
  );
});
