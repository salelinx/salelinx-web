// The marketing email answer is read from user-writable auth metadata, and
// "not asked yet" has to stay distinguishable from both answers: it is what
// makes the prompt appear.
import { describe, expect, it } from 'vitest';
import {
  isMarketingPromptExempt,
  marketingChoice,
  marketingChoiceMetadata,
} from '@/lib/marketing-choice';

describe('marketingChoice', () => {
  it('reads both answers', () => {
    expect(marketingChoice({ marketing_opt_out: true })).toBe('no');
    expect(marketingChoice({ marketing_opt_out: false })).toBe('yes');
  });

  it('treats a missing or malformed value as not asked', () => {
    expect(marketingChoice({})).toBeNull();
    expect(marketingChoice(null)).toBeNull();
    expect(marketingChoice(undefined)).toBeNull();
    expect(marketingChoice({ marketing_opt_out: 'true' })).toBeNull();
  });

  it('round-trips through the metadata it writes', () => {
    const at = new Date('2026-10-05T10:00:00.000Z');
    expect(marketingChoiceMetadata(true, at)).toEqual({
      marketing_opt_out: false,
      marketing_choice_at: '2026-10-05T10:00:00.000Z',
    });
    expect(marketingChoice(marketingChoiceMetadata(true))).toBe('yes');
    expect(marketingChoice(marketingChoiceMetadata(false))).toBe('no');
  });
});

describe('isMarketingPromptExempt', () => {
  it('stays off the legal pages and the auth flows', () => {
    expect(isMarketingPromptExempt('/legal/privacy')).toBe(true);
    expect(isMarketingPromptExempt('/auth/reset-password')).toBe(true);
    expect(isMarketingPromptExempt('/auth/mfa')).toBe(true);
  });

  it('asks everywhere else', () => {
    expect(isMarketingPromptExempt('/')).toBe(false);
    expect(isMarketingPromptExempt('/account')).toBe(false);
    expect(isMarketingPromptExempt('/authors')).toBe(false);
  });
});
