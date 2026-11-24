import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const fromRoot = (path) => fileURLToPath(new URL(path, import.meta.url));
const output = fromRoot('./dist/');
await rm(output, { recursive: true, force: true });
await mkdir(output);
await Promise.all([
  build({
    absWorkingDir: fromRoot('./'),
    entryPoints: ['src/main.js', 'src/style.css'],
    outdir: output,
    bundle: true,
    minify: true,
    target: ['es2022'],
    format: 'esm',
    logLevel: 'info',
  }),
  cp(fromRoot('./src/index.html'), fromRoot('./dist/index.html')),
  cp(fromRoot('./public/'), output, { recursive: true }),
  cp(fromRoot('./THIRD_PARTY_LICENSES.txt'), fromRoot('./dist/THIRD_PARTY_LICENSES.txt')),
]);
