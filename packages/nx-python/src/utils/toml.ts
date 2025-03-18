/**
 * This file contains utility functions for manipulating the (parsed) contents
 * of TOML files.
 */

/**
 * Insert `s` into `array`, preserving order if `array` is sorted.
 */
export function sortPreservingInsert(array: string[], s: string) {
  const sorted = isSorted(array);
  array.push(s);
  if (sorted) {
    array.sort();
  }
}

/**
 * Set `obj[key]` to `value`.
 *
 * If the iteration order of `obj`'s keys is sorted, this operation will
 * preserve that sorted order (by deleting and re-setting existing keys as
 * necessary).
 */
export function sortPreservingSet<T extends object, K extends string & keyof T>(
  obj: T,
  key: K,
  value: T[K],
) {
  const keys = Object.keys(obj);
  if (!isSorted(keys) || keys.indexOf(key) !== -1) {
    obj[key] = value;
    return;
  }

  keys.push(key);
  keys.sort();

  obj[key] = value;

  for (const k of keys.slice(keys.indexOf(key) + 1)) {
    const v = obj[k];
    delete obj[k];
    obj[k] = v;
  }
}

function isSorted(array: string[]) {
  return array.slice(1).every((s, idx) => array[idx] <= s);
}
