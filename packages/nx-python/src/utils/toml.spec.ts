import { sortPreservingInsert, sortPreservingSet } from './toml';

describe('sortPreservingInsert', () => {
  it('should insert into empty array', async () => {
    const a = [];
    sortPreservingInsert(a, 'foo');
    expect(a).toEqual(['foo']);
  });
  it('should append to non-sorted array', async () => {
    const a = ['z', 'a'];
    sortPreservingInsert(a, 'foo');
    expect(a).toEqual(['z', 'a', 'foo']);
  });
  it('should insert into sorted array preserving order', async () => {
    const a = ['a', 'z'];
    sortPreservingInsert(a, 'foo');
    expect(a).toEqual(['a', 'foo', 'z']);
  });
});

describe('sortPreservingSet', () => {
  it('should set in empty object', async () => {
    const o: Record<string, string> = {};
    sortPreservingSet(o, 'foo', 'bar');
    expect(o).toEqual({ foo: 'bar' });
  });
  it('should set in non-sorted object', async () => {
    const o: Record<string, string> = { z: 'z', a: 'a' };
    sortPreservingSet(o, 'foo', 'bar');
    expect(Object.entries(o)).toEqual([
      ['z', 'z'],
      ['a', 'a'],
      ['foo', 'bar'],
    ]);
  });
  it('should set in sorted object preserving order', async () => {
    const o: Record<string, string> = { a: 'a', z: 'z' };
    sortPreservingSet(o, 'foo', 'bar');
    expect(Object.entries(o)).toEqual([
      ['a', 'a'],
      ['foo', 'bar'],
      ['z', 'z'],
    ]);
  });
  it('should set existing key in sorted object preserving order', async () => {
    const o: Record<string, string> = { a: 'a', b: 'b', c: 'c' };
    sortPreservingSet(o, 'b', 'B');
    expect(Object.entries(o)).toEqual([
      ['a', 'a'],
      ['b', 'B'],
      ['c', 'c'],
    ]);
  });
});
