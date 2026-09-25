import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import { chromium } from 'playwright';
import sharp from 'sharp';
import {
  visualScreenSchema,
  type ChangeContext,
  type DesignChange,
  type ProjectDesignGraphInput,
  type VisualScreen,
} from 'foundry-design-protocol';
import type {
  DeliveryCaptureRequest,
  DeliveryCaptureResult,
  DeliveryEvidenceRequest,
} from 'foundry-design-runtime';
import {
  captureVisualScreen,
  UnsupportedVisualContextError,
  validateVisualUrl,
} from './visual-check-capture.js';

/** Reads one runtime-indexed capture, never a client-supplied file or arbitrary screenshot. */
export async function readDeliveryEvidence({
  projectRoot,
  evidence,
}: DeliveryEvidenceRequest): Promise<Uint8Array> {
  const capture = evidence.capture;
  if (
    !capture?.sha256 ||
    !capture.conditions ||
    !['before', 'rebuilt'].includes(capture.phase) ||
    !/^\.foundry\/sessions\/delivery-evidence\/(before|rebuilt)-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.png$/.test(
      evidence.path,
    ) ||
    !evidence.path.split('/').at(-1)?.startsWith(`${capture.phase}-`)
  )
    throw new Error('Evidence is not a trusted source capture.');
  const root = await realpath(projectRoot);
  let file = root;
  const parts = evidence.path.split('/');
  for (const [index, part] of parts.entries()) {
    file = join(file, part);
    const stat = await lstat(file);
    if (stat.isSymbolicLink() || (index < parts.length - 1 ? !stat.isDirectory() : !stat.isFile()))
      throw new Error('Evidence paths must remain inside the project capture directory.');
  }
  if ((await realpath(file)) !== file) throw new Error('Evidence path changed during validation.');
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size > 20 * 1024 * 1024)
      throw new Error('Evidence image exceeds the safe size limit.');
    const png = await handle.readFile();
    if (createHash('sha256').update(png).digest('hex') !== capture.sha256)
      throw new Error('Evidence image does not match its recorded digest.');
    const metadata = await sharp(png, { limitInputPixels: 40_000_000 }).metadata();
    const scale = capture.conditions.deviceScaleFactor;
    if (
      metadata.format !== 'png' ||
      metadata.width !== capture.viewport.width * scale ||
      metadata.height !== capture.viewport.height * scale
    )
      throw new Error('Evidence image does not match its recorded viewport.');
    return png;
  } finally {
    await handle.close();
  }
}

function themeHook(id: string, graph: ProjectDesignGraphInput | null): VisualScreen['themeHook'] {
  if (id === 'current' || id === 'system') return undefined;
  const theme = graph?.themes?.find((candidate) => candidate.id === id);
  if (!theme?.selector)
    throw new UnsupportedVisualContextError(`Theme ${id} has no indexed root selector.`);
  const attribute = /^(html|body|:root)?\[([a-z-]+)=["']?([^"'\]]+)["']?\]$/.exec(theme.selector);
  if (attribute && (!theme.attribute || theme.attribute === attribute[2]))
    return {
      selector: attribute[1] || 'html',
      attribute: attribute[2]!,
      value: theme.value ?? attribute[3]!,
    };
  const className = /^(html|body|:root)?\.([a-zA-Z_-][\w-]*)$/.exec(theme.selector);
  if (className)
    return { selector: className[1] || 'html', attribute: 'class', value: className[2]! };
  throw new UnsupportedVisualContextError(
    `Theme ${id} does not expose a supported root attribute or class hook.`,
  );
}

export function deliveryCaptureScreen(
  input: DeliveryCaptureRequest,
  change: DesignChange,
  context: ChangeContext,
): VisualScreen {
  if (!input.changeSet.context.targetUrl)
    throw new UnsupportedVisualContextError('No product preview URL is configured.');
  const url = validateVisualUrl(input.changeSet.context.targetUrl);
  const selector =
    typeof change.target.locator.selector === 'string'
      ? change.target.locator.selector
      : typeof change.target.locator.foundryId === 'string'
        ? `[data-foundry-id=${JSON.stringify(change.target.locator.foundryId)}]`
        : undefined;
  if (!selector)
    throw new UnsupportedVisualContextError('Reviewed target has no browser selector.');
  const breakpoint = input.designGraph?.breakpoints?.find(
    (candidate) => candidate.id === context.breakpoint,
  );
  const viewport =
    context.breakpoint === 'current'
      ? input.changeSet.context.viewport
      : breakpoint && {
          width: breakpoint.width,
          height: breakpoint.height ?? input.changeSet.context.viewport?.height,
        };
  if (!viewport?.width || !viewport.height)
    throw new UnsupportedVisualContextError(
      `Breakpoint ${context.breakpoint} has no recorded dimensions.`,
    );
  let selectedTheme = context.theme;
  let state = 'current';
  let stateHook: VisualScreen['stateHook'];
  if (context.state !== 'current') {
    const authored = input.designGraph?.states?.find((candidate) => candidate.id === context.state);
    if (!authored)
      throw new UnsupportedVisualContextError(`State ${context.state} is not indexed.`);
    if (authored.pseudoStates?.length)
      throw new UnsupportedVisualContextError(
        `State ${context.state} needs pseudo-state replay; no visual capture was fabricated.`,
      );
    if (authored.reducedMotion === false)
      throw new UnsupportedVisualContextError(
        `State ${context.state} requires motion; the still-image capture uses reduced motion.`,
      );
    if (
      authored.viewport &&
      (authored.viewport.width !== viewport.width || authored.viewport.height !== viewport.height)
    )
      throw new UnsupportedVisualContextError(
        `State ${context.state} has different authored dimensions.`,
      );
    if (authored.theme) {
      if (!['current', 'system', authored.theme].includes(selectedTheme))
        throw new UnsupportedVisualContextError('Authored state and requested theme conflict.');
      selectedTheme = authored.theme;
    }
    for (const [key, value] of Object.entries(authored.query ?? {}))
      url.searchParams.set(key, value);
    const variants = Object.entries(authored.variant ?? {});
    if (variants.length > 1)
      throw new UnsupportedVisualContextError(
        `State ${context.state} has multiple variant axes; no partial capture was retained.`,
      );
    if (variants[0]) {
      const [property, value] = variants[0];
      state = context.state;
      stateHook = {
        selector,
        attribute: `data-${property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`,
        value: String(value),
      };
    }
  }
  validateVisualUrl(url.toString());
  return visualScreenSchema.parse({
    version: 1,
    name: 'delivery-capture',
    url: url.toString(),
    viewport,
    theme: ['current', 'system'].includes(selectedTheme) ? 'current' : selectedTheme,
    state,
    themeHook: themeHook(selectedTheme, input.designGraph),
    stateHook,
    targets: [selector],
    masks: [],
  });
}

