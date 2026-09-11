import assert from 'node:assert/strict';
import test from 'node:test';
import { rebuiltTargetIdentityMatches } from './rebuilt-identity.js';

test('requires an explicit Foundry id rather than a selector-derived replacement id', () => {
  const frozen = {
    id: 'password-reveal',
    componentPath: [],
    locator: { selector: '.reveal-button', foundryId: 'password-reveal' },
  };
  assert.equal(
    rebuiltTargetIdentityMatches(frozen, {
      foundryId: 'password-reveal',
      componentPath: [],
    }),
    true,
  );
  assert.equal(
    rebuiltTargetIdentityMatches(frozen, {
      foundryId: 'replacement-at-the-same-selector',
      componentPath: [],
    }),
    false,
  );
});

test('rejects a reused explicit id when frozen source or component identity differs', () => {
  const frozen = {
    id: 'password-reveal',
    componentPath: ['Signup', 'PasswordReveal'],
    source: { file: 'style.css', line: 660, symbol: '/* foundry: password-reveal */' },
    locator: { foundryId: 'password-reveal', selector: '.reveal-button' },
  };
  assert.equal(
    rebuiltTargetIdentityMatches(frozen, {
      foundryId: 'password-reveal',
      componentPath: ['Signup', 'PasswordReveal'],
      source: frozen.source,
    }),
    true,
  );
  assert.equal(
    rebuiltTargetIdentityMatches(frozen, {
      foundryId: 'password-reveal',
      componentPath: ['Signup', 'PasswordReveal'],
      source: { ...frozen.source, line: 700 },
    }),
    false,
  );
  assert.equal(
    rebuiltTargetIdentityMatches(frozen, {
      foundryId: 'password-reveal',
      componentPath: ['Other', 'PasswordReveal'],
      source: frozen.source,
    }),
    false,
  );
});

test('accepts exact source and component identity when no explicit id exists', () => {
  const source = {
    file: 'style.css',
    line: 660,
    column: 20,
    symbol: '/* foundry: password-reveal */',
  };
  const frozen = {
    id: 'web_selector_hash',
    componentPath: ['Signup', 'PasswordReveal'],
    source,
    locator: { selector: '.reveal-button' },
  };
  assert.equal(
    rebuiltTargetIdentityMatches(frozen, {
      source,
      componentPath: ['Signup', 'PasswordReveal'],
    }),
    true,
  );
  assert.equal(
    rebuiltTargetIdentityMatches(frozen, {
      source: { ...source, line: 661 },
      componentPath: ['Signup', 'PasswordReveal'],
    }),
    false,
  );
  assert.equal(
    rebuiltTargetIdentityMatches(
      { ...frozen, source: undefined },
      { componentPath: frozen.componentPath },
    ),
    false,
  );
});
