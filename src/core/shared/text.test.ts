import { describe, expect, it } from 'vitest';

import { detectLanguage, htmlToText, truncate } from './text';

describe('htmlToText', () => {
  it('keeps paragraphs and list items, drops tags and decodes entities', () => {
    const text = htmlToText(
      '<p>Hello &amp; welcome</p><p><br></p><ul><li>One</li><li>Two</li></ul>',
    );
    expect(text).toBe('Hello & welcome\n\n- One\n- Two');
  });
});

describe('truncate', () => {
  it('leaves short text untouched', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('cuts on a word boundary and marks the cut', () => {
    expect(truncate('the quick brown fox jumps', 15)).toBe('the quick brown […]');
  });
});

describe('detectLanguage', () => {
  it.each([
    [
      'We are looking for an engineer with experience in TypeScript and you will work with our team',
      'en',
    ],
    [
      'Buscamos uma pessoa com experiência em TypeScript para trabalhar com a nossa equipe de que você',
      'pt',
    ],
  ] as const)('detects %#', (text, language) => {
    expect(detectLanguage(text)).toBe(language);
  });

  it('abstains on text without enough signal', () => {
    expect(detectLanguage('TypeScript React Node.js')).toBeUndefined();
  });
});
