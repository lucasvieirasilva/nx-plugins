import { extractBooleanFlag } from './args';

describe('extractBooleanFlag', () => {
  it('should return undefined when flag is not present', () => {
    const unparsed = ['--other', 'value'];
    expect(extractBooleanFlag(unparsed, '--fix')).toBeUndefined();
    expect(unparsed).toEqual(['--other', 'value']);
  });

  it('should return true when flag is present without a value', () => {
    const unparsed = ['--fix'];
    expect(extractBooleanFlag(unparsed, '--fix')).toBe(true);
    expect(unparsed).toEqual([]);
  });

  it('should return true when flag is followed by true', () => {
    const unparsed = ['--fix', 'true'];
    expect(extractBooleanFlag(unparsed, '--fix')).toBe(true);
    expect(unparsed).toEqual([]);
  });

  it('should return true when flag is followed by True (case-insensitive)', () => {
    const unparsed = ['--fix', 'True'];
    expect(extractBooleanFlag(unparsed, '--fix')).toBe(true);
    expect(unparsed).toEqual([]);
  });

  it('should return false when flag is followed by false', () => {
    const unparsed = ['--fix', 'false'];
    expect(extractBooleanFlag(unparsed, '--fix')).toBe(false);
    expect(unparsed).toEqual([]);
  });

  it('should return true when flag is followed by a non-boolean value', () => {
    const unparsed = ['--fix', '--other'];
    expect(extractBooleanFlag(unparsed, '--fix')).toBe(true);
    expect(unparsed).toEqual(['--other']);
  });

  it('should only remove the matched flag and leave other args intact', () => {
    const unparsed = ['--other', '--fix', 'true', '--verbose'];
    expect(extractBooleanFlag(unparsed, '--fix')).toBe(true);
    expect(unparsed).toEqual(['--other', '--verbose']);
  });
});
