export function* chunks<T>(arr: T[], size: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) {
    yield arr.slice(i, i + size);
  }
}

export function* chunksLastBatch<T>(
  arr: T[],
  size: number
): Generator<{ items: T[]; lastBatch: boolean }> {
  for (let i = 0; i < arr.length; i += size) {
    yield { items: arr.slice(i, i + size), lastBatch: i + size >= arr.length };
  }
}
