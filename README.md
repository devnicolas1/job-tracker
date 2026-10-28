# Job Tracker

A personal career database, résumé vault and AI-curated job pipeline that runs on your own
machine. You keep a complete profile; an AI coding agent (Claude Code or Codex, on your existing
subscription — no API key needed) searches LinkedIn and eight other job boards, scores every
posting against your profile, tailors **your own résumé** to each strong match and files it all
here.

- **Profile** — everything about your career: basics, job preferences, experience, education,
  certifications, projects, skills, languages, awards, publications, volunteering.
- **Résumés** — your own résumé PDFs (English and Portuguese), plus every tailored version: your
  PDF, same design, with only the text adapted to the job.
- **Jobs** — opportunities ranked by fit, with strengths, gaps, a PDF résumé and a status pipeline
  (new → saved → applied → interviewing → offer / rejected).

It is a single-user, local-only tool: there is no sign-in, so do not expose it on a network or
deploy it publicly.

## Quick start

Requirements:

- Node.js 24+ (`nvm use` reads `.nvmrc`). `better-sqlite3` is a native module; if `npm install`
  has to compile it, you need a C/C++ toolchain (Xcode Command Line Tools, `build-essential`, or
  the Visual Studio Build Tools).
- [Claude Code](https://claude.com/claude-code) or [Codex](https://github.com/openai/codex) to
  run the agent workflows. The web app works on its own, but finding jobs and tailoring résumés
  need an agent.

```bash
git clone https://github.com/devnicolas1/job-tracker.git
cd job-tracker
npm install
npm run dev            # http://localhost:3000
```

1. Fill in **Profile**, or upload your résumé PDF on **Résumés** and run `/import-resume` in
   Claude Code to fill it for you. Set your **Job preferences**: they drive the search.
2. In this folder, start Claude Code and run:

   ```
   /find-jobs
   /find-jobs 5 remote backend roles in Portugal
   ```

   Claude Code picks up the MCP server from `.mcp.json` (approve it on first use) and the skills
   from `.claude/skills/`.

3. Review the results on **Jobs**, download tailored résumés, and track your applications.
   Jobs saved without a résumé (or with an outdated one) have a **Copy tailoring prompt** button:
   it copies `/tailor-resume <job id>`; paste it into Claude Code to generate that résumé.

Want to look around first? `npm run demo` serves a fictional profile on http://localhost:3001
from a separate `.demo-data/` directory, leaving your data untouched.

### Using Codex instead

Register the MCP server once in `~/.codex/config.toml`:

```toml
[mcp_servers.job-tracker]
command = "npm"
args = ["run", "--silent", "--prefix", "/absolute/path/to/job-tracker", "mcp"]
```

Codex reads `AGENTS.md`, which points it to the same workflow files. It has no `/find-jobs`
command: ask it in plain words ("find 5 remote backend jobs", "tailor the résumé for job
`Fn_fog-hkJc`").

## How it works

```
                 ┌──────────────────────── src/core ────────────────────────┐
 Browser ──► Next.js (src/app, src/features)                                │
                 │      Server Actions ──► services ──► Drizzle ──► SQLite  │
 Claude Code ─► MCP server (src/mcp)            │                (data/)    │
   + skill       │      tools ───────────► services                         │
                 │                              └─► job sources ──► boards  │
                 └──────────────────────────────────────────────────────────┘
```

- **`src/core`** — framework-free domain and application layer: zod schemas (the single source of
  truth for validation), services, database, job sources and résumé rendering. Both adapters
  below call the same services, so the UI and the agent can never disagree about the rules.
- **`src/app` + `src/features`** — the Next.js App Router UI. Routes stay thin; each feature owns
  its components and Server Actions. Forms are generated from declarative field descriptors.
  Shared UI primitives live in `src/ui`, small helpers in `src/lib`.
- **`src/core/resume-document`** — résumé → tailored résumé, without templates: reads the layout
  of your PDF, applies the agent's text edits and lays it out again (see below).
- **`src/mcp`** — the Model Context Protocol server the agent talks to over stdio.
- **`.claude/skills`** — the agent workflows: `find-jobs`, `tailor-resume` and `import-resume`.

### Key design decisions

| Decision                                              | Why                                                                                                                                                                                                        |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Agent via **MCP + skill**, not an LLM API             | Runs on your Claude Code / Codex subscription. The skill holds the workflow; the MCP server holds the capabilities.                                                                                        |
| LinkedIn's **public guest pages**, parsed server-side | No login, cookies or browser automation. Postings come back as one line each (~25 tokens) instead of a rendered page (thousands). Requests are throttled to ~1/s.                                          |
| **Token-frugal tools**                                | Compact text instead of JSON, 11-character ids, already-seen and dismissed postings filtered out server-side, and `save_job` fills in posting data itself, so the agent never echoes a description back.   |
| Tailoring = **edits to your own PDF**, no template    | Your résumé is the design. The agent only sends text edits by paragraph id; the look is measured from your PDF every time, so changing your résumé's design changes every future tailored version with it. |
| Tailorings **pinned to the base version**             | Edits store a checksum of the PDF they were written against. If you replace the base résumé, older tailorings are flagged out of date instead of being applied to the wrong paragraphs.                    |
| **SQLite** (WAL) + Drizzle                            | Zero-ops local storage that the web app and the MCP server can use concurrently. Migrations run automatically on start-up.                                                                                 |
| JSON columns for profile entries                      | Entries are always read and written whole and never queried by inner fields; zod validates them at the boundary. Adding a profile section is a schema + descriptor change, not a migration.                |
| Native `<dialog>`, no component library               | Focus trapping, Escape and backdrop come from the platform. Fewer dependencies to audit and learn.                                                                                                         |

## How résumé tailoring works

Tailored résumés are produced from your own PDF, never from a template:

1. **Read** (`read-pdf.ts`, MuPDF): every character with its font, size, colour and position, plus
   horizontal rules.
2. **Segment** (`segment.ts`): characters → lines → paragraphs, inferred from geometry the way a
   reader would: bullet markers and hanging indents, line spacing learned per font size, hard
   breaks (a line that ends while the next word would have fitted), alignment by consensus of
   similar paragraphs, and which rule belongs under which heading.
3. **Outline** (`outline.ts`): the agent sees `[p9] • **Lead:** text…` and answers with edits:
   replace, insert-like-another-paragraph, delete. Edits carry text only (`**bold**`, `*italic*`).
4. **Re-typeset** (`typeset.ts`, `flow.ts`, `render.tsx`): lines are broken word-processor style
   (greedy, kerned, spaces never squeezed) and flowed onto **one pageless sheet** whose height fits
   the content, then drawn with react-pdf using only the measured styles.

The pipeline is verified by round-tripping: rendering a résumé **with no edits** reproduces every
line of the original with the same breaks and spacing (within 0.2 pt), only without page breaks.
Ligatures are disabled so the text layer reads "financial", not "fnancial", for applicant-tracking
systems.

Limitations: images, photos, coloured boxes and multi-column layouts are not reproduced; scanned
PDFs (no text layer) are rejected at upload.

## Scripts

| Command                           | What it does                                                    |
| --------------------------------- | --------------------------------------------------------------- |
| `npm run dev`                     | Web app in development mode                                     |
| `npm run build` / `npm start`     | Production build and server (still local-only)                  |
| `npm run demo`                    | Seed and serve a fictional profile on port 3001                 |
| `npm run mcp`                     | MCP server on stdio (normally started by the agent)             |
| `npm run check`                   | Typecheck, lint, format check and tests — run before committing |
| `npm test` / `npm run test:watch` | Tests only (Vitest)                                             |
| `npm run format`                  | Format everything with Prettier                                 |
| `npm run db:generate`             | Generate a migration after changing `src/core/db/schema.ts`     |
| `npm run db:studio`               | Browse the database in Drizzle Studio                           |

## Job sources

`search_jobs` searches all of them in one call; each is a module in `src/core/sources/`.

| Source           | How it is read                                            | Notes                                           |
| ---------------- | --------------------------------------------------------- | ----------------------------------------------- |
| `linkedin`       | Public guest job pages (HTML)                             | See the terms note below                        |
| `larajobs`       | RSS feed                                                  | Laravel only; links go straight to applications |
| `remotive`       | Public API                                                | Cached 6 h, as its terms ask                    |
| `himalayas`      | Public search API                                         | Salary, seniority, eligible countries           |
| `remoteok`       | Public API                                                |                                                 |
| `weworkremotely` | RSS (back-end and full-stack categories)                  |                                                 |
| `companies`      | Greenhouse, Lever, Ashby and InHire public job-board APIs | Boards listed in Job preferences                |
| `hackernews`     | Algolia HN API, latest "Who is hiring?" thread            | Free-text posts                                 |
| `github`         | GitHub API: `backend-br/vagas`, `frontendbr/vagas`        | Brazilian, labelled issues                      |

Feed-style sources download once, are cached, and filter locally; postings that name the
keywords in their title rank first. To watch specific companies, add their boards in **Profile →
Job preferences → Company job boards**, as `provider:company` taken from the board URL
(`boards.greenhouse.io/gitlab` → `greenhouse:gitlab`, `jobs.lever.co/spotify` → `lever:spotify`,
`jobs.ashbyhq.com/ramp` → `ashby:ramp`, `magazineluiza.inhire.app/magalucloud/vagas` →
`inhire:magazineluiza/magalucloud`).

Gupy was evaluated and left out: its API answers automated requests with a bot check.

## Data and privacy

Everything stays on your machine in `data/` (git-ignored): the SQLite database and your uploaded
résumés. The app itself makes outbound requests only for the agent's job searches on the sources
above; public APIs and feeds are called with an honest user agent and cached. Keep in mind that
your agent (Claude Code or Codex) reads your profile and résumé to do its work, so that data is
sent to its model provider like anything else you show it.

Scraping is against LinkedIn's terms of service. The tracker keeps volume low (a handful of
throttled requests per run, for personal use), but use it with that in mind. This project is not
affiliated with LinkedIn or any of the job boards it reads.

Environment variables (all optional): `JOB_TRACKER_DATA_DIR` (default `data`),
`JOB_TRACKER_ROOT` (default: current directory), `JOB_TRACKER_WEB_URL` (default
`http://localhost:3000`, used for links the agent reports).

## Extending

Read [`CLAUDE.md`](CLAUDE.md) first: it holds the architecture rules and conventions (for people
and coding agents alike), and `npm run check` and `npm run build` must pass before a change is
done.

- **Another job board** — implement `JobSource` (`src/core/sources/types.ts`) next to
  the others (feed or API boards can reuse `createCatalogSource` from `sources/catalog.ts`),
  register it in `sources/registry.ts`, and add parser tests against saved responses in
  `__fixtures__/`.
- **Another profile section** — add its zod schema to `profileSectionSchemas`
  (`src/core/profile/schemas.ts`) and a descriptor in `src/features/profile/descriptors.ts`.
  Storage, UI and MCP tools pick it up automatically.
- **Another résumé language** — extend `RESUME_LANGUAGES` (`src/core/shared/schemas.ts`).
- **Another résumé font** — `npm i @fontsource/<font>`; proprietary fonts map to a
  metric-compatible open one in `src/core/resume-document/fonts.ts` (Calibri → Carlito).

## License

[MIT](LICENSE) © Nicolas Freitas
