import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getPoetryLockGraph } from './lock-graph';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '__fixtures__', name), 'utf-8');

describe('getPoetryLockGraph', () => {
  describe('each project locked on its own', () => {
    const graph = getPoetryLockGraph(
      [
        {
          path: 'apps/app1/poetry.lock',
          text: fixture('project-app1.poetry.lock'),
        },
        {
          path: 'libs/lib1/poetry.lock',
          text: fixture('project-lib1.poetry.lock'),
        },
      ],
      false,
    );

    it('should make a project depend on everything its own lock pins', () => {
      expect(graph.members).toStrictEqual({
        'apps/app1': {
          lockFile: 'apps/app1/poetry.lock',
          dependencies: [
            'pypi:certifi',
            'pypi:charset-normalizer',
            'pypi:idna',
            'pypi:iniconfig',
            'pypi:pysocks',
            'pypi:requests',
            'pypi:urllib3',
          ],
        },
        'libs/lib1': {
          lockFile: 'libs/lib1/poetry.lock',
          dependencies: ['pypi:idna'],
        },
      });
    });

    it('should add one node for a package two locks pin identically, and none for local projects', () => {
      expect(Object.keys(graph.externalNodes).sort()).toStrictEqual([
        'pypi:certifi',
        'pypi:charset-normalizer',
        'pypi:idna',
        'pypi:iniconfig',
        'pypi:pysocks',
        'pypi:requests',
        'pypi:urllib3',
      ]);
      expect(graph.externalNodes['pypi:idna'].data).toStrictEqual({
        version: '3.20',
        packageName: 'idna',
        hash: expect.any(String),
      });
    });

    it('should name each version when locks pin a package differently', () => {
      const older = fixture('project-lib1.poetry.lock').replace(
        'version = "3.20"',
        'version = "3.19"',
      );
      const { externalNodes, members } = getPoetryLockGraph(
        [
          {
            path: 'apps/app1/poetry.lock',
            text: fixture('project-app1.poetry.lock'),
          },
          { path: 'libs/lib1/poetry.lock', text: older },
        ],
        false,
      );

      expect(Object.keys(externalNodes)).toEqual(
        expect.arrayContaining(['pypi:idna@3.20', 'pypi:idna@3.19']),
      );
      expect(members['libs/lib1'].dependencies).toStrictEqual([
        'pypi:idna@3.19',
      ]);
    });
  });

  describe('one lock shared by the workspace', () => {
    const graph = getPoetryLockGraph(
      [{ path: 'poetry.lock', text: fixture('shared.poetry.lock') }],
      true,
    );

    it('should make a member depend on what its entry reaches, through extras and other members', () => {
      expect(graph.members).toStrictEqual({
        'apps/app1': {
          lockFile: 'poetry.lock',
          dependencies: [
            'pypi:certifi',
            'pypi:charset-normalizer',
            'pypi:idna',
            'pypi:pysocks',
            'pypi:requests',
            'pypi:urllib3',
          ],
        },
        'libs/lib1': {
          lockFile: 'poetry.lock',
          dependencies: ['pypi:idna'],
        },
      });
    });

    it("should leave the root's own dev group out of every member", () => {
      expect(graph.externalNodes).toHaveProperty('pypi:pluggy');
      for (const member of Object.values(graph.members)) {
        expect(member.dependencies).not.toContain('pypi:pluggy');
      }
    });

    it('should change only the hash of the package that changed', () => {
      const text = fixture('shared.poetry.lock');
      const hash = /name = "urllib3"[\s\S]*?hash = "sha256:([0-9a-f]+)"/.exec(
        text,
      )[1];
      const after = getPoetryLockGraph(
        [{ path: 'poetry.lock', text: text.replace(hash, '0'.repeat(64)) }],
        true,
      ).externalNodes;

      const changed = Object.keys(graph.externalNodes).filter(
        (name) => graph.externalNodes[name].data.hash !== after[name].data.hash,
      );
      expect(changed).toStrictEqual(['pypi:urllib3']);
    });
  });
});
