import dedent from 'string-dedent';
import { getUvLockGraph } from './lock-graph';

const shared = (text: string, path = 'uv.lock') =>
  getUvLockGraph([{ path, text }], true);

const lock = (uvloop = '0.19.0') => dedent`
  version = 1
  requires-python = ">=3.12"

  [[package]]
  name = "api"
  version = "0.1.0"
  source = { editable = "apps/api" }
  dependencies = [
      { name = "httpx" },
      { name = "shared" },
  ]

  [package.optional-dependencies]
  server = [
      { name = "uvicorn", extra = ["standard"] },
  ]

  [package.dev-dependencies]
  dev = [
      { name = "pytest" },
  ]

  [[package]]
  name = "shared"
  version = "0.1.0"
  source = { editable = "libs/shared" }
  dependencies = [
      { name = "idna" },
      { name = "numpy", version = "2.0.0", source = { registry = "https://pypi.org/simple" } },
  ]

  [[package]]
  name = "httpx"
  version = "0.27.0"
  source = { registry = "https://pypi.org/simple" }
  dependencies = [
      { name = "idna" },
  ]
  sdist = { url = "https://example.invalid/httpx.tar.gz", hash = "sha256:aaa" }

  [[package]]
  name = "idna"
  version = "3.7"
  source = { registry = "https://pypi.org/simple" }
  wheels = [
      { url = "https://example.invalid/idna.whl", hash = "sha256:bbb" },
  ]

  [[package]]
  name = "numpy"
  version = "1.26.4"
  source = { registry = "https://pypi.org/simple" }

  [[package]]
  name = "numpy"
  version = "2.0.0"
  source = { registry = "https://pypi.org/simple" }

  [[package]]
  name = "pytest"
  version = "8.0.0"
  source = { registry = "https://pypi.org/simple" }

  [[package]]
  name = "unused"
  version = "1.0.0"
  source = { registry = "https://pypi.org/simple" }

  [[package]]
  name = "uvicorn"
  version = "0.30.0"
  source = { registry = "https://pypi.org/simple" }

  [package.optional-dependencies]
  standard = [
      { name = "uvloop" },
  ]

  [[package]]
  name = "uvloop"
  version = "${uvloop}"
  source = { registry = "https://pypi.org/simple" }
`;

// Written by `uv lock` (0.8.13) for a project taking demo 1.0.0 from one local
// wheel on Linux and from another elsewhere.
const twoSources = (
  wheelB = '17caf46e2c8b7a805a4f8eb900375f368a1b68a94e34bdc4e87af6ab8f42f4c7',
) => dedent`
  version = 1
  revision = 3
  requires-python = ">=3.12"
  resolution-markers = [
      "sys_platform == 'linux'",
      "sys_platform != 'linux'",
  ]

  [[package]]
  name = "demo"
  version = "1.0.0"
  source = { path = "wheels-a/demo-1.0.0-py2.py3-none-any.whl" }
  resolution-markers = [
      "sys_platform == 'linux'",
  ]
  wheels = [
      { filename = "demo-1.0.0-py2.py3-none-any.whl", hash = "sha256:0fbdc4c17930841dcff77436999762eb9de94f5ffb6afe2c9dbea87cb3504eff" },
  ]

  [[package]]
  name = "demo"
  version = "1.0.0"
  source = { path = "wheels-b/demo-1.0.0-py2.py3-none-any.whl" }
  resolution-markers = [
      "sys_platform != 'linux'",
  ]
  wheels = [
      { filename = "demo-1.0.0-py2.py3-none-any.whl", hash = "sha256:${wheelB}" },
  ]

  [[package]]
  name = "root"
  version = "0.1.0"
  source = { virtual = "." }
  dependencies = [
      { name = "demo", version = "1.0.0", source = { path = "wheels-a/demo-1.0.0-py2.py3-none-any.whl" }, marker = "sys_platform == 'linux'" },
      { name = "demo", version = "1.0.0", source = { path = "wheels-b/demo-1.0.0-py2.py3-none-any.whl" }, marker = "sys_platform != 'linux'" },
  ]

  [package.metadata]
  requires-dist = [
      { name = "demo", marker = "sys_platform != 'linux'", path = "wheels-b/demo-1.0.0-py2.py3-none-any.whl" },
      { name = "demo", marker = "sys_platform == 'linux'", path = "wheels-a/demo-1.0.0-py2.py3-none-any.whl" },
  ]
`;

