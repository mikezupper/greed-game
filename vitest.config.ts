import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { gyralVitePreset } from '@gyral/core/vite';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', environment: 'node', include: ['tests/unit/**/*.test.ts'], testTimeout: 30_000 } },
      {
        ...gyralVitePreset({ clientOnly: true, optimize: ['@gyral/core'] }),
        test: {
          name: 'browser', include: ['tests/browser/**/*.test.ts'], testTimeout: 30_000,
          browser: {
            enabled: true, headless: true,
            provider: playwright({ launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } }),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
