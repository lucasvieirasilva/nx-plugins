import { vi } from 'vitest';

const originalExit = process.exit;
let stubProcessExit = false;

const processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code) => {
  if (stubProcessExit) {
    return undefined as never;
  }
  return originalExit(code);
});

const enquirerMocks = vi.hoisted(() => {
  const mocks = {
    prompt: vi.fn(),
  };

  void mock('enquirer', mocks);
  return mocks;
});

import { output, ProjectGraph, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createPoetryWorkspaceWithPackageDependencies } from './test-utils/create-poetry-workspace-with-package-dependencies';
import { createUvWorkspaceWithPackageDependencies } from './test-utils/create-uv-workspace-with-package-dependencies';
import { releaseVersionGenerator } from './release-version';
import { ReleaseGroupWithName } from 'nx/src/command-line/release/config/filter-release-groups';
import { readPyprojectToml } from '../../provider/utils';
import { PoetryPyprojectToml } from '../../provider/poetry/types';
import { UVPyprojectToml } from '../../provider/uv/types';
import { PoetryProvider } from '../../provider/poetry';
import { PythonReleaseVersionGeneratorSchema } from './schema';

process.env.NX_DAEMON = 'false';

describe('release-version', () => {
  let tree: Tree;
  let projectGraph: ProjectGraph;

  describe('poetry', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();

      projectGraph = createPoetryWorkspaceWithPackageDependencies(tree, {
        'my-lib': {
          projectRoot: 'libs/my-lib',
          packageName: 'my-lib',
          version: '0.0.1',
          pyprojectTomlPath: 'libs/my-lib/pyproject.toml',
          localDependencies: [],
        },
        'project-with-dependency-on-my-pkg': {
          projectRoot: 'libs/project-with-dependency-on-my-pkg',
          packageName: 'project-with-dependency-on-my-pkg',
          version: '0.0.1',
          pyprojectTomlPath:
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          localDependencies: [
            {
              projectName: 'my-lib',
              dependencyCollection: 'dependencies',
            },
          ],
        },
        'project-with-devDependency-on-my-pkg': {
          projectRoot: 'libs/project-with-devDependency-on-my-pkg',
          packageName: 'project-with-devDependency-on-my-pkg',
          version: '0.0.1',
          pyprojectTomlPath:
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          localDependencies: [
            {
              projectName: 'my-lib',
              dependencyCollection: 'dev',
            },
          ],
        },
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return a versionData object', async () => {
      expect(
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'major',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        }),
      ).toMatchInlineSnapshot(`
      {
        "callback": [Function],
        "data": {
          "my-lib": {
            "currentVersion": "0.0.1",
            "dependentProjects": [
              {
                "dependencyCollection": "dependencies",
                "groupKey": undefined,
                "rawVersionSpec": "0.0.1",
                "source": "project-with-dependency-on-my-pkg",
                "target": "my-lib",
                "type": "static",
              },
              {
                "dependencyCollection": "devDependencies",
                "groupKey": undefined,
                "rawVersionSpec": "0.0.1",
                "source": "project-with-devDependency-on-my-pkg",
                "target": "my-lib",
                "type": "static",
              },
            ],
            "newVersion": "1.0.0",
          },
          "project-with-dependency-on-my-pkg": {
            "currentVersion": "0.0.1",
            "dependentProjects": [],
            "newVersion": "1.0.0",
          },
          "project-with-devDependency-on-my-pkg": {
            "currentVersion": "0.0.1",
            "dependentProjects": [],
            "newVersion": "1.0.0",
          },
        },
      }
    `);
    });

    it('should not update the lock file if skipLockFileUpdate is true', async () => {
      const generatorOptions: PythonReleaseVersionGeneratorSchema = {
        projects: Object.values(projectGraph.nodes), // version all projects
        projectGraph,
        specifier: 'major',
        currentVersionResolver: 'disk',
        releaseGroup: createReleaseGroup('fixed'),
        skipLockFileUpdate: true,
      };
      const { callback, data } = await releaseVersionGenerator(
        tree,
        generatorOptions,
      );

      expect(data).toEqual({
        'my-lib': {
          currentVersion: '0.0.1',
          dependentProjects: [
            {
              dependencyCollection: 'dependencies',
              rawVersionSpec: '0.0.1',
              source: 'project-with-dependency-on-my-pkg',
              target: 'my-lib',
              type: 'static',
            },
            {
              dependencyCollection: 'devDependencies',
              rawVersionSpec: '0.0.1',
              source: 'project-with-devDependency-on-my-pkg',
              target: 'my-lib',
              type: 'static',
            },
          ],
          newVersion: '1.0.0',
        },
        'project-with-dependency-on-my-pkg': {
          currentVersion: '0.0.1',
          dependentProjects: [],
          newVersion: '1.0.0',
        },
        'project-with-devDependency-on-my-pkg': {
          currentVersion: '0.0.1',
          dependentProjects: [],
          newVersion: '1.0.0',
        },
      });

      const lockMock = vi
        .spyOn(PoetryProvider.prototype, 'lock')
        .mockResolvedValue();
      await callback(tree, {
        dryRun: false,
        generatorOptions: { ...generatorOptions },
      });

      expect(lockMock).not.toHaveBeenCalled();
    });

    describe('not all given projects have pyproject.toml files', () => {
      beforeEach(() => {
        tree.delete('libs/my-lib/pyproject.toml');
      });

      it(`should exit with code one and print guidance when not all of the given projects are appropriate for Python versioning`, async () => {
        stubProcessExit = true;

        const outputSpy = vi
          .spyOn(output, 'error')
          .mockImplementationOnce(() => {
            return undefined as never;
          });

        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'major',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });

        expect(outputSpy).toHaveBeenCalledWith({
          title: `The project "my-lib" does not have a pyproject.toml available at libs/my-lib/pyproject.toml.

To fix this you will either need to add a pyproject.toml file at that location, or configure "release" within your nx.json to exclude "my-lib" from the current release group, or amend the packageRoot configuration to point to where the pyproject.toml should be.`,
        });

        outputSpy.mockRestore();
        expect(processExitSpy).toHaveBeenCalledWith(1);

        stubProcessExit = false;
      });
    });

    describe('package with mixed "prod" and "dev" dependencies', () => {
      beforeEach(() => {
        projectGraph = createPoetryWorkspaceWithPackageDependencies(tree, {
          'my-app': {
            projectRoot: 'libs/my-app',
            packageName: 'my-app',
            version: '0.0.1',
            pyprojectTomlPath: 'libs/my-app/pyproject.toml',
            localDependencies: [
              {
                projectName: 'my-lib-1',
                dependencyCollection: 'dependencies',
              },
              {
                projectName: 'my-lib-2',
                dependencyCollection: 'dev',
              },
            ],
          },
          'my-lib-1': {
            projectRoot: 'libs/my-lib-1',
            packageName: 'my-lib-1',
            version: '0.0.1',
            pyprojectTomlPath: 'libs/my-lib-1/pyproject.toml',
            localDependencies: [],
          },
          'my-lib-2': {
            projectRoot: 'libs/my-lib-2',
            packageName: 'my-lib-2',
            version: '0.0.1',
            pyprojectTomlPath: 'libs/my-lib-2/pyproject.toml',
            localDependencies: [],
          },
        });
      });

      it('should update local dependencies only where it needs to', async () => {
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'major',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });

        expect(readPyprojectToml(tree, 'libs/my-app/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "dependencies": {
                "my-lib-1": {
                  "develop": true,
                  "path": "../my-lib-1",
                },
              },
              "group": {
                "dev": {
                  "dependencies": {
                    "my-lib-2": {
                      "develop": true,
                      "path": "../my-lib-2",
                    },
                  },
                },
              },
              "name": "my-app",
              "version": "1.0.0",
            },
          },
        }
      `);
      });
    });

    describe('fixed release group', () => {
      it(`should work with semver keywords and exact semver versions`, async () => {
        expect(
          readPyprojectToml<PoetryPyprojectToml>(
            tree,
            'libs/my-lib/pyproject.toml',
          ).tool.poetry.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'major',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });
        expect(
          readPyprojectToml<PoetryPyprojectToml>(
            tree,
            'libs/my-lib/pyproject.toml',
          ).tool.poetry.version,
        ).toEqual('1.0.0');

        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'minor',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });
        expect(
          readPyprojectToml<PoetryPyprojectToml>(
            tree,
            'libs/my-lib/pyproject.toml',
          ).tool.poetry.version,
        ).toEqual('1.1.0');

        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'patch',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });
        expect(
          readPyprojectToml<PoetryPyprojectToml>(
            tree,
            'libs/my-lib/pyproject.toml',
          ).tool.poetry.version,
        ).toEqual('1.1.1');

        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '1.2.3', // exact version
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });
        expect(
          readPyprojectToml<PoetryPyprojectToml>(
            tree,
            'libs/my-lib/pyproject.toml',
          ).tool.poetry.version,
        ).toEqual('1.2.3');
      });

      it(`should apply the updated version to the projects, including updating dependents`, async () => {
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'major',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });

        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "name": "my-lib",
              "version": "1.0.0",
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "dependencies": {
                "my-lib": {
                  "develop": true,
                  "path": "../my-lib",
                },
              },
              "name": "project-with-dependency-on-my-pkg",
              "version": "1.0.0",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                },
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "1.0.0",
            },
          },
        }
      `);
      });
    });

    describe('independent release group', () => {
      describe('specifierSource: prompt', () => {
        it(`should appropriately prompt for each project independently and apply the version updates across all pyproject.toml files`, async () => {
          enquirerMocks.prompt
            // First project will be minor
            .mockResolvedValueOnce({ specifier: 'minor' })
            // Next project will be patch
            .mockResolvedValueOnce({ specifier: 'patch' })
            // Final project will be custom explicit version
            .mockResolvedValueOnce({ specifier: 'custom' })
            .mockResolvedValueOnce({ specifier: '1.2.3' });

          expect(
            readPyprojectToml<PoetryPyprojectToml>(
              tree,
              'libs/my-lib/pyproject.toml',
            ).tool.poetry.version,
          ).toEqual('0.0.1');
          expect(
            readPyprojectToml<PoetryPyprojectToml>(
              tree,
              'libs/project-with-dependency-on-my-pkg/pyproject.toml',
            ).tool.poetry.version,
          ).toEqual('0.0.1');
          expect(
            readPyprojectToml<PoetryPyprojectToml>(
              tree,
              'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
            ).tool.poetry.version,
          ).toEqual('0.0.1');

          await releaseVersionGenerator(tree, {
            projects: Object.values(projectGraph.nodes), // version all projects
            projectGraph,
            specifier: '', // no specifier override set, each individual project will be prompted
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
          });

          expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "name": "my-lib",
                "version": "0.1.0",
              },
            },
          }
        `);

          expect(
            readPyprojectToml(
              tree,
              'libs/project-with-dependency-on-my-pkg/pyproject.toml',
            ),
          ).toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "my-lib": {
                    "develop": true,
                    "path": "../my-lib",
                  },
                },
                "name": "project-with-dependency-on-my-pkg",
                "version": "0.0.2",
              },
            },
          }
        `);
          expect(
            readPyprojectToml(
              tree,
              'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
            ),
          ).toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "group": {
                  "dev": {
                    "dependencies": {
                      "my-lib": {
                        "develop": true,
                        "path": "../my-lib",
                      },
                    },
                  },
                },
                "name": "project-with-devDependency-on-my-pkg",
                "version": "1.2.3",
              },
            },
          }
        `);
        });

        it(`should respect an explicit user CLI specifier for all, even when projects are independent, and apply the version updates across all pyproject.toml files`, async () => {
          expect(
            readPyprojectToml<PoetryPyprojectToml>(
              tree,
              'libs/my-lib/pyproject.toml',
            ).tool.poetry.version,
          ).toEqual('0.0.1');
          expect(
            readPyprojectToml<PoetryPyprojectToml>(
              tree,
              'libs/project-with-dependency-on-my-pkg/pyproject.toml',
            ).tool.poetry.version,
          ).toEqual('0.0.1');
          expect(
            readPyprojectToml<PoetryPyprojectToml>(
              tree,
              'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
            ).tool.poetry.version,
          ).toEqual('0.0.1');

          await releaseVersionGenerator(tree, {
            projects: Object.values(projectGraph.nodes), // version all projects
            projectGraph,
            specifier: '4.5.6', // user CLI specifier override set, no prompting should occur
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
          });

          expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "name": "my-lib",
                "version": "4.5.6",
              },
            },
          }
        `);

          expect(
            readPyprojectToml(
              tree,
              'libs/project-with-dependency-on-my-pkg/pyproject.toml',
            ),
          ).toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "my-lib": {
                    "develop": true,
                    "path": "../my-lib",
                  },
                },
                "name": "project-with-dependency-on-my-pkg",
                "version": "4.5.6",
              },
            },
          }
        `);
          expect(
            readPyprojectToml(
              tree,
              'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
            ),
          ).toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "group": {
                  "dev": {
                    "dependencies": {
                      "my-lib": {
                        "develop": true,
                        "path": "../my-lib",
                      },
                    },
                  },
                },
                "name": "project-with-devDependency-on-my-pkg",
                "version": "4.5.6",
              },
            },
          }
        `);
        });

        describe('updateDependentsOptions', () => {
          it(`should not update dependents when filtering to a subset of projects by default`, async () => {
            expect(
              readPyprojectToml<PoetryPyprojectToml>(
                tree,
                'libs/my-lib/pyproject.toml',
              ).tool.poetry.version,
            ).toEqual('0.0.1');
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-dependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                  "name": "project-with-dependency-on-my-pkg",
                  "version": "0.0.1",
                },
              },
            }
          `);
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "group": {
                    "dev": {
                      "dependencies": {
                        "my-lib": {
                          "develop": true,
                          "path": "../my-lib",
                        },
                      },
                    },
                  },
                  "name": "project-with-devDependency-on-my-pkg",
                  "version": "0.0.1",
                },
              },
            }
          `);

            await releaseVersionGenerator(tree, {
              projects: [projectGraph.nodes['my-lib']], // version only my-lib
              projectGraph,
              specifier: '9.9.9', // user CLI specifier override set, no prompting should occur
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'never',
            });

            expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
              .toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "name": "my-lib",
                  "version": "9.9.9",
                },
              },
            }
          `);

            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-dependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                  "name": "project-with-dependency-on-my-pkg",
                  "version": "0.0.1",
                },
              },
            }
          `);
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "group": {
                    "dev": {
                      "dependencies": {
                        "my-lib": {
                          "develop": true,
                          "path": "../my-lib",
                        },
                      },
                    },
                  },
                  "name": "project-with-devDependency-on-my-pkg",
                  "version": "0.0.1",
                },
              },
            }
          `);
          });

          it(`should not update dependents when filtering to a subset of projects by default, if "updateDependents" is set to "never"`, async () => {
            expect(
              readPyprojectToml<PoetryPyprojectToml>(
                tree,
                'libs/my-lib/pyproject.toml',
              ).tool.poetry.version,
            ).toEqual('0.0.1');
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-dependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                  "name": "project-with-dependency-on-my-pkg",
                  "version": "0.0.1",
                },
              },
            }
          `);
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "group": {
                    "dev": {
                      "dependencies": {
                        "my-lib": {
                          "develop": true,
                          "path": "../my-lib",
                        },
                      },
                    },
                  },
                  "name": "project-with-devDependency-on-my-pkg",
                  "version": "0.0.1",
                },
              },
            }
          `);

            await releaseVersionGenerator(tree, {
              projects: [projectGraph.nodes['my-lib']], // version only my-lib
              projectGraph,
              specifier: '9.9.9', // user CLI specifier override set, no prompting should occur
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'never',
            });

            expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
              .toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "name": "my-lib",
                  "version": "9.9.9",
                },
              },
            }
          `);

            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-dependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                  "name": "project-with-dependency-on-my-pkg",
                  "version": "0.0.1",
                },
              },
            }
          `);
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "group": {
                    "dev": {
                      "dependencies": {
                        "my-lib": {
                          "develop": true,
                          "path": "../my-lib",
                        },
                      },
                    },
                  },
                  "name": "project-with-devDependency-on-my-pkg",
                  "version": "0.0.1",
                },
              },
            }
          `);
          });

          it(`should update dependents even when filtering to a subset of projects which do not include those dependents, if "updateDependents" is "auto"`, async () => {
            expect(
              readPyprojectToml<PoetryPyprojectToml>(
                tree,
                'libs/my-lib/pyproject.toml',
              ).tool.poetry.version,
            ).toEqual('0.0.1');
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-dependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                  "name": "project-with-dependency-on-my-pkg",
                  "version": "0.0.1",
                },
              },
            }
          `);
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "group": {
                    "dev": {
                      "dependencies": {
                        "my-lib": {
                          "develop": true,
                          "path": "../my-lib",
                        },
                      },
                    },
                  },
                  "name": "project-with-devDependency-on-my-pkg",
                  "version": "0.0.1",
                },
              },
            }
          `);

            await releaseVersionGenerator(tree, {
              projects: [projectGraph.nodes['my-lib']], // version only my-lib
              projectGraph,
              specifier: '9.9.9', // user CLI specifier override set, no prompting should occur
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'auto',
            });

            expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
              .toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "name": "my-lib",
                  "version": "9.9.9",
                },
              },
            }
          `);

            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-dependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                  "name": "project-with-dependency-on-my-pkg",
                  "version": "0.0.2",
                },
              },
            }
          `);
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "tool": {
                "poetry": {
                  "group": {
                    "dev": {
                      "dependencies": {
                        "my-lib": {
                          "develop": true,
                          "path": "../my-lib",
                        },
                      },
                    },
                  },
                  "name": "project-with-devDependency-on-my-pkg",
                  "version": "0.0.2",
                },
              },
            }
          `);
          });
        });
      });
    });

    describe('leading v in version', () => {
      it(`should strip a leading v from the provided specifier`, async () => {
        expect(
          readPyprojectToml<PoetryPyprojectToml>(
            tree,
            'libs/my-lib/pyproject.toml',
          ).tool.poetry.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'v8.8.8',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });
        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "name": "my-lib",
              "version": "8.8.8",
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "dependencies": {
                "my-lib": {
                  "develop": true,
                  "path": "../my-lib",
                },
              },
              "name": "project-with-dependency-on-my-pkg",
              "version": "8.8.8",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                },
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "8.8.8",
            },
          },
        }
      `);
      });
    });

    describe('dependent version prefix', () => {
      beforeEach(() => {
        projectGraph = createPoetryWorkspaceWithPackageDependencies(tree, {
          'my-lib': {
            projectRoot: 'libs/my-lib',
            packageName: 'my-lib',
            version: '0.0.1',
            pyprojectTomlPath: 'libs/my-lib/pyproject.toml',
            localDependencies: [],
          },
          'project-with-dependency-on-my-pkg': {
            projectRoot: 'libs/project-with-dependency-on-my-pkg',
            packageName: 'project-with-dependency-on-my-pkg',
            version: '0.0.1',
            pyprojectTomlPath:
              'libs/project-with-dependency-on-my-pkg/pyproject.toml',
            localDependencies: [
              {
                projectName: 'my-lib',
                dependencyCollection: 'dependencies',
              },
            ],
          },
          'project-with-devDependency-on-my-pkg': {
            projectRoot: 'libs/project-with-devDependency-on-my-pkg',
            packageName: 'project-with-devDependency-on-my-pkg',
            version: '0.0.1',
            pyprojectTomlPath:
              'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
            localDependencies: [
              {
                projectName: 'my-lib',
                dependencyCollection: 'dev',
              },
            ],
          },
          'another-project-with-devDependency-on-my-pkg': {
            projectRoot: 'libs/another-project-with-devDependency-on-my-pkg',
            packageName: 'another-project-with-devDependency-on-my-pkg',
            version: '0.0.1',
            pyprojectTomlPath:
              'libs/another-project-with-devDependency-on-my-pkg/pyproject.toml',
            localDependencies: [
              {
                projectName: 'my-lib',
                dependencyCollection: 'dev',
              },
            ],
          },
        });
      });

      it('should work with an empty prefix', async () => {
        expect(
          readPyprojectToml<PoetryPyprojectToml>(
            tree,
            'libs/my-lib/pyproject.toml',
          ).tool.poetry.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '9.9.9',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
          versionPrefix: '',
        });
        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "name": "my-lib",
              "version": "9.9.9",
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "dependencies": {
                "my-lib": {
                  "develop": true,
                  "path": "../my-lib",
                },
              },
              "name": "project-with-dependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                },
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/another-project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                },
              },
              "name": "another-project-with-devDependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
      });

      it('should work with a ^ prefix', async () => {
        expect(
          readPyprojectToml<PoetryPyprojectToml>(
            tree,
            'libs/my-lib/pyproject.toml',
          ).tool.poetry.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '9.9.9',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
          versionPrefix: '^',
        });
        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "name": "my-lib",
              "version": "9.9.9",
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "dependencies": {
                "my-lib": {
                  "develop": true,
                  "path": "../my-lib",
                },
              },
              "name": "project-with-dependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                },
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/another-project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                },
              },
              "name": "another-project-with-devDependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
      });

      it('should work with a ~ prefix', async () => {
        expect(
          readPyprojectToml<PoetryPyprojectToml>(
            tree,
            'libs/my-lib/pyproject.toml',
          ).tool.poetry.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '9.9.9',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
          versionPrefix: '~',
        });
        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "name": "my-lib",
              "version": "9.9.9",
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "dependencies": {
                "my-lib": {
                  "develop": true,
                  "path": "../my-lib",
                },
              },
              "name": "project-with-dependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                },
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/another-project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                },
              },
              "name": "another-project-with-devDependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
      });

      it('should respect any existing prefix when set to "auto"', async () => {
        expect(
          readPyprojectToml<PoetryPyprojectToml>(
            tree,
            'libs/my-lib/pyproject.toml',
          ).tool.poetry.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '9.9.9',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
          versionPrefix: 'auto',
        });
        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "name": "my-lib",
              "version": "9.9.9",
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "dependencies": {
                "my-lib": {
                  "develop": true,
                  "path": "../my-lib",
                },
              },
              "name": "project-with-dependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                },
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/another-project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                },
              },
              "name": "another-project-with-devDependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
      });

      it('should use the behavior of "auto" by default', async () => {
        expect(
          readPyprojectToml<PoetryPyprojectToml>(
            tree,
            'libs/my-lib/pyproject.toml',
          ).tool.poetry.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '9.9.9',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
          versionPrefix: undefined,
        });
        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "name": "my-lib",
              "version": "9.9.9",
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "dependencies": {
                "my-lib": {
                  "develop": true,
                  "path": "../my-lib",
                },
              },
              "name": "project-with-dependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                },
              },
              "name": "project-with-devDependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/another-project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "my-lib": {
                      "develop": true,
                      "path": "../my-lib",
                    },
                  },
                },
              },
              "name": "another-project-with-devDependency-on-my-pkg",
              "version": "9.9.9",
            },
          },
        }
      `);
      });

      it(`should exit with code one and print guidance for invalid prefix values`, async () => {
        stubProcessExit = true;

        const outputSpy = vi
          .spyOn(output, 'error')
          .mockImplementationOnce(() => {
            return undefined as never;
          });

        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'major',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
          versionPrefix: '$' as never,
        });

        expect(outputSpy).toHaveBeenCalledWith({
          title: `Invalid value for version.generatorOptions.versionPrefix: "$"

