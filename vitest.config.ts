import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

/**
 * The `obsidian` package ships types only, with an empty `main`, so anything
 * that imports it needs a runtime stand-in before it can be loaded in a test.
 * UI tests opt into a DOM with a `@vitest-environment happy-dom` docblock;
 * everything else stays on the faster default Node environment.
 */
export default defineConfig({
  resolve: {
    alias: {
      obsidian: fileURLToPath(
        new URL('./tests/helpers/obsidian-stub.ts', import.meta.url),
      ),
    },
  },
});
