---
name: tailor-resume
description: Write (or rewrite) the tailored résumé for one job already in the Job Tracker. Use when the user runs /tailor-resume <job id> (Claude Code) or $tailor-resume <job id> (Codex), or asks to tailor, generate or redo the résumé for a specific tracked job. Argument — the job id shown in the app, e.g. "Fn_fog-hkJc".
---

# Tailor résumé for one job

The argument is a Job Tracker job id. Work silently and keep it cheap: one call per step.

1. `get_job` with the id. It returns the posting text, the fit assessment and any existing
   tailored résumé. If the id is unknown, `list_jobs` with `query` set to the argument and pick
   the match; ask the user if it is ambiguous.
2. `get_profile` once — the source of facts beyond what the base résumé says.
3. `get_base_resume` with the posting's language (`lang:` in `get_job`; if missing, the language
   the posting is written in; `pt` or `en`).
4. Write the edits (below) and save them with `save_tailored_resume` (`id` + `tailoredResume`).
   If an existing tailored résumé is shown, improve on it rather than starting over, unless the
   user asked for a fresh one.
5. Reply with one line: the job, what you emphasised, and the link returned by the tool.

## Writing the edits

A tailored résumé is **the user's own résumé with its text adapted** — never a new document. The
app rebuilds the user's PDF exactly (fonts, colours, spacing, bullets, rules) as a single pageless
sheet and applies your edits; you only write text.

1. `get_base_resume` returns the résumé in the posting's language as numbered paragraphs:

   ```
   [p8] **Software Engineer - Acme Corp -** *Mar 2021 - Present*
   [p9] • **Checkout rewrite:** replaced the legacy payment flow with…
   ```

2. The tailored résumé is `{ language, edits }`, where each edit is one of:
   - `{ op: "replace", id: "p9", text: "**Lead:** new wording…" }`
   - `{ op: "insert", after: "p16", like: "p16", text: "…" }` — a new paragraph after `after`,
     looking exactly like `like` (default: `after`). Use it for an extra bullet, or a whole new
     section: a heading `like` an existing heading, then items `like` existing items.
   - `{ op: "delete", id: "p19" }`
   - To move a paragraph: delete it and insert it where it belongs.

**What to change** — only what makes this résumé speak to this posting:

- The headline under the name and the summary: aim them at the role.
- Bullets: reorder the most relevant first (delete + insert), rewrite them to use the posting's
  vocabulary where it is honestly true, and drop clearly irrelevant ones if space is tight.
- Skills lines: put the posting's technologies first within each line.
- Add a section or bullet only for facts that exist in the profile but are missing from the
  résumé (e.g. a relevant certification or project).

**Keep the résumé's conventions** — they are part of its design:

- Same structure and section order; similar length to the original (the PDF is pageless, so
  length is never cut off by a page, but recruiters still skim: do not pad it).
- Same text patterns: bold lead-ins (`**Lead:** …`), STAR labels, `Title - Company - *dates*`
  lines, `**Label:** items` skill lines. Leave names, companies and dates untouched.
- Write in the base résumé's language; bullets never include the `•` marker.

**Truthful only.** Every claim must come from the base résumé or the profile. Never add skills,
tools, metrics or responsibilities that are not there; keep numbers exactly as given.

## If something fails

- Unknown paragraph id: fix it from the `get_base_resume` outline and retry once.
- No base résumé in that language: tell the user to upload one at http://localhost:3000/resumes
  (or offer the other language if the role accepts it) and stop.
