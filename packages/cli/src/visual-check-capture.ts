import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { Browser, Page } from 'playwright';
import type { VisualCapture, VisualScreen } from 'foundry-design-protocol';

export class UnsupportedVisualContextError extends Error {}

// tsx/esbuild can preserve nested function names through a local __name helper.
// Keep that helper inside this evaluation, never on the project's global object.
function evaluateInPage<T, A>(
  page: Page,
  callback: (argument: A) => T,
  argument: A,
): Promise<Awaited<T>> {
  return page.evaluate(
    `(() => { const __name = (target) => target; return (${callback.toString()})(${JSON.stringify(argument)}); })()`,
  );
}

export function validateVisualUrl(input: string): URL {
  const url = new URL(input);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password
  ) {
    throw new Error('Visual checks require an HTTP(S) loopback project URL without credentials.');
  }
  if (
    [...url.searchParams.keys()].some((key) =>
      /token|secret|password|capability|session/i.test(key),
    )
  ) {
    throw new Error(
      'Register the product URL without session credentials or secret query parameters.',
    );
  }
  return url;
}

export function screenConfigurationHash(screen: VisualScreen): string {
  return createHash('sha256').update(JSON.stringify(screen)).digest('hex');
}

async function projectRevision(
  projectRoot: string,
): Promise<{ sourceRevision?: string; sourceDirty?: boolean }> {
  try {
    const execute = promisify(execFile);
    const { stdout: revision } = await execute('git', ['rev-parse', 'HEAD'], {
      cwd: projectRoot,
      timeout: 5000,
    });
    const { stdout: status } = await execute(
      'git',
      ['status', '--porcelain', '--untracked-files=normal', '--', '.', ':!.foundry/visual-checks'],
      { cwd: projectRoot, timeout: 5000 },
    );
    return { sourceRevision: revision.trim(), sourceDirty: Boolean(status.trim()) };
  } catch {
    return {};
  }
}

async function applyHook(
  page: Page,
  axis: string,
  value: string,
  hook: VisualScreen['themeHook'],
): Promise<void> {
  if (!hook) {
    if (value !== 'current')
      throw new UnsupportedVisualContextError(
        `${axis} “${value}” needs an explicit authored attribute or class hook.`,
      );
    return;
  }
  const result = await evaluateInPage(
    page,
    ({ hook, axis }) => {
      const nodes = document.querySelectorAll(hook.selector);
      if (nodes.length !== 1)
        return `${axis} hook must resolve to exactly one target (found ${nodes.length}).`;
      const target = nodes[0]!;
      const styles: string[] = [];
      function collect(rules: CSSRuleList): void {
        for (const rule of Array.from(rules)) {
          if ('selectorText' in rule) styles.push((rule as CSSStyleRule).selectorText);
          if ('cssRules' in rule) collect((rule as CSSGroupingRule).cssRules);
        }
      }
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          collect(sheet.cssRules);
        } catch {
          /* Cross-origin rules cannot prove an authored hook. */
        }
      }
      const hookSelector =
        hook.attribute === 'class'
          ? `.${CSS.escape(hook.value)}`
          : `[${hook.attribute}="${CSS.escape(hook.value)}"]`;
      const normalize = (selector: string) =>
        selector.replace(/\[([^\]=]+)=['"]?([^\]'"\s]+)['"]?\]/g, '[$1="$2"]');
      if (!styles.some((selector) => normalize(selector).includes(hookSelector))) {
        return `No readable authored CSS selector was found for ${axis} ${hookSelector}.`;
      }
      if (hook.attribute === 'class') target.classList.add(hook.value);
      else target.setAttribute(hook.attribute, hook.value);
      return null;
    },
    { hook, axis },
  );
  if (result) throw new UnsupportedVisualContextError(result);
}

