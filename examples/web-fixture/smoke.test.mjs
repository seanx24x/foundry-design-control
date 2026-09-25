import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { buildFixture } from './build.mjs';
import { configureFoundry } from './configure-foundry.mjs';
import { validateSourceAnnotations } from './validate-source-annotations.mjs';

test('signup fixture contains mapped form surfaces and accessible interaction states', async () => {
  const html = await readFile(new URL('index.html', import.meta.url), 'utf8');
  const css = await readFile(new URL('style.css', import.meta.url), 'utf8');
  assert.match(html, /data-foundry-id="signup-form"/);
  assert.match(html, /data-foundry-id="working-note"/);
  assert.match(html, /data-foundry-id="create-workspace-button"/);
  assert.match(html, /data-foundry-id="password-reveal"/);
  assert.match(html, /data-foundry-id="story-title"/);
  assert.match(html, /data-foundry-id="form-title"/);
  assert.match(
    html,
    /data-foundry-component="Signup\/HeroHeading"\s+data-foundry-source="index.html:43:12"/,
  );
  assert.match(
    html,
    /data-foundry-component="Signup\/FormHeading"\s+data-foundry-source="index.html:111:12"/,
  );
  assert.match(html, /data-foundry-component="Signup\/PasswordReveal"/);
  assert.match(html, /data-foundry-source="style\.css:660:20"/);
  assert.match(html, /data-foundry-source-anchor="\/\* foundry: password-reveal \*\/"/);
  assert.match(html, /Create your workspace/);
  assert.match(html, /validateField/);
  assert.match(html, /MutationObserver\(syncThemeColor\)/);
  assert.match(html, /data-foundry-source=/);
  assert.match(css, /@keyframes button-spin/);
  assert.match(css, /prefers-reduced-motion/);
});

