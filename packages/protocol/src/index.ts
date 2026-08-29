import { z } from 'zod';

export const PROTOCOL_VERSION = '1.0.0' as const;

export const platformSchema = z.enum(['web', 'swiftui', 'react-native']);
export const changeCategorySchema = z.enum([
  'layout',
  'spacing',
  'typography',
  'color',
  'border',
  'effect',
  'content',
  'asset',
  'visibility',
  'accessibility',
  'responsive',
  'state',
  'motion',
]);
export const scopeSchema = z.enum(['instance', 'component']);
export const confidenceSchema = z.enum(['measured', 'instrumented', 'inferred', 'unresolved']);

export const geometrySchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().nonnegative().finite(),
  height: z.number().nonnegative().finite(),
  scale: z.number().positive().finite().default(1),
});

export const sourceRefSchema = z.object({
  file: z.string().min(1),
  line: z.number().int().positive().optional(),
  column: z.number().int().nonnegative().optional(),
  symbol: z.string().optional(),
});

export const sessionContextSchema = z.object({
  projectRoot: z.string().min(1),
  revision: z.string().optional(),
  platform: platformSchema,
  targetUrl: z.string().url().optional(),
  targetName: z.string().optional(),
  device: z.string().optional(),
  viewport: z.object({ width: z.number().positive(), height: z.number().positive() }).optional(),
  theme: z.enum(['light', 'dark', 'system', 'custom']).default('system'),
  breakpoint: z.string().default('current'),
  state: z.string().default('current'),
});

export const targetRefSchema = z.object({
  id: z.string().min(1),
  platform: platformSchema,
  semanticRole: z.string().default('element'),
  label: z.string().default('Untitled element'),
  componentPath: z.array(z.string()).default([]),
  source: sourceRefSchema.optional(),
  geometry: geometrySchema,
  locator: z.record(z.string(), z.unknown()).default({}),
  confidence: confidenceSchema,
  evidence: z.array(z.string()).default([]),
});

export const controlDescriptorSchema = z.object({
  id: z.string().min(1),
  category: changeCategorySchema,
  property: z.string().min(1),
  label: z.string().min(1),
  valueType: z.enum([
    'number',
    'string',
    'boolean',
    'color',
    'length',
    'select',
    'asset',
    'motion',
  ]),
  value: z.unknown(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  unit: z.string().optional(),
  options: z.array(z.object({ label: z.string(), value: z.unknown() })).optional(),
  tokens: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  previewable: z.boolean().default(true),
  supported: z.boolean().default(true),
  unsupportedReason: z.string().optional(),
});

const changeValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
]);

export const designChangeSchema = z.object({
  id: z.string().min(1),
  target: targetRefSchema,
  category: changeCategorySchema,
  property: z.string().min(1),
  before: changeValueSchema,
  after: changeValueSchema,
  unit: z.string().optional(),
  token: z.string().optional(),
  scope: scopeSchema.default('instance'),
  context: z.object({
    breakpoint: z.string().default('current'),
    theme: z.string().default('current'),
    state: z.string().default('current'),
  }),
  confidence: confidenceSchema,
  evidence: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  status: z.enum(['draft', 'approved', 'applied', 'rejected', 'unresolved']).default('draft'),
});

export const changeSetSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  sessionId: z.string().min(1),
  context: sessionContextSchema,
  changes: z.array(designChangeSchema),
  screenshots: z
    .array(z.object({ label: z.string(), path: z.string(), createdAt: z.string().datetime() }))
    .default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const verificationResultSchema = z.object({
  changeId: z.string().min(1),
  property: z.string().min(1),
  requested: changeValueSchema,
  rendered: changeValueSchema,
  passed: z.boolean(),
  reason: z.string().optional(),
  geometry: geometrySchema.optional(),
  screenshotPath: z.string().optional(),
  verifiedAt: z.string().datetime(),
});

