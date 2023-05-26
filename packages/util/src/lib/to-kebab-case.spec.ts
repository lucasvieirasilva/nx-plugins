import { toKebabCase } from './to-kebab-case';

describe('toKebabCase', () => {
  it('should convert string to kebab case', () => {
    expect(toKebabCase('Hello World')).toEqual('hello-world');
    expect(toKebabCase('Hello World!')).toEqual('hello-world');
    expect(toKebabCase('123 Hello World')).toEqual('123-hello-world');
    expect(toKebabCase('Hello World 123')).toEqual('hello-world-123');
    expect(toKebabCase('  Hello World  ')).toEqual('hello-world');
    expect(toKebabCase(' Hello World')).toEqual('hello-world');
    expect(toKebabCase('Hello World ')).toEqual('hello-world');
  });
});
