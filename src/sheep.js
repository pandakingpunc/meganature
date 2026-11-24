import {
  ConeGeometry, CylinderGeometry, DynamicDrawUsage, IcosahedronGeometry, InstancedMesh,
  Matrix4, MeshStandardMaterial, Object3D, PlaneGeometry, ShaderMaterial,
} from 'three';
import { randomGenerator } from './grass.js';

export function createSheep(scene, field, start) {
  const random = randomGenerator(0x4b414c);
  const size = 36;
  const body = new InstancedMesh(new IcosahedronGeometry(1, 1), new MeshStandardMaterial({ roughness: 1, flatShading: true }), size);
  const head = new InstancedMesh(new IcosahedronGeometry(1, 0), new MeshStandardMaterial({ color: '#242322', roughness: 1, flatShading: true }), size);
  const legs = new InstancedMesh(new CylinderGeometry(0.045, 0.031, 0.39, 5), head.material, size * 4);
  const ears = new InstancedMesh(new ConeGeometry(0.065, 0.23, 4), head.material, size * 2);
  const shadow = new InstancedMesh(new PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      void main() {
        float r = length(vUv-0.5)*2.0;
        gl_FragColor = vec4(0.055,0.073,0.045,0.36*(1.0-smoothstep(0.15,1.0,r)));
        #include <colorspace_fragment>
      }
    `,
  }), size);
  for (const mesh of [body, head, legs, ears, shadow]) {
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  const flock = [];
  const centers = [
    { x: start.x - 9, z: start.z + 15, radius: 21, count: 12, foreground: true },
    { x: start.x - 19, z: start.z + 41, radius: 30, count: 10, foreground: true },
    { ...field.toWorld(62.3605, -6.8025), radius: 210, count: 8 },
    { ...field.toWorld(62.3468, -6.7931), radius: 330, count: 6 },
  ];
  const eye = field.heightAt(start.x, start.z) + 1.72;
  function visibleFromStart(x, z, height) {
    for (let t = 0.1; t < 1; t += 0.1) {
      const intervening = field.heightAt(start.x + (x - start.x) * t, start.z + (z - start.z) * t);
      if (intervening > eye + (height + 0.43 - eye) * t) return false;
    }
    return true;
  }
  for (const { x, z, radius, count, foreground } of centers) {
    let placed = 0;
    for (let trial = 0; trial < 350 && placed < count; trial++) {
      const angle = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * radius;
      const ax = x + Math.cos(angle) * r;
      const az = z + Math.sin(angle) * r;
      const height = field.heightAt(ax, az);
      if (height < 15 || field.slopeAt(ax, az) > 0.58 || Math.hypot(ax - start.x, az - start.z) < 5.5 ||
          (foreground && !visibleFromStart(ax, az, height)) ||
          flock.some((sheep) => Math.hypot(sheep.x - ax, sheep.z - az) < 1.5)) continue;
      flock.push({
        x: ax, z: az, homeX: ax, homeZ: az,
        angle: random() * Math.PI * 2, phase: random() * 8,
        black: random() < 0.23, size: 0.85 + random() * 0.22,
      });
      placed++;
    }
  }
  body.count = head.count = flock.length;
  legs.count = flock.length * 4;
  ears.count = flock.length * 2;
  const pose = new Object3D();
  const shadowPose = new Matrix4();
  const fleece = body.material.color.clone();
  return {
    count: flock.length,
    update(time, elapsed, viewer) {
      const cursor = { body: 0, head: 0, legs: 0, ears: 0, shadow: 0 };
      for (const [index, sheep] of flock.entries()) {
        const phase = time + sheep.phase;
        const walking = Math.sin(phase * 0.46) > 0.35;
        if (walking) {
          const turn = Math.sin(phase * 0.53) * 0.34;
          sheep.angle += elapsed * turn;
          const x = sheep.x + Math.sin(sheep.angle) * elapsed * 0.61;
          const z = sheep.z + Math.cos(sheep.angle) * elapsed * 0.61;
          if (field.heightAt(x, z) > 8 && field.slopeAt(x, z, 2) < 0.66 &&
              Math.hypot(x - sheep.homeX, z - sheep.homeZ) < 26) {
            sheep.x = x;
            sheep.z = z;
          } else {
            sheep.angle += elapsed * 3.1;
          }
        }
        const y = field.heightAt(sheep.x, sheep.z);
        const distanceSq = viewer.distanceToSquared(pose.position.set(sheep.x, y, sheep.z));
        if (distanceSq > 1350 ** 2) continue;
        const sine = Math.sin(sheep.angle);
        const cosine = Math.cos(sheep.angle);
        const scale = sheep.size;
        const place = (mesh, i, x, h, z, sx, sy, sz, pitch = 0, roll = 0) => {
          pose.position.set(sheep.x + (x * cosine + z * sine) * scale,
            y + h * scale, sheep.z + (-x * sine + z * cosine) * scale);
          pose.rotation.set(pitch, sheep.angle, roll, 'YXZ');
          pose.scale.set(sx * scale, sy * scale, sz * scale);
          pose.updateMatrix();
          mesh.setMatrixAt(i, pose.matrix);
        };
        body.setColorAt(cursor.body, fleece.set(sheep.black ? '#444043' : (index % 3 === 0 ? '#e5d4b5' : '#f8edd9')));
        place(body, cursor.body++, 0, 0.63, -0.05, 0.34, 0.36, 0.61);
        if (distanceSq < 90 ** 2) {
          const gx = field.heightAt(sheep.x + 0.5, sheep.z) - field.heightAt(sheep.x - 0.5, sheep.z);
          const gz = field.heightAt(sheep.x, sheep.z + 0.5) - field.heightAt(sheep.x, sheep.z - 0.5);
          const across = 0.43 * scale;
          const along = 0.72 * scale;
          shadowPose.set(
            cosine * across, 0, sine * along, sheep.x,
            (gx * cosine - gz * sine) * across, 1, (gx * sine + gz * cosine) * along, y + 0.045,
            -sine * across, 0, cosine * along, sheep.z,
            0, 0, 0, 1,
          );
          shadow.setMatrixAt(cursor.shadow++, shadowPose);
        }
        const grazing = walking ? 0 : 0.31 + Math.sin(phase * 2.0) * 0.046;
        place(head, cursor.head++, 0, 0.78 - grazing, 0.57 + grazing * 0.34, 0.15, 0.21, 0.22, grazing * 1.6);
        for (const side of [-1, 1]) {
          place(ears, cursor.ears++, side * 0.13, 0.86 - grazing, 0.55 + grazing * 0.34, 1, 1, 1, 0.2, -side * 1.13);
          for (const end of [-1, 1]) {
            const swing = walking ? Math.sin(phase * 8.4) * 0.34 * side * end : 0;
            const z = end * 0.32 - 0.05;
            const x = side * 0.2;
            const footY = field.heightAt(sheep.x + (x * cosine + z * sine) * scale,
              sheep.z + (-x * sine + z * cosine) * scale);
            const length = Math.max(0.18, 0.47 + (y - footY) / scale);
            place(legs, cursor.legs++, x, 0.48 - length / 2, z, 1, length / 0.39, 1, swing);
          }
        }
      }
      for (const [name, mesh] of Object.entries({ body, head, legs, ears, shadow })) {
        mesh.count = cursor[name];
        mesh.instanceMatrix.needsUpdate = true;
      }
      if (body.instanceColor) body.instanceColor.needsUpdate = true;
    },
  };
}