async function ignoredCaptureDirectory(projectRoot: string): Promise<string> {
  const root = await realpath(projectRoot);
  const local = '.foundry/sessions/delivery-evidence';
  const { stdout } = await promisify(execFile)(
    'git',
    ['check-ignore', '--', `${local}/capture.png`],
    { cwd: root, timeout: 2500 },
  );
  if (!stdout.trim())
    throw new Error(
      'Delivery evidence needs the ignored .foundry/sessions folder created by setup.',
    );
  let directory = root;
  for (const part of local.split('/')) {
    directory = join(directory, part);
    const stat = await lstat(directory).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return undefined;
      throw error;
    });
    if (stat?.isSymbolicLink() || (stat && !stat.isDirectory()))
      throw new Error('Delivery evidence directory must be a local project directory.');
    if (!stat) await mkdir(directory);
  }
  return directory;
}

/** A reviewed Apply is the only caller. Fresh contexts never install the overlay or replay drafts. */
export async function captureDeliveryEvidence(
  input: DeliveryCaptureRequest,
): Promise<DeliveryCaptureResult> {
  const result: DeliveryCaptureResult = { screenshots: [], unavailable: [] };
  if (input.signal.aborted)
    return { screenshots: [], unavailable: ['Visual capture was cancelled.'] };
  const root = await realpath(input.changeSet.context.projectRoot);
  const directory = await ignoredCaptureDirectory(root);
  const browser = await chromium.launch({ headless: true, timeout: 8000 });
  const abort = () => {
    void browser.close().catch(() => {});
  };
  input.signal.addEventListener('abort', abort, { once: true });
  try {
    const seen = new Set<string>();
    for (const change of input.changeSet.changes) {
      for (const breakpoint of change.contextSet.breakpoints)
        for (const theme of change.contextSet.themes)
          for (const state of change.contextSet.states) {
            const context = { breakpoint, theme, state };
            const key = JSON.stringify([change.target.id, context]);
            if (seen.has(key)) continue;
            seen.add(key);
            const label = `${change.target.label}: ${breakpoint} / ${theme} / ${state}`;
            if (input.signal.aborted) {
              result.unavailable.push(`${label}: capture time limit reached.`);
              continue;
            }
            try {
              const screen = deliveryCaptureScreen(input, change, context);
              const path = join(directory, `${input.phase}-${randomUUID()}.png`);
              const captured = await captureVisualScreen(browser, screen, root, path);
              const geometry = captured.geometry[0];
              if (
                captured.geometry.length !== 1 ||
                !geometry ||
                geometry.width <= 0 ||
                geometry.height <= 0 ||
                geometry.x >= screen.viewport.width ||
                geometry.y >= screen.viewport.height ||
                geometry.x + geometry.width <= 0 ||
                geometry.y + geometry.height <= 0
              )
                throw new UnsupportedVisualContextError(
                  'Reviewed target does not resolve to one visible rendered element.',
                );
              result.screenshots.push({
                label: `${input.phase === 'before' ? 'Source before Apply' : 'Verified rebuilt source'} · ${label}`,
                path: relative(root, path).split(sep).join('/'),
                createdAt: captured.createdAt,
                capture: {
                  version: 1,
                  phase: input.phase,
                  context,
                  viewport: screen.viewport,
                  sourceRevision: input.revision,
                  applyRunId: input.applyRunId,
                  targetId: change.target.id,
                  sha256: captured.screenshotHash,
                  conditions: {
                    motion: captured.motion,
                    browser: captured.browser,
                    platform: captured.platform,
                    deviceScaleFactor: captured.deviceScaleFactor,
                  },
                },
              });
            } catch (error) {
              result.unavailable.push(
                `${input.phase} ${label}: ${error instanceof Error ? error.message : 'capture unavailable'}`,
              );
            }
          }
    }
    return result;
  } finally {
    input.signal.removeEventListener('abort', abort);
    await browser.close().catch(() => {});
  }
}
