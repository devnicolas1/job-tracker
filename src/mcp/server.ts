import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { getConfig } from '@/core/config';
import { getServices } from '@/core/container';

import { createMcpServer } from './create-server';

// stdio entry point. stdout carries protocol messages only, so diagnostics go to stderr.
createMcpServer(getServices(), getConfig())
  .connect(new StdioServerTransport())
  .catch((error: unknown) => {
    console.error('job-tracker MCP server failed to start:', error);
    process.exit(1);
  });
