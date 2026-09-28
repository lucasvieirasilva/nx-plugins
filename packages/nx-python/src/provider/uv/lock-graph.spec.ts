import dedent from 'string-dedent';
import { getUvLockGraph } from './lock-graph';

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

describe('getUvLockGraph', () => {
  it('should add an external node per locked package and none for members', () => {
    const { externalNodes } = getUvLockGraph(lock());

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
    const { memberDependencies } = getUvLockGraph(lock());

    expect(memberDependencies).toStrictEqual({
      'apps/api': [
        'pypi:httpx',
        'pypi:idna',
        'pypi:numpy@2.0.0',
        'pypi:pytest',
        'pypi:uvicorn',
        'pypi:uvloop',
      ],
      'libs/shared': ['pypi:idna', 'pypi:numpy@2.0.0'],
    });
  });

  it('should change only the hash of the package that changed', () => {
    const before = getUvLockGraph(lock()).externalNodes;
    const after = getUvLockGraph(lock('0.20.0')).externalNodes;

    const changed = Object.keys(before).filter(
      (name) => before[name].data.hash !== after[name].data.hash,
    );
    expect(changed).toStrictEqual(['pypi:uvloop']);
  });
});
