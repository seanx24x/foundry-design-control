import { createHash, randomUUID } from 'node:crypto';
import {
  access,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rmdir,
  writeFile,
} from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { chromium } from 'playwright';
import sharp from 'sharp';
import {
  visualCaptureSchema,
  visualCheckReportSchema,
  visualScreenSchema,
  type VisualCapture,
  type VisualCheckReport,
  type VisualCheckResult,
  type VisualFinding,
  type VisualScreen,
} from 'foundry-design-protocol';
import {
  captureVisualScreen,
  screenConfigurationHash,
  UnsupportedVisualContextError,
  validateVisualUrl,
} from './visual-check-capture.js';

interface VisualConfiguration {
  version: 1;
  screens: VisualScreen[];
  baselines: Record<string, string>;
}
const identifier = /^[a-z0-9][a-z0-9_-]{0,79}$/i;
const hash = (content: Buffer | string) => createHash('sha256').update(content).digest('hex');
const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false,
  );
const rootFor = (projectRoot: string) => resolve(projectRoot, '.foundry/visual-checks');
const safeId = (id: string) => {
  if (!identifier.test(id)) throw new Error('Invalid visual-check identifier.');
  return id;
};

async function safePath(root: string, child: string): Promise<string> {
  const target = resolve(root, child);
  const path = relative(root, target);
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path))
    throw new Error('Visual-check artifact path escapes its managed directory.');
  let current = root;
  const parents = [
    root,
    ...path.split(sep).map((part) => {
      current = join(current, part);
      return current;
    }),
  ];
  // Also reject .foundry as a symlink, so managed writes never leave the project.
  parents.unshift(dirname(root));
  for (const part of parents) {
    try {
      if ((await lstat(part)).isSymbolicLink())
        throw new Error('Visual checks refuse symbolic-link storage paths.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return target;
}

async function configuration(root: string): Promise<VisualConfiguration> {
  const path = await safePath(root, 'screens.json');
  if (!(await exists(path))) return { version: 1, screens: [], baselines: {} };
  const input = JSON.parse(await readFile(path, 'utf8'));
  if (
    input.version !== 1 ||
    !Array.isArray(input.screens) ||
    !input.baselines ||
    typeof input.baselines !== 'object'
  )
    throw new Error('Unsupported visual-check configuration.');
  const screens = input.screens.map((screen: unknown) => visualScreenSchema.parse(screen));
  if (new Set(screens.map((screen: VisualScreen) => screen.name)).size !== screens.length)
    throw new Error('Duplicate registered screen names.');
  const baselines = Object.fromEntries(
    Object.entries(input.baselines).map(([name, value]) => [safeId(name), safeId(String(value))]),
  );
  return { version: 1, screens, baselines };
}

async function saveConfiguration(root: string, config: VisualConfiguration): Promise<void> {
  const path = await safePath(root, 'screens.json');
  const temp = await safePath(root, `screens-${randomUUID()}.tmp`);
  await writeFile(temp, `${JSON.stringify(config, null, 2)}\n`, { flag: 'wx' });
  await rename(temp, path);
}

async function withLock<T>(root: string, work: () => Promise<T>): Promise<T> {
  const lock = await safePath(root, 'operation.lock');
  await mkdir(root, { recursive: true });
  try {
    await mkdir(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST')
      throw new Error(
        'Another visual-check operation is running. If a process was interrupted, remove .foundry/visual-checks/operation.lock after confirming it has stopped.',
      );
    throw error;
  }
  try {
    return await work();
  } finally {
    await rmdir(lock);
  }
}

export async function registerVisualScreen(
  projectRoot: string,
  input: unknown,
): Promise<VisualScreen> {
  const screen = visualScreenSchema.parse(input);
  validateVisualUrl(screen.url);
  const root = rootFor(projectRoot);
  return withLock(root, async () => {
    const config = await configuration(root);
    const previous = config.screens.find((item) => item.name === screen.name);
    config.screens = [...config.screens.filter((item) => item.name !== screen.name), screen];
    // Keep immutable baseline evidence. Changed config needs a fresh explicit approval.
    if (previous && screenConfigurationHash(previous) !== screenConfigurationHash(screen))
      delete config.baselines[screen.name];
    await saveConfiguration(root, config);
    return screen;
  });
}

export function visualCheckExitCode(results: VisualCheckResult[]): VisualCheckReport['exitCode'] {
  if (
    !results.length ||
    results.some((result) => ['failed', 'unsupported'].includes(result.status))
  )
    return 2;
  if (results.some((result) => result.status === 'different')) return 1;
  if (results.some((result) => result.status === 'unbaselined')) return 3;
  return 0;
}

function findingKey(finding: VisualFinding): string {
  return `${finding.kind}:${finding.selector}`;
}

export async function compareVisualCaptures(
  baseline: VisualCapture,
  current: VisualCapture,
  baselineImage: string,
  currentImage: string,
  diffImage: string,
): Promise<
  Pick<
    VisualCheckResult,
    | 'status'
    | 'reason'
    | 'changedPixels'
    | 'totalPixels'
    | 'changedRatio'
    | 'geometryChanges'
    | 'newFindings'
  >
> {
  const empty = { geometryChanges: [], newFindings: [] };
  if (
    baseline.configurationHash !== screenConfigurationHash(baseline.screen) ||
    current.configurationHash !== screenConfigurationHash(current.screen)
  )
    throw new Error('Recorded capture configuration was modified after capture.');
  if (baseline.configurationHash !== current.configurationHash)
    return {
      status: 'unsupported',
      reason:
        'Capture configuration differs from the approved baseline. Capture and approve the new context explicitly.',
      ...empty,
    };
  if (baseline.browser !== current.browser || baseline.platform !== current.platform)
    return {
      status: 'unsupported',
      reason:
        'Browser version or operating system differs from the baseline. Use the same capture environment or explicitly approve a baseline here.',
      ...empty,
    };
  const [before, after] = await Promise.all([readFile(baselineImage), readFile(currentImage)]);
  if (hash(before) !== baseline.screenshotHash || hash(after) !== current.screenshotHash)
    throw new Error(
      'Screenshot hash differs from the recorded capture. Evidence may have been modified.',
    );
  const [a, b] = await Promise.all([
    sharp(before).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(after).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  if (a.info.width !== b.info.width || a.info.height !== b.info.height)
    return {
      status: 'unsupported',
      reason: 'Screenshot dimensions do not match the approved context.',
      ...empty,
    };
  const diff = Buffer.alloc(b.data.length);
  let changedPixels = 0;
  for (let offset = 0; offset < b.data.length; offset += 4) {
    const changed = [0, 1, 2, 3].some(
      (channel) =>
        Math.abs(a.data[offset + channel]! - b.data[offset + channel]!) >
        current.screen.pixelThreshold,
    );
    if (changed) changedPixels++;
    diff[offset] = changed ? 255 : Math.round(b.data[offset]! * 0.25 + 190);
    diff[offset + 1] = changed ? 64 : Math.round(b.data[offset + 1]! * 0.25 + 190);
    diff[offset + 2] = changed ? 112 : Math.round(b.data[offset + 2]! * 0.25 + 190);
    diff[offset + 3] = 255;
  }
  await sharp(diff, { raw: { width: b.info.width, height: b.info.height, channels: 4 } })
    .png()
    .toFile(diffImage);
  const oldGeometry = new Map(baseline.geometry.map((item) => [item.selector, item]));
  const geometryChanges: VisualCheckResult['geometryChanges'] = [];
  for (const item of current.geometry) {
    const old = oldGeometry.get(item.selector);
    if (!old)
      geometryChanges.push({
        selector: item.selector,
        description: 'Element appeared in measured geometry.',
      });
    else {
      const properties = (['x', 'y', 'width', 'height'] as const).filter(
        (key) => Math.abs(item[key] - old[key]) > current.screen.geometryTolerance,
      );
      if (properties.length)
        geometryChanges.push({
          selector: item.selector,
          description: properties.map((key) => `${key}: ${old[key]} → ${item[key]}px`).join('; '),
        });
      oldGeometry.delete(item.selector);
    }
  }
  for (const selector of oldGeometry.keys())
    geometryChanges.push({ selector, description: 'Element disappeared from measured geometry.' });
  const oldFindings = new Set(baseline.findings.map(findingKey));
  const newFindings = current.findings.filter((finding) => !oldFindings.has(findingKey(finding)));
  const totalPixels = b.info.width * b.info.height;
  const changedRatio = changedPixels / totalPixels;
  const different =
    changedRatio > current.screen.changedPixelRatio ||
    geometryChanges.length > 0 ||
    newFindings.length > 0;
  return {
    status: different ? 'different' : 'passed',
    changedPixels,
    totalPixels,
    changedRatio,
    geometryChanges,
    newFindings,
  };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}

export function renderVisualCheckHtml(report: VisualCheckReport): string {
  const esc = escapeHtml;
  const image = (path: string | undefined, label: string) =>
    path
      ? `<figure><figcaption>${label}</figcaption><img alt="${label}" src="../../${esc(path)}"></figure>`
      : '';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Foundry visual check ${esc(report.id)}</title><style>body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#f4f4f5;color:#171719}main{max-width:1440px;margin:auto;padding:32px}h1{font-size:28px}section{background:white;border:1px solid #ddd;border-radius:8px;padding:24px;margin:24px 0}.images{display:flex;gap:16px;flex-wrap:wrap}figure{margin:0;flex:1;min-width:260px}img{width:100%;border:1px solid #ddd}code{overflow-wrap:anywhere}li{margin:8px 0}.status{font-weight:600}small{color:#626267}</style><main><h1>Foundry visual checks</h1><p>${esc(report.createdAt)} · ${esc(report.id)}</p><p>Differences are evidence to review, not an automatic judgment of design quality. Baselines change only through explicit approval.</p>${report.results.map((result) => `<section><h2>${esc(result.name)} <span class="status">· ${result.status}</span></h2>${result.reason ? `<p>${esc(result.reason)}</p>` : ''}${result.capture ? `<small>${result.capture.screen.viewport.width} × ${result.capture.screen.viewport.height} · ${esc(result.capture.screen.theme)} · ${esc(result.capture.screen.state)} · Browser ${esc(result.capture.browser)} · ${esc(result.capture.platform)} · Revision ${esc(result.capture.sourceRevision || 'unavailable')}${result.capture.sourceDirty ? ' (uncommitted source changes)' : ''}</small>` : ''}${result.changedRatio !== undefined ? `<p>${(result.changedRatio * 100).toFixed(3)}% changed pixels · ${result.geometryChanges.length} geometry changes · ${result.newFindings.length} new findings</p>` : ''}<div class="images">${image(result.baselineScreenshot, 'Approved baseline')}${image(result.capture?.screenshot, 'Current capture')}${image(result.diffScreenshot, 'Pixel differences')}</div><ul>${result.geometryChanges.map((item) => `<li><code>${esc(item.selector)}</code>: ${esc(item.description)}</li>`).join('')}${result.newFindings.map((item) => `<li><code>${esc(item.selector)}</code>: ${esc(item.message)}</li>`).join('')}</ul>${result.capture ? `<details><summary>Capture evidence and existing findings</summary><ul>${result.capture.evidence.map((item) => `<li>${esc(item)}</li>`).join('')}${result.capture.findings.map((item) => `<li><code>${esc(item.selector)}</code>: ${esc(item.message)}</li>`).join('')}</ul></details>` : ''}</section>`).join('')}</main></html>`;
}

export async function runVisualChecks(
  projectRoot: string,
  name?: string,
): Promise<VisualCheckReport> {
  const root = rootFor(projectRoot);
  return withLock(root, async () => {
    const config = await configuration(root);
    const screens = name
      ? config.screens.filter((screen) => screen.name === safeId(name))
      : config.screens;
    if (!screens.length)
      throw new Error('No matching screen is registered. Run visual-check register first.');
    const id = `check_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const runRoot = await safePath(root, `runs/${id}`);
    await mkdir(runRoot, { recursive: true });
    const results: VisualCheckResult[] = [];
    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      for (const screen of screens) {
        try {
          const imagePath = await safePath(root, `runs/${id}/${screen.name}.png`);
          const capture = await captureVisualScreen(browser, screen, projectRoot, imagePath);
          capture.screenshot = relative(root, imagePath).split(sep).join('/');
          const baselineId = config.baselines[screen.name];
          if (!baselineId) {
            results.push({
              name: screen.name,
              status: 'unbaselined',
              capture,
              reason:
                'No approved baseline. Review this capture, then approve this run explicitly.',
              geometryChanges: [],
              newFindings: [],
            });
            continue;
          }
          const baseline = visualCaptureSchema.parse(
            JSON.parse(
              await readFile(
                await safePath(root, `baselines/${safeId(baselineId)}/capture.json`),
                'utf8',
              ),
            ),
          );
          const baselineImage = await safePath(root, baseline.screenshot);
          const diff = await safePath(root, `runs/${id}/${screen.name}-diff.png`);
          const comparison = await compareVisualCaptures(
            baseline,
            capture,
            baselineImage,
            imagePath,
            diff,
          );
          results.push({
            name: screen.name,
            capture,
            baselineId,
            baselineScreenshot: baseline.screenshot,
            ...comparison,
            ...((await exists(diff))
              ? { diffScreenshot: relative(root, diff).split(sep).join('/') }
              : {}),
          });
        } catch (error) {
          results.push({
            name: screen.name,
            status: error instanceof UnsupportedVisualContextError ? 'unsupported' : 'failed',
            reason: String((error as Error).message),
            geometryChanges: [],
            newFindings: [],
          });
        }
      }
    } catch (error) {
      for (const screen of screens)
        results.push({
          name: screen.name,
          status: 'failed',
          reason: `Browser could not start. Install Chromium explicitly with “npx playwright install chromium”. ${String((error as Error).message)}`,
          geometryChanges: [],
          newFindings: [],
        });
    } finally {
      await browser?.close();
    }
    const report: VisualCheckReport = {
      format: 'foundry.visual-check',
      version: 1,
      id,
      createdAt: new Date().toISOString(),
      results,
      exitCode: visualCheckExitCode(results),
    };
    await writeFile(join(runRoot, 'report.html'), renderVisualCheckHtml(report), { flag: 'wx' });
    await writeFile(join(runRoot, 'report.tmp'), `${JSON.stringify(report, null, 2)}\n`, {
      flag: 'wx',
    });
    await rename(join(runRoot, 'report.tmp'), join(runRoot, 'report.json'));
    return report;
  });
}

export async function approveVisualBaseline(
  projectRoot: string,
  runId: string,
  name: string,
): Promise<string> {
  const root = rootFor(projectRoot);
  return withLock(root, async () => {
    const report = visualCheckReportSchema.parse(
      JSON.parse(await readFile(await safePath(root, `runs/${safeId(runId)}/report.json`), 'utf8')),
    );
    if (report.id !== runId) throw new Error('Report identity does not match the requested run.');
    const result = report.results.find((item) => item.name === safeId(name));
    if (!result?.capture || ['failed', 'unsupported'].includes(result.status))
      throw new Error('Only a successful, supported capture can become a baseline.');
    const config = await configuration(root);
    const screen = config.screens.find((item) => item.name === name);
    if (
      !screen ||
      result.capture.screen.name !== name ||
      screenConfigurationHash(screen) !== result.capture.configurationHash ||
      result.capture.configurationHash !== screenConfigurationHash(result.capture.screen)
    )
      throw new Error(
        'Screen configuration has changed since capture. Run a new check before approval.',
      );
    const source = await safePath(root, result.capture.screenshot);
    if (hash(await readFile(source)) !== result.capture.screenshotHash)
      throw new Error('Capture image was modified after the run. Baseline approval refused.');
    const id = `baseline_${Date.now()}_${randomUUID().slice(0, 8)}`;
    const destination = await safePath(root, `baselines/${id}`);
    await mkdir(destination, { recursive: true });
    await copyFile(source, join(destination, 'capture.png'), constants.COPYFILE_EXCL);
    await writeFile(
      join(destination, 'capture.json'),
      `${JSON.stringify({ ...result.capture, screenshot: `baselines/${id}/capture.png` }, null, 2)}\n`,
      { flag: 'wx' },
    );
    await writeFile(
      join(destination, 'approval.json'),
      `${JSON.stringify({ version: 1, runId, name, approvedAt: new Date().toISOString(), method: 'explicit-cli-approval' }, null, 2)}\n`,
      { flag: 'wx' },
    );
    config.baselines[name] = id;
    await saveConfiguration(root, config);
    return id;
  });
}

export async function listVisualCheckReports(projectRoot: string): Promise<VisualCheckReport[]> {
  const root = rootFor(projectRoot);
  const runs = await safePath(root, 'runs');
  if (!(await exists(runs))) return [];
  const ids = (await readdir(runs))
    .filter((id) => identifier.test(id))
    .sort()
    .reverse()
    .slice(0, 20);
  const reports = [];
  for (const id of ids) {
    const file = await safePath(root, `runs/${id}/report.json`);
    if (!(await exists(file))) continue; // A running check has not committed a report yet.
    const report = visualCheckReportSchema.parse(JSON.parse(await readFile(file, 'utf8')));
    if (report.id !== id)
      throw new Error('Visual-check report identity does not match its directory.');
    reports.push(report);
  }
  return reports;
}

export async function runVisualCheckCli(args: string[], projectRoot: string): Promise<number> {
  const option = (name: string) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const repeated = (name: string) =>
    args.flatMap((item, index) => (item === name && args[index + 1] ? [args[index + 1]!] : []));
  const required = (name: string) => {
    const value = option(name);
    if (!value || value.startsWith('--')) throw new Error(`${name} is required.`);
    return value;
  };
  const print = (value: unknown, message: string) =>
    console.log(args.includes('--json') ? JSON.stringify(value, null, 2) : message);
  try {
    if (args[0] === 'register') {
      const hook = (axis: string, value: string) =>
        option(`--${axis}-attribute`)
          ? {
              selector: option(`--${axis}-selector`) ?? 'html',
              attribute: required(`--${axis}-attribute`),
              value,
            }
          : undefined;
      const theme = option('--theme') ?? 'current';
      const state = option('--state') ?? 'current';
      const screen = await registerVisualScreen(projectRoot, {
        version: 1,
        name: required('--name'),
        url: required('--url'),
        viewport: {
          width: Number(option('--width') ?? 1440),
          height: Number(option('--height') ?? 900),
        },
        theme,
        state,
        themeHook: hook('theme', theme),
        stateHook: hook('state', state),
        masks: repeated('--mask'),
        targets: repeated('--target'),
      });
      print(
        screen,
        `Registered ${screen.name}. Run visual-check run, review the report, then approve a baseline explicitly.`,
      );
      return 0;
    }
    if (args[0] === 'run') {
      const report = await runVisualChecks(projectRoot, option('--name'));
      print(
        report,
        `${report.results.map((result) => `${result.name}: ${result.status}${result.reason ? ` — ${result.reason}` : ''}`).join('\n')}\nReport: ${join(rootFor(projectRoot), 'runs', report.id, 'report.html')}`,
      );
      return report.exitCode;
    }
    if (args[0] === 'approve') {
      const id = await approveVisualBaseline(projectRoot, required('--run'), required('--name'));
      print({ baselineId: id }, `Approved ${id}. Prior baseline evidence has been retained.`);
      return 0;
    }
    if (args[0] === 'list') {
      const config = await configuration(rootFor(projectRoot));
      print(
        config,
        config.screens
          .map(
            (screen) =>
              `${screen.name}: ${screen.viewport.width}×${screen.viewport.height} ${screen.theme}/${screen.state} — ${config.baselines[screen.name] ? 'baseline approved' : 'needs baseline'}`,
          )
          .join('\n') || 'No registered screens.',
      );
      return 0;
    }
    throw new Error('Use visual-check register, run, approve or list.');
  } catch (error) {
    print(
      { error: String((error as Error).message), exitCode: 2 },
      `Visual check: ${String((error as Error).message)}`,
    );
    return 2;
  }
}
