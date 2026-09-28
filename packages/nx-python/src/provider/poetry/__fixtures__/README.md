Lock files written by Poetry 2.4.1 for `apps/app1` (depends on `requests[socks]`, a local `libs/lib1`, and `iniconfig` in its dev group) and `libs/lib1` (depends on `idna`):

- `project-*.poetry.lock`: each project locked on its own.
- `shared.poetry.lock`: one lock at the root of a workspace whose `pyproject.toml` takes both projects as path dependencies and `pluggy` in its own dev group.

Each package's `files` list is cut to its first entry, and descriptions and the content hash are dropped.
