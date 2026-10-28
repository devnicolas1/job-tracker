import { ValidationError } from '@/core/shared/errors';

import { parseMarkup } from './markup';
import type { Paragraph, ResumeLayout, TextRun } from './model';
import { TAB } from './segment';

/*
 * Applies an agent's text edits to a base layout. Edits address paragraphs by id and carry only
 * text: new runs inherit the look of the paragraph they replace (or are modelled on), so tailoring
 * can change words and structure but never design.
 */

export type ParagraphEdit =
  | { readonly op: 'replace'; readonly id: string; readonly text: string }
  | {
      readonly op: 'insert';
      readonly after: string;
      readonly like?: string | undefined;
      readonly text: string;
    }
  | { readonly op: 'delete'; readonly id: string };

/** Text written for the outline/agent → runs styled after `model`'s runs. */
function restyle(model: Paragraph, text: string): TextRun[] {
  let cleaned = text.replaceAll('<tab>', TAB).trim();
  // The marker is drawn from the model; drop it if the agent typed it too.
  if (model.marker && cleaned.startsWith(model.marker.text)) {
    cleaned = cleaned.slice(model.marker.text.length).trim();
  }
  if (!cleaned)
    throw new ValidationError(`Empty text for a paragraph like ${model.id}; delete it instead.`);

  // The paragraph's main style (longest run) is the base for emphasis it does not have yet.
  const [fallback] = [...model.runs].sort((a, b) => b.text.length - a.text.length);
  if (!fallback)
    throw new ValidationError(`Paragraph ${model.id} has no text to copy a style from.`);
  return parseMarkup(cleaned).map(({ text: segment, bold, italic }) => {
    const match =
      model.runs.find((run) => run.font.bold === bold && run.font.italic === italic) ?? fallback;
    return { ...match, font: { ...match.font, bold, italic }, text: segment };
  });
}

export function applyEdits(layout: ResumeLayout, edits: readonly ParagraphEdit[]): ResumeLayout {
  const byId = new Map(layout.paragraphs.map((paragraph) => [paragraph.id, paragraph]));
  const find = (id: string) => {
    const paragraph = byId.get(id);
    if (!paragraph) throw new ValidationError(`Unknown paragraph "${id}" in the base résumé.`);
    return paragraph;
  };

  const replaced = new Map<string, Paragraph>();
  const deleted = new Set<string>();
  const inserted = new Map<string, Paragraph[]>();

  for (const edit of edits) {
    if (edit.op === 'replace') {
      const original = find(edit.id);
      replaced.set(edit.id, { ...original, runs: restyle(original, edit.text) });
    } else if (edit.op === 'delete') {
      find(edit.id);
      deleted.add(edit.id);
    } else {
      find(edit.after);
      const model = find(edit.like ?? edit.after);
      const siblings = inserted.get(edit.after) ?? [];
      siblings.push({
        ...model,
        id: `${edit.after}.${siblings.length + 1}`,
        runs: restyle(model, edit.text),
      });
      inserted.set(edit.after, siblings);
    }
  }

  return {
    ...layout,
    paragraphs: layout.paragraphs.flatMap((paragraph) => [
      ...(deleted.has(paragraph.id) ? [] : [replaced.get(paragraph.id) ?? paragraph]),
      ...(inserted.get(paragraph.id) ?? []),
    ]),
  };
}
