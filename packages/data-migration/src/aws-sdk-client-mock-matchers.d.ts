// Type augmentation for the `aws-sdk-client-mock-vitest` custom matchers that
// are registered at runtime in the global test setup (`tests/setup.ts`). This
// teaches TypeScript about `toHaveReceivedCommandWith`, `toReceiveCommand`,
// etc. so the spec files type-check. It is excluded from the library build
// (see `tsconfig.lib.json`) so it never ships in the published package.
//
// The interfaces are intentionally empty (they only merge the matcher methods
// into vitest's types) and `Assertion<T = any>` must mirror vitest's own
// signature for declaration merging, so the relevant rules are disabled here.
/* eslint-disable @typescript-eslint/no-empty-object-type, @typescript-eslint/no-empty-interface, @typescript-eslint/no-explicit-any */
import type { CustomMatcher } from 'aws-sdk-client-mock-vitest';

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatcher<T> {}
  interface AsymmetricMatchersContaining extends CustomMatcher {}
}
