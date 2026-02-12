/**
 * Extracts a boolean flag from the unparsed args array.
 *
 * Handles three forms:
 *   --flag          → true
 *   --flag true     → true
 *   --flag false    → false
 *
 * Mutates the unparsed array by removing the matched entries.
 * Returns the resolved boolean value, or undefined if the flag was not found.
 */
export function extractBooleanFlag(
  unparsed: string[],
  flag: string,
): boolean | undefined {
  const index = unparsed.findIndex((item) => item.trim() === flag);

  if (index === -1) {
    return undefined;
  }

  const nextArg = unparsed[index + 1]?.toLowerCase()?.trim();
  if (nextArg === 'true' || nextArg === 'false') {
    const deleted = unparsed.splice(index, 2);
    return deleted[1]?.toLowerCase() === 'true';
  }

  unparsed.splice(index, 1);
  return true;
}
