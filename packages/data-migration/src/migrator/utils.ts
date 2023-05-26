import { RemoteConfigParam } from './migration';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});

export const resolveConfigParam = async (
  param: RemoteConfigParam
): Promise<string> => {
  const type = param.type || 'plain';

  switch (type) {
    case 'plain':
      return param.value;
    case 'ssm':
      // eslint-disable-next-line no-case-declarations
      const {
        Parameter: { Value },
      } = await ssm.send(
        new GetParameterCommand({
          Name: param.value,
          WithDecryption: param.decrypt || false,
        })
      );

      return Value;
    default:
      throw new Error(`Unknown config param type: ${type}`);
  }
};