Valid values are: "auto", "", "~", "^", "="`,
        });

        outputSpy.mockRestore();
        expect(processExitSpy).toHaveBeenCalledWith(1);

        stubProcessExit = false;
      });
    });

    describe('transitive updateDependents', () => {
      beforeEach(() => {
        projectGraph = createPoetryWorkspaceWithPackageDependencies(tree, {
          'my-lib': {
            projectRoot: 'libs/my-lib',
            packageName: 'my-lib',
            version: '0.0.1',
            pyprojectTomlPath: 'libs/my-lib/pyproject.toml',
            localDependencies: [],
          },
          'project-with-dependency-on-my-lib': {
            projectRoot: 'libs/project-with-dependency-on-my-lib',
            packageName: 'project-with-dependency-on-my-lib',
            version: '0.0.1',
            pyprojectTomlPath:
              'libs/project-with-dependency-on-my-lib/pyproject.toml',
            localDependencies: [
              {
                projectName: 'my-lib',
                dependencyCollection: 'dependencies',
              },
            ],
          },
          'project-with-transitive-dependency-on-my-lib': {
            projectRoot: 'libs/project-with-transitive-dependency-on-my-lib',
            packageName: 'project-with-transitive-dependency-on-my-lib',
            version: '0.0.1',
            pyprojectTomlPath:
              'libs/project-with-transitive-dependency-on-my-lib/pyproject.toml',
            localDependencies: [
              {
                // Depends on my-lib via the project-with-dependency-on-my-lib
                projectName: 'project-with-dependency-on-my-lib',
                dependencyCollection: 'dev',
              },
            ],
          },
        });
      });

      it('should not update transitive dependents when updateDependents is set to "never" and the transitive dependents are not in the same batch', async () => {
        expect(
          readPyprojectToml<PoetryPyprojectToml>(
            tree,
            'libs/my-lib/pyproject.toml',
          ).tool.poetry.version,
        ).toEqual('0.0.1');
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "dependencies": {
                "my-lib": {
                  "develop": true,
                  "path": "../my-lib",
                },
              },
              "name": "project-with-dependency-on-my-lib",
              "version": "0.0.1",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-transitive-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "project-with-dependency-on-my-lib": {
                      "develop": true,
                      "path": "../project-with-dependency-on-my-lib",
                    },
                  },
                },
              },
              "name": "project-with-transitive-dependency-on-my-lib",
              "version": "0.0.1",
            },
          },
        }
      `);

        // It should not include transitive dependents in the versionData because we are filtering to only my-lib and updateDependents is set to "never"
        expect(
          await releaseVersionGenerator(tree, {
            projects: [projectGraph.nodes['my-lib']], // version only my-lib
            projectGraph,
            specifier: '9.9.9',
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
            updateDependents: 'never',
          }),
        ).toMatchInlineSnapshot(`
        {
          "callback": [Function],
          "data": {
            "my-lib": {
              "currentVersion": "0.0.1",
              "dependentProjects": [],
              "newVersion": "9.9.9",
            },
          },
        }
      `);

        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "name": "my-lib",
              "version": "9.9.9",
            },
          },
        }
      `);

        // The version of project-with-dependency-on-my-lib is untouched because it is not in the same batch as my-lib and updateDependents is set to "never"
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "dependencies": {
                "my-lib": {
                  "develop": true,
                  "path": "../my-lib",
                },
              },
              "name": "project-with-dependency-on-my-lib",
              "version": "0.0.1",
            },
          },
        }
      `);

        // The version of project-with-transitive-dependency-on-my-lib is untouched because it is not in the same batch as my-lib and updateDependents is set to "never"
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-transitive-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "project-with-dependency-on-my-lib": {
                      "develop": true,
                      "path": "../project-with-dependency-on-my-lib",
                    },
                  },
                },
              },
              "name": "project-with-transitive-dependency-on-my-lib",
              "version": "0.0.1",
            },
          },
        }
      `);
      });

      it('should always update transitive dependents when updateDependents is set to "auto"', async () => {
        expect(
          readPyprojectToml<PoetryPyprojectToml>(
            tree,
            'libs/my-lib/pyproject.toml',
          ).tool.poetry.version,
        ).toEqual('0.0.1');
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "dependencies": {
                "my-lib": {
                  "develop": true,
                  "path": "../my-lib",
                },
              },
              "name": "project-with-dependency-on-my-lib",
              "version": "0.0.1",
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-transitive-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "project-with-dependency-on-my-lib": {
                      "develop": true,
                      "path": "../project-with-dependency-on-my-lib",
                    },
                  },
                },
              },
              "name": "project-with-transitive-dependency-on-my-lib",
              "version": "0.0.1",
            },
          },
        }
      `);

        // It should include the appropriate versionData for transitive dependents
        expect(
          await releaseVersionGenerator(tree, {
            projects: [projectGraph.nodes['my-lib']], // version only my-lib
            projectGraph,
            specifier: '9.9.9',
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
            updateDependents: 'auto',
          }),
        ).toMatchInlineSnapshot(`
          {
            "callback": [Function],
            "data": {
              "my-lib": {
                "currentVersion": "0.0.1",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "0.0.1",
                    "source": "project-with-dependency-on-my-lib",
                    "target": "my-lib",
                    "type": "static",
                  },
                ],
                "newVersion": "9.9.9",
              },
              "project-with-dependency-on-my-lib": {
                "currentVersion": "0.0.1",
                "dependentProjects": [
                  {
                    "dependencyCollection": "devDependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "0.0.1",
                    "source": "project-with-transitive-dependency-on-my-lib",
                    "target": "project-with-dependency-on-my-lib",
                    "type": "static",
                  },
                ],
                "newVersion": "0.0.2",
              },
              "project-with-transitive-dependency-on-my-lib": {
                "currentVersion": "0.0.1",
                "dependentProjects": [],
                "newVersion": "0.0.2",
              },
            },
          }
        `);

        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "name": "my-lib",
              "version": "9.9.9",
            },
          },
        }
      `);

        // The version of project-with-dependency-on-my-lib gets bumped by a patch number and the dependencies reference is updated to the new version of my-lib
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "dependencies": {
                "my-lib": {
                  "develop": true,
                  "path": "../my-lib",
                },
              },
              "name": "project-with-dependency-on-my-lib",
              "version": "0.0.2",
            },
          },
        }
      `);

        // The version of project-with-transitive-dependency-on-my-lib gets bumped by a patch number and the devDependencies reference is updated to the new version of project-with-dependency-on-my-lib because of the transitive dependency on my-lib
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-transitive-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "tool": {
            "poetry": {
              "group": {
                "dev": {
                  "dependencies": {
                    "project-with-dependency-on-my-lib": {
                      "develop": true,
                      "path": "../project-with-dependency-on-my-lib",
                    },
                  },
                },
              },
              "name": "project-with-transitive-dependency-on-my-lib",
              "version": "0.0.2",
            },
          },
        }
      `);
      });
    });

    describe('circular dependencies', () => {
      beforeEach(() => {
        // package-a <-> package-b
        projectGraph = createPoetryWorkspaceWithPackageDependencies(tree, {
          'package-a': {
            projectRoot: 'packages/package-a',
            packageName: 'package-a',
            version: '1.0.0',
            pyprojectTomlPath: 'packages/package-a/pyproject.toml',
            localDependencies: [
              {
                projectName: 'package-b',
                dependencyCollection: 'dependencies',
              },
            ],
          },
          'package-b': {
            projectRoot: 'packages/package-b',
            packageName: 'package-b',
            version: '1.0.0',
            pyprojectTomlPath: 'packages/package-b/pyproject.toml',
            localDependencies: [
              {
                projectName: 'package-a',
                dependencyCollection: 'dependencies',
              },
            ],
          },
        });
      });

      describe("updateDependents: 'never'", () => {
        it('should allow versioning of circular dependencies when not all projects are included in the current batch', async () => {
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-b": {
                    "develop": true,
                    "path": "../package-b",
                  },
                },
                "name": "package-a",
                "version": "1.0.0",
              },
            },
          }
        `);
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-a": {
                    "develop": true,
                    "path": "../package-a",
                  },
                },
                "name": "package-b",
                "version": "1.0.0",
              },
            },
          }
        `);

          expect(
            await releaseVersionGenerator(tree, {
              projects: [projectGraph.nodes['package-a']], // version only package-a
              projectGraph,
              specifier: '2.0.0',
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'never',
            }),
          ).toMatchInlineSnapshot(`
          {
            "callback": [Function],
            "data": {
              "package-a": {
                "currentVersion": "1.0.0",
                "dependentProjects": [],
                "newVersion": "2.0.0",
              },
            },
          }
        `);

          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-b": {
                    "develop": true,
                    "path": "../package-b",
                  },
                },
                "name": "package-a",
                "version": "2.0.0",
              },
            },
          }
        `);
          // package-b is unchanged
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-a": {
                    "develop": true,
                    "path": "../package-a",
                  },
                },
                "name": "package-b",
                "version": "1.0.0",
              },
            },
          }
        `);
        });

        it('should allow versioning of circular dependencies when all projects are included in the current batch', async () => {
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-b": {
                    "develop": true,
                    "path": "../package-b",
                  },
                },
                "name": "package-a",
                "version": "1.0.0",
              },
            },
          }
        `);
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-a": {
                    "develop": true,
                    "path": "../package-a",
                  },
                },
                "name": "package-b",
                "version": "1.0.0",
              },
            },
          }
        `);

          expect(
            await releaseVersionGenerator(tree, {
              // version both packages
              projects: [
                projectGraph.nodes['package-a'],
                projectGraph.nodes['package-b'],
              ],

              projectGraph,
              specifier: '2.0.0',
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'never',
            }),
          ).toMatchInlineSnapshot(`
          {
            "callback": [Function],
            "data": {
              "package-a": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "1.0.0",
                    "source": "package-b",
                    "target": "package-a",
                    "type": "static",
                  },
                ],
                "newVersion": "2.0.0",
              },
              "package-b": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "1.0.0",
                    "source": "package-a",
                    "target": "package-b",
                    "type": "static",
                  },
                ],
                "newVersion": "2.0.0",
              },
            },
          }
        `);

          // Both the version of package-a, and the dependency on package-b are updated to 2.0.0
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-b": {
                    "develop": true,
                    "path": "../package-b",
                  },
                },
                "name": "package-a",
                "version": "2.0.0",
              },
            },
          }
        `);
          // Both the version of package-b, and the dependency on package-a are updated to 2.0.0
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-a": {
                    "develop": true,
                    "path": "../package-a",
                  },
                },
                "name": "package-b",
                "version": "2.0.0",
              },
            },
          }
        `);
        });
      });

      describe("updateDependents: 'auto'", () => {
        it('should allow versioning of circular dependencies when not all projects are included in the current batch', async () => {
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-b": {
                    "develop": true,
                    "path": "../package-b",
                  },
                },
                "name": "package-a",
                "version": "1.0.0",
              },
            },
          }
        `);
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-a": {
                    "develop": true,
                    "path": "../package-a",
                  },
                },
                "name": "package-b",
                "version": "1.0.0",
              },
            },
          }
        `);

          expect(
            await releaseVersionGenerator(tree, {
              projects: [projectGraph.nodes['package-a']], // version only package-a
              projectGraph,
              specifier: '2.0.0',
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'auto',
            }),
          ).toMatchInlineSnapshot(`
          {
            "callback": [Function],
            "data": {
              "package-a": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "1.0.0",
                    "source": "package-b",
                    "target": "package-a",
                    "type": "static",
                  },
                ],
                "newVersion": "2.0.0",
              },
              "package-b": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "1.0.0",
                    "source": "package-a",
                    "target": "package-b",
                    "type": "static",
                  },
                ],
                "newVersion": "1.0.1",
              },
            },
          }
        `);

          // The version of package-a has been updated to 2.0.0, and the dependency on package-b has been updated to 1.0.1
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-b": {
                    "develop": true,
                    "path": "../package-b",
                  },
                },
                "name": "package-a",
                "version": "2.0.0",
              },
            },
          }
        `);
          // The version of package-b has been patched to 1.0.1, and the dependency on package-a has been updated to 2.0.0
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-a": {
                    "develop": true,
                    "path": "../package-a",
                  },
                },
                "name": "package-b",
                "version": "1.0.1",
              },
            },
          }
        `);
        });

        it('should allow versioning of circular dependencies when all projects are included in the current batch', async () => {
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-b": {
                    "develop": true,
                    "path": "../package-b",
                  },
                },
                "name": "package-a",
                "version": "1.0.0",
              },
            },
          }
        `);
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-a": {
                    "develop": true,
                    "path": "../package-a",
                  },
                },
                "name": "package-b",
                "version": "1.0.0",
              },
            },
          }
        `);

          expect(
            await releaseVersionGenerator(tree, {
              // version both packages
              projects: [
                projectGraph.nodes['package-a'],
                projectGraph.nodes['package-b'],
              ],
              projectGraph,
              specifier: '2.0.0',
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'auto',
            }),
          ).toMatchInlineSnapshot(`
          {
            "callback": [Function],
            "data": {
              "package-a": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "1.0.0",
                    "source": "package-b",
                    "target": "package-a",
                    "type": "static",
                  },
                ],
                "newVersion": "2.0.0",
              },
              "package-b": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "1.0.0",
                    "source": "package-a",
                    "target": "package-b",
                    "type": "static",
                  },
                ],
                "newVersion": "2.0.0",
              },
            },
          }
        `);

          // Both the version of package-a, and the dependency on package-b are updated to 2.0.0
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-b": {
                    "develop": true,
                    "path": "../package-b",
                  },
                },
                "name": "package-a",
                "version": "2.0.0",
              },
            },
          }
        `);
          // Both the version of package-b, and the dependency on package-a are updated to 2.0.0
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "tool": {
              "poetry": {
                "dependencies": {
                  "package-a": {
                    "develop": true,
                    "path": "../package-a",
                  },
                },
                "name": "package-b",
                "version": "2.0.0",
              },
            },
          }
        `);
        });
      });
    });
  });

  describe('uv', () => {
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace();
      tree.root = '.';

      projectGraph = createUvWorkspaceWithPackageDependencies(tree, {
        'my-lib': {
          projectRoot: 'libs/my-lib',
          packageName: 'my-lib',
          version: '0.0.1',
          pyprojectTomlPath: 'libs/my-lib/pyproject.toml',
          localDependencies: [],
        },
        'project-with-dependency-on-my-pkg': {
          projectRoot: 'libs/project-with-dependency-on-my-pkg',
          packageName: 'project-with-dependency-on-my-pkg',
          version: '0.0.1',
          pyprojectTomlPath:
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          localDependencies: [
            {
              projectName: 'my-lib',
              dependencyCollection: 'dependencies',
            },
          ],
        },
        'project-with-devDependency-on-my-pkg': {
          projectRoot: 'libs/project-with-devDependency-on-my-pkg',
          packageName: 'project-with-devDependency-on-my-pkg',
          version: '0.0.1',
          pyprojectTomlPath:
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          localDependencies: [
            {
              projectName: 'my-lib',
              dependencyCollection: 'dev',
            },
          ],
        },
      });
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return a versionData object', async () => {
      expect(
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'major',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        }),
      ).toMatchInlineSnapshot(`
      {
        "callback": [Function],
        "data": {
          "my-lib": {
            "currentVersion": "0.0.1",
            "dependentProjects": [
              {
                "dependencyCollection": "dependencies",
                "groupKey": undefined,
                "rawVersionSpec": "0.0.1",
                "source": "project-with-dependency-on-my-pkg",
                "target": "my-lib",
                "type": "static",
              },
              {
                "dependencyCollection": "devDependencies",
                "groupKey": undefined,
                "rawVersionSpec": "0.0.1",
                "source": "project-with-devDependency-on-my-pkg",
                "target": "my-lib",
                "type": "static",
              },
            ],
            "newVersion": "1.0.0",
          },
          "project-with-dependency-on-my-pkg": {
            "currentVersion": "0.0.1",
            "dependentProjects": [],
            "newVersion": "1.0.0",
          },
          "project-with-devDependency-on-my-pkg": {
            "currentVersion": "0.0.1",
            "dependentProjects": [],
            "newVersion": "1.0.0",
          },
        },
      }
    `);
    });

    describe('not all given projects have pyproject.toml files', () => {
      beforeEach(() => {
        tree.delete('libs/my-lib/pyproject.toml');
      });

      it(`should exit with code one and print guidance when not all of the given projects are appropriate for Python versioning`, async () => {
        stubProcessExit = true;

        const outputSpy = vi
          .spyOn(output, 'error')
          .mockImplementationOnce(() => {
            return undefined as never;
          });

        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'major',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });

        expect(outputSpy).toHaveBeenCalledWith({
          title: `The project "my-lib" does not have a pyproject.toml available at libs/my-lib/pyproject.toml.

