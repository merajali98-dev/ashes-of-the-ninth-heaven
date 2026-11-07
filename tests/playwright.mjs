// One place to find a browser for the browser suites, on any machine:
//   PLAYWRIGHT_MODULE  a path or file:// URL to Playwright's index.mjs (otherwise the `playwright` package is used)
//   BROWSER_PATH       a Chromium-based browser to drive (otherwise a suite's own path if it exists, else Playwright's)
// Without Playwright installed the suite explains how to get it and exits cleanly.
import {existsSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const source = process.env.PLAYWRIGHT_MODULE;
const spec = source ? (source.startsWith('file:') ? source : pathToFileURL(source).href) : 'playwright';
const mod = await import(spec).catch(() => null);
if (!mod) {
  console.log('Skipped: the browser suites need Playwright. Run `npm i -D playwright && npx playwright install chromium`, or set PLAYWRIGHT_MODULE.');
  process.exit(0);
}

export const chromium = {
  launch(options = {}) {
    const next = {...options};
    if (process.env.BROWSER_PATH) next.executablePath = process.env.BROWSER_PATH;
    else if (next.executablePath && !existsSync(next.executablePath)) delete next.executablePath;
    return mod.chromium.launch(next);
  },
};
