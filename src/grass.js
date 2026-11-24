import { BufferAttribute, BufferGeometry, DoubleSide, InstancedMesh, Object3D, ShaderMaterial } from 'three';
import { atmosphereGLSL, noiseGLSL, sun } from './sky.js';

export function randomGenerator(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

function tuft() {
  const positions = [];
  const random = randomGenerator(36);
  for (let i = 0; i < 9; i++) {
    const angle = random() * Math.PI * 2;
    const x = Math.cos(angle), z = Math.sin(angle);
    const spread = random() * 0.24;
    const width = 0.023 + random() * 0.031;
    const bend = 0.16 + random() * 0.16;
    const height = 0.25 + random() * 0.36;
    const a = [x * spread - z * width, -0.025, z * spread + x * width];
    const b = [x * spread + z * width, -0.025, z * spread - x * width];
    const c = [x * (spread + bend * 0.36) - z * width * 0.57, height * 0.58, z * (spread + bend * 0.36) + x * width * 0.57];
    const d = [x * (spread + bend * 0.36) + z * width * 0.57, height * 0.58, z * (spread + bend * 0.36) - x * width * 0.57];
    const end = [x * (spread + bend), height, z * (spread + bend)];
    positions.push(...a, ...b, ...c, ...b, ...d, ...c, ...c, ...d, ...end);
  }
  return new BufferGeometry().setAttribute('position', new BufferAttribute(Float32Array.from(positions), 3));
}

export function createGrass(scene, field, time) {
  const material = new ShaderMaterial({
    side: DoubleSide,
    uniforms: { uTime: time, uSun: { value: sun } },
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying float vTint, vTip;
      void main() {
        vec4 p = instanceMatrix * vec4(position,1.0);
        float gust = sin(p.x*0.11+p.z*0.047+uTime*2.7)+0.55*sin(p.z*0.12+uTime*1.47);
        p.x += gust*position.y*position.y*0.42;
        p.z += gust*position.y*0.078;
        vTint = fract(sin(dot(instanceMatrix[3].xz,vec2(0.217,0.411)))*1712.95);
        vTip = smoothstep(0.0,0.63,position.y);
        vWorld = p.xyz;
        gl_Position = projectionMatrix*modelViewMatrix*p;
      }
    `,
    fragmentShader: `
      varying vec3 vWorld;
      varying float vTint, vTip;
      ${noiseGLSL}
      ${atmosphereGLSL}
      void main() {
        vec3 dry = mix(vec3(0.19,0.28,0.041),vec3(0.42,0.34,0.081),vTint*vTint);
        vec3 color = mix(vec3(0.041,0.087,0.019),dry,vTip);
        gl_FragColor = vec4(haze(color,vWorld),1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const capacity = 4600;
  const mesh = new InstancedMesh(tuft(), material, capacity);
  const dummy = new Object3D();
  mesh.frustumCulled = false;
  mesh.count = 0;
  scene.add(mesh);
  let cellX, cellZ;
  const extent = 125;
  const stride = 1.9;

  return {
    update(camera) {
      const nextX = Math.floor(camera.x / 42);
      const nextZ = Math.floor(camera.z / 42);
      mesh.visible = camera.y - field.heightAt(camera.x, camera.z) < 125;
      if (!mesh.visible || (nextX === cellX && nextZ === cellZ)) return;
      cellX = nextX;
      cellZ = nextZ;
      let count = 0;
      const minX = Math.floor((cellX * 42 - extent) / stride);
      const minZ = Math.floor((cellZ * 42 - extent) / stride);
      const side = Math.ceil(extent * 2 / stride);
      for (let j = 0; j < side; j++) {
        for (let i = 0; i < side; i++) {
          const col = minX + i;
          const row = minZ + j;
          const random = randomGenerator(Math.imul(col, 374761393) ^ Math.imul(row, 668265263));
          const x = (col + random()) * stride;
          const z = (row + random()) * stride;
          const radius = Math.hypot(x - cellX * 42, z - cellZ * 42);
          if (radius > extent || random() > (radius < 32 ? 0.82 : 0.29)) continue;
          const y = field.heightAt(x, z);
          if (y < 7 || y > 720 || field.slopeAt(x, z, 2) > 0.68 || count === capacity) continue;
          dummy.position.set(x, y, z);
          dummy.rotation.y = random() * Math.PI * 2;
          const scale = 0.63 + random() * 0.76;
          dummy.scale.set(scale, scale * (0.73 + random() * 0.51), scale);
          dummy.updateMatrix();
          mesh.setMatrixAt(count++, dummy.matrix);
        }
      }
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
