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
export const scopeSchema = z.enum(['instance', 'variant', 'component']);
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
  aliasOfTokenId: z.string().optional(),
  aliasOfTokenName: z.string().optional(),
  resolvedValue: z.string().optional(),
  aliasChain: z.array(z.string()).optional(),
  aliasStatus: z.enum(['direct', 'resolved', 'broken', 'circular']).optional(),
  source: sourceRefSchema.optional(),
  confidence: confidenceSchema.default('inferred'),
  evidence: z.array(z.string()).default([]),
});

export const tokenPromotionCandidateSchema = z.object({
  id: z.string().min(1),
  value: z.string().min(1),
  category: designTokenSchema.shape.category,
  property: z.string().min(1),
  occurrenceCount: z.number().int().positive(),
  sources: z.array(sourceRefSchema).min(1),
  componentIds: z.array(z.string()).default([]),
  recommendation: z.enum(['use-existing', 'create-token']),
  relation: z.enum(['exact', 'near', 'new']),
  suggestedTokenId: z.string().optional(),
  suggestedTokenName: z.string().min(1),
  suggestedValue: z.string().min(1),
  aliasChain: z.array(z.string()).default([]),
  canStage: z.boolean().default(true),
  blockers: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
});

export const componentVariantSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  property: z.string().min(1),
  value: changeValueSchema,
  props: z.record(z.string(), changeValueSchema).default({}),
  source: sourceRefSchema.optional(),
  adapter: z.enum(['storybook', 'cva', 'typescript', 'configured']).optional(),
  sourceProperty: z.string().optional(),
});

export const componentVariantAxisSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  property: z.string().min(1),
  values: z.array(changeValueSchema).default([]),
  adapter: z.enum(['storybook', 'cva', 'typescript', 'configured']),
  source: sourceRefSchema,
  sourceProperty: z.string().min(1),
  canCreate: z.boolean().default(false),
  evidence: z.array(z.string()).default([]),
});

export const componentDefinitionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  source: sourceRefSchema.optional(),
  selector: z.string().optional(),
  instances: z.number().int().nonnegative().default(0),
  variants: z.array(componentVariantSchema).default([]),
  variantAxes: z.array(componentVariantAxisSchema).default([]),
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

export const containerQueryDefinitionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  name: z.string().optional(),
  condition: z.string().min(1),
  axis: z.enum(['inline-size', 'block-size', 'size']).default('inline-size'),
  minWidth: z.number().nonnegative().optional(),
  maxWidth: z.number().nonnegative().optional(),
  source: sourceRefSchema,
  evidence: z.array(z.string()).default([]),
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
  adapter: z.enum(['css', 'motion', 'gsap', 'react-spring']).optional(),
  sourceProperty: z.string().optional(),
  configuration: z.record(z.string(), z.unknown()).default({}),
  source: sourceRefSchema.optional(),
  evidence: z.array(z.string()).default([]),
});

export const designTokenUsageSchema = z.object({
  id: z.string().min(1),
  tokenId: z.string().min(1),
  tokenName: z.string().min(1),
  value: z.string().min(1),
  category: designTokenSchema.shape.category,
  kind: z.enum(['reference', 'literal', 'alias']),
  property: z.string().optional(),
  componentId: z.string().optional(),
  source: sourceRefSchema,
  evidence: z.array(z.string()).default([]),
});

export const designSystemFindingSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['near-duplicate', 'literal-drift', 'unused-token', 'component-drift']),
  severity: z.enum(['info', 'warning']).default('info'),
  title: z.string().min(1),
  detail: z.string().min(1),
  category: designTokenSchema.shape.category.optional(),
  tokenIds: z.array(z.string()).default([]),
  usageIds: z.array(z.string()).default([]),
  componentIds: z.array(z.string()).default([]),
  suggestedTokenId: z.string().optional(),
  source: sourceRefSchema.optional(),
  evidence: z.array(z.string()).default([]),
});

