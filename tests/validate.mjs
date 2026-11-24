import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import region from '../data/region.json' with { type: 'json' };
import { preview } from '../server.mjs';
import { Heightfield } from '../src/heightfield.js';

const shots = new URL('./shots/', import.meta.url);
const map = new URL('../dist/maps/faroe-north/', import.meta.url);
const metadata = JSON.parse(await readFile(new URL('meta.json', map), 'utf8'));
const binary = await readFile(new URL('height.bin', map));
assert.deepEqual(metadata.bbox, region.bbox);
assert.equal(metadata.verticalExaggeration, 1);
assert.equal(metadata.seaLevel, 0);
assert.equal(metadata.width, region.samples);
assert.equal(binary.length, metadata.width * metadata.height * 2);
const field = new Heightfield(metadata, binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.length));
let min = Infinity, max = -Infinity;
for (const meters of field.samples) {
  min = Math.min(min, meters);
  max = Math.max(max, meters);
}
assert.equal(min, metadata.minElevation);
assert.ok(Math.abs(max - metadata.maxElevation) < 0.001);
assert.ok(max >= 850 && max <= 880, `Bölge maksimumu beklenen aralığın dışında: ${max}`);

// GPS positions from Umhvørvisstovan, with the OSM point for the broad Kunoy summit.
for (const [name, latitude, longitude, reference, radius, low, high] of [
  ['Slættaratindur', 62.296717, -7.0132, 880, 60, 850, 880],
  ['Kúvingafjall', 62.3134209, -6.6693841, 830, 150, 790, 835],
  ['Nestindar', 62.35075, -6.79825, 788, 60, 700, 790],
  ['Sandfelli (Gjógv)', 62.319383, -6.988617, 752, 60, 725, 760],
]) {
  const { x, z } = field.toWorld(latitude, longitude);
  const exact = field.heightAt(x, z);
  let local = exact;
  for (let dz = -radius; dz <= radius; dz += 6) {
    for (let dx = -radius; dx <= radius; dx += 6) {
      if (Math.hypot(dx, dz) <= radius) local = Math.max(local, field.heightAt(x + dx, z + dz));
    }
  }
  assert.ok(local >= low && local <= high, `${name}: beklenen ${low}–${high} m, örneklenen ${local} m`);
  console.log(`DEM ${name} · nokta ${exact.toFixed(1)} m · ${radius} m çevre ${local.toFixed(1)} m · referans ${reference} m`);
}
const beacon = field.toWorld(metadata.lighthouse.latitude, metadata.lighthouse.longitude);
const beaconHeight = field.heightAt(beacon.x, beacon.z);
assert.ok(beaconHeight > 150 && beaconHeight < metadata.lighthouse.focalElevation);
const focalDifference = metadata.lighthouse.focalElevation - beaconHeight;
console.log(`DEM Kallur · zemin ${beaconHeight.toFixed(1)} m · ışık odak kotu ${metadata.lighthouse.focalElevation} m · fark ${focalDifference.toFixed(1)} m`);
console.log(`DEM ${metadata.width} × ${metadata.height} · ${binary.length} bayt · ${metadata.metersPerPixel.toFixed(3)} m/örnek · ${min}–${max.toFixed(1)} m`);

await mkdir(shots, { recursive: true });
const scratch = new URL('../data/raw/playwright/', import.meta.url);
await mkdir(scratch, { recursive: true });
if (process.platform === 'win32') process.env.TEMP = process.env.TMP = fileURLToPath(scratch);
else process.env.TMPDIR = fileURLToPath(scratch);

const server = await preview();
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const errors = [];
const external = [];
const shot = (name) => fileURLToPath(new URL(name, shots));
const state = (page) => page.evaluate(() => window.megaNatureState());
const track = (page) => {
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', (request) => { if (!request.url().startsWith(origin + '/')) external.push(request.url()); });
};

function samplePixels(buffer) {
  const png = PNG.sync.read(buffer);
  const colors = new Set();
  let lit = 0, samples = 0;
  for (let y = 10; y < png.height - 10; y += 8) {
    for (let x = 10; x < png.width - 10; x += 8) {
      const offset = (y * png.width + x) * 4;
      const [r, g, b] = png.data.subarray(offset, offset + 3);
      if (Math.max(r, g, b) > 35) lit++;
      samples++;
      colors.add(`${r >> 3},${g >> 3},${b >> 3}`);
    }
  }
  assert.ok(lit / samples > 0.8 && colors.size > 125, `Canvas örnekleri boş veya tekdüze: ${lit}/${samples}, ${colors.size} renk`);
  return `${lit}/${samples} aydınlık piksel, ${colors.size} renk grubu`;
}