export const surfaceSnapshotSchema = z.object({
  platform: z.enum(['swiftui', 'react-native']),
  width: z.number().positive(),
  height: z.number().positive(),
  frameDataUrl: z.string().startsWith('data:image/').optional(),
  targets: z.array(targetRefSchema),
  controlsByTarget: z.record(z.string(), z.array(controlDescriptorSchema)).default({}),
  updatedAt: z.string().datetime(),
});

export const previewCommandSchema = z.object({
  id: z.string().min(1),
  targetId: z.string().min(1),
  property: z.string().min(1),
  value: z.unknown(),
  createdAt: z.string().datetime(),
});

export type Platform = z.infer<typeof platformSchema>;
export type ChangeCategory = z.infer<typeof changeCategorySchema>;
export type SessionContext = z.infer<typeof sessionContextSchema>;
export type TargetRef = z.infer<typeof targetRefSchema>;
export type ControlDescriptor = z.infer<typeof controlDescriptorSchema>;
export type DesignChange = z.infer<typeof designChangeSchema>;
export type ChangeSet = z.infer<typeof changeSetSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type SurfaceSnapshot = z.infer<typeof surfaceSnapshotSchema>;
export type PreviewCommand = z.infer<typeof previewCommandSchema>;

export function changeKey(change: DesignChange): string {
  const context = change.context;
  return [
    change.target.id,
    change.property,
    change.scope,
    context.breakpoint,
    context.theme,
    context.state,
  ].join('::');
}

export function coalesceChanges(changes: DesignChange[]): DesignChange[] {
  const order: string[] = [];
  const byKey = new Map<string, DesignChange>();
  for (const change of changes) {
    const parsed = designChangeSchema.parse(change);
    const key = changeKey(parsed);
    const existing = byKey.get(key);
    if (!existing) {
      order.push(key);
      byKey.set(key, parsed);
      continue;
    }
    byKey.set(key, {
      ...parsed,
      id: existing.id,
      before: existing.before,
      createdAt: existing.createdAt,
    });
  }
  return order.map((key) => byKey.get(key)!);
}

function renderValue(value: unknown, unit?: string): string {
  const rendered = typeof value === 'string' ? value : JSON.stringify(value);
  return `${rendered}${unit ?? ''}`;
}

export function renderChangePrompt(changeSet: ChangeSet): string {
  const parsed = changeSetSchema.parse(changeSet);
  const approved = parsed.changes.filter((change) => change.status !== 'rejected');
  const lines = [
    '# Foundry design change set',
    '',
    `Session: ${parsed.sessionId}`,
    `Platform: ${parsed.context.platform}`,
    `Project: ${parsed.context.projectRoot}`,
    `Revision: ${parsed.context.revision ?? 'unrecorded'}`,
    '',
    'Apply the following reviewed design changes in source code. Preserve existing project conventions and tokens. Do not approximate unresolved targets. After editing, rebuild the affected surface and verify every requested rendered value.',
    '',
  ];
  if (approved.length === 0) {
    lines.push('No reviewed changes are present.');
    return lines.join('\n');
  }
  for (const [index, change] of approved.entries()) {
    lines.push(
      `${index + 1}. ${change.target.label} — ${change.property}`,
      `   - Change: ${renderValue(change.before, change.unit)} → ${renderValue(change.after, change.unit)}`,
      `   - Scope: ${change.scope}; breakpoint=${change.context.breakpoint}; theme=${change.context.theme}; state=${change.context.state}`,
      `   - Target: ${change.target.source ? `${change.target.source.file}${change.target.source.line ? `:${change.target.source.line}` : ''}` : JSON.stringify(change.target.locator)}`,
      `   - Evidence: ${change.confidence}; ${[...new Set([...change.target.evidence, ...change.evidence])].join('; ') || 'none recorded'}`,
    );
    if (change.token) lines.push(`   - Token: ${change.token}`);
  }
  lines.push(
    '',
    'Return the source diff, validation results, and any change that could not be mapped exactly.',
  );
  return lines.join('\n');
}
