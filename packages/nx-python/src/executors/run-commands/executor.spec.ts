import { vi } from 'vitest';

vi.mock('nx/src/executors/run-commands/run-commands.impl');
vi.mock('../../provider/poetry/utils');

import executor from './executor';
import { ExecutorContext } from '@nx/devkit';

describe('run commands executor', () => {
  const context: ExecutorContext = {
    cwd: '',
    root: '.',
    isVerbose: false,
    projectName: 'app',
    projectsConfigurations: {
      version: 2,
      projects: {
        app: {
          root: 'apps/app',
          targets: {},
        },
      },
    },
    nxJsonConfiguration: {},
    projectGraph: {
      dependencies: {},
      nodes: {},
    },
  };

  describe('poetry', () => {
    it('should activate the venv and call the base executor', async () => {
      const options = {
        command: 'test',
        __unparsed__: [],
      };
      await executor(options, context);

      expect(
        (await import('../../provider/poetry/utils')).activateVenv,
      ).toHaveBeenCalledWith(context.root);
      expect(
        (await import('nx/src/executors/run-commands/run-commands.impl'))
          .default,
      ).toHaveBeenCalledWith(options, context);
    });
  });
});
