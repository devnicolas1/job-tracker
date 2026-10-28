import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { AppConfig } from '@/core/config';
import type { Services } from '@/core/container';

import { createJobCache } from './job-cache';
import { registerJobTools } from './tools/jobs';
import { registerProfileTools } from './tools/profile';
import { registerResumeTools } from './tools/resumes';

/**
 * MCP adapter: exposes the same services the web app uses as tools an agent (Claude Code, Codex…)
 * can call. Transport-agnostic, so tests can drive it in-process.
 */
export function createMcpServer(services: Services, config: Pick<AppConfig, 'webUrl'>): McpServer {
  const server = new McpServer(
    { name: 'job-tracker', version: '0.1.0' },
    {
      instructions: `Job Tracker: the user's career database and job pipeline (web UI at ${config.webUrl}).
Outputs are compact text; ids appear in [brackets]. The profile is the source of truth for facts:
never invent experience, dates or skills when assessing fit or tailoring a résumé.`,
    },
  );

  registerProfileTools(server, services);
  registerResumeTools(server, services);
  registerJobTools(server, { services, cache: createJobCache(), config });
  return server;
}
