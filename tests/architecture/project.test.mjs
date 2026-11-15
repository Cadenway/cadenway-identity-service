import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { verifyNestArchitecture } from '@cadenway/nest-testing/architecture';

test('authored code follows the Cadenway architecture', () => {
  const findings = verifyNestArchitecture({
    rootDir: fileURLToPath(new URL('../..', import.meta.url)),
    tsconfig: 'tsconfig.json',
    profile: 'service',
    exceptions: [
      {
        file: 'src/telemetry.ts',
        rule: 'service-layout',
        reason:
          'Process entry point preloaded before main.js (`node --import ./dist/telemetry.js`), as @cadenway/nest-common documents; the service profile lists main.ts and migrate.ts only.',
      },
    ],
  });
  assert.equal(
    findings.length,
    0,
    findings
      .map(({ file, line, rule, message }) => `${file}:${line} [${rule}] ${message}`)
      .join('\n'),
  );
});
