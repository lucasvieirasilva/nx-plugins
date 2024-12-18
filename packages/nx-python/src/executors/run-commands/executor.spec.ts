import { vi } from 'vitest';
import { vol } from 'memfs';
import '../../utils/mocks/fs.mock';
vi.mock('nx/src/executors/run-commands/run-commands.impl');
vi.mock('../../provider/poetry/utils');

import executor from './executor';
import { ExecutorContext } from '@nx/devkit';
import dedent from 'string-dedent';

describe('run commands executor', () => {
  const originalEnv = process.env;

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

  afterEach(() => {
    vol.reset();
  });

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

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

  describe('uv', () => {
    describe('workspace', () => {
      beforeEach(() => {
        vol.fromJSON({
          'uv.lock': '',
        });
      });

      it('should activate the venv and call the base executor', async () => {
        const options = {
          command: 'test',
          __unparsed__: [],
        };
        await executor(options, context);

        expect(
          (await import('nx/src/executors/run-commands/run-commands.impl'))
            .default,
        ).toHaveBeenCalledWith(options, context);

        expect(process.env.PATH).toContain(`${process.cwd()}/.venv/bin`);
      });
    });

    describe('project', () => {
      beforeEach(() => {
        vol.fromJSON({
          'apps/app/pyproject.toml': dedent`
          [project]
          name = "app"
          version = "0.1.0"
          readme = "README.md"
          requires-python = ">=3.12"
          dependencies = []
          `,
        });
      });

      it('should activate the venv and call the base executor', async () => {
        const options = {
          command: 'test',
          __unparsed__: [],
        };
        await executor(options, context);

        expect(
          (await import('nx/src/executors/run-commands/run-commands.impl'))
            .default,
        ).toHaveBeenCalledWith(options, context);

        expect(process.env.PATH).toContain(
          `${process.cwd()}/apps/app/.venv/bin`,
        );
      });
    });
  });
});