export const projectDesignGraphSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  projectRoot: z.string().min(1),
  revision: z.string().optional(),
  tokens: z.array(designTokenSchema).default([]),
  components: z.array(componentDefinitionSchema).default([]),
  breakpoints: z.array(breakpointDefinitionSchema).default([]),
  containerQueries: z.array(containerQueryDefinitionSchema).optional(),
  themes: z.array(themeDefinitionSchema).default([]),
  states: z.array(stateDefinitionSchema).default([]),
  motionPresets: z.array(motionPresetSchema).default([]),
  tokenUsages: z.array(designTokenUsageSchema).default([]),
  designSystemFindings: z.array(designSystemFindingSchema).default([]),
  tokenPromotions: z.array(tokenPromotionCandidateSchema).optional(),
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
    'component-variant',
    'token-refactor',
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
  kind: z.enum([
    'resize',
    'spacing',
    'align',
    'distribute',
    'style',
    'content',
    'motion',
    'state',
    'component-variant',
    'token-refactor',
  ]),
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

export const designBranchSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  status: z.enum(['exploring', 'chosen', 'rejected', 'archived']).default('exploring'),
  originBranchId: z.string().optional(),
  changes: z.array(designChangeSchema).default([]),
  operations: z.array(designOperationSchema).default([]),
  rejectionReason: z.string().max(280).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const designBranchRecordSourceSchema = z.object({
  targetId: z.string().min(1),
  targetLabel: z.string().min(1),
  property: z.string().min(1),
  componentPath: z.array(z.string()).default([]),
  source: sourceRefSchema.optional(),
});

export const designBranchRecordSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  branchId: z.string().min(1),
  name: z.string().min(1).max(80),
  outcome: z.enum(['chosen', 'rejected']),
  rationale: z.string().max(280).optional(),
  context: sessionContextSchema,
  changes: z.array(designChangeSchema).default([]),
  operations: z.array(designOperationSchema).default([]),
  sourceRelationships: z.array(designBranchRecordSourceSchema).default([]),
  compatibility: z.object({
    status: z.enum(['current', 'stale', 'missing']),
    matchedSources: z.number().int().nonnegative(),
    totalSources: z.number().int().nonnegative(),
    warnings: z.array(z.string()).default([]),
    checkedAt: z.string().datetime(),
  }),
  importedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const designBranchRecordBundleSchema = z.object({
  format: z.literal('foundry.design-branch-records'),
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  records: z.array(designBranchRecordSchema).max(100),
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
  interruptedState: z.enum(['applying', 'rebuilding', 'verifying']).optional(),
  resumedAt: z.string().datetime().optional(),
  retryOf: z.string().optional(),
  error: z.string().optional(),
  requestedAt: z.string().datetime(),
  claimedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime(),
});

export const deliveryRecordStatusSchema = z.enum([
  'draft',
  'ready',
  'implementing',
  'verified',
  'superseded',
]);

export const deliveryNarrativeSourceSchema = z.enum(['deterministic', 'agent', 'authored']);

export const deliveryAcceptanceCriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(['pending', 'passed', 'failed']).default('pending'),
  evidence: z.array(z.string()).default([]),
});

export const deliveryRecordSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  sessionId: z.string().min(1),
  applyRunId: z.string().min(1),
  title: z.string().min(1).max(120),
  summary: z.string().max(2000).default(''),
  intent: z.string().max(4000).default(''),
  narrativeSource: deliveryNarrativeSourceSchema.default('deterministic'),
  status: deliveryRecordStatusSchema,
  changeIds: z.array(z.string().min(1)).min(1),
  operationIds: z.array(z.string().min(1)).default([]),
  affectedFiles: z.array(z.string().min(1)).default([]),
  affectedComponents: z.array(z.string().min(1)).default([]),
  affectedTokens: z.array(z.string().min(1)).default([]),
  contexts: z
    .array(
      z.object({
        breakpoint: z.string(),
        theme: z.string(),
        state: z.string(),
      }),
    )
    .default([]),
  risks: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  acceptanceCriteria: z.array(deliveryAcceptanceCriterionSchema).default([]),
  blockers: z.array(z.string()).default([]),
  validationResults: z.array(validationResultSchema).default([]),
  verificationResults: z.array(verificationResultSchema).default([]),
  evidence: z
    .array(
      z.object({
        label: z.string().min(1),
        path: z.string().min(1),
        createdAt: z.string().datetime(),
      }),
    )
    .default([]),
  revision: z.string().optional(),
  designGraphRevision: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  verifiedAt: z.string().datetime().optional(),
  supersededAt: z.string().datetime().optional(),
});

