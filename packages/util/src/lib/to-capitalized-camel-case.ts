import * as _ from 'lodash';

export function toCapitalizedCamelCase(str: string): string {
  const camelCase = _.camelCase(str);
  return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
}
