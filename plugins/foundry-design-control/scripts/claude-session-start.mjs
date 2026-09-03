import { access } from 'node:fs/promises';
import { join } from 'node:path';

let input = {};
try {
  input = JSON.parse(
    await new Promise((resolve) => {
      let value = '';
      process.stdin.setEncoding('utf8');
      process.stdin.on('data', (chunk) => (value += chunk));
      process.stdin.on('end', () => resolve(value));
    }),
  );
} catch {
  process.exit(0);
}
const root = input.cwd ?? process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
try {
  await access(join(root, '.foundry', 'foundry.config.json'));
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext:
          'This workspace is configured for Foundry Design Control. When the user starts Foundry or submits a reviewed batch, use the foundry-design-control skill and keep wait_for_apply_request active until the user stops the session.',
      },
    }),
  );
} catch {
  // Non-Foundry projects receive no additional context.
}
