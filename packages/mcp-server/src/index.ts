#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { z } from 'zod';
import { FoundryRuntimeClient } from './client.js';

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
    version: '0.3.0',
  });
  const client = new FoundryRuntimeClient();

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
        revision: z.string().optional(),
        designGraphRevision: z.string().optional(),
        waitMs: z.number().int().min(0).max(60_000).default(30_000),
      }),
    },
    async ({ sessionId, token, agent, revision, designGraphRevision, waitMs }) => {
      const id = client.sessionId(sessionId);
      const deadline = Date.now() + waitMs;
      let nextPresenceAt = 0;
      do {
        if (Date.now() >= nextPresenceAt) {
          await client.request(
            `/v1/sessions/${id}/agent-presence`,
            {
              method: 'POST',
              body: JSON.stringify({
                agent,
                listening: true,
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
          return result(
            await client.request(
              `/v1/sessions/${id}/apply-runs/${run.id}/claim`,
              {
                method: 'POST',
                body: JSON.stringify({ agent, revision, designGraphRevision }),
              },
              token,
            ),
          );
        }
        if (Date.now() >= deadline) break;
        await new Promise((resolveWait) => setTimeout(resolveWait, 500));
      } while (true);
      return result({ status: 'waiting', sessionId: id, waitedMs: waitMs });
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
    async ({ sessionId, token, runId, ...update }) =>
      result(
        await client.request(
          `/v1/sessions/${client.sessionId(sessionId)}/apply-runs/${runId}`,
          { method: 'PATCH', body: JSON.stringify(update) },
          token,
        ),
      ),
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
        'Mark approved changes applied after a source diff is produced. This tool does not edit source files.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
        changeIds: z.array(z.string()).min(1),
      }),
    },
    async ({ sessionId, token, changeIds }) => {
      const id = client.sessionId(sessionId);
      const updates = [];
      for (const changeId of changeIds)
        updates.push(
          await client.request(
            `/v1/sessions/${id}/changes/${changeId}`,
            { method: 'PATCH', body: JSON.stringify({ status: 'applied' }) },
            token,
          ),
        );
      return result({ updated: changeIds.length, session: updates.at(-1) });
    },
  );

  server.registerTool(
    'foundry_design_record_verification',
    {
      description: 'Store measured post-build verification results for the applied change set.',
      inputSchema: z.object({
        sessionId: z.string().optional(),
        token: z.string().optional(),
        runId: z.string().optional(),
        results: z.array(
          z.object({
            changeId: z.string(),
            property: z.string(),
            requested: z.unknown(),
            rendered: z.unknown(),
            passed: z.boolean(),
            reason: z.string().optional(),
            verifiedAt: z.string().datetime(),
          }),
        ),
      }),
    },
    async ({ sessionId, token, runId, results }) =>
      result(
        await client.request(
          `/v1/sessions/${client.sessionId(sessionId)}/verify`,
          { method: 'POST', body: JSON.stringify({ runId, results }) },
          token,
        ),
      ),
  );
  return server;
});
