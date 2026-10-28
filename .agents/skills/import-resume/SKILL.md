---
name: import-resume
description: Fill in or enrich the Job Tracker profile from the user's uploaded base résumé (PDF). Use when the user asks to import, parse or load their résumé/CV into their profile, or when the profile is empty.
---

# Import résumé into profile

1. `list_base_resumes` and pick the file: the language the user names, else English, else the
   only one available. If none is uploaded, ask the user to upload one at
   http://localhost:3000/resumes and stop.
2. `get_base_resume` with that language: it returns the résumé's full text as numbered
   paragraphs, which is all you need (any agent can call it; no PDF reader required). Open the
   PDF at the listed path only if the text looks incomplete and you can read PDFs.
3. `get_profile` once, to avoid creating duplicates of entries that already exist.
4. Write what is missing:
   - `update_profile_basics` — name, headline, contacts, summary.
   - `save_profile_entry` for each experience, education, certification, project, skill and
     language. Dates use `YYYY-MM`; omit `endDate` for current roles. Put achievements in
     `highlights` (one per bullet) and tools in `technologies`.
   - Enrich an existing entry (pass its `id` and the full data) rather than adding a near
     duplicate.
5. Do not invent anything the résumé does not state. If something is ambiguous (e.g. a missing
   start month), use the most conservative reading and mention it.
6. Report in a few lines: what was added or updated, and what the user should review at
   http://localhost:3000/profile (e.g. job preferences, which a résumé never contains).
