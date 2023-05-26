import { chunks, chunksLastBatch } from './chunks';

describe('chunks', () => {
  it('should iterate over chunks', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const size = 3;
    const expected = [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]];
    const actual = [...chunks(arr, size)];
    expect(actual).toEqual(expected);
  });
});

describe('chunksLastBatch', () => {
  it('should iterate over chunks', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const size = 3;
    const expected = [
      { items: [1, 2, 3], lastBatch: false },
      { items: [4, 5, 6], lastBatch: false },
      { items: [7, 8, 9], lastBatch: false },
      { items: [10], lastBatch: true },
    ];
    const actual = [...chunksLastBatch(arr, size)];
    expect(actual).toEqual(expected);
  });

  it('should iterate over chunks', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const size = 5;
    const expected = [
      { items: [1, 2, 3, 4, 5], lastBatch: false },
      { items: [6, 7, 8, 9, 10], lastBatch: true },
    ];
    const actual = [...chunksLastBatch(arr, size)];
    expect(actual).toEqual(expected);
  });
});