try {
  browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-unsafe-swiftshader'] });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await desktop.newPage();
  track(page);
  await page.goto(`${origin}/?verify=1`);
  await page.locator('#hud').waitFor({ state: 'visible', timeout: 45_000 });
  await page.waitForFunction(() => window.megaNatureState().frames >= 4);
  const adapter = await page.locator('canvas').evaluate((canvas) => {
    const context = canvas.getContext('webgl2');
    const info = context.getExtension('WEBGL_debug_renderer_info');
    return info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER);
  });
  console.log(`Microsoft Edge ${browser.version()} · ${adapter}`);

  const opening = await state(page);
  assert.equal(opening.flying, false);
  assert.ok(opening.sheep >= 20 && opening.sheep <= 60);
  assert.ok(opening.lod.length >= 2);
  await page.screenshot({ path: shot('01-kallur.png') });
  await page.keyboard.press('p');
  await page.locator('#hud').waitFor({ state: 'hidden' });
  assert.equal((await state(page)).photo, true);
  console.log(`Canvas · ${samplePixels(await page.locator('canvas').screenshot())} · LOD adımları ${opening.lod.join(', ')} · ${opening.sheep} koyun`);
  await page.keyboard.press('p');
  await page.locator('#hud').waitFor({ state: 'visible' });
  const performance = await page.evaluate(async () => {
    const start = window.megaNatureState();
    const begin = globalThis.performance.now();
    await new Promise((resolve) => setTimeout(resolve, 2200));
    const end = window.megaNatureState();
    return { fps: (end.frames - start.frames) * 1000 / (globalThis.performance.now() - begin), quality: end.quality };
  });
  console.log(`Açılışta ${performance.fps.toFixed(1)} fps (2,2 sn) · render ölçeği ${performance.quality.toFixed(2)}`);

  await page.getByRole('button', { name: 'Kaynaklar' }).click();
  assert.match(await page.locator('#attribution').textContent(), /© DLR e\.V\. 2010-2014/);
  await page.getByRole('button', { name: 'Kapat' }).click();
  await page.getByRole('button', { name: 'Keşfe başla' }).click();
  await page.waitForFunction(() => document.pointerLockElement === document.querySelector('canvas'));
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => !document.pointerLockElement);
  console.log('Pointer lock, fotoğraf modu ve kaynak atfı geçti.');

  const beforeWalk = await state(page);
  await page.keyboard.down('w');
  await page.waitForFunction(({ x, z }) => {
    const s = window.megaNatureState();
    if (s.y <= s.groundY) throw new Error('Yürüyüşte kamera arazinin altına indi.');
    return Math.hypot(s.x - x, s.z - z) >= 4;
  }, beforeWalk, { timeout: 15_000 });
  await page.keyboard.up('w');
  const walked = await state(page);
  assert.ok(walked.y - walked.groundY > 1.6 && walked.y - walked.groundY < 1.85);
  console.log(`W · ${Math.hypot(walked.x - beforeWalk.x, walked.z - beforeWalk.z).toFixed(2)} m hareket · kamera zeminden ${(walked.y - walked.groundY).toFixed(2)} m yukarıda`);

  await page.keyboard.press('f');
  await page.waitForFunction(() => document.getElementById('mode').value === 'Uçuş');
  assert.equal((await state(page)).flying, true);
  await page.mouse.move(720, 380);
  await page.mouse.down();
  await page.mouse.move(492, 451, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => {
    const s = window.megaNatureState();
    return s.bearing >= 185 && s.bearing <= 190 && s.pitch < -0.28;
  });
  await page.keyboard.down('Shift');
  await page.keyboard.down('s');
  await page.keyboard.down('e');
  await page.waitForFunction(() => window.megaNatureState().y >= 1750, undefined, { timeout: 45_000 });
  await page.keyboard.up('e');
  await page.waitForFunction(({ x, z }) => {
    const s = window.megaNatureState();
    return Math.hypot(s.x - x, s.z - z) >= 5150;
  }, walked, { timeout: 45_000 });
  await page.keyboard.up('s');
  await page.keyboard.up('Shift');
  await page.mouse.move(720, 380);
  await page.mouse.down();
  await page.mouse.move(674, 348, { steps: 6 });
  await page.mouse.up();
  await page.waitForFunction(() => document.getElementById('heading').value.startsWith('180'));
  const airborne = await state(page);
  assert.equal(airborne.flying, true);
  console.log(`F / E / Shift · ${airborne.y.toFixed(1)} m rakım, ${Math.hypot(airborne.x - walked.x, airborne.z - walked.z).toFixed(1)} m yatay uçuş · render ölçeği ${airborne.quality.toFixed(2)}`);
  await page.screenshot({ path: shot('02-ucus.png') });
  await page.keyboard.down('q');
  await page.waitForFunction((y) => window.megaNatureState().y < y - 8, airborne.y);
  await page.keyboard.up('q');
  await page.keyboard.press('f');
  await page.waitForFunction(() => document.getElementById('mode').value === 'Yürüyüş');
  const landed = await state(page);
  assert.ok(!landed.flying && landed.y > landed.groundY && landed.groundY > 2);
  console.log('Q ile alçalma ve F ile yürüyüşe dönüş geçti.');

  const mobile = await browser.newContext({ viewport: { width: 430, height: 760 }, isMobile: true, hasTouch: true });
  const touchPage = await mobile.newPage();
  track(touchPage);
  await touchPage.goto(`${origin}/?verify=1`);
  const joystick = touchPage.locator('#joystick');
  await joystick.waitFor({ state: 'visible', timeout: 45_000 });
  const box = await joystick.boundingBox();
  const mobileStart = await state(touchPage);
  const cdp = await mobile.newCDPSession(touchPage);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + 11 }],
  });
  await touchPage.waitForFunction(({ x, z }) => {
    const s = window.megaNatureState();
    return Math.hypot(s.x - x, s.z - z) > 0.9;
  }, mobileStart);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touchPage.getByRole('button', { name: 'Uçuş' }).tap();
  await touchPage.getByRole('button', { name: 'Yüksel' }).waitFor({ state: 'visible' });
  assert.equal((await state(touchPage)).flying, true);
  await touchPage.getByRole('button', { name: 'Fotoğraf', exact: true }).tap();
  await touchPage.getByRole('button', { name: 'Fotoğraf modundan çık' }).tap();
  await joystick.waitFor({ state: 'visible' });
  console.log('Dokunmatik joystick, uçuş düğmesi ve fotoğraf modu geçti (Edge dokunmatik emülasyonu).');
  assert.deepEqual(errors, [], 'Konsol veya sayfa hataları');
  assert.deepEqual(external, [], 'Harici ağ istekleri');
  console.log('0 konsol/sayfa hatası · 0 harici istek · tests/shots/01-kallur.png ve tests/shots/02-ucus.png');
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