async function stableGeometry(page: Page, screen: VisualScreen) {
  const sample = () =>
    evaluateInPage(
      page,
      ({ masks, targets }) => {
        const masked = (node: Element) =>
          masks.some((selector) => node.matches(selector) || node.closest(selector));
        const selectorFor = (node: Element): string => {
          if (node.id && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1)
            return `#${CSS.escape(node.id)}`;
          const path: string[] = [];
          let cursor: Element | null = node;
          while (cursor && cursor !== document.documentElement) {
            const parent: Element | null = cursor.parentElement;
            const position = parent ? Array.from(parent.children).indexOf(cursor) + 1 : 1;
            path.unshift(`${cursor.tagName.toLowerCase()}:nth-child(${position})`);
            cursor = parent;
          }
          return `html > ${path.join(' > ')}`;
        };
        const nodes = [
          ...new Set(
            targets.length
              ? targets.flatMap((selector) => Array.from(document.querySelectorAll(selector)))
              : Array.from(document.body.querySelectorAll('*')),
          ),
        ];
        const geometry: Array<{
          selector: string;
          x: number;
          y: number;
          width: number;
          height: number;
        }> = [];
        const findings: Array<{
          kind:
            | 'horizontal-overflow'
            | 'clipped-content'
            | 'small-target'
            | 'missing-name'
            | 'missing-alt';
          selector: string;
          message: string;
        }> = [];
        for (const node of nodes.slice(0, 2000)) {
          if (masked(node)) continue;
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          if (
            !rect.width ||
            !rect.height ||
            style.visibility === 'hidden' ||
            style.display === 'none'
          )
            continue;
          const selector = selectorFor(node);
          const round = (value: number) => Math.round(value * 100) / 100;
          geometry.push({
            selector,
            x: round(rect.x),
            y: round(rect.y),
            width: round(rect.width),
            height: round(rect.height),
          });
          if (rect.right > innerWidth + 1 || rect.left < -1)
            findings.push({
              kind: 'horizontal-overflow',
              selector,
              message: 'Element extends beyond the horizontal viewport.',
            });
          if (
            (['hidden', 'clip'].includes(style.overflowX) &&
              node.scrollWidth > node.clientWidth + 1) ||
            (['hidden', 'clip'].includes(style.overflowY) &&
              node.scrollHeight > node.clientHeight + 1)
          )
            findings.push({
              kind: 'clipped-content',
              selector,
              message: 'Content exceeds a clipped element. This may be intentional.',
            });
          if (
            node.matches(
              'button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]',
            )
          ) {
            if (rect.width < 44 || rect.height < 44)
              findings.push({
                kind: 'small-target',
                selector,
                message: `Interactive target measures ${round(rect.width)} × ${round(rect.height)}px; check whether a 44px target is appropriate.`,
              });
            const labelled = node
              .getAttribute('aria-labelledby')
              ?.split(/\s+/)
              .map((id) => document.getElementById(id)?.textContent || '')
              .join('');
            const inputLabels =
              'labels' in node
                ? Array.from((node as HTMLInputElement).labels ?? [])
                    .map((label) => label.textContent)
                    .join('')
                : '';
            const text = (
              node.getAttribute('aria-label') ||
              labelled ||
              inputLabels ||
              node.textContent ||
              node.getAttribute('title') ||
              ('value' in node && node.matches('input[type="submit"],input[type="button"]')
                ? String((node as HTMLInputElement).value)
                : '')
            ).trim();
            if (!text)
              findings.push({
                kind: 'missing-name',
                selector,
                message: 'No accessible name was found by the basic name check.',
              });
          }
          if (
            node.matches('img') &&
            !node.hasAttribute('alt') &&
            node.getAttribute('role') !== 'presentation' &&
            node.getAttribute('aria-hidden') !== 'true'
          )
            findings.push({
              kind: 'missing-alt',
              selector,
              message: 'Image has no alt attribute.',
            });
        }
        return { geometry, findings, truncated: nodes.length > 2000 };
      },
      { masks: screen.masks, targets: screen.targets },
    );
  let previous = '';
  let stable = 0;
  for (let attempt = 0; attempt < 25; attempt++) {
    const value = await sample();
    const signature = JSON.stringify(value.geometry);
    stable = signature === previous ? stable + 1 : 0;
    if (stable >= 3) return value;
    previous = signature;
    await page.waitForTimeout(100);
  }
  throw new Error(
    'Layout did not become stable. Mask dynamic content or fix the preview before capturing.',
  );
}

