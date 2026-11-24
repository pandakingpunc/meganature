import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import region from '../data/region.json' with { type: 'json' };

export const bucket = 'https://copernicus-dem-30m.s3.amazonaws.com';
export const tileUrl = (tile) => `${bucket}/${tile}/${tile}.tif`;
export const rawFile = (tile) => new URL(`../data/raw/${tile}.tif`, import.meta.url);

async function download(tile) {
  const file = rawFile(tile);
  const existing = await stat(file).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (existing?.size && !process.argv.includes('--force')) {
    console.log(`${tile}.tif · önbellek · ${existing.size} bayt`);
    return;
  }

  const partial = new URL(`${file.href}.${process.pid}.partial`);
  try {
    const response = await fetch(tileUrl(tile), { signal: AbortSignal.timeout(120_000) });
    if (!response.ok || !response.body) throw new Error(`${tile}: HTTP ${response.status}`);
    await pipeline(Readable.fromWeb(response.body), createWriteStream(partial));
    const { size } = await stat(partial);
    const expected = Number(response.headers.get('content-length'));
    if (!size || (expected && size !== expected)) throw new Error(`${tile}: eksik indirme`);
    await rename(partial, file);
    console.log(`${tile}.tif · ${size} bayt`);
  } finally {
    await rm(partial, { force: true });
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await mkdir(new URL('../data/raw/', import.meta.url), { recursive: true });
  await Promise.all(region.tiles.map(download));
}
