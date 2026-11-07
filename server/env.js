// Loads the gitignored .env file for local development (hosting sets real environment variables instead).
// Skipped under `node --test`, so tests never depend on a developer's settings.
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const file = fileURLToPath(new URL('../.env', import.meta.url));
if (!process.env.NODE_TEST_CONTEXT && existsSync(file)) process.loadEnvFile(file);
