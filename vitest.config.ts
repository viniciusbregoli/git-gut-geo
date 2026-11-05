import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{web/src,server,scripts,shared}/**/*.test.{ts,tsx}'],
  },
});
