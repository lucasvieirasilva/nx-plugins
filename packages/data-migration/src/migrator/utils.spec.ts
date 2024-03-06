import 'aws-sdk-client-mock-jest';
import { mockClient } from 'aws-sdk-client-mock';
import { resolveConfigParam } from './utils';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

describe('resolveConfigParam', () => {
  it('should resolve plain value', async () => {
    const value = 'plain-value';
    const param = { value };
    const result = await resolveConfigParam(param);
    expect(result).toEqual(value);
  });

  it('should resolve ssm value', async () => {
    const paramName = 'ssm-param-name';
    const value = 'ssm-value';

    const ssmMock = mockClient(SSMClient);
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: value } });

    const result = await resolveConfigParam({ value: paramName, type: 'ssm' });
    expect(result).toEqual(value);
    expect(ssmMock).toHaveReceivedCommandWith(GetParameterCommand, {
      Name: paramName,
      WithDecryption: false,
    });
  });

  it('should throw error for unknown type', async () => {
    const value = 'ssm-value';
    await expect(
      resolveConfigParam({ value, type: 'unknown' } as never),
    ).rejects.toThrow('Unknown config param type: unknown');
  });
});
