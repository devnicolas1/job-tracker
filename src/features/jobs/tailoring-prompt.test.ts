import { describe, expect, it } from 'vitest';

import { tailoringPrompt } from './tailoring-prompt';

describe('tailoringPrompt', () => {
  it('invokes the tailor-resume skill with the job id', () => {
    expect(tailoringPrompt('Fn_fog-hkJc')).toBe('Use the tailor-resume skill for job Fn_fog-hkJc');
  });
});
