// Starts the job-tracker MCP server over stdio for any agent (Claude Code, Codex…).
// Plain `node` works on every OS without npm/npx shims, and the server finds this repository from
// its own location, so the agent may launch it from any working directory.
import path from 'node:path';

process.chdir(path.resolve(import.meta.dirname, '..'));

// tsx reads tsconfig.json (for the `@/` alias) from the working directory, so load it after chdir.
await import('tsx');
await import('../src/mcp/server.ts');
