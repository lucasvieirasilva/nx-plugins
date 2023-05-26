import { toCapitalizedCamelCase } from './to-capitalized-camel-case';

describe('toCapitalizedCamelCase', () => {
  it('should convert a single word to capitalized camelCase', () => {
    const input = 'HELLO';
    const output = toCapitalizedCamelCase(input);
    expect(output).toEqual('Hello');
  });

  it('should convert multiple words to capitalized camelCase', () => {
    const input = 'some-example_string to Be-converted';
    const output = toCapitalizedCamelCase(input);
    expect(output).toEqual('SomeExampleStringToBeConverted');
  });

  it('should handle multiple words with multiple spaces', () => {
    const input = 'some   example   string   to   Be    converted';
    const output = toCapitalizedCamelCase(input);
    expect(output).toEqual('SomeExampleStringToBeConverted');
  });

  it('should not convert when the input is already camelCase', () => {
    const input = 'SomeExampleStringToBeConverted';
    const output = toCapitalizedCamelCase(input);
    expect(output).toEqual(input);
  });

  it('should handle partial camelCase', () => {
    const input = 'some example string ToBeConverted';
    const output = toCapitalizedCamelCase(input);
    expect(output).toEqual('SomeExampleStringToBeConverted');
  });

  it('should handle empty string input', () => {
    const input = '';
    const output = toCapitalizedCamelCase(input);
    expect(output).toEqual('');
  });
});
