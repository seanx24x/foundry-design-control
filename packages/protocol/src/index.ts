import { z } from 'zod';

export const PROTOCOL_VERSION = '1.2.0' as const;
export const LEGACY_PROTOCOL_VERSION = '1.0.0' as const;
export const APPLY_RUN_PROTOCOL_VERSION = '1.1.0' as const;

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
  designGraphRevision: z.string().optional(),
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

export const designTokenSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  value: z.string().min(1),
  category: z.enum([
    'color',
    'spacing',
    'size',
    'radius',
    'typography',
    'shadow',
    'motion',
    'other',
  ]),
  cssVariable: z.string().optional(),
  source: sourceRefSchema.optional(),
  confidence: confidenceSchema.default('inferred'),
  evidence: z.array(z.string()).default([]),
});

export const componentVariantSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  property: z.string().min(1),
  value: changeValueSchema,
  source: sourceRefSchema.optional(),
});

export const componentDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: sourceRefSchema.optional(),
  selector: z.string().optional(),
  instances: z.number().int().nonnegative().default(0),
  variants: z.array(componentVariantSchema).default([]),
  evidence: z.array(z.string()).default([]),
});

export const stateDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  viewport: z.object({ width: z.number().positive(), height: z.number().positive() }).optional(),
  theme: z.string().optional(),
  variant: z.record(z.string(), changeValueSchema).optional(),
  pseudoStates: z.array(z.enum(['hover', 'focus', 'active', 'disabled'])).default([]),
  reducedMotion: z.boolean().optional(),
  query: z.record(z.string(), z.string()).default({}),
  confidence: confidenceSchema.default('instrumented'),
  evidence: z.array(z.string()).default([]),
});

export const breakpointDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive().default(900),
  mediaQuery: z.string().optional(),
  source: sourceRefSchema.optional(),
});

export const themeDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  selector: z.string().optional(),
  attribute: z.string().optional(),
  value: z.string().optional(),
  source: sourceRefSchema.optional(),
});

export const motionPresetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  duration: z.number().nonnegative().optional(),
  easing: z.string().optional(),
  delay: z.number().nonnegative().optional(),
  source: sourceRefSchema.optional(),
});

export const projectDesignGraphSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  projectRoot: z.string().min(1),
  revision: z.string().optional(),
  tokens: z.array(designTokenSchema).default([]),
  components: z.array(componentDefinitionSchema).default([]),
  breakpoints: z.array(breakpointDefinitionSchema).default([]),
  themes: z.array(themeDefinitionSchema).default([]),
  states: z.array(stateDefinitionSchema).default([]),
  motionPresets: z.array(motionPresetSchema).default([]),
  indexedAt: z.string().datetime(),
});

export const sourceMappingCandidateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  intent: z.enum([
    'resize',
    'spacing',
    'align',
    'distribute',
    'position',
    'style',
    'content',
    'motion',
    'state',
  ]),
  property: z.string().min(1),
  targetId: z.string().optional(),
  value: changeValueSchema,
  source: sourceRefSchema.optional(),
  scope: scopeSchema.default('instance'),
  confidence: confidenceSchema,
  evidence: z.array(z.string()).default([]),
  blastRadius: z.number().int().nonnegative().default(1),
});

