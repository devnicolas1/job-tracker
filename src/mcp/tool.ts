import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';

import { DomainError } from '@/core/shared/errors';

export interface ToolDefinition<S extends z.ZodObject> {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: S;
  readonly annotations?: ToolAnnotations;
  /** Returns compact plain text: it is read by a model, and every character costs tokens. */
  readonly run: (args: z.output<S>) => string | Promise<string>;
}

const text = (value: string, isError = false): CallToolResult => ({
  content: [{ type: 'text', text: value }],
  ...(isError && { isError: true }),
});

/**
 * Registers a tool whose expected failures (validation, not found, source unavailable) are
 * reported back to the agent as tool errors it can act on, instead of crashing the call.
 */
export function registerTool<S extends z.ZodObject>(server: McpServer, tool: ToolDefinition<S>) {
  // Widened to a concrete type: the SDK's conditional callback typing can't resolve a generic `S`.
  const inputSchema: z.ZodObject = tool.input;
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema,
      ...(tool.annotations && { annotations: tool.annotations }),
    },
    async (args: Record<string, unknown>) => {
      try {
        return text(await tool.run(args as z.output<S>));
      } catch (error) {
        if (error instanceof DomainError) return text(error.message, true);
        throw error;
      }
    },
  );
}
