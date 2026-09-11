import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  reviewContextSetLabel,
  verificationContextLabel,
  verificationContextsForChange,
  verificationFrameUrl,
  verificationViewportForContext,
} from './index.js';

test('expands every reviewed breakpoint, theme, and state combination exactly once', () => {
  const contexts = verificationContextsForChange({
    context: { breakpoint: 'desktop', theme: 'light', state: 'default' },
    contextSet: {
      breakpoints: ['phone', 'desktop', 'phone'],
      themes: ['light', 'dark', 'light'],
      states: ['default', 'focus', 'default'],
    },
  });

  assert.equal(contexts.length, 8);
  assert.deepEqual(contexts[0], {
    breakpoint: 'phone',
    theme: 'light',
    state: 'default',
  });
  assert.deepEqual(contexts.at(-1), {
    breakpoint: 'desktop',
    theme: 'dark',
    state: 'focus',
  });
  assert.equal(
    new Set(contexts.map(({ breakpoint, theme, state }) => `${breakpoint}:${theme}:${state}`)).size,
    contexts.length,
  );
});

test('migrated changes without a context set verify their exact capture context', () => {
  assert.deepEqual(
    verificationContextsForChange({
      context: { breakpoint: 'tablet', theme: 'dark', state: 'error' },
    }),
    [{ breakpoint: 'tablet', theme: 'dark', state: 'error' }],
  );
});

test('review and verification labels expose the exact contexts they represent', () => {
  assert.equal(
    reviewContextSetLabel({
      context: { breakpoint: 'desktop', theme: 'light', state: 'default' },
      contextSet: {
        breakpoints: ['phone', 'desktop'],
        themes: ['light', 'dark'],
        states: ['default', 'focus'],
      },
    }),
    'Breakpoint: phone, desktop · Theme: light, dark · State: default, focus · 8 contexts',
  );
  assert.equal(
    verificationContextLabel({
      context: { breakpoint: 'phone', theme: 'dark', state: 'focus' },
    }),
    'Breakpoint: phone · Theme: dark · State: focus',
  );
  assert.equal(
    verificationContextLabel({
      context: {
        breakpoint: 'desktop',
        theme: 'light',
        state: 'default',
        motionPreference: 'reduce',
      },
    }),
    'Breakpoint: desktop · Theme: light · State: default · Motion: reduce',
  );
});

test('rebuilt verification loads the frozen target through the configured preview origin', () => {
  const url = new URL(
    verificationFrameUrl(
      {
        targetUrl: 'http://127.0.0.1:4173/signup?fixture=morrow#form',
        previewOrigin: 'http://127.0.0.1:4399',
      },
      'ses_frozen',
      'private-token',
      'preview-capability-kept-in-the-frame-url',
    ),
  );
  assert.equal(url.origin, 'http://127.0.0.1:4399');
  assert.equal(url.pathname, '/signup');
  assert.equal(url.searchParams.get('fixture'), 'morrow');
  assert.equal(url.searchParams.get('__foundry_session'), 'ses_frozen');
  assert.equal(url.searchParams.get('__foundry_token'), 'private-token');
  assert.equal(
    url.searchParams.get('__foundry_preview_capability'),
    'preview-capability-kept-in-the-frame-url',
  );
  assert.equal(url.searchParams.get('__foundry_child'), '1');
  assert.equal(url.searchParams.get('__foundry_verification'), '1');
  assert.equal(url.hash, '#form');
});

test('rebuilt verification keeps the reviewed viewport when the inspector later resizes', () => {
  const frozen = { width: 1280, height: 720 };
  assert.deepEqual(verificationViewportForContext(frozen, undefined), frozen);
  assert.deepEqual(verificationViewportForContext(frozen, { width: 432 }), {
    width: 432,
    height: 720,
  });
});

test('rebuilt verification uses acknowledged atomic preview contexts and reports each context', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const bridgeStart = source.indexOf('function requestVerificationPreviewContext');
  const documentStart = source.indexOf('async function verificationDocument');
  const documentEnd = source.indexOf('function authoredStyleValue', documentStart);
  const verificationBridge = source.slice(bridgeStart, documentStart);
  const verificationDocument = source.slice(documentStart, documentEnd);
  assert.ok(bridgeStart > 0 && documentStart > bridgeStart && documentEnd > documentStart);
  assert.match(verificationDocument, /requestVerificationPreviewContext/);
  assert.match(verificationBridge, /command: 'apply-preview-context'/);
  assert.match(
    verificationDocument,
    /verificationFrameUrl\(frozenContext, sessionId, token, previewCapability\)/,
  );
  assert.doesNotMatch(verificationDocument, /requestedTheme/);
  assert.doesNotMatch(verificationDocument, /window\.innerWidth|window\.innerHeight/);

  const verifyStart = source.indexOf('async function verify(');
  const verifyEnd = source.indexOf('function installPanelResizer', verifyStart);
  const verify = source.slice(verifyStart, verifyEnd);
  assert.ok(verifyStart > 0 && verifyEnd > verifyStart);
  assert.match(verify, /const contexts = verificationContextsForChange\(change\)/);
  assert.match(verify, /for \(const context of contexts\)/);
  assert.match(verify, /context,\s*passed,/);
  assert.match(verify, /verificationContext\.cleanup\(\)/);
  assert.match(verify, /run\.reviewedChangeSet\.changes/);
  assert.match(verify, /run\.reviewedChangeSet\.context/);
  assert.match(verify, /rebuiltTargetIdentityMatches\(change\.target/);
  assert.match(verify, /\/verification-challenge/);
  assert.match(verify, /JSON\.stringify\(\{ claimAttemptId, previewCapability \}\)/);
  assert.match(verify, /source: 'browser-preview'/);
  assert.match(verify, /challenge: challenge\.challenge/);
  assert.match(verify, /runId,\s*claimAttemptId,\s*challenge: challenge\.challenge,\s*results,/);
});
