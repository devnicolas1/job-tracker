/**
 * What to paste into the agent (Claude Code or Codex) to (re)generate a job's tailored résumé.
 * Plain words rather than a slash command, so it works in both: it names the project's
 * `tailor-resume` skill, which does the rest from the job id alone.
 */
export const tailoringPrompt = (jobId: string) => `Use the tailor-resume skill for job ${jobId}`;