To fix this you will either need to add a pyproject.toml file at that location, or configure "release" within your nx.json to exclude "my-lib" from the current release group, or amend the packageRoot configuration to point to where the pyproject.toml should be.`,
        });

        outputSpy.mockRestore();
        expect(processExitSpy).toHaveBeenCalledWith(1);

        stubProcessExit = false;
      });
    });

    describe('package with mixed "prod" and "dev" dependencies', () => {
      beforeEach(() => {
        projectGraph = createUvWorkspaceWithPackageDependencies(tree, {
          'my-app': {
            projectRoot: 'libs/my-app',
            packageName: 'my-app',
            version: '0.0.1',
            pyprojectTomlPath: 'libs/my-app/pyproject.toml',
            localDependencies: [
              {
                projectName: 'my-lib-1',
                dependencyCollection: 'dependencies',
              },
              {
                projectName: 'my-lib-2',
                dependencyCollection: 'dev',
              },
            ],
          },
          'my-lib-1': {
            projectRoot: 'libs/my-lib-1',
            packageName: 'my-lib-1',
            version: '0.0.1',
            pyprojectTomlPath: 'libs/my-lib-1/pyproject.toml',
            localDependencies: [],
          },
          'my-lib-2': {
            projectRoot: 'libs/my-lib-2',
            packageName: 'my-lib-2',
            version: '0.0.1',
            pyprojectTomlPath: 'libs/my-lib-2/pyproject.toml',
            localDependencies: [],
          },
        });
      });

      it('should update local dependencies only where it needs to', async () => {
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'major',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });

        expect(readPyprojectToml(tree, 'libs/my-app/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "my-lib-2",
            ],
          },
          "project": {
            "dependencies": [
              "my-lib-1",
            ],
            "name": "my-app",
            "version": "1.0.0",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib-1": {
                  "workspace": true,
                },
                "my-lib-2": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
      });
    });

    describe('fixed release group', () => {
      it(`should work with semver keywords and exact semver versions`, async () => {
        expect(
          readPyprojectToml<UVPyprojectToml>(tree, 'libs/my-lib/pyproject.toml')
            .project.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'major',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });
        expect(
          readPyprojectToml<UVPyprojectToml>(tree, 'libs/my-lib/pyproject.toml')
            .project.version,
        ).toEqual('1.0.0');

        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'minor',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });
        expect(
          readPyprojectToml<UVPyprojectToml>(tree, 'libs/my-lib/pyproject.toml')
            .project.version,
        ).toEqual('1.1.0');

        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'patch',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });
        expect(
          readPyprojectToml<UVPyprojectToml>(tree, 'libs/my-lib/pyproject.toml')
            .project.version,
        ).toEqual('1.1.1');

        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '1.2.3', // exact version
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });
        expect(
          readPyprojectToml<UVPyprojectToml>(tree, 'libs/my-lib/pyproject.toml')
            .project.version,
        ).toEqual('1.2.3');
      });

      it(`should apply the updated version to the projects, including updating dependents`, async () => {
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'major',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });

        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "project": {
            "name": "my-lib",
            "version": "1.0.0",
          },
          "tool": {
            "uv": {
              "sources": {},
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "project": {
            "dependencies": [
              "my-lib",
            ],
            "name": "project-with-dependency-on-my-pkg",
            "version": "1.0.0",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "my-lib",
            ],
          },
          "project": {
            "name": "project-with-devDependency-on-my-pkg",
            "version": "1.0.0",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
      });
    });

    describe('independent release group', () => {
      describe('specifierSource: prompt', () => {
        it(`should appropriately prompt for each project independently and apply the version updates across all pyproject.toml files`, async () => {
          enquirerMocks.prompt
            // First project will be minor
            .mockResolvedValueOnce({ specifier: 'minor' })
            // Next project will be patch
            .mockResolvedValueOnce({ specifier: 'patch' })
            // Final project will be custom explicit version
            .mockResolvedValueOnce({ specifier: 'custom' })
            .mockResolvedValueOnce({ specifier: '1.2.3' });

          expect(
            readPyprojectToml<UVPyprojectToml>(
              tree,
              'libs/my-lib/pyproject.toml',
            ).project.version,
          ).toEqual('0.0.1');
          expect(
            readPyprojectToml<UVPyprojectToml>(
              tree,
              'libs/project-with-dependency-on-my-pkg/pyproject.toml',
            ).project.version,
          ).toEqual('0.0.1');
          expect(
            readPyprojectToml<UVPyprojectToml>(
              tree,
              'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
            ).project.version,
          ).toEqual('0.0.1');

          await releaseVersionGenerator(tree, {
            projects: Object.values(projectGraph.nodes), // version all projects
            projectGraph,
            specifier: '', // no specifier override set, each individual project will be prompted
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
          });

          expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "name": "my-lib",
              "version": "0.1.0",
            },
            "tool": {
              "uv": {
                "sources": {},
              },
            },
          }
        `);

          expect(
            readPyprojectToml(
              tree,
              'libs/project-with-dependency-on-my-pkg/pyproject.toml',
            ),
          ).toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "my-lib",
              ],
              "name": "project-with-dependency-on-my-pkg",
              "version": "0.0.2",
            },
            "tool": {
              "uv": {
                "sources": {
                  "my-lib": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
          expect(
            readPyprojectToml(
              tree,
              'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
            ),
          ).toMatchInlineSnapshot(`
          {
            "dependency-groups": {
              "dev": [
                "my-lib",
              ],
            },
            "project": {
              "name": "project-with-devDependency-on-my-pkg",
              "version": "1.2.3",
            },
            "tool": {
              "uv": {
                "sources": {
                  "my-lib": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
        });

        it(`should respect an explicit user CLI specifier for all, even when projects are independent, and apply the version updates across all pyproject.toml files`, async () => {
          expect(
            readPyprojectToml<UVPyprojectToml>(
              tree,
              'libs/my-lib/pyproject.toml',
            ).project.version,
          ).toEqual('0.0.1');
          expect(
            readPyprojectToml<UVPyprojectToml>(
              tree,
              'libs/project-with-dependency-on-my-pkg/pyproject.toml',
            ).project.version,
          ).toEqual('0.0.1');
          expect(
            readPyprojectToml<UVPyprojectToml>(
              tree,
              'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
            ).project.version,
          ).toEqual('0.0.1');

          await releaseVersionGenerator(tree, {
            projects: Object.values(projectGraph.nodes), // version all projects
            projectGraph,
            specifier: '4.5.6', // user CLI specifier override set, no prompting should occur
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
          });

          expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "name": "my-lib",
              "version": "4.5.6",
            },
            "tool": {
              "uv": {
                "sources": {},
              },
            },
          }
        `);

          expect(
            readPyprojectToml(
              tree,
              'libs/project-with-dependency-on-my-pkg/pyproject.toml',
            ),
          ).toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "my-lib",
              ],
              "name": "project-with-dependency-on-my-pkg",
              "version": "4.5.6",
            },
            "tool": {
              "uv": {
                "sources": {
                  "my-lib": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
          expect(
            readPyprojectToml(
              tree,
              'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
            ),
          ).toMatchInlineSnapshot(`
          {
            "dependency-groups": {
              "dev": [
                "my-lib",
              ],
            },
            "project": {
              "name": "project-with-devDependency-on-my-pkg",
              "version": "4.5.6",
            },
            "tool": {
              "uv": {
                "sources": {
                  "my-lib": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
        });

        describe('updateDependentsOptions', () => {
          it(`should not update dependents when filtering to a subset of projects by default`, async () => {
            expect(
              readPyprojectToml<UVPyprojectToml>(
                tree,
                'libs/my-lib/pyproject.toml',
              ).project.version,
            ).toEqual('0.0.1');
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-dependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "project": {
                "dependencies": [
                  "my-lib",
                ],
                "name": "project-with-dependency-on-my-pkg",
                "version": "0.0.1",
              },
              "tool": {
                "uv": {
                  "sources": {
                    "my-lib": {
                      "workspace": true,
                    },
                  },
                },
              },
            }
          `);
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "dependency-groups": {
                "dev": [
                  "my-lib",
                ],
              },
              "project": {
                "name": "project-with-devDependency-on-my-pkg",
                "version": "0.0.1",
              },
              "tool": {
                "uv": {
                  "sources": {
                    "my-lib": {
                      "workspace": true,
                    },
                  },
                },
              },
            }
          `);

            await releaseVersionGenerator(tree, {
              projects: [projectGraph.nodes['my-lib']], // version only my-lib
              projectGraph,
              specifier: '9.9.9', // user CLI specifier override set, no prompting should occur
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'never',
            });

            expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
              .toMatchInlineSnapshot(`
            {
              "project": {
                "name": "my-lib",
                "version": "9.9.9",
              },
              "tool": {
                "uv": {
                  "sources": {},
                },
              },
            }
          `);

            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-dependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "project": {
                "dependencies": [
                  "my-lib",
                ],
                "name": "project-with-dependency-on-my-pkg",
                "version": "0.0.1",
              },
              "tool": {
                "uv": {
                  "sources": {
                    "my-lib": {
                      "workspace": true,
                    },
                  },
                },
              },
            }
          `);
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "dependency-groups": {
                "dev": [
                  "my-lib",
                ],
              },
              "project": {
                "name": "project-with-devDependency-on-my-pkg",
                "version": "0.0.1",
              },
              "tool": {
                "uv": {
                  "sources": {
                    "my-lib": {
                      "workspace": true,
                    },
                  },
                },
              },
            }
          `);
          });

          it(`should not update dependents when filtering to a subset of projects by default, if "updateDependents" is set to "never"`, async () => {
            expect(
              readPyprojectToml<UVPyprojectToml>(
                tree,
                'libs/my-lib/pyproject.toml',
              ).project.version,
            ).toEqual('0.0.1');
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-dependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "project": {
                "dependencies": [
                  "my-lib",
                ],
                "name": "project-with-dependency-on-my-pkg",
                "version": "0.0.1",
              },
              "tool": {
                "uv": {
                  "sources": {
                    "my-lib": {
                      "workspace": true,
                    },
                  },
                },
              },
            }
          `);
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "dependency-groups": {
                "dev": [
                  "my-lib",
                ],
              },
              "project": {
                "name": "project-with-devDependency-on-my-pkg",
                "version": "0.0.1",
              },
              "tool": {
                "uv": {
                  "sources": {
                    "my-lib": {
                      "workspace": true,
                    },
                  },
                },
              },
            }
          `);

            await releaseVersionGenerator(tree, {
              projects: [projectGraph.nodes['my-lib']], // version only my-lib
              projectGraph,
              specifier: '9.9.9', // user CLI specifier override set, no prompting should occur
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'never',
            });

            expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
              .toMatchInlineSnapshot(`
            {
              "project": {
                "name": "my-lib",
                "version": "9.9.9",
              },
              "tool": {
                "uv": {
                  "sources": {},
                },
              },
            }
          `);

            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-dependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "project": {
                "dependencies": [
                  "my-lib",
                ],
                "name": "project-with-dependency-on-my-pkg",
                "version": "0.0.1",
              },
              "tool": {
                "uv": {
                  "sources": {
                    "my-lib": {
                      "workspace": true,
                    },
                  },
                },
              },
            }
          `);
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "dependency-groups": {
                "dev": [
                  "my-lib",
                ],
              },
              "project": {
                "name": "project-with-devDependency-on-my-pkg",
                "version": "0.0.1",
              },
              "tool": {
                "uv": {
                  "sources": {
                    "my-lib": {
                      "workspace": true,
                    },
                  },
                },
              },
            }
          `);
          });

          it(`should update dependents even when filtering to a subset of projects which do not include those dependents, if "updateDependents" is "auto"`, async () => {
            expect(
              readPyprojectToml<UVPyprojectToml>(
                tree,
                'libs/my-lib/pyproject.toml',
              ).project.version,
            ).toEqual('0.0.1');
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-dependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "project": {
                "dependencies": [
                  "my-lib",
                ],
                "name": "project-with-dependency-on-my-pkg",
                "version": "0.0.1",
              },
              "tool": {
                "uv": {
                  "sources": {
                    "my-lib": {
                      "workspace": true,
                    },
                  },
                },
              },
            }
          `);
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "dependency-groups": {
                "dev": [
                  "my-lib",
                ],
              },
              "project": {
                "name": "project-with-devDependency-on-my-pkg",
                "version": "0.0.1",
              },
              "tool": {
                "uv": {
                  "sources": {
                    "my-lib": {
                      "workspace": true,
                    },
                  },
                },
              },
            }
          `);

            await releaseVersionGenerator(tree, {
              projects: [projectGraph.nodes['my-lib']], // version only my-lib
              projectGraph,
              specifier: '9.9.9', // user CLI specifier override set, no prompting should occur
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'auto',
            });

            expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
              .toMatchInlineSnapshot(`
            {
              "project": {
                "name": "my-lib",
                "version": "9.9.9",
              },
              "tool": {
                "uv": {
                  "sources": {},
                },
              },
            }
          `);

            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-dependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "project": {
                "dependencies": [
                  "my-lib",
                ],
                "name": "project-with-dependency-on-my-pkg",
                "version": "0.0.2",
              },
              "tool": {
                "uv": {
                  "sources": {
                    "my-lib": {
                      "workspace": true,
                    },
                  },
                },
              },
            }
          `);
            expect(
              readPyprojectToml(
                tree,
                'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
              ),
            ).toMatchInlineSnapshot(`
            {
              "dependency-groups": {
                "dev": [
                  "my-lib",
                ],
              },
              "project": {
                "name": "project-with-devDependency-on-my-pkg",
                "version": "0.0.2",
              },
              "tool": {
                "uv": {
                  "sources": {
                    "my-lib": {
                      "workspace": true,
                    },
                  },
                },
              },
            }
          `);
          });
        });
      });
    });

    describe('leading v in version', () => {
      it(`should strip a leading v from the provided specifier`, async () => {
        expect(
          readPyprojectToml<UVPyprojectToml>(tree, 'libs/my-lib/pyproject.toml')
            .project.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'v8.8.8',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
        });
        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "project": {
            "name": "my-lib",
            "version": "8.8.8",
          },
          "tool": {
            "uv": {
              "sources": {},
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "project": {
            "dependencies": [
              "my-lib",
            ],
            "name": "project-with-dependency-on-my-pkg",
            "version": "8.8.8",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "my-lib",
            ],
          },
          "project": {
            "name": "project-with-devDependency-on-my-pkg",
            "version": "8.8.8",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
      });
    });

    describe('dependent version prefix', () => {
      beforeEach(() => {
        projectGraph = createUvWorkspaceWithPackageDependencies(tree, {
          'my-lib': {
            projectRoot: 'libs/my-lib',
            packageName: 'my-lib',
            version: '0.0.1',
            pyprojectTomlPath: 'libs/my-lib/pyproject.toml',
            localDependencies: [],
          },
          'project-with-dependency-on-my-pkg': {
            projectRoot: 'libs/project-with-dependency-on-my-pkg',
            packageName: 'project-with-dependency-on-my-pkg',
            version: '0.0.1',
            pyprojectTomlPath:
              'libs/project-with-dependency-on-my-pkg/pyproject.toml',
            localDependencies: [
              {
                projectName: 'my-lib',
                dependencyCollection: 'dependencies',
              },
            ],
          },
          'project-with-devDependency-on-my-pkg': {
            projectRoot: 'libs/project-with-devDependency-on-my-pkg',
            packageName: 'project-with-devDependency-on-my-pkg',
            version: '0.0.1',
            pyprojectTomlPath:
              'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
            localDependencies: [
              {
                projectName: 'my-lib',
                dependencyCollection: 'dev',
              },
            ],
          },
          'another-project-with-devDependency-on-my-pkg': {
            projectRoot: 'libs/another-project-with-devDependency-on-my-pkg',
            packageName: 'another-project-with-devDependency-on-my-pkg',
            version: '0.0.1',
            pyprojectTomlPath:
              'libs/another-project-with-devDependency-on-my-pkg/pyproject.toml',
            localDependencies: [
              {
                projectName: 'my-lib',
                dependencyCollection: 'dev',
              },
            ],
          },
        });
      });

      it('should work with an empty prefix', async () => {
        expect(
          readPyprojectToml<UVPyprojectToml>(tree, 'libs/my-lib/pyproject.toml')
            .project.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '9.9.9',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
          versionPrefix: '',
        });
        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "project": {
            "name": "my-lib",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {},
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "project": {
            "dependencies": [
              "my-lib",
            ],
            "name": "project-with-dependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "my-lib",
            ],
          },
          "project": {
            "name": "project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/another-project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "my-lib",
            ],
          },
          "project": {
            "name": "another-project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
      });

      it('should work with a ^ prefix', async () => {
        expect(
          readPyprojectToml<UVPyprojectToml>(tree, 'libs/my-lib/pyproject.toml')
            .project.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '9.9.9',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
          versionPrefix: '^',
        });
        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "project": {
            "name": "my-lib",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {},
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "project": {
            "dependencies": [
              "my-lib",
            ],
            "name": "project-with-dependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "my-lib",
            ],
          },
          "project": {
            "name": "project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/another-project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "my-lib",
            ],
          },
          "project": {
            "name": "another-project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
      });

      it('should work with a ~ prefix', async () => {
        expect(
          readPyprojectToml<UVPyprojectToml>(tree, 'libs/my-lib/pyproject.toml')
            .project.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '9.9.9',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
          versionPrefix: '~',
        });
        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "project": {
            "name": "my-lib",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {},
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "project": {
            "dependencies": [
              "my-lib",
            ],
            "name": "project-with-dependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "my-lib",
            ],
          },
          "project": {
            "name": "project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/another-project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "my-lib",
            ],
          },
          "project": {
            "name": "another-project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
      });

      it('should respect any existing prefix when set to "auto"', async () => {
        expect(
          readPyprojectToml<UVPyprojectToml>(tree, 'libs/my-lib/pyproject.toml')
            .project.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '9.9.9',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
          versionPrefix: 'auto',
        });
        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "project": {
            "name": "my-lib",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {},
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "project": {
            "dependencies": [
              "my-lib",
            ],
            "name": "project-with-dependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "my-lib",
            ],
          },
          "project": {
            "name": "project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/another-project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "my-lib",
            ],
          },
          "project": {
            "name": "another-project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
      });

      it('should use the behavior of "auto" by default', async () => {
        expect(
          readPyprojectToml<UVPyprojectToml>(tree, 'libs/my-lib/pyproject.toml')
            .project.version,
        ).toEqual('0.0.1');
        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: '9.9.9',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
          versionPrefix: undefined,
        });
        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "project": {
            "name": "my-lib",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {},
            },
          },
        }
      `);

        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "project": {
            "dependencies": [
              "my-lib",
            ],
            "name": "project-with-dependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "my-lib",
            ],
          },
          "project": {
            "name": "project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/another-project-with-devDependency-on-my-pkg/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "my-lib",
            ],
          },
          "project": {
            "name": "another-project-with-devDependency-on-my-pkg",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
      });

      it(`should exit with code one and print guidance for invalid prefix values`, async () => {
        stubProcessExit = true;

        const outputSpy = vi
          .spyOn(output, 'error')
          .mockImplementationOnce(() => {
            return undefined as never;
          });

        await releaseVersionGenerator(tree, {
          projects: Object.values(projectGraph.nodes), // version all projects
          projectGraph,
          specifier: 'major',
          currentVersionResolver: 'disk',
          releaseGroup: createReleaseGroup('fixed'),
          versionPrefix: '$' as never,
        });

        expect(outputSpy).toHaveBeenCalledWith({
          title: `Invalid value for version.generatorOptions.versionPrefix: "$"