test('Morrow exposes a fixture-authored query state to Foundry', async () => {
  const authored = JSON.parse(await readFile(new URL('foundry.design.json', import.meta.url)));
  assert.deepEqual(authored.states, [
    {
      id: 'loading',
      label: 'Loading',
      query: { 'morrow-state': 'loading' },
      confidence: 'instrumented',
      evidence: [
        'The Morrow fixture reads ?morrow-state=loading and applies its authored loading treatment.',
      ],
    },
  ]);

  const root = await mkdtemp(join(tmpdir(), 'foundry-morrow-config-'));
  try {
    await mkdir(join(root, '.foundry'), { recursive: true });
    await cp(new URL('foundry.design.json', import.meta.url), join(root, 'foundry.design.json'));
    for (const file of ['index.html', 'style.css']) {
      await cp(new URL(file, import.meta.url), join(root, file));
    }
    await writeFile(
      join(root, '.foundry', 'foundry.config.json'),
      `${JSON.stringify({ version: 2, design: { themes: [{ id: 'light' }] } }, null, 2)}\n`,
    );
    await configureFoundry(root);
    const configuredOnce = await readFile(join(root, '.foundry', 'foundry.config.json'), 'utf8');
    await configureFoundry(root);
    const configuredTwice = await readFile(join(root, '.foundry', 'foundry.config.json'), 'utf8');
    assert.equal(
      configuredTwice,
      configuredOnce,
      'Authored state configuration must be idempotent.',
    );
    const configured = JSON.parse(configuredOnce);
    assert.deepEqual(configured.design.themes, [{ id: 'light' }]);
    assert.deepEqual(configured.design.states, authored.states);
    assert.deepEqual(configured.design.components[0].source, { file: 'index.html', line: 247 });
    assert.deepEqual(
      configured.design.components[0].variants.map((item) => item.value),
      ['Primary', 'Quiet', 'Danger'],
    );
    assert.ok(
      configured.design.components[0].variants.every((item) => item.source.file === 'style.css'),
    );
    assert.ok(configured.design.exclude.includes('PrimaryAction.tsx'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('fixture build output is deterministic and source-identical', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-morrow-build-'));
  try {
    for (const file of ['index.html', 'style.css']) {
      await cp(new URL(file, import.meta.url), join(root, file));
    }
    await cp(new URL('fonts/', import.meta.url), join(root, 'fonts'), { recursive: true });
    const first = await buildFixture(root);
    const firstManifest = await readFile(join(root, 'dist', 'build-manifest.json'), 'utf8');
    const second = await buildFixture(root);
    const secondManifest = await readFile(join(root, 'dist', 'build-manifest.json'), 'utf8');
    assert.deepEqual(second, first);
    assert.equal(secondManifest, firstManifest);
    assert.deepEqual(Object.keys(second.files), [
      'index.html',
      'style.css',
      'fonts/inter.woff2',
      'fonts/inter-OFL.txt',
      'fonts/google-sans-flex.woff2',
      'fonts/google-sans-flex-OFL.txt',
    ]);
    assert.deepEqual(second.sourceAnnotations, { count: 13, files: ['index.html', 'style.css'] });
    for (const file of Object.keys(second.files)) {
      assert.equal(
        await readFile(join(root, 'dist', file), 'utf8'),
        await readFile(join(root, file), 'utf8'),
      );
      assert.match(second.files[file].sha256, /^[a-f0-9]{64}$/);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('source annotations are current and remain inside the fixture', () => {
  assert.deepEqual(validateSourceAnnotations(), {
    count: 13,
    files: ['index.html', 'style.css'],
  });
});

test('source annotation drift validator rejects unsafe and stale mappings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'foundry-morrow-annotations-'));
  try {
    const invalidSources = [
      ['/tmp/index.html:1:1', /absolute path/],
      ['../outside.css:1:1', /parent traversal/],
      ['missing.css:1:1', /missing file/],
      ['index.html:1:1', /stale at/],
    ];
    for (const [source, expectation] of invalidSources) {
      await writeFile(
        join(root, 'index.html'),
        `<main data-foundry-id="test" data-foundry-source="${source}"></main>\n`,
      );
      assert.throws(() => validateSourceAnnotations(root), expectation);
    }

    await writeFile(join(root, 'style.css'), '\n.reveal-button { min-height: 40px; }\n');
    await writeFile(
      join(root, 'index.html'),
      '<button data-foundry-id="test" data-foundry-source="style.css:2:0"></button>\n',
    );
    assert.throws(() => validateSourceAnnotations(root), /needs data-foundry-source-anchor/);

    await writeFile(
      join(root, 'index.html'),
      '<button data-foundry-id="test" data-foundry-source="style.css:1:0" data-foundry-source-anchor=".reveal-button {"></button>\n',
    );
    assert.throws(() => validateSourceAnnotations(root), /stale at/);

    await writeFile(
      join(root, 'style.css'),
      '.reveal-button { min-height: 40px; }\n.reveal-button { min-height: 44px; }\n',
    );
    assert.throws(() => validateSourceAnnotations(root), /one unambiguous/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('Morrow fixture styling stays on the 4px grid', async () => {
  const css = await readFile(new URL('style.css', import.meta.url), 'utf8');
  const values = [...css.matchAll(/(-?\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
  const offGrid = values.filter(
    (value) => value !== 0 && Math.abs(value) !== 1 && Math.abs(value) % 4 !== 0,
  );
  assert.deepEqual(
    [...new Set(offGrid)].sort((a, b) => a - b),
    [],
  );
});

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first, second) {
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

test('dark theme uses the approved palette with readable text', async () => {
  const css = await readFile(new URL('style.css', import.meta.url), 'utf8');
  for (const declaration of [
    '--canvas: #111411',
    '--surface: #171a17',
    '--surface-muted: #202520',
    '--ink: #f4f5f2',
    '--muted: #a7ada5',
    '--quiet: #7f867e',
    '--line: #2d332d',
    '--line-strong: #424942',
    '--green: #78a99a',
    '--green-hover: #8bb7aa',
    '--green-soft: #243a33',
    '--mint: #b9d8cc',
    '--error: #e58c84',
    '--error-soft: #3b2524',
    '--focus: #8fc2b2',
  ]) {
    assert.ok(css.includes(declaration), `Missing dark-theme declaration: ${declaration}`);
  }
  assert.ok(contrast('#f4f5f2', '#171a17') >= 7);
  assert.ok(contrast('#a7ada5', '#171a17') >= 4.5);
});

test('rendered Morrow target and dark surfaces match the demonstration contract', async (t) => {
  const expectedRevealHeight = Number(process.env.FOUNDRY_EXPECT_REVEAL_HEIGHT ?? 40);
  const root = new URL('.', import.meta.url);
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    try {
      const body = await readFile(new URL(file, root));
      const type = extname(file) === '.css' ? 'text/css' : 'text/html';
      response.writeHead(200, { 'content-type': type });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
  });
  let browser;
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      server.closeAllConnections();
      if (server.listening) {
        await new Promise((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
    }
  });
  await new Promise((resolve, reject) => {
    const listening = () => {
      server.off('error', failed);
      resolve();
    };
    const failed = (error) => {
      server.off('listening', listening);
      reject(error);
    };
    server.once('error', failed);
    server.once('listening', listening);
    server.listen(0, '127.0.0.1');
  });
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  browser = await chromium.launch({ headless: true });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`http://127.0.0.1:${address.port}`);
  const reveal = await page.locator('[data-foundry-id="password-reveal"]').boundingBox();
  assert.deepEqual(
    { width: Math.round(reveal.width), height: Math.round(reveal.height) },
    { width: 44, height: expectedRevealHeight },
  );
  if (expectedRevealHeight === 40) {
    const undersizedTargets = await page.evaluate(() =>
      [...document.querySelectorAll('a,button,input,select,textarea,summary')]
        .filter((element) => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          const visible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            Number(style.opacity || 1) > 0 &&
            box.width > 1 &&
            box.height > 1;
          const eligible =
            element.tagName !== 'A' || !['inline', 'contents'].includes(style.display);
          return visible && eligible && (box.width < 44 || box.height < 44);
        })
        .map((element) => ({
          id: element.getAttribute('data-foundry-id'),
          width: Math.round(element.getBoundingClientRect().width),
          height: Math.round(element.getBoundingClientRect().height),
        })),
    );
    assert.deepEqual(undersizedTargets, [{ id: 'password-reveal', width: 44, height: 40 }]);
  }

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForFunction(
    () => document.querySelector('meta[name="theme-color"]')?.content === '#111411',
  );
  await page.waitForTimeout(240);
  const rendered = await page.evaluate(() => {
    const color = (selector) => getComputedStyle(document.querySelector(selector)).backgroundColor;
    return {
      canvas: color('html'),
      shell: color('.signup-shell'),
      story: color('.product-story'),
      header: color('.site-header'),
      input: color('.input-shell'),
      note: color('.working-note'),
      social: color('.social-button'),
      iconButton: color('.icon-button'),
      checkbox: color('.custom-checkbox'),
      meta: document.querySelector('meta[name="theme-color"]').content,
      visibleSurfaces: [...document.querySelectorAll('*')]
        .filter((element) => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            box.width > 0 &&
            box.height > 0 &&
            style.backgroundColor !== 'rgba(0, 0, 0, 0)'
          );
        })
        .map((element) => ({
          selector: element.className || element.tagName.toLowerCase(),
          background: getComputedStyle(element).backgroundColor,
        })),
    };
  });
  assert.deepEqual(
    {
      canvas: rendered.canvas,
      shell: rendered.shell,
      story: rendered.story,
      header: rendered.header,
      input: rendered.input,
      social: rendered.social,
      iconButton: rendered.iconButton,
      checkbox: rendered.checkbox,
    },
    {
      canvas: 'rgb(17, 20, 17)',
      shell: 'rgb(23, 26, 23)',
      story: 'rgb(32, 37, 32)',
      header: 'rgba(23, 26, 23, 0.92)',
      input: 'rgb(23, 26, 23)',
      social: 'rgb(23, 26, 23)',
      iconButton: 'rgb(23, 26, 23)',
      checkbox: 'rgb(23, 26, 23)',
    },
  );
  assert.equal(rendered.meta, '#111411');
  const forbiddenLightSurfaces = new Set([
    'rgb(255, 255, 255)',
    'rgb(243, 244, 240)',
    'rgb(237, 240, 234)',
    'rgb(232, 235, 229)',
  ]);
  assert.deepEqual(
    rendered.visibleSurfaces.filter(({ background }) => forbiddenLightSurfaces.has(background)),
    [],
  );

  await page.locator('#email').focus();
  await page.locator('#email').blur();
  await page.waitForTimeout(240);
  assert.equal(
    await page
      .locator('#email')
      .evaluate((input) => getComputedStyle(input.closest('.input-shell')).backgroundColor),
    'rgb(59, 37, 36)',
  );
  await page.locator('.social-button').hover();
  await page.waitForTimeout(240);
  assert.equal(
    await page
      .locator('.social-button')
      .evaluate((button) => getComputedStyle(button).backgroundColor),
    'rgb(32, 37, 32)',
  );

  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.waitForFunction(
    () => document.querySelector('meta[name="theme-color"]')?.content === '#f3f4f0',
  );

  await page.goto(`http://127.0.0.1:${address.port}/?morrow-state=loading`);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('.submit-button').isDisabled(), true);
  assert.equal(
    await page.locator('.submit-button b').evaluate((el) => getComputedStyle(el).animationName),
    'button-spin',
  );
  assert.equal(
    await page.evaluate(
      () =>
        document.fonts.check('16px "Morrow Sans"') && document.fonts.check('16px "Morrow Display"'),
    ),
    true,
  );
  const note = page.locator('.working-note');
  assert.equal(await note.evaluate((el) => getComputedStyle(el).animationName), 'note-arrive');
  assert.equal(await note.evaluate((el) => el.getAnimations()[0].effect.getTiming().duration), 480);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.ok(
    (await note.evaluate((el) => parseFloat(getComputedStyle(el).animationDuration))) <= 0.00001,
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const authoredLoadingState = await page.locator('.submit-button').evaluate((button) => ({
    state: button.getAttribute('data-foundry-state'),
    busy: button.getAttribute('aria-busy'),
    label: button.querySelector('span')?.textContent,
    cursor: getComputedStyle(button).cursor,
    opacity: getComputedStyle(button).opacity,
  }));
  assert.deepEqual(authoredLoadingState, {
    state: 'loading',
    busy: 'true',
    label: 'Creating workspace',
    cursor: 'progress',
    opacity: '0.72',
  });
});