export const documentationPageSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  kind: z.enum(['component', 'system', 'feature', 'screen']),
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().default(''),
  body: z.string().default(''),
  narrativeSource: deliveryNarrativeSourceSchema.default('deterministic'),
  freshness: z.enum(['current', 'stale', 'conflicted']).default('current'),
  sourceFiles: z.array(z.string()).default([]),
  componentIds: z.array(z.string()).default([]),
  deliveryRecordIds: z.array(z.string()).default([]),
  revision: z.string().optional(),
  designGraphRevision: z.string().optional(),
  contentHash: z.string().min(1),
  exportedHash: z.string().optional(),
  exportedPath: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const designHistoryEntrySchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  deliveryRecordId: z.string().min(1),
  applyRunId: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().default(''),
  changeIds: z.array(z.string().min(1)).min(1),
  affectedFiles: z.array(z.string()).default([]),
  contexts: z.array(z.object({ breakpoint: z.string(), theme: z.string(), state: z.string() })),
  validationResults: z.array(validationResultSchema).default([]),
  verificationResults: z.array(verificationResultSchema).default([]),
  revision: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const deliveryMilestoneSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  summary: z.string().max(2000).default(''),
  entryIds: z.array(z.string().min(1)).default([]),
  status: z.enum(['draft', 'published']).default('draft'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().optional(),
});

export const visualAgentContextTargetSchema = z.object({
  id: z.string().min(1),
  selector: z.string().min(1),
  label: z.string().min(1),
  kind: z.string().min(1),
  component: z.string().nullable().optional(),
  source: z.string().optional(),
  confidence: confidenceSchema,
  geometry: geometrySchema,
  measurements: z.record(z.string(), changeValueSchema).default({}),
});

export const visualAgentCommentSchema = z.object({
  id: z.string().min(1),
  body: z.string().min(1).max(2000),
  targetId: z.string().optional(),
  regionId: z.string().optional(),
  createdAt: z.string().datetime(),
});

export const visualAgentContextSchema = z.object({
  targets: z.array(visualAgentContextTargetSchema).default([]),
  region: z
    .object({
      id: z.string().min(1),
      x: z.number().finite(),
      y: z.number().finite(),
      width: z.number().nonnegative().finite(),
      height: z.number().nonnegative().finite(),
      label: z.string().default('Canvas region'),
    })
    .optional(),
  comments: z.array(visualAgentCommentSchema).default([]),
  viewport: z.object({ width: z.number().positive(), height: z.number().positive() }),
  breakpoint: z.string().default('current'),
  theme: z.string().default('current'),
  state: z.string().default('current'),
  tokens: z.array(designTokenSchema).default([]),
  designGraphRevision: z.string().optional(),
});

export const visualAgentProposalSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  summary: z.string().min(1).max(2000),
  reasoning: z.array(z.string().min(1)).default([]),
  exactValues: z.array(z.string().min(1)).default([]),
  sourceLocations: z.array(z.string().min(1)).default([]),
  responsiveImpact: z.string().min(1).max(2000),
  verificationPlan: z.array(z.string().min(1)).default([]),
  changes: z.array(designChangeSchema).default([]),
  branchId: z.string().optional(),
  status: z.enum(['proposed', 'previewing', 'promoted', 'rejected']).default('proposed'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const visualAgentMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['user', 'agent', 'system']),
  body: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const visualAgentRequestSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  title: z.string().min(1).max(120),
  prompt: z.string().min(1).max(8000),
  status: z.enum(['queued', 'thinking', 'ready', 'needs_attention', 'closed']),
  context: visualAgentContextSchema,
  messages: z.array(visualAgentMessageSchema).default([]),
  proposals: z.array(visualAgentProposalSchema).default([]),
  agent: z
    .object({
      name: z.string().min(1),
      version: z.string().optional(),
      taskId: z.string().optional(),
    })
    .optional(),
  claimAttemptId: z.string().optional(),
  claimExpiresAt: z.string().datetime().optional(),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const stressConditionIdSchema = z.enum([
  'long-content',
  'empty-content',
  'large-numbers',
  'missing-images',
  'loading-state',
  'error-state',
  'offline-state',
  'text-200',
  'browser-zoom-200',
  'high-contrast',
  'monochrome',
  'reduced-motion',
  'keyboard-only',
]);

