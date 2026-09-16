// Prints the page-checks function for injection into the live Netflix page.
//   npm run smoke:snippet -- '{"mode":"stacked"}'   → immediately-invoked call, returns the report
//   npm run smoke:snippet -- --define                → `window.__dsubsCheck = function ...;` for reuse
import { runPageChecks } from './page-checks.js';

const arg = process.argv[2] ?? '{}';
if (arg === '--define') {
  process.stdout.write(`window.__dsubsCheck = ${runPageChecks.toString()};\n`);
} else {
  JSON.parse(arg);
  process.stdout.write(`(${runPageChecks.toString()})(document, ${arg})\n`);
}
