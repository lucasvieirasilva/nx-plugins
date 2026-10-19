export * from './plugins/plugin';

// The `pyproject.toml` shapes the providers read and write. Exported as types
// only (no runtime footprint) so tooling around the plugin - including this
// repo's e2e suite - can assert against the real manifest structure instead of
// re-declaring it.
export type * from './provider/poetry/types';
export type * from './provider/uv/types';

// The package-manager abstraction the executors use, for tooling that needs
// the same resolution (e.g. a project's locked requirements) outside an
// executor.
export { getProvider } from './provider/resolver';
export type { BaseProvider, RequirementsTxtOptions } from './provider/base';
