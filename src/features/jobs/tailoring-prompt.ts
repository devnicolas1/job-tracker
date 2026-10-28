/**
 * What to paste into Claude Code to (re)generate a job's tailored résumé. It invokes the
 * project's `tailor-resume` skill, which does the rest from the job id alone.
 */
export const tailoringPrompt = (jobId: string) => `/tailor-resume ${jobId}`;
