import { z } from 'zod';

export const readinessRecoverySchema = z.object({
  id: z.enum(['retry-preview', 'reindex', 'resume', 'repair', 'restart-agent', 'start', 'review']),
  label: z.string().min(1),
  command: z.string().optional(),
  requiresAgentRestart: z.boolean().optional(),
});

export const readinessCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  status: z.enum(['passed', 'warning', 'failed']),
  detail: z.string(),
  recovery: readinessRecoverySchema.optional(),
});

export const readinessReportSchema = z.object({
  version: z.literal(1),
  checkedAt: z.string().datetime(),
  projectRoot: z.string(),
  sessionId: z.string().optional(),
  ready: z.boolean(),
  status: z.enum(['ready', 'attention', 'blocked']),
  checks: z.array(readinessCheckSchema),
  capabilities: z.object({ inspect: z.boolean(), stage: z.boolean(), apply: z.boolean() }),
  nextAction: readinessRecoverySchema.optional(),
});

/** Server receipt time determines freshness; client clocks never extend this lease. */
export const previewPresenceInputSchema = z
  .object({
    version: z.literal(1),
    previewCapability: z.string().min(1),
    frameId: z.string().min(1).max(128),
    frameKind: z.enum(['canvas', 'workbench', 'responsive', 'verification']),
    protocolVersion: z.string().min(1),
    adapterVersion: z.string().min(1),
    targetCount: z.number().int().nonnegative().max(100_000),
    mappedTargetCount: z.number().int().nonnegative().max(100_000),
    connected: z.boolean().default(true),
  })
  .refine((input) => input.mappedTargetCount <= input.targetCount, 'Mapped count exceeds targets');

export type ReadinessCheck = z.infer<typeof readinessCheckSchema>;
export type ReadinessRecovery = z.infer<typeof readinessRecoverySchema>;
export type ReadinessReport = z.infer<typeof readinessReportSchema>;
export type PreviewPresenceInput = z.infer<typeof previewPresenceInputSchema>;

/** Used by the inspector endpoint and CLI so they cannot disagree about readiness. */
export function createReadinessReport(input: {
  projectRoot: string;
  sessionId?: string;
  checkedAt?: string;
  checks: ReadinessCheck[];
}): ReadinessReport {
  const passed = (id: string) => input.checks.find((check) => check.id === id)?.status === 'passed';
  const inspect = passed('runtime') && passed('preview-connection');
  const stage =
    inspect && passed('source-mapping') && passed('session-current') && passed('preview-version');
  const apply = stage && passed('agent-listening') && passed('bridge-version') && passed('config');
  const blockers = input.checks.filter((check) => check.status !== 'passed');
  return {
    version: 1,
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    projectRoot: input.projectRoot,
    sessionId: input.sessionId,
    ready: apply,
    status: apply
      ? 'ready'
      : blockers.some((check) => check.status === 'failed')
        ? 'blocked'
        : 'attention',
    checks: input.checks,
    capabilities: { inspect, stage, apply },
    nextAction: blockers.find((check) => check.recovery)?.recovery,
  };
}
