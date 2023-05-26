import { camelCaseToTitle } from './camel-case-to-title';

describe('camelCaseToTitle', () => {
  it('should convert camel case string to title format', () => {
    expect(camelCaseToTitle('camelCase')).toEqual('Camel Case');
    expect(camelCaseToTitle('camelCaseString')).toEqual('Camel Case String');
    expect(camelCaseToTitle('camel')).toEqual('Camel');
    expect(camelCaseToTitle('camelCaseStringWithNumbers123')).toEqual(
      'Camel Case String With Numbers123'
    );
  });
});
