# Error log

Approaches that took more than two attempts to get working. Check this before suggesting an approach to a similar task.

## Running TypeScript tests with `.js` import specifiers

**Date:** August 25, 2026

**What did not work:** Running the test files directly with Node's type stripping. The source uses `.js` import specifiers under `Node16` module resolution, which is correct for the build but does not resolve when Node strips types from `.ts` files at runtime.

**What worked instead:** A second `tsconfig.test.json` that compiles both `src/` and `tests/` to `dist-test/`, then `node --test "dist-test/tests/**/*.test.js"`.

**Note for next time:** `node --test dist-test/tests` treats the argument as a file, not a directory to scan. Use a glob pattern in quotes.
