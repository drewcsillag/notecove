/**
 * ActivityLogPreview Component Tests
 */

import { parseActivityLog, parseActivityLogFilename } from '../ActivityLogPreview';

describe('parseActivityLog', () => {
  it('parses valid activity log lines', () => {
    const content = 'note123|profile456|42\nnote789|profileABC|100\n';
    const result = parseActivityLog(content);

    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toEqual({
      noteId: 'note123',
      profileId: 'profile456',
      sequenceNumber: 42,
      lineNumber: 1,
    });
    expect(result.entries[1]).toEqual({
      noteId: 'note789',
      profileId: 'profileABC',
      sequenceNumber: 100,
      lineNumber: 2,
    });
  });

  it('handles empty content', () => {
    const result = parseActivityLog('');
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(0);
  });

  it('handles content with only whitespace lines', () => {
    const result = parseActivityLog('\n\n  \n');
    expect(result.success).toBe(true);
    expect(result.entries).toHaveLength(0);
  });

  it('fails on malformed lines (wrong field count)', () => {
    const content = 'note123|profile456|42\nmalformed_line\nnote789|profileABC|100\n';
    const result = parseActivityLog(content);

    expect(result.success).toBe(false);
    expect(result.error).toContain('line 2');
  });

  it('fails on non-numeric sequence number', () => {
    const content = 'note123|profile456|notanumber\n';
    const result = parseActivityLog(content);

    expect(result.success).toBe(false);
    expect(result.error).toContain('line 1');
  });

  it('handles lines with trailing whitespace', () => {
    const content = 'note123|profile456|42  \n';
    const result = parseActivityLog(content);

    expect(result.success).toBe(true);
    expect(result.entries[0]?.sequenceNumber).toBe(42);
  });

  it('handles legacy underscore delimiter format', () => {
    // Legacy format: noteId_profileId_sequenceNumber
    const content = 'note123_profile456_42\n';
    const result = parseActivityLog(content);

    expect(result.success).toBe(true);
    expect(result.entries[0]).toEqual({
      noteId: 'note123',
      profileId: 'profile456',
      sequenceNumber: 42,
      lineNumber: 1,
    });
  });
});

describe('parseActivityLogFilename', () => {
  it('parses new format: profileId.instanceId.log', () => {
    const result = parseActivityLogFilename('abc123.xyz789.log');

    expect(result).toEqual({
      profileId: 'abc123',
      instanceId: 'xyz789',
    });
  });

  it('parses legacy format: instanceId.log', () => {
    const result = parseActivityLogFilename('instance123.log');

    expect(result).toEqual({
      profileId: null,
      instanceId: 'instance123',
    });
  });

  it('handles complex profileId with underscores (base64url)', () => {
    // profileId can contain underscores in base64url alphabet
    const result = parseActivityLogFilename('profile_with_underscores.instance123.log');

    expect(result).toEqual({
      profileId: 'profile_with_underscores',
      instanceId: 'instance123',
    });
  });

  it('returns null for invalid filename', () => {
    const result = parseActivityLogFilename('notavalidfile.txt');
    expect(result).toBeNull();
  });

  it('returns null for empty filename', () => {
    const result = parseActivityLogFilename('');
    expect(result).toBeNull();
  });
});