describe('getUvLockGraph', () => {
  it('should add an external node per locked package and none for members', () => {
    const { externalNodes } = shared(lock());

    expect(Object.keys(externalNodes).sort()).toStrictEqual([
      'pypi:httpx',
      'pypi:idna',
      'pypi:numpy@1.26.4',
      'pypi:numpy@2.0.0',
      'pypi:pytest',
      'pypi:unused',
      'pypi:uvicorn',
      'pypi:uvloop',
    ]);
    expect(externalNodes['pypi:httpx']).toStrictEqual({
      type: 'pypi',
      name: 'pypi:httpx',
      data: {
        version: '0.27.0',
        packageName: 'httpx',
        hash: expect.any(String),
      },
    });
  });

  it('should list what each member installs through dependencies, extras, groups and other members', () => {
    const { members } = shared(lock());

    expect(members).toStrictEqual({
      'apps/api': {
        lockFile: 'uv.lock',
        dependencies: [
          'pypi:httpx',
          'pypi:idna',
          'pypi:numpy@2.0.0',
          'pypi:pytest',
          'pypi:uvicorn',
          'pypi:uvloop',
        ],
      },
      'libs/shared': {
        lockFile: 'uv.lock',
        dependencies: ['pypi:idna', 'pypi:numpy@2.0.0'],
      },
    });
  });

  it('should change only the hash of the package that changed', () => {
    const before = shared(lock()).externalNodes;
    const after = shared(lock('0.20.0')).externalNodes;

    const changed = Object.keys(before).filter(
      (name) => before[name].data.hash !== after[name].data.hash,
    );
    expect(changed).toStrictEqual(['pypi:uvloop']);
  });

  it('should keep packages that share a name and version but not a source apart', () => {
    const { externalNodes, members } = shared(twoSources());

    const names = Object.keys(externalNodes);
    expect(names).toHaveLength(2);
    for (const name of names) {
      expect(name).toMatch(/^pypi:demo@1\.0\.0#[0-9a-f]{8}$/);
    }
    expect(members['.'].dependencies).toStrictEqual(
      [...names].sort((a, b) => a.localeCompare(b)),
    );

    const after = shared(twoSources('0'.repeat(64))).externalNodes;
    const changed = names.filter(
      (name) => externalNodes[name].data.hash !== after[name].data.hash,
    );
    expect(changed).toHaveLength(1);
  });

  it('should follow an edge only to the source it names', () => {
    const before = shared(twoSources()).externalNodes;
    const after = shared(twoSources('0'.repeat(64))).externalNodes;
    const [wheelB] = Object.keys(before).filter(
      (name) => before[name].data.hash !== after[name].data.hash,
    );
    const onlyA = twoSources()
      .split('\n')
      .filter(
        (line) =>
          !line.includes(
            '{ name = "demo", version = "1.0.0", source = { path = "wheels-b/',
          ),
      )
      .join('\n');

    expect(shared(onlyA).members['.'].dependencies).toStrictEqual(
      Object.keys(before).filter((name) => name !== wheelB),
    );
  });

  it('should resolve members against the directory of the lock file', () => {
    expect(shared(lock(), 'python/uv.lock').members).toMatchObject({
      'python/apps/api': { lockFile: 'python/uv.lock' },
      'python/libs/shared': { lockFile: 'python/uv.lock' },
    });
  });

  it("should read only a project's own entry from its own lock", () => {
    const own = (name: string, deps: string, packages: string) => dedent`
      version = 1
      requires-python = ">=3.12"

      [[package]]
      name = "${name}"
      version = "0.1.0"
      source = { editable = "." }
      dependencies = [${deps}]
      ${packages}
    `;
    const lib = dedent`
      [[package]]
      name = "lib"
      version = "0.1.0"
      source = { editable = "../lib" }
      dependencies = [{ name = "six" }]

      [[package]]
      name = "six"
      version = "1.16.0"
      source = { registry = "https://pypi.org/simple" }
    `;
    const graph = getUvLockGraph(
      [
        { path: 'app/uv.lock', text: own('app', '{ name = "lib" }', lib) },
        {
          path: 'lib/uv.lock',
          text: own(
            'lib',
            '{ name = "six" }',
            dedent`
              [[package]]
              name = "six"
              version = "1.16.0"
              source = { registry = "https://pypi.org/simple" }
            `,
          ),
        },
      ],
      false,
    );

    expect(graph.members).toStrictEqual({
      app: { lockFile: 'app/uv.lock', dependencies: ['pypi:six'] },
      lib: { lockFile: 'lib/uv.lock', dependencies: ['pypi:six'] },
    });
    expect(Object.keys(graph.externalNodes)).toStrictEqual(['pypi:six']);
  });
});
