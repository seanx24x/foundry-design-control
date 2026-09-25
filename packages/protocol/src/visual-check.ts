import { z } from 'zod';

const identifier = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/i);
const hookSchema = z.object({
  selector: z.string().min(1),
  attribute: z.string().regex(/^(data-[a-z0-9_-]+|class)$/),
  value: z.string().min(1),
});

export const visualScreenSchema = z.object({
  version: z.literal(1),
  name: identifier,
  url: z.string().url(),
  viewport: z.object({
    width: z.number().int().min(320).max(3840),
    height: z.number().int().min(240).max(2160),
  }),
  theme: z.string().min(1).default('current'),
  state: z.string().min(1).default('current'),
  themeHook: hookSchema.optional(),
  stateHook: hookSchema.optional(),
  masks: z.array(z.string().min(1)).max(32).default([]),
  targets: z.array(z.string().min(1)).max(64).default([]),
  pixelThreshold: z.number().int().min(0).max(255).default(16),
  changedPixelRatio: z.number().min(0).max(1).default(0.001),
  geometryTolerance: z.number().min(0).max(10).default(0.5),
});

export const visualFindingSchema = z.object({
  kind: z.enum([
    'horizontal-overflow',
    'clipped-content',
    'small-target',
    'missing-name',
    'missing-alt',
  ]),
  selector: z.string(),
  message: z.string(),
});

export const visualCaptureSchema = z.object({
  version: z.literal(1),
  screen: visualScreenSchema,
  configurationHash: z.string(),
  createdAt: z.string().datetime(),
  sourceRevision: z.string().optional(),
  sourceDirty: z.boolean().optional(),
  browser: z.string(),
  platform: z.string(),
  deviceScaleFactor: z.literal(1),
  motion: z.literal('reduced; CSS animations and transitions disabled'),
  screenshot: z.string(),
  screenshotHash: z.string(),
  geometry: z.array(
    z.object({
      selector: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    }),
  ),
  findings: z.array(visualFindingSchema),
  evidence: z.array(z.string()),
});

export const visualCheckResultSchema = z.object({
  name: identifier,
  status: z.enum(['passed', 'different', 'failed', 'unsupported', 'unbaselined']),
  reason: z.string().optional(),
  capture: visualCaptureSchema.optional(),
  baselineId: z.string().optional(),
  baselineScreenshot: z.string().optional(),
  diffScreenshot: z.string().optional(),
  changedPixels: z.number().int().nonnegative().optional(),
  totalPixels: z.number().int().nonnegative().optional(),
  changedRatio: z.number().nonnegative().optional(),
  geometryChanges: z.array(z.object({ selector: z.string(), description: z.string() })).default([]),
  newFindings: z.array(visualFindingSchema).default([]),
});

export const visualCheckReportSchema = z.object({
  format: z.literal('foundry.visual-check'),
  version: z.literal(1),
  id: identifier,
  createdAt: z.string().datetime(),
  results: z.array(visualCheckResultSchema),
  exitCode: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
});

export type VisualScreen = z.infer<typeof visualScreenSchema>;
export type VisualCapture = z.infer<typeof visualCaptureSchema>;
export type VisualFinding = z.infer<typeof visualFindingSchema>;
export type VisualCheckResult = z.infer<typeof visualCheckResultSchema>;
export type VisualCheckReport = z.infer<typeof visualCheckReportSchema>;
