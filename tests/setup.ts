import Honeybadger from "@honeybadger-io/js";

/**
 * Global Vitest test setup file.
 *
 * Guarantees that no error during test execution is ever transmitted to Honeybadger:
 * 1. Disables Honeybadger data reporting (`reportData: false`).
 * 2. Sets environment to "test".
 * 3. Registers a `beforeNotify` handler returning `false` to abort notifications.
 * 4. Stubs `Honeybadger.notify` to guarantee zero outbound network requests.
 */
Honeybadger.configure({
  apiKey: "test-environment-disabled",
  environment: "test",
  reportData: false,
});

Honeybadger.beforeNotify(() => false);

// Stub notify to completely neutralize error dispatch during testing
Honeybadger.notify = (() => false) as any;
