#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { ClaimLeaseKeeper } from './claim-lease.js';
import { FoundryRuntimeClient } from './client.js';
import packageJson from '../package.json' with { type: 'json' };

const verificationContextSchema = z.object({
  breakpoint: z.string().default('current'),
  theme: z.string().default('current'),
  state: z.string().default('current'),
});

const verificationGeometrySchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
  scale: z.number().positive(),
});

function result(value: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof value === 'string' ? value : JSON.stringify(value, null, 2),
      },
    ],
    ...(typeof value === 'object' && value !== null
      ? { structuredContent: value as Record<string, unknown> }
      : {}),
  };
}

serveStdio(() => {
  const server = new McpServer({
    name: 'foundry-design-control',
    version: packageJson.version,
  });
  const client = new FoundryRuntimeClient();
  const claimLeases = new ClaimLeaseKeeper(client);
  const listenerTaskId = `listener_${randomUUID().replaceAll('-', '')}`;

  server.registerTool(
    'foundry_design_start_session',
    {
      description:
        'Create a local Foundry design-inspection session. The localhost runtime must already be running.',
      inputSchema: z.object({
        projectRoot: z.string().min(1),
        platform: z.enum(['web', 'swiftui', 'react-native']),
        targetUrl: z.string().url().optional(),
        targetName: z.string().optional(),
        revision: z.string().optional(),
        designGraphRevision: z.string().optional(),
      }),
    },
    async (input) =>
      result(
        await client.request('/v1/sessions', {
          method: 'POST',
          body: JSON.stringify({
            context: {
              ...input,
              theme: 'system',
              breakpoint: 'current',
              state: 'current',
            },
          }),
        }),
      ),
  );

  server.registerTool(
    'foundry_design_get_change_set',
    {
      description:
        'Read the canonical change set and verification results for a Foundry session before editing code.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
      }),
    },
    async ({ sessionId, token }) =>
      result(await client.request(`/v1/sessions/${client.sessionId(sessionId)}`, {}, token)),
  );

  server.registerTool(
    'foundry_design_get_project_design',
    {
      description:
        'Read the revisioned local project design graph, including tokens, components, variants, viewports, themes, states, and motion presets.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
      }),
    },
    async ({ sessionId, token }) =>
      result(
        await client.request(`/v1/sessions/${client.sessionId(sessionId)}/design-graph`, {}, token),
      ),
  );

  server.registerTool(
    'foundry_design_wait_for_work',
    {
      description:
        'Keep one Foundry session listener active and atomically claim the next reviewed Apply run or grounded Visual Agent conversation request.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
        agent: z.object({
          name: z.string().min(1),
          version: z.string().optional(),
          taskId: z.string().optional(),
        }),
        revision: z.string().nullable().optional(),
        designGraphRevision: z.string().nullable().optional(),
        waitMs: z.number().int().min(0).max(60_000).default(30_000),
      }),
    },
    async ({ sessionId, token, agent, revision, designGraphRevision, waitMs }) => {
      const id = client.sessionId(sessionId);
      const resolvedAgent = { ...agent, taskId: agent.taskId ?? listenerTaskId };
      const deadline = Date.now() + waitMs;
      let nextPresenceAt = 0;
      do {
        if (Date.now() >= nextPresenceAt) {
          await client.request(
            `/v1/sessions/${id}/agent-presence`,
            {
              method: 'POST',
              body: JSON.stringify({
                agent: resolvedAgent,
                listening: true,
                bridgeVersion: packageJson.version,
                ttlMs: Math.min(Math.max(waitMs + 10_000, 15_000), 70_000),
              }),
            },
            token,
          );
          nextPresenceAt = Date.now() + 5_000;
        }
        const visual = (await client.request(
          `/v1/sessions/${id}/visual-agent-requests?status=queued`,
          {},
          token,
        )) as { requests?: Array<{ id: string }> };
        const visualRequest = visual.requests?.[0];
        if (visualRequest) {
          const claimed = (await client.request(
            `/v1/sessions/${id}/visual-agent-requests/${visualRequest.id}/claim`,
            {
              method: 'POST',
              body: JSON.stringify({ agent: resolvedAgent, ttlMs: 10 * 60_000 }),
            },
            token,
          )) as {
            claimCapability?: string;
            visualAgentRequests?: Array<{
              id: string;
              status: string;
              agent?: { name: string; taskId?: string };
              claimAttemptId?: string;
            }>;
          };
          const request = claimed.visualAgentRequests?.find(
            (candidate) => candidate.id === visualRequest.id,
          );
          if (
            request?.status === 'thinking' &&
            request.agent?.name === resolvedAgent.name &&
            request.agent.taskId === resolvedAgent.taskId &&
            request.claimAttemptId &&
            claimed.claimCapability
          ) {
            claimLeases.start({
              sessionId: id,
              token,
              runId: visualRequest.id,
              claimAttemptId: request.claimAttemptId,
              claimCapability: claimed.claimCapability,
              kind: 'visual',
            });
            const { claimCapability: _secret, ...publicClaim } = claimed;
            return result({ kind: 'visual_request', request, session: publicClaim });
          }
        }
        const applies = (await client.request(
          `/v1/sessions/${id}/apply-runs?state=queued`,
          {},
          token,
        )) as { runs?: Array<{ id: string }> };
        const apply = applies.runs?.[0];
        if (apply) {
          const claimed = (await client.request(
            `/v1/sessions/${id}/apply-runs/${apply.id}/claim`,
            {
              method: 'POST',
              body: JSON.stringify({ agent: resolvedAgent, revision, designGraphRevision }),
            },
            token,
          )) as {
            claimCapability?: string;
            applyRuns?: Array<{
              id: string;
              state: string;
              agent?: { name: string; taskId?: string };
              claimAttemptId?: string;
            }>;
          };
          const run = claimed.applyRuns?.find((candidate) => candidate.id === apply.id);
          if (
            run?.state === 'claimed' &&
            run.agent?.name === resolvedAgent.name &&
            run.agent.taskId === resolvedAgent.taskId &&
            run.claimAttemptId &&
            claimed.claimCapability
          ) {
            claimLeases.start({
              sessionId: id,
              token,
              runId: apply.id,
              claimAttemptId: run.claimAttemptId,
              claimCapability: claimed.claimCapability,
            });
            const { claimCapability: _secret, ...publicClaim } = claimed;
            return result({ kind: 'apply_run', run, session: publicClaim });
          }
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolveWait) => setTimeout(resolveWait, 500));
      } while (true);
      return result({ status: 'waiting', sessionId: id, waitedMs: waitMs });
    },
  );

  server.registerTool(
    'foundry_design_wait_for_apply',
    {
      description:
        'Wait for the user to review a Foundry batch and press Apply with agent, then atomically claim that apply run.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
        agent: z.object({
          name: z.string().min(1),
          version: z.string().optional(),
          taskId: z.string().optional(),
        }),
        revision: z.string().nullable().optional(),
        designGraphRevision: z.string().nullable().optional(),
        waitMs: z.number().int().min(0).max(60_000).default(30_000),
      }),
    },
    async ({ sessionId, token, agent, revision, designGraphRevision, waitMs }) => {
      const id = client.sessionId(sessionId);
      const resolvedAgent = { ...agent, taskId: agent.taskId ?? listenerTaskId };
      const deadline = Date.now() + waitMs;
      let nextPresenceAt = 0;
      do {
        if (Date.now() >= nextPresenceAt) {
          await client.request(
            `/v1/sessions/${id}/agent-presence`,
            {
              method: 'POST',
              body: JSON.stringify({
                agent: resolvedAgent,
                listening: true,
                bridgeVersion: packageJson.version,
                ttlMs: Math.min(Math.max(waitMs + 10_000, 15_000), 70_000),
              }),
            },
            token,
          );
          nextPresenceAt = Date.now() + 5_000;
        }
        const payload = (await client.request(
          `/v1/sessions/${id}/apply-runs?state=queued`,
          {},
          token,
        )) as { runs?: Array<{ id: string }> };
        const run = payload.runs?.[0];
        if (run) {
          const claimed = (await client.request(
            `/v1/sessions/${id}/apply-runs/${run.id}/claim`,
            {
              method: 'POST',
              body: JSON.stringify({
                agent: resolvedAgent,
                revision,
                designGraphRevision,
              }),
            },
            token,
          )) as {
            claimCapability?: string;
            applyRuns?: Array<{
              id: string;
              state: string;
              agent?: { name: string; taskId?: string };
              claimAttemptId?: string;
            }>;
          };
          const claimedRun = claimed.applyRuns?.find((candidate) => candidate.id === run.id);
          const sameAgent =
            claimedRun?.state === 'claimed' &&
            claimedRun.agent?.name === resolvedAgent.name &&
            claimedRun.agent.taskId === resolvedAgent.taskId;
          if (sameAgent && claimedRun?.claimAttemptId && claimed.claimCapability) {
            claimLeases.start({
              sessionId: id,
              token,
              runId: run.id,
              claimAttemptId: claimedRun.claimAttemptId,
              claimCapability: claimed.claimCapability,
            });
            const { claimCapability: _secret, ...publicClaim } = claimed;
            return result(publicClaim);
          }
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolveWait) => setTimeout(resolveWait, 500));
      } while (true);
      return result({ status: 'waiting', sessionId: id, waitedMs: waitMs });
    },
  );

  server.registerTool(
    'foundry_design_wait_for_visual_request',
    {
      description:
        'Wait for a Foundry user to ask about selected pixels or a canvas region, then claim the durable visual conversation request with its source, viewport, theme, state, measurements, comments, tokens, and design memory context.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
        agent: z.object({
          name: z.string().min(1),
          version: z.string().optional(),
          taskId: z.string().optional(),
        }),
        waitMs: z.number().int().min(0).max(60_000).default(30_000),
      }),
    },
    async ({ sessionId, token, agent, waitMs }) => {
      const id = client.sessionId(sessionId);
      const resolvedAgent = { ...agent, taskId: agent.taskId ?? listenerTaskId };
      const deadline = Date.now() + waitMs;
      let nextPresenceAt = 0;
      do {
        if (Date.now() >= nextPresenceAt) {
          await client.request(
            `/v1/sessions/${id}/agent-presence`,
            {
              method: 'POST',
              body: JSON.stringify({
                agent: resolvedAgent,
                listening: true,
                bridgeVersion: packageJson.version,
                ttlMs: Math.min(Math.max(waitMs + 10_000, 15_000), 70_000),
              }),
            },
            token,
          );
          nextPresenceAt = Date.now() + 5_000;
        }
        const payload = (await client.request(
          `/v1/sessions/${id}/visual-agent-requests?status=queued`,
          {},
          token,
        )) as { requests?: Array<{ id: string }> };
        const request = payload.requests?.[0];
        if (request) {
          const claimed = (await client.request(
            `/v1/sessions/${id}/visual-agent-requests/${request.id}/claim`,
            {
              method: 'POST',
              body: JSON.stringify({ agent: resolvedAgent, ttlMs: 10 * 60_000 }),
            },
            token,
          )) as {
            claimCapability?: string;
            visualAgentRequests?: Array<{
              id: string;
              status: string;
              agent?: { name: string; taskId?: string };
              claimAttemptId?: string;
            }>;
          };
          const claimedRequest = claimed.visualAgentRequests?.find(
            (candidate) => candidate.id === request.id,
          );
          if (
            claimedRequest?.status === 'thinking' &&
            claimedRequest.agent?.name === resolvedAgent.name &&
            claimedRequest.agent.taskId === resolvedAgent.taskId &&
            claimedRequest.claimAttemptId &&
            claimed.claimCapability
          ) {
            claimLeases.start({
              sessionId: id,
              token,
              runId: request.id,
              claimAttemptId: claimedRequest.claimAttemptId,
              claimCapability: claimed.claimCapability,
              kind: 'visual',
            });
            const { claimCapability: _secret, ...publicClaim } = claimed;
            return result(publicClaim);
          }
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolveWait) => setTimeout(resolveWait, 500));
      } while (true);
      return result({ status: 'waiting', sessionId: id, waitedMs: waitMs });
    },
  );

  server.registerTool(
    'foundry_design_get_visual_request',
    {
      description:
        'Read one persistent visual conversation request and its grounded context, messages, proposals, and status.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
        requestId: z.string().min(1),
      }),
    },
    async ({ sessionId, token, requestId }) =>
      result(
        await client.request(
          `/v1/sessions/${client.sessionId(sessionId)}/visual-agent-requests/${requestId}`,
          {},
          token,
        ),
      ),
  );

  server.registerTool(
    'foundry_design_respond_to_visual_request',
    {
      description:
        'Return grounded visual reasoning and one or more exact, independently previewable design proposals. Proposals remain separate from Review until the user previews and promotes one.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
        requestId: z.string().min(1),
        claimAttemptId: z.string().min(1),
        message: z.string().min(1),
        proposals: z.array(
          z.object({
            name: z.string().min(1).max(80),
            summary: z.string().min(1),
            reasoning: z.array(z.string().min(1)).default([]),
            exactValues: z.array(z.string().min(1)).default([]),
            sourceLocations: z.array(z.string().min(1)).default([]),
            responsiveImpact: z.string().min(1),
            verificationPlan: z.array(z.string().min(1)).default([]),
            changes: z.array(z.unknown()).default([]),
          }),
        ),
      }),
    },
    async ({ sessionId, token, requestId, ...input }) => {
      const claimCapability = claimLeases.capability(requestId, input.claimAttemptId);
      if (!claimCapability) {
        throw new Error(
          'No private capability is held for this visual request claim. Claim it again.',
        );
      }
      const payload = await client.request(
        `/v1/sessions/${client.sessionId(sessionId)}/visual-agent-requests/${requestId}/respond`,
        { method: 'POST', body: JSON.stringify({ ...input, claimCapability }) },
        token,
      );
      claimLeases.stop(requestId);
      return result(payload);
    },
  );

  server.registerTool(
    'foundry_design_heartbeat_apply_run',
    {
      description:
        'Extend a claimed Foundry handoff lease while inspecting source before source work begins.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
        runId: z.string().min(1),
        claimAttemptId: z.string().min(1),
      }),
    },
    async ({ sessionId, token, runId, claimAttemptId }) => {
      const id = client.sessionId(sessionId);
      const claimCapability = claimLeases.capability(runId, claimAttemptId);
      if (!claimCapability) {
        throw new Error('The private Apply claim capability is unavailable. Reclaim the run.');
      }
      const payload = await client.request(
        `/v1/sessions/${id}/apply-runs/${runId}/heartbeat`,
        { method: 'POST', body: JSON.stringify({ claimAttemptId, claimCapability }) },
        token,
      );
      claimLeases.start({ sessionId: id, token, runId, claimAttemptId, claimCapability });
      return result(payload);
    },
  );

  server.registerTool(
    'foundry_design_get_apply_run',
    {
      description: 'Read one persistent Foundry apply run, including progress and verification.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
        runId: z.string().min(1),
      }),
    },
    async ({ sessionId, token, runId }) =>
      result(
        await client.request(
          `/v1/sessions/${client.sessionId(sessionId)}/apply-runs/${runId}`,
          {},
          token,
        ),
      ),
  );

  server.registerTool(
    'foundry_design_update_apply_run',
    {
      description:
        'Report source-edit, rebuild, validation, verification-request, or failure progress for a claimed Foundry apply run.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
        runId: z.string().min(1),
        claimAttemptId: z.string().min(1),
        state: z.enum(['applying', 'rebuilding', 'verifying', 'failed']),
        message: z.string().optional(),
        changedFiles: z.array(z.string()).optional(),
        validationResults: z
          .array(
            z.object({
              name: z.string().min(1),
              passed: z.boolean(),
              summary: z.string().optional(),
            }),
          )
          .optional(),
        error: z.string().optional(),
      }),
    },
    async ({ sessionId, token, runId, ...update }) => {
      const claimCapability = claimLeases.capability(runId, update.claimAttemptId);
      if (!claimCapability) {
        throw new Error('The private Apply claim capability is unavailable. Reclaim the run.');
      }
      const payload = await client.request(
        `/v1/sessions/${client.sessionId(sessionId)}/apply-runs/${runId}`,
        { method: 'PATCH', body: JSON.stringify({ ...update, claimCapability }) },
        token,
      );
      if (update.state === 'failed') claimLeases.stop(runId);
      return result(payload);
    },
  );

  server.registerTool(
    'foundry_design_review_change',
    {
      description: 'Mark one recorded design change approved or rejected during the review step.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
        changeId: z.string().min(1),
        status: z.enum(['approved', 'rejected']),
      }),
    },
    async ({ sessionId, token, changeId, status }) =>
      result(
        await client.request(
          `/v1/sessions/${client.sessionId(sessionId)}/changes/${changeId}`,
          { method: 'PATCH', body: JSON.stringify({ status }) },
          token,
        ),
      ),
  );

  server.registerTool(
    'foundry_design_export',
    {
      description:
        'Export a reviewed Foundry change set as canonical JSON or one consolidated coding-agent prompt.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
        format: z.enum(['json', 'prompt', 'full']).default('json'),
      }),
    },
    async ({ sessionId, token, format }) =>
      result(
        await client.request(
          `/v1/sessions/${client.sessionId(sessionId)}/export?format=${format}`,
          {},
          token,
        ),
      ),
  );

  server.registerTool(
    'foundry_design_record_apply_result',
    {
      description:
        'Acknowledge that the exact frozen changes for a claimed apply run produced a source diff. This tool does not edit source files or complete verification.',
      inputSchema: z
        .object({
          sessionId: z.string().optional(),
          token: z.string().optional(),
          runId: z.string().min(1).optional(),
          claimAttemptId: z.string().min(1).optional(),
          changeIds: z.array(z.string()).min(1),
        })
        .superRefine((input, context) => {
          if (Boolean(input.runId) !== Boolean(input.claimAttemptId)) {
            context.addIssue({
              code: 'custom',
              message: 'runId and claimAttemptId must be provided together',
            });
          }
        }),
    },
    async ({ sessionId, token, runId, claimAttemptId, changeIds }) => {
      const id = client.sessionId(sessionId);
      const claimCapability =
        runId && claimAttemptId ? claimLeases.capability(runId, claimAttemptId) : undefined;
      if (runId && claimAttemptId && !claimCapability) {
        throw new Error('The private Apply claim capability is unavailable. Reclaim the run.');
      }
      return result(
        await client.request(
          runId && claimAttemptId
            ? `/v1/sessions/${id}/apply-runs/${runId}/apply-result`
            : `/v1/sessions/${id}/apply-runs/apply-result`,
          {
            method: 'POST',
            body: JSON.stringify(
              runId && claimAttemptId
                ? { claimAttemptId, claimCapability, changeIds }
                : { changeIds },
            ),
          },
          token,
        ),
      );
    },
  );

  server.registerTool(
    'foundry_design_record_verification',
    {
      description: 'Store measured post-build verification results for the applied change set.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
        runId: z.string().min(1),
        claimAttemptId: z.string().min(1),
        results: z.array(
          z.object({
            applyRunId: z.string().min(1),
            claimAttemptId: z.string().min(1),
            changeId: z.string(),
            property: z.string(),
            requested: z.unknown(),
            rendered: z.unknown(),
            passed: z.boolean(),
            context: verificationContextSchema.optional(),
            reason: z.string().optional(),
            geometry: verificationGeometrySchema.optional(),
            evidence: z.array(z.string().min(1)).default([]),
            verifiedAt: z.string().datetime(),
          }),
        ),
      }),
    },
    async ({ sessionId, token, runId, claimAttemptId, results }) => {
      const claimCapability = claimLeases.capability(runId, claimAttemptId);
      if (!claimCapability) {
        throw new Error('The private Apply claim capability is unavailable. Reclaim the run.');
      }
      return result(
        await client.request(
          `/v1/sessions/${client.sessionId(sessionId)}/verify`,
          {
            method: 'POST',
            body: JSON.stringify({
              source: 'native-agent',
              runId,
              claimAttemptId,
              claimCapability,
              results,
            }),
          },
          token,
        ),
      );
    },
  );
  return server;
});