Valid values are: "auto", "", "~", "^", "="`,
        });

        outputSpy.mockRestore();
        expect(processExitSpy).toHaveBeenCalledWith(1);

        stubProcessExit = false;
      });
    });

    describe('transitive updateDependents', () => {
      beforeEach(() => {
        projectGraph = createUvWorkspaceWithPackageDependencies(tree, {
          'my-lib': {
            projectRoot: 'libs/my-lib',
            packageName: 'my-lib',
            version: '0.0.1',
            pyprojectTomlPath: 'libs/my-lib/pyproject.toml',
            localDependencies: [],
          },
          'project-with-dependency-on-my-lib': {
            projectRoot: 'libs/project-with-dependency-on-my-lib',
            packageName: 'project-with-dependency-on-my-lib',
            version: '0.0.1',
            pyprojectTomlPath:
              'libs/project-with-dependency-on-my-lib/pyproject.toml',
            localDependencies: [
              {
                projectName: 'my-lib',
                dependencyCollection: 'dependencies',
              },
            ],
          },
          'project-with-transitive-dependency-on-my-lib': {
            projectRoot: 'libs/project-with-transitive-dependency-on-my-lib',
            packageName: 'project-with-transitive-dependency-on-my-lib',
            version: '0.0.1',
            pyprojectTomlPath:
              'libs/project-with-transitive-dependency-on-my-lib/pyproject.toml',
            localDependencies: [
              {
                // Depends on my-lib via the project-with-dependency-on-my-lib
                projectName: 'project-with-dependency-on-my-lib',
                dependencyCollection: 'dev',
              },
            ],
          },
        });
      });

      it('should not update transitive dependents when updateDependents is set to "never" and the transitive dependents are not in the same batch', async () => {
        expect(
          readPyprojectToml<UVPyprojectToml>(tree, 'libs/my-lib/pyproject.toml')
            .project.version,
        ).toEqual('0.0.1');
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "project": {
            "dependencies": [
              "my-lib",
            ],
            "name": "project-with-dependency-on-my-lib",
            "version": "0.0.1",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-transitive-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "project-with-dependency-on-my-lib",
            ],
          },
          "project": {
            "name": "project-with-transitive-dependency-on-my-lib",
            "version": "0.0.1",
          },
          "tool": {
            "uv": {
              "sources": {
                "project-with-dependency-on-my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);

        // It should not include transitive dependents in the versionData because we are filtering to only my-lib and updateDependents is set to "never"
        expect(
          await releaseVersionGenerator(tree, {
            projects: [projectGraph.nodes['my-lib']], // version only my-lib
            projectGraph,
            specifier: '9.9.9',
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
            updateDependents: 'never',
          }),
        ).toMatchInlineSnapshot(`
        {
          "callback": [Function],
          "data": {
            "my-lib": {
              "currentVersion": "0.0.1",
              "dependentProjects": [],
              "newVersion": "9.9.9",
            },
          },
        }
      `);

        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "project": {
            "name": "my-lib",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {},
            },
          },
        }
      `);

        // The version of project-with-dependency-on-my-lib is untouched because it is not in the same batch as my-lib and updateDependents is set to "never"
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "project": {
            "dependencies": [
              "my-lib",
            ],
            "name": "project-with-dependency-on-my-lib",
            "version": "0.0.1",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);

        // The version of project-with-transitive-dependency-on-my-lib is untouched because it is not in the same batch as my-lib and updateDependents is set to "never"
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-transitive-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "project-with-dependency-on-my-lib",
            ],
          },
          "project": {
            "name": "project-with-transitive-dependency-on-my-lib",
            "version": "0.0.1",
          },
          "tool": {
            "uv": {
              "sources": {
                "project-with-dependency-on-my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
      });

      it('should always update transitive dependents when updateDependents is set to "auto"', async () => {
        expect(
          readPyprojectToml<UVPyprojectToml>(tree, 'libs/my-lib/pyproject.toml')
            .project.version,
        ).toEqual('0.0.1');
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "project": {
            "dependencies": [
              "my-lib",
            ],
            "name": "project-with-dependency-on-my-lib",
            "version": "0.0.1",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-transitive-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "project-with-dependency-on-my-lib",
            ],
          },
          "project": {
            "name": "project-with-transitive-dependency-on-my-lib",
            "version": "0.0.1",
          },
          "tool": {
            "uv": {
              "sources": {
                "project-with-dependency-on-my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);

        // It should include the appropriate versionData for transitive dependents
        expect(
          await releaseVersionGenerator(tree, {
            projects: [projectGraph.nodes['my-lib']], // version only my-lib
            projectGraph,
            specifier: '9.9.9',
            currentVersionResolver: 'disk',
            specifierSource: 'prompt',
            releaseGroup: createReleaseGroup('independent'),
            updateDependents: 'auto',
          }),
        ).toMatchInlineSnapshot(`
          {
            "callback": [Function],
            "data": {
              "my-lib": {
                "currentVersion": "0.0.1",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "0.0.1",
                    "source": "project-with-dependency-on-my-lib",
                    "target": "my-lib",
                    "type": "static",
                  },
                ],
                "newVersion": "9.9.9",
              },
              "project-with-dependency-on-my-lib": {
                "currentVersion": "0.0.1",
                "dependentProjects": [
                  {
                    "dependencyCollection": "devDependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "0.0.1",
                    "source": "project-with-transitive-dependency-on-my-lib",
                    "target": "project-with-dependency-on-my-lib",
                    "type": "static",
                  },
                ],
                "newVersion": "0.0.2",
              },
              "project-with-transitive-dependency-on-my-lib": {
                "currentVersion": "0.0.1",
                "dependentProjects": [],
                "newVersion": "0.0.2",
              },
            },
          }
        `);

        expect(readPyprojectToml(tree, 'libs/my-lib/pyproject.toml'))
          .toMatchInlineSnapshot(`
        {
          "project": {
            "name": "my-lib",
            "version": "9.9.9",
          },
          "tool": {
            "uv": {
              "sources": {},
            },
          },
        }
      `);

        // The version of project-with-dependency-on-my-lib gets bumped by a patch number and the dependencies reference is updated to the new version of my-lib
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "project": {
            "dependencies": [
              "my-lib",
            ],
            "name": "project-with-dependency-on-my-lib",
            "version": "0.0.2",
          },
          "tool": {
            "uv": {
              "sources": {
                "my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);

        // The version of project-with-transitive-dependency-on-my-lib gets bumped by a patch number and the devDependencies reference is updated to the new version of project-with-dependency-on-my-lib because of the transitive dependency on my-lib
        expect(
          readPyprojectToml(
            tree,
            'libs/project-with-transitive-dependency-on-my-lib/pyproject.toml',
          ),
        ).toMatchInlineSnapshot(`
        {
          "dependency-groups": {
            "dev": [
              "project-with-dependency-on-my-lib",
            ],
          },
          "project": {
            "name": "project-with-transitive-dependency-on-my-lib",
            "version": "0.0.2",
          },
          "tool": {
            "uv": {
              "sources": {
                "project-with-dependency-on-my-lib": {
                  "workspace": true,
                },
              },
            },
          },
        }
      `);
      });
    });

    describe('circular dependencies', () => {
      beforeEach(() => {
        // package-a <-> package-b
        projectGraph = createUvWorkspaceWithPackageDependencies(tree, {
          'package-a': {
            projectRoot: 'packages/package-a',
            packageName: 'package-a',
            version: '1.0.0',
            pyprojectTomlPath: 'packages/package-a/pyproject.toml',
            localDependencies: [
              {
                projectName: 'package-b',
                dependencyCollection: 'dependencies',
              },
            ],
          },
          'package-b': {
            projectRoot: 'packages/package-b',
            packageName: 'package-b',
            version: '1.0.0',
            pyprojectTomlPath: 'packages/package-b/pyproject.toml',
            localDependencies: [
              {
                projectName: 'package-a',
                dependencyCollection: 'dependencies',
              },
            ],
          },
        });
      });

      describe("updateDependents: 'never'", () => {
        it('should allow versioning of circular dependencies when not all projects are included in the current batch', async () => {
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-b",
              ],
              "name": "package-a",
              "version": "1.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-b": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-a",
              ],
              "name": "package-b",
              "version": "1.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-a": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);

          expect(
            await releaseVersionGenerator(tree, {
              projects: [projectGraph.nodes['package-a']], // version only package-a
              projectGraph,
              specifier: '2.0.0',
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'never',
            }),
          ).toMatchInlineSnapshot(`
          {
            "callback": [Function],
            "data": {
              "package-a": {
                "currentVersion": "1.0.0",
                "dependentProjects": [],
                "newVersion": "2.0.0",
              },
            },
          }
        `);

          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-b",
              ],
              "name": "package-a",
              "version": "2.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-b": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
          // package-b is unchanged
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-a",
              ],
              "name": "package-b",
              "version": "1.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-a": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
        });

        it('should allow versioning of circular dependencies when all projects are included in the current batch', async () => {
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-b",
              ],
              "name": "package-a",
              "version": "1.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-b": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-a",
              ],
              "name": "package-b",
              "version": "1.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-a": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);

          expect(
            await releaseVersionGenerator(tree, {
              // version both packages
              projects: [
                projectGraph.nodes['package-a'],
                projectGraph.nodes['package-b'],
              ],

              projectGraph,
              specifier: '2.0.0',
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'never',
            }),
          ).toMatchInlineSnapshot(`
          {
            "callback": [Function],
            "data": {
              "package-a": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "1.0.0",
                    "source": "package-b",
                    "target": "package-a",
                    "type": "static",
                  },
                ],
                "newVersion": "2.0.0",
              },
              "package-b": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "1.0.0",
                    "source": "package-a",
                    "target": "package-b",
                    "type": "static",
                  },
                ],
                "newVersion": "2.0.0",
              },
            },
          }
        `);

          // Both the version of package-a, and the dependency on package-b are updated to 2.0.0
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-b",
              ],
              "name": "package-a",
              "version": "2.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-b": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
          // Both the version of package-b, and the dependency on package-a are updated to 2.0.0
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-a",
              ],
              "name": "package-b",
              "version": "2.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-a": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
        });
      });

      describe("updateDependents: 'auto'", () => {
        it('should allow versioning of circular dependencies when not all projects are included in the current batch', async () => {
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-b",
              ],
              "name": "package-a",
              "version": "1.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-b": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-a",
              ],
              "name": "package-b",
              "version": "1.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-a": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);

          expect(
            await releaseVersionGenerator(tree, {
              projects: [projectGraph.nodes['package-a']], // version only package-a
              projectGraph,
              specifier: '2.0.0',
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'auto',
            }),
          ).toMatchInlineSnapshot(`
          {
            "callback": [Function],
            "data": {
              "package-a": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "1.0.0",
                    "source": "package-b",
                    "target": "package-a",
                    "type": "static",
                  },
                ],
                "newVersion": "2.0.0",
              },
              "package-b": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "1.0.0",
                    "source": "package-a",
                    "target": "package-b",
                    "type": "static",
                  },
                ],
                "newVersion": "1.0.1",
              },
            },
          }
        `);

          // The version of package-a has been updated to 2.0.0, and the dependency on package-b has been updated to 1.0.1
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-b",
              ],
              "name": "package-a",
              "version": "2.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-b": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
          // The version of package-b has been patched to 1.0.1, and the dependency on package-a has been updated to 2.0.0
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-a",
              ],
              "name": "package-b",
              "version": "1.0.1",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-a": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
        });

        it('should allow versioning of circular dependencies when all projects are included in the current batch', async () => {
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-b",
              ],
              "name": "package-a",
              "version": "1.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-b": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-a",
              ],
              "name": "package-b",
              "version": "1.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-a": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);

          expect(
            await releaseVersionGenerator(tree, {
              // version both packages
              projects: [
                projectGraph.nodes['package-a'],
                projectGraph.nodes['package-b'],
              ],
              projectGraph,
              specifier: '2.0.0',
              currentVersionResolver: 'disk',
              specifierSource: 'prompt',
              releaseGroup: createReleaseGroup('independent'),
              updateDependents: 'auto',
            }),
          ).toMatchInlineSnapshot(`
          {
            "callback": [Function],
            "data": {
              "package-a": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "1.0.0",
                    "source": "package-b",
                    "target": "package-a",
                    "type": "static",
                  },
                ],
                "newVersion": "2.0.0",
              },
              "package-b": {
                "currentVersion": "1.0.0",
                "dependentProjects": [
                  {
                    "dependencyCollection": "dependencies",
                    "groupKey": undefined,
                    "rawVersionSpec": "1.0.0",
                    "source": "package-a",
                    "target": "package-b",
                    "type": "static",
                  },
                ],
                "newVersion": "2.0.0",
              },
            },
          }
        `);

          // Both the version of package-a, and the dependency on package-b are updated to 2.0.0
          expect(readPyprojectToml(tree, 'packages/package-a/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-b",
              ],
              "name": "package-a",
              "version": "2.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-b": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
          // Both the version of package-b, and the dependency on package-a are updated to 2.0.0
          expect(readPyprojectToml(tree, 'packages/package-b/pyproject.toml'))
            .toMatchInlineSnapshot(`
          {
            "project": {
              "dependencies": [
                "package-a",
              ],
              "name": "package-b",
              "version": "2.0.0",
            },
            "tool": {
              "uv": {
                "sources": {
                  "package-a": {
                    "workspace": true,
                  },
                },
              },
            },
          }
        `);
        });
      });
    });
  });
});

function createReleaseGroup(
  relationship: ReleaseGroupWithName['projectsRelationship'],
  partialGroup: Partial<ReleaseGroupWithName> = {},
): ReleaseGroupWithName {
  return {
    name: 'myReleaseGroup',
    releaseTagPattern: '{projectName}@v{version}',
    ...partialGroup,
    projectsRelationship: relationship,
  } as ReleaseGroupWithName;
}

async function mock(mockedUri, stub) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { Module } = (await import('module')) as any;

  Module._load_original = Module._load;
  Module._load = (uri, parent) => {
    if (uri === mockedUri) return stub;
    return Module._load_original(uri, parent);
  };
}
