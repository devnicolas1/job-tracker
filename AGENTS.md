# Job Tracker — notes for agents

This file is read by Codex and other agents; `CLAUDE.md` imports it for Claude Code. Two kinds
of work happen in this repository.

**Operating the tracker** (finding jobs, editing the profile): use the `job-tracker` MCP tools.
Never edit `data/` directly. The profile is the only source of facts: never invent experience,
dates, skills or metrics. If the `job-tracker` tools are missing, point the user to the README's
"Agent setup" instead of working around them.

The workflows live in `.claude/skills/`. Claude Code loads them as skills; other agents (Codex)
read the file when the user asks for that task:

- Find jobs (`find-jobs`): `.claude/skills/find-jobs/SKILL.md`.
- Fill the profile from an uploaded résumé (`import-resume`): `.claude/skills/import-resume/SKILL.md`.
- Tailor the résumé for one tracked job (`tailor-resume <job id>`):
  `.claude/skills/tailor-resume/SKILL.md`.

Skills must work in every agent: name MCP tools, not agent-specific tools (no "Read tool",
"WebFetch"). The MCP server starts with `node scripts/mcp.mjs` on every OS, from any directory.

**Changing the code**: read `README.md` (architecture and decisions) first.

## Architecture rules

- `src/core` is framework-free: no imports from `next`, `react` (except the PDF renderer),
  `src/app`, `src/features` or `src/mcp`. Both adapters call the same services.
- zod schemas in `src/core/**/schemas.ts` are the single source of truth for validation. Services
  validate their own input (`parseInput`); adapters never duplicate rules.
- Expected failures throw `DomainError` subclasses. Server Actions turn them into `ActionState`
  via `runAction`; MCP tools return them as tool errors via `registerTool`. Anything else is a bug
  and should propagate.
- Services are created by factories that receive their dependencies (`createServices`), so tests
  use an in-memory database with the real migrations (`src/core/testing/fixtures.ts`).
- Server Actions are public endpoints: validate every argument, not just form data.
- MCP tool output is read by a model: compact text, ids in `[brackets]`, no pretty-printed JSON.
  Keep tool descriptions short — every tool definition is loaded into every agent session.

## Conventions

- TypeScript strict with `noUncheckedIndexedAccess`; `typescript-eslint` strict-type-checked.
- Imports use the `@/` alias across top-level folders and relative paths within a feature.
- Schema change: edit `src/core/db/schema.ts`, then `npm run db:generate -- --name <change>`.
  Never edit generated migrations in `drizzle/`.
- Tests sit next to the code (`*.test.ts`). Parsers are tested against fixtures in
  `__fixtures__/`, never against live sites.
- Résumé tailoring (`src/core/resume-document`) must never hard-code a design: every style comes
  from the base PDF. After changing it, an unedited base résumé must still round-trip to the same
  line breaks and spacing (`pipeline.test.ts` covers the principle; check real PDFs too).
- Before finishing: `npm run check` and `npm run build`.
