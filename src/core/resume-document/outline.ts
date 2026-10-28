import { toMarkup } from './markup';
import type { ResumeLayout } from './model';
import { TAB } from './segment';

/**
 * The base résumé as the agent sees it: one line per paragraph, `[id]` first, bullets shown with
 * their marker, emphasis as markup. Styles are not shown because they cannot be changed.
 */
export function toOutline(layout: ResumeLayout): string {
  return layout.paragraphs
    .map((paragraph) => {
      const text = toMarkup(paragraph.runs).replaceAll(TAB, '<tab>');
      return `[${paragraph.id}] ${paragraph.marker ? `${paragraph.marker.text} ` : ''}${text}`;
    })
    .join('\n');
}