export const designOperationSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['resize', 'spacing', 'align', 'distribute', 'style', 'content', 'motion', 'state']),
  label: z.string().min(1),
  targetIds: z.array(z.string().min(1)).min(1),
  changeIds: z.array(z.string().min(1)).default([]),
  stateIds: z.array(z.string().min(1)).default([]),
  mappingCandidates: z.array(sourceMappingCandidateSchema).default([]),
  selectedMappingId: z.string().optional(),
  status: z.enum(['preview', 'resolved', 'unresolved']).default('preview'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const designChangeSchema = z.object({
  id: z.string().min(1),
  target: targetRefSchema,
  category: changeCategorySchema,
  property: z.string().min(1),
  before: changeValueSchema,
  after: changeValueSchema,
  unit: z.string().optional(),
  token: z.string().optional(),
  operationId: z.string().optional(),
  stateIds: z.array(z.string()).default([]),
  mappingCandidates: z.array(sourceMappingCandidateSchema).default([]),
  selectedMappingId: z.string().optional(),
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
  operations: z.array(designOperationSchema).default([]),
  designGraphRevision: z.string().optional(),
  screenshots: z
    .array(
      z.object({
        label: z.string(),
        path: z.string(),
        createdAt: z.string().datetime(),
      }),
    )
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

export const applyRunStateSchema = z.enum([
  'reviewing',
  'queued',
  'claimed',
  'applying',
  'rebuilding',
  'verifying',
  'passed',
  'needs_attention',
  'cancelled',
  'failed',
]);

export const applyRunMessageSchema = z.object({
  state: applyRunStateSchema,
  message: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const validationResultSchema = z.object({
  name: z.string().min(1),
  passed: z.boolean(),
  summary: z.string().optional(),
});

export const applyRunSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  changeIds: z.array(z.string().min(1)).min(1),
  revision: z.string().optional(),
  designGraphRevision: z.string().optional(),
  state: applyRunStateSchema,
  agent: z
    .object({
      name: z.string().min(1),
      version: z.string().optional(),
      taskId: z.string().optional(),
    })
    .optional(),
  messages: z.array(applyRunMessageSchema).default([]),
  changedFiles: z.array(z.string()).default([]),
  validationResults: z.array(validationResultSchema).default([]),
  verificationResults: z.array(verificationResultSchema).default([]),
  attempts: z.number().int().positive().default(1),
  claimAttemptId: z.string().min(1).optional(),
  claimExpiresAt: z.string().datetime().optional(),
  claimHeartbeatAt: z.string().datetime().optional(),
  requeueCount: z.number().int().nonnegative().default(0),
  retryOf: z.string().optional(),
  error: z.string().optional(),
  requestedAt: z.string().datetime(),
  claimedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
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
  operationId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type Platform = z.infer<typeof platformSchema>;
export type ChangeCategory = z.infer<typeof changeCategorySchema>;
export type SessionContext = z.infer<typeof sessionContextSchema>;
export type TargetRef = z.infer<typeof targetRefSchema>;
export type ControlDescriptor = z.infer<typeof controlDescriptorSchema>;
export type DesignChange = z.infer<typeof designChangeSchema>;
export type DesignChangeInput = z.input<typeof designChangeSchema>;
export type DesignToken = z.infer<typeof designTokenSchema>;
export type ComponentDefinition = z.infer<typeof componentDefinitionSchema>;
export type StateDefinition = z.infer<typeof stateDefinitionSchema>;
export type BreakpointDefinition = z.infer<typeof breakpointDefinitionSchema>;
export type ThemeDefinition = z.infer<typeof themeDefinitionSchema>;
export type MotionPreset = z.infer<typeof motionPresetSchema>;
export type ProjectDesignGraph = z.infer<typeof projectDesignGraphSchema>;
export type SourceMappingCandidate = z.infer<typeof sourceMappingCandidateSchema>;
export type DesignOperation = z.infer<typeof designOperationSchema>;
export type DesignOperationInput = z.input<typeof designOperationSchema>;
export type ChangeSet = z.infer<typeof changeSetSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type ApplyRunState = z.infer<typeof applyRunStateSchema>;
export type ApplyRunMessage = z.infer<typeof applyRunMessageSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type ApplyRun = z.infer<typeof applyRunSchema>;
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
    [...change.stateIds].sort().join(','),
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
  const approved = parsed.changes.filter((change) =>
    ['approved', 'applied'].includes(change.status),
  );
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
    if (change.stateIds.length) lines.push(`   - State set: ${change.stateIds.join(', ')}`);
    const mapping = change.mappingCandidates.find(
      (candidate) => candidate.id === change.selectedMappingId,
    );
    if (mapping) {
      lines.push(
        `   - Source intent: ${mapping.label}; property=${mapping.property}; confidence=${mapping.confidence}; blast-radius=${mapping.blastRadius}`,
      );
    }
  }
  lines.push(
    '',
    'Return the source diff, validation results, and any change that could not be mapped exactly.',
  );
  return lines.join('\n');
}
