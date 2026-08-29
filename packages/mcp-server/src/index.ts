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
  const server = new McpServer({ name: 'foundry-design-control', version: '0.1.0' });
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
      }),
    },
    async (input) =>
      result(
        await client.request('/v1/sessions', {
          method: 'POST',
          body: JSON.stringify({
            context: { ...input, theme: 'system', breakpoint: 'current', state: 'current' },
          }),
        }),
      ),
  );

  server.registerTool(
    'foundry_design_get_change_set',
    {
      description:
        'Read the canonical change set and verification results for a Foundry session before editing code.',
      inputSchema: z.object({ sessionId: z.string().optional(), token: z.string().optional() }),
    },
    async ({ sessionId, token }) =>
      result(await client.request(`/v1/sessions/${client.sessionId(sessionId)}`, {}, token)),
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
        format: z.enum(['json', 'prompt']).default('json'),
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
    async ({ sessionId, token, results }) =>
      result(
        await client.request(
          `/v1/sessions/${client.sessionId(sessionId)}/verify`,
          { method: 'POST', body: JSON.stringify({ results }) },
          token,
        ),
      ),
  );
  return server;
});
