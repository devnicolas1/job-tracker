---
name: find-jobs
description: Hunt for job openings that fit the user's profile, score them, write a tailored résumé for the strong matches and save them to the Job Tracker. Use when the user asks to find, search or look for jobs, or to refresh their job pipeline. Optional argument — how many matches to save and any extra focus, e.g. "5 remote backend roles".
---

# Find jobs

You operate the Job Tracker through its `job-tracker` MCP tools. The goal is a short list of
genuinely good opportunities, each with an honest assessment and a résumé tailored to it — at the
lowest token cost. Work silently; talk to the user only at the end (or if blocked).

## Budget rules (follow strictly)

- Call `get_profile` **once**. Never fetch it again in this run.
- Run all searches in **one** `search_jobs` call (up to 6 queries). It searches every job board
  at once; pass `sources` only to narrow it.
- Triage from the one-line search results. Open (`get_job_posting`) only postings that survive
  triage — at most **2× the target** count. Use `maxChars: 4000`.
- Never open job pages in a browser or with WebFetch: the tools are far cheaper.
- Never echo postings or descriptions back. `save_job` fills in the posting server-side: send
  only `externalId`, your assessment and the tailored résumé.
- Dismiss rejects in **one** batched `dismiss_jobs` call per phase, with reasons of ≤ 6 words.
- Call `get_base_resume` at most **once per language** per run, and only when a job needs it.
- Keep your own reasoning brief. No drafts: write each tailoring once.

## Workflow

1. **Load the profile** — `get_profile`. If basics or experience are empty, stop and tell the user
   to fill in their profile at http://localhost:3000/profile (or offer the `import-resume` skill).
   Target count: from the user's argument, else **8**.

2. **Plan queries** from preferences (fall back to the profile headline and recent titles):
   - **Stacks:** one query per main language or framework the user works in professionally
     (`keywords` preference, else the profile's experience technologies) — every one of them,
     not just the headline stack (e.g. "React", "TypeScript" **and** "Go"). Use one word each:
     boards require every query word in the title or description (developer/senior/pleno/remote
     are ignored), so "Node Express" misses a Node job that names NestJS or Fastify.
   - **Locations:** pair each stack with every place the user can work from: the country they
     live in (from the profile location, e.g. "Poland" — remote jobs restricted to a country
     never match "Worldwide") and "Worldwide" for remote-anywhere roles. A city ("Kraków")
     only finds on-site/hybrid jobs there, so add it only when the user wants those.
   - Up to 6 queries: stacks × locations. When that is too many, keep every stack in the user's
     home country and in "Worldwide" and merge the rest.
   - `workplaceTypes` and `postedWithin: "week"` (use `"day"` if the user runs this daily).
   - `experienceLevels` from seniority: junior→`entry`, mid→`associate`+`mid-senior`,
     senior/staff/principal/lead→`mid-senior`, manager→`mid-senior`+`director`.

3. **Search** — one `search_jobs` call. Already-tracked and dismissed postings are skipped for you.
   Results come grouped by source (`## remotive: …`); always pass that source to
   `get_job_posting`, `save_job` and `dismiss_jobs` (one `dismiss_jobs` call per source).

   | Source                                                | What it is                                                          |
   | ----------------------------------------------------- | ------------------------------------------------------------------- |
   | `linkedin`                                            | Everything; noisy. Uses `location`, `experienceLevels`.             |
   | `larajobs`                                            | Laravel-only board. No description: judge from the tags line.       |
   | `remotive`, `himalayas`, `remoteok`, `weworkremotely` | International remote boards. Check the eligible locations.          |
   | `companies`                                           | Companies the user chose (Greenhouse, Lever, Ashby, InHire boards). |
   | `hackernews`                                          | Monthly "Who is hiring?" posts: free text, often several roles.     |
   | `github`                                              | Brazilian community boards (backend-br, frontendbr), in Portuguese. |

4. **Triage from titles** — discard: wrong seniority or function, stacks the profile lacks,
   `exclude` keywords, and duplicates (same company and title, different city: keep one). Then
   `dismiss_jobs` everything discarded. A title that names no stack ("Software Engineer II –
   Payments") matched a stack query in its description: keep it when seniority and function fit.

5. **Assess** — for each survivor, `get_job_posting`, then score 0–100:

   | Criterion                                                  | Weight |
   | ---------------------------------------------------------- | -----: |
   | Must-have skills and experience covered by the profile     |     40 |
   | Role and seniority alignment                               |     25 |
   | Location, workplace, employment type, language, salary fit |     20 |
   | Domain, nice-to-haves, growth                              |     15 |

   A violated hard constraint (on-site in another country without relocation, required
   language/citizenship the user lacks, excluded keyword) caps the score at 40. Be honest: an
   inflated score wastes the user's time. The user's preference notes override these defaults:
   anything they say is not a deal breaker (e.g. a missing degree) never caps the score.

6. **Save**
   - **≥ 70** — `save_job` with `assessment` **and** `tailoredResume` (see Tailored résumé).
   - **55–69** — `save_job` with `assessment` only.
   - **< 55** — add to a final `dismiss_jobs` batch.
   - Stop once the target count of ≥ 70 matches is saved.

7. **Report** — a compact table (score, title, company, link from `save_job`), one line on what
   was dismissed and why, and the link http://localhost:3000/jobs. Nothing else.

## Assessment fields

- `matchSummary`: 2–3 sentences, plain and specific ("Strong Node/Postgres overlap; posting wants
  Kafka, which the profile lacks.").
- `strengths` / `gaps`: 2–5 short items each, concrete (skills, years, domain), no fluff.

## Tailored résumé

Follow the **Writing the edits** section of `.claude/skills/tailor-resume/SKILL.md` (read it once
per run, before the first tailoring; `lang:` comes from `get_job_posting`). Send the result as
`tailoredResume` in `save_job`.

## If something fails

- `search_jobs` reports a stopped source (rate limit, changed format): keep the other sources'
  results, and mention the stopped source in the report.
- `save_job` rejects a tailoring (unknown paragraph id): fix the id from the `get_base_resume`
  outline and retry once.
- No base résumé for the posting's language: save the job without `tailoredResume` and mention
  in the report that uploading one at http://localhost:3000/resumes enables tailoring.
- Jobs found elsewhere (e.g. a company careers page the user mentions) can be saved with
  `source` set to a slug like `"company-site"` and a `posting` object (url, title, company…).