export async function captureVisualScreen(
  browser: Browser,
  screen: VisualScreen,
  projectRoot: string,
  screenshot: string,
): Promise<VisualCapture> {
  validateVisualUrl(screen.url);
  const context = await browser.newContext({
    viewport: screen.viewport,
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
    locale: 'en-US',
    timezoneId: 'UTC',
  });
  try {
    await context.route('**/*', async (route) => {
      if (route.request().isNavigationRequest()) {
        try {
          validateVisualUrl(route.request().url());
        } catch {
          await route.abort('blockedbyclient');
          return;
        }
      }
      await route.continue();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const response = await page.goto(screen.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    if (!response?.ok())
      throw new Error(`Preview returned HTTP ${response?.status() ?? 'no response'}.`);
    validateVisualUrl(page.url());
    await evaluateInPage(
      page,
      async () => {
        await Promise.race([
          document.fonts.ready,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Fonts did not finish loading.')), 10000),
          ),
        ]);
      },
      undefined,
    );
    await applyHook(page, 'Theme', screen.theme, screen.themeHook);
    await applyHook(page, 'State', screen.state, screen.stateHook);
    await page.addStyleTag({
      content:
        '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;scroll-behavior:auto!important}',
    });
    await evaluateInPage(
      page,
      async (masks: string[]) => {
        // Force style/layout after authored hooks so newly requested fonts are included.
        document.body.getBoundingClientRect();
        const ready = async () => {
          await document.fonts.ready;
          const failedFonts = Array.from(document.fonts).filter((face) => face.status === 'error');
          if (failedFonts.length)
            throw new Error(
              'A project font failed to load. Capture cannot verify the intended typography.',
            );
          await Promise.all(
            Array.from(document.images)
              .filter((image) => {
                const rect = image.getBoundingClientRect();
                return (
                  !masks.some((selector) => image.matches(selector) || image.closest(selector)) &&
                  rect.width > 0 &&
                  rect.height > 0 &&
                  rect.bottom > 0 &&
                  rect.top < innerHeight
                );
              })
              .map(async (image) => {
                if (!image.complete) await image.decode();
                if (!image.naturalWidth) throw new Error('A visible project image failed to load.');
              }),
          );
        };
        await Promise.race([
          ready(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Fonts or visible images did not become ready.')),
              10000,
            ),
          ),
        ]);
      },
      screen.masks,
    );
    for (const selector of [...screen.targets, ...screen.masks]) {
      if (!(await page.locator(selector).count()))
        throw new UnsupportedVisualContextError(`Registered selector was not found: ${selector}`);
    }
    const measured = await stableGeometry(page, screen);
    const bytes = await page.screenshot({
      path: screenshot,
      animations: 'disabled',
      caret: 'hide',
      mask: screen.masks.map((selector) => page.locator(selector)),
      maskColor: '#808080',
      fullPage: false,
    });
    const after = await stableGeometry(page, screen);
    if (JSON.stringify(measured.geometry) !== JSON.stringify(after.geometry))
      throw new Error('Layout changed during capture. The capture cannot be used as evidence.');
    return {
      version: 1,
      screen,
      configurationHash: screenConfigurationHash(screen),
      createdAt: new Date().toISOString(),
      ...(await projectRevision(projectRoot)),
      browser: browser.version(),
      platform: `${process.platform}/${process.arch}`,
      deviceScaleFactor: 1,
      motion: 'reduced; CSS animations and transitions disabled',
      screenshot,
      screenshotHash: createHash('sha256').update(bytes).digest('hex'),
      geometry: measured.geometry,
      findings: measured.findings,
      evidence: [
        'Waited for document.fonts.ready.',
        'Geometry stable across four samples before and after capture.',
        'Fresh isolated browser context; locale en-US, timezone UTC.',
        'Basic overflow, clipping, target-size and name/alt checks only; not a complete accessibility audit.',
        ...(measured.truncated
          ? [
              'Geometry checks limited to the first 2000 elements. Register explicit targets to narrow this screen.',
            ]
          : []),
      ],
    };
  } finally {
    await context.close();
  }
}