export const stressTestSessionSchema = z.object({
  conditions: z.array(stressConditionIdSchema).default([]),
  scope: z.enum(['selection', 'canvas']).default('selection'),
  targetId: z.string().optional(),
  viewport: z.object({ width: z.number().positive(), height: z.number().positive() }),
  temporary: z.literal(true),
  appliedAt: z.string().datetime(),
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
export type SourceRef = z.infer<typeof sourceRefSchema>;
export type SessionContext = z.infer<typeof sessionContextSchema>;
export type TargetRef = z.infer<typeof targetRefSchema>;
export type ControlDescriptor = z.infer<typeof controlDescriptorSchema>;
export type DesignChange = z.infer<typeof designChangeSchema>;
export type DesignChangeInput = z.input<typeof designChangeSchema>;
export type DesignToken = z.infer<typeof designTokenSchema>;
export type ComponentDefinition = z.infer<typeof componentDefinitionSchema>;
export type ComponentVariantAxis = z.infer<typeof componentVariantAxisSchema>;
export type ContainerQueryDefinition = z.infer<typeof containerQueryDefinitionSchema>;
export type StateDefinition = z.infer<typeof stateDefinitionSchema>;
export type BreakpointDefinition = z.infer<typeof breakpointDefinitionSchema>;
export type ThemeDefinition = z.infer<typeof themeDefinitionSchema>;
export type MotionPreset = z.infer<typeof motionPresetSchema>;
export type ProjectDesignGraph = z.infer<typeof projectDesignGraphSchema>;
export type DesignTokenUsage = z.infer<typeof designTokenUsageSchema>;
export type DesignSystemFinding = z.infer<typeof designSystemFindingSchema>;
export type TokenPromotionCandidate = z.infer<typeof tokenPromotionCandidateSchema>;
export type SourceMappingCandidate = z.infer<typeof sourceMappingCandidateSchema>;
export type DesignOperation = z.infer<typeof designOperationSchema>;
export type DesignOperationInput = z.input<typeof designOperationSchema>;
export type ChangeSet = z.infer<typeof changeSetSchema>;
export type DesignBranch = z.infer<typeof designBranchSchema>;
export type DesignBranchRecordSource = z.infer<typeof designBranchRecordSourceSchema>;
export type DesignBranchRecord = z.infer<typeof designBranchRecordSchema>;
export type DesignBranchRecordBundle = z.infer<typeof designBranchRecordBundleSchema>;
export type VerificationResult = z.infer<typeof verificationResultSchema>;
export type ApplyRunState = z.infer<typeof applyRunStateSchema>;
export type ApplyRunMessage = z.infer<typeof applyRunMessageSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type ApplyRun = z.infer<typeof applyRunSchema>;
export type DeliveryRecordStatus = z.infer<typeof deliveryRecordStatusSchema>;
export type DeliveryNarrativeSource = z.infer<typeof deliveryNarrativeSourceSchema>;
export type DeliveryAcceptanceCriterion = z.infer<typeof deliveryAcceptanceCriterionSchema>;
export type DeliveryRecord = z.infer<typeof deliveryRecordSchema>;
export type DocumentationPage = z.infer<typeof documentationPageSchema>;
export type DesignHistoryEntry = z.infer<typeof designHistoryEntrySchema>;
export type DeliveryMilestone = z.infer<typeof deliveryMilestoneSchema>;
export type VisualAgentContextTarget = z.infer<typeof visualAgentContextTargetSchema>;
export type VisualAgentComment = z.infer<typeof visualAgentCommentSchema>;
export type VisualAgentContext = z.infer<typeof visualAgentContextSchema>;
export type VisualAgentProposal = z.infer<typeof visualAgentProposalSchema>;
export type VisualAgentMessage = z.infer<typeof visualAgentMessageSchema>;
export type VisualAgentRequest = z.infer<typeof visualAgentRequestSchema>;
export type StressConditionId = z.infer<typeof stressConditionIdSchema>;
export type StressTestSession = z.infer<typeof stressTestSessionSchema>;
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
