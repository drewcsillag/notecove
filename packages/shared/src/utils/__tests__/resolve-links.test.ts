/**
 * Link Resolution Tests
 *
 * Tests for resolving [[uuid]] links to [[title]] in text.
 */

import { resolveLinks, type NoteTitleResolver } from '../resolve-links';

describe('resolveLinks', () => {
  // Mock resolver that returns predictable titles
  const mockResolver: NoteTitleResolver = async (noteId: string) => {
    const titles: Record<string, string | null> = {
      '550e8400-e29b-41d4-a716-446655440000': 'My First Note',
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890': 'Another Note',
      'd7fb06b1-8a33-44b8-bf4d-b067f4ed43c5': 'Welcome to NoteCove',
      'deadbeef-dead-beef-dead-beefdeadbeef': null, // Deleted/non-existent
    };
    return titles[noteId] ?? null;
  };

  it('should resolve a single link to note title', async () => {
    const text = 'Check out [[550e8400-e29b-41d4-a716-446655440000]]';
    const result = await resolveLinks(text, mockResolver);
    expect(result).toBe('Check out [[My First Note]]');
  });

  it('should resolve multiple links', async () => {
    const text =
      'See [[550e8400-e29b-41d4-a716-446655440000]] and [[a1b2c3d4-e5f6-7890-abcd-ef1234567890]]';
    const result = await resolveLinks(text, mockResolver);
    expect(result).toBe('See [[My First Note]] and [[Another Note]]');
  });

  it('should handle broken links (deleted/non-existent notes)', async () => {
    const text = 'This links to [[deadbeef-dead-beef-dead-beefdeadbeef]]';
    const result = await resolveLinks(text, mockResolver);
    expect(result).toBe('This links to [[deleted note]]');
  });

  it('should handle text with no links', async () => {
    const text = 'Plain text with no links';
    const result = await resolveLinks(text, mockResolver);
    expect(result).toBe('Plain text with no links');
  });

  it('should handle empty text', async () => {
    const text = '';
    const result = await resolveLinks(text, mockResolver);
    expect(result).toBe('');
  });

  it('should handle same link appearing multiple times', async () => {
    const text =
      '[[550e8400-e29b-41d4-a716-446655440000]] is linked again: [[550e8400-e29b-41d4-a716-446655440000]]';
    const result = await resolveLinks(text, mockResolver);
    expect(result).toBe('[[My First Note]] is linked again: [[My First Note]]');
  });

  it('should handle links at start and end of text', async () => {
    const text = '[[550e8400-e29b-41d4-a716-446655440000]]';
    const result = await resolveLinks(text, mockResolver);
    expect(result).toBe('[[My First Note]]');
  });

  it('should preserve surrounding text and punctuation', async () => {
    const text = 'Read "[[550e8400-e29b-41d4-a716-446655440000]]" for more info.';
    const result = await resolveLinks(text, mockResolver);
    expect(result).toBe('Read "[[My First Note]]" for more info.');
  });

  it('should handle multiline text with links', async () => {
    const text = 'First line [[550e8400-e29b-41d4-a716-446655440000]]\nSecond line';
    const result = await resolveLinks(text, mockResolver);
    expect(result).toBe('First line [[My First Note]]\nSecond line');
  });

  it('should not recurse into resolved titles (one level deep)', async () => {
    // Even if "My First Note" contains [[uuid]], we don't resolve it
    // This test verifies we only do one level of resolution
    const resolver: NoteTitleResolver = async (noteId: string) => {
      if (noteId === '550e8400-e29b-41d4-a716-446655440000') {
        // This title itself contains a link - we should NOT resolve it
        return 'Note with [[a1b2c3d4-e5f6-7890-abcd-ef1234567890]] inside';
      }
      return null;
    };

    const text = 'See [[550e8400-e29b-41d4-a716-446655440000]]';
    const result = await resolveLinks(text, resolver);
    // The inner link should remain as-is (one level deep)
    expect(result).toBe('See [[Note with [[a1b2c3d4-e5f6-7890-abcd-ef1234567890]] inside]]');
  });

  it('should handle case insensitive UUID matching', async () => {
    // UUIDs might be stored in different cases
    const text = 'Check [[550E8400-E29B-41D4-A716-446655440000]]';
    const result = await resolveLinks(text, mockResolver);
    expect(result).toBe('Check [[My First Note]]');
  });

  it('should handle null/undefined input', async () => {
    expect(await resolveLinks(null as unknown as string, mockResolver)).toBe('');
    expect(await resolveLinks(undefined as unknown as string, mockResolver)).toBe('');
  });
});
