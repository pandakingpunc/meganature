import {
  Color, DirectionalLight, FogExp2, HemisphereLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer,
} from 'three';
import { createGrass } from './grass.js';
import { loadHeightfield } from './heightfield.js';
import { lighthouse } from './lighthouse.js';
import { createSheep } from './sheep.js';
import { sky, sun } from './sky.js';
import { createTerrain } from './terrain.js';
import { createUI } from './ui.js';
import { water } from './water.js';

const eyeHeight = 1.72;
const maxPitch = Math.PI / 2 - 0.05;
const maxSlope = 0.72;
const clamp = (value, min, max) => Math.min(max, Math.max(value, min));

async function start() {
  const field = await loadHeightfield();
  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'Kalsoy manzarası');
  document.getElementById('world').append(canvas);

  const scene = new Scene();
  scene.fog = new FogExp2(new Color('#a1a2a8'), 0.00016);
  const time = { value: 0 };
  const camera = new PerspectiveCamera(55, 1, 0.18, 76_000);
  const beacon = lighthouse(field);
  const startingPoint = {
    x: beacon.position.x + 67,
    z: beacon.position.z + 63,
  };
  const surface = field.heightAt(startingPoint.x, startingPoint.z);
  camera.position.set(startingPoint.x, surface + eyeHeight, startingPoint.z);

  let yaw = 138 * Math.PI / 180;
  let pitch = -0.13;
  let flying = false;
  let groundY = surface;
  let stride = 0;
  const safe = new Vector3().copy(camera.position);
  const skyDome = sky(time);
  const light = new DirectionalLight('#ffdfb1', 2.15);
  light.position.copy(sun).multiplyScalar(550);
  scene.add(skyDome, water(field, time), beacon, light, new HemisphereLight('#b5cee4', '#767047', 1.78));
  const terrain = createTerrain(scene, field, time);
  const grass = createGrass(scene, field, time);
  const sheep = createSheep(scene, field, startingPoint);
  const edge = field.half - field.spacing;
  const ui = createUI(canvas, field.meta, {
    look(dx, dy) {
      yaw -= dx * 0.00265;
      pitch = clamp(pitch - dy * 0.00265, -maxPitch, maxPitch);
    },
    toggleFlight() {
      flying = !flying;
      if (flying) return;
      if (groundY < 2 || field.slopeAt(camera.position.x, camera.position.z) > maxSlope) {
        camera.position.copy(safe);
        groundY = field.heightAt(safe.x, safe.z);
      }
      camera.position.y = groundY + eyeHeight;
    },
  });

  function walk(dx, dz) {
    const { x, z } = camera.position;
    const nextX = clamp(x + dx, -edge, edge);
    const nextZ = clamp(z + dz, -edge, edge);
    const span = Math.hypot(nextX - x, nextZ - z);
    if (span < 0.00001) return false;
    const height = field.heightAt(nextX, nextZ);
    if (height < 2 || Math.abs(height - groundY) > maxSlope * span ||
        (height > groundY && field.slopeAt(nextX, nextZ, 2) > 0.90)) return false;
    groundY = height;
    camera.position.x = nextX;
    camera.position.z = nextZ;
    return true;
  }

  function move(dt) {
    const { forward, right, vertical, fast } = ui.movement();
    const length = Math.max(1, Math.hypot(forward, right));
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const speed = flying ? (fast ? 310 : 90) : (fast ? 10.5 : 5.2);
    const dx = (right * cos - forward * sin) * dt * speed / length;
    const dz = (-right * sin - forward * cos) * dt * speed / length;
    if (flying) {
      camera.position.x = clamp(camera.position.x + dx, -edge, edge);
      camera.position.z = clamp(camera.position.z + dz, -edge, edge);
      groundY = field.heightAt(camera.position.x, camera.position.z);
      camera.position.y = clamp(camera.position.y + vertical * dt * (fast ? 255 : 78), groundY + eyeHeight, 2800);
    } else {
      let moved = false;
      if (dx || dz) moved = walk(dx, dz) || walk(dx, 0) || walk(0, dz);
      stride = moved ? stride + dt * (fast ? 13 : 9) : 0;
      camera.position.y = groundY + eyeHeight + Math.sin(stride) * 0.045;
      safe.copy(camera.position);
    }
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
  }

  let quality = 1;
  let frames = 0;
  let previous = 0;
  let windowStart = 0;
  let lastUI = -1000;
  const deviceRatio = Math.min(window.devicePixelRatio, 1.7);
  function resize() {
    renderer.setPixelRatio(deviceRatio * quality);
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  function state() {
    return {
      x: camera.position.x, y: camera.position.y, z: camera.position.z, groundY,
      ...field.toDegrees(camera.position.x, camera.position.z),
      flying, quality, pitch, bearing: ((-yaw * 180 / Math.PI) % 360 + 360) % 360,
      photo: ui.photo, frames, sheep: sheep.count, lod: terrain.levels(),
    };
  }
  if (new URLSearchParams(location.search).has('verify')) {
    Object.defineProperty(window, 'megaNatureState', { value: state });
  }

  let qualityFrames = 0;
  let healthyWindows = 0;
  function frame(now) {
    if (!previous) previous = windowStart = now;
    const dt = Math.min((now - previous) / 1000, 0.075);
    previous = now;
    time.value += dt;
    frames++;
    qualityFrames++;
    if (now - windowStart >= 2200) {
      const fps = qualityFrames * 1000 / (now - windowStart);
      const oldQuality = quality;
      if (fps < 46) quality = Math.max(0.56, quality - 0.15);
      healthyWindows = fps > 57 ? healthyWindows + 1 : 0;
      if (healthyWindows >= 3) {
        quality = Math.min(1, quality + 0.1);
        healthyWindows = 0;
      }
      if (quality !== oldQuality) resize();
      windowStart = now;
      qualityFrames = 0;
    }
    move(dt);
    skyDome.position.copy(camera.position);
    terrain.update(camera.position.x, camera.position.z);
    grass.update(camera.position);
    sheep.update(time.value, dt, camera.position);
    if (now - lastUI >= 95) {
      const { x, z, y } = camera.position;
      ui.update({
        ...field.toDegrees(x, z),
        altitude: flying ? y : groundY,
        flying,
        bearing: ((-yaw * 180 / Math.PI) % 360 + 360) % 360,
        nearLighthouse: Math.hypot(beacon.position.x - x, beacon.position.z - z) < 900,
      });
      lastUI = now;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame((now) => {
    frame(now);
    ui.show();
  });
}

start().catch((error) => {
  document.getElementById('loading').textContent = 'Harita açılamadı. WebGL 2 desteğini ve harita dosyalarını kontrol edin.';
  console.error(error);
});
