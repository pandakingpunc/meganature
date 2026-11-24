import { BufferAttribute, BufferGeometry, Mesh, ShaderMaterial, Sphere, Vector3 } from 'three';
import { atmosphereGLSL, noiseGLSL, sun } from './sky.js';

const cells = 64;
const steps = [1, 2, 4, 8];
const lodDistances = [1550, 3500, 6900];
const coastalLodDistances = [1550, 5500, 7900];

function createMaterial(time) {
  return new ShaderMaterial({
    uniforms: { uTime: time, uSun: { value: sun } },
    vertexShader: `
      varying vec3 vWorld, vNormal;
      void main() {
        vWorld = position;
        vNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vWorld, vNormal;
      ${noiseGLSL}
      ${atmosphereGLSL}
      void main() {
        if (vWorld.y < 0.025) discard;
        vec3 normal = normalize(vNormal);
        vec2 world = vWorld.xz;
        float distanceToEye = distance(vWorld,cameraPosition);
        float broad = fbm(world*0.009);
        float small = noise2(world*0.26);
        float grain = noise2(world*3.5)*0.47+noise2(world*1.25)*0.38+small*0.15;
        float steepness = 1.0-normal.y;
        float stratum = noise2(vec2(world.x*0.017+world.y*0.013,vWorld.y*0.138)+vec2(0.0,noise2(world*0.025)*1.5));
        float basalt = smoothstep(0.115,0.43,steepness+(broad-0.46)*0.13+(stratum-0.5)*0.045);
        float grassHue = smoothstep(0.17,0.8,broad);
        vec3 grass = mix(vec3(0.064,0.112,0.033),vec3(0.27,0.36,0.064),grassHue);
        grass *= 0.8+small*0.37;
        grass = mix(grass,vec3(0.255,0.212,0.069),smoothstep(530.0,857.0,vWorld.y)*0.45);
        vec3 rock = mix(vec3(0.057,0.061,0.067),vec3(0.23,0.21,0.18),broad*0.59+stratum*0.23);
        rock *= 0.78 + 0.22*stratum + small*0.23;
        vec3 color = mix(grass,rock,basalt);
        float detail = 1.0-smoothstep(42.0,260.0,distanceToEye);
        color *= 1.0 + (grain-0.5)*0.72*detail;
        normal = normalize(normal+vec3(small-0.5,0.0,grain-0.5)*0.13*detail);
        float light = max(dot(normal,uSun),0.0);
        vec3 diffuse = vec3(0.58,0.66,0.75)+vec3(1.14,0.78,0.43)*light;
        color *= diffuse;
        color = haze(color,vWorld);
        gl_FragColor = vec4(color,1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createTerrain(scene, field, time) {
  const { size, spacing, half } = field;
  const count = (size - 1) / cells;
  if (!Number.isInteger(count)) throw new Error('Arazi parçası yüksekliğe bölünemiyor.');

  const material = createMaterial(time);
  const indexCache = new Map();
  const tiles = new Map();
  for (let row = 0; row < count; row++) {
    for (let column = 0; column < count; column++) {
      const x0 = column * cells;
      const z0 = row * cells;
      let peak = 0;
      let coastal = false;
      for (let z = 0; z <= cells; z++) {
        for (let x = 0; x <= cells; x++) {
          const height = field.at(x0 + x, z0 + z);
          peak = Math.max(peak, height);
          coastal ||= height === 0;
        }
      }
      if (!peak) continue;
      const center = new Vector3((x0 + cells / 2) * spacing - half, peak / 2, (z0 + cells / 2) * spacing - half);
      tiles.set(row * count + column, { column, row, x0, z0, center, peak, coastal, lod: 0, shapes: [] });
    }
  }

  function geometry(tile, level) {
    if (tile.shapes[level]) return tile.shapes[level];
    const step = steps[level];
    const n = cells / step + 1;
    const positions = new Float32Array(n * n * 3);
    const normals = new Float32Array(n * n * 3);
    for (let z = 0; z < n; z++) {
      for (let x = 0; x < n; x++) {
        const gx = tile.x0 + x * step;
        const gz = tile.z0 + z * step;
        const x0 = Math.max(0, gx - 1), x1 = Math.min(size - 1, gx + 1);
        const z0 = Math.max(0, gz - 1), z1 = Math.min(size - 1, gz + 1);
        const dx = (field.at(x0, gz) - field.at(x1, gz)) / ((x1 - x0) * spacing);
        const dz = (field.at(gx, z0) - field.at(gx, z1)) / ((z1 - z0) * spacing);
        const inv = 1 / Math.hypot(dx, 1, dz);
        const i = (z * n + x) * 3;
        positions.set([gx * spacing - half, field.at(gx, gz), gz * spacing - half], i);
        normals.set([dx * inv, inv, dz * inv], i);
      }
    }
    const shape = new BufferGeometry();
    shape.setAttribute('position', new BufferAttribute(positions, 3));
    shape.setAttribute('normal', new BufferAttribute(normals, 3));
    shape.boundingSphere = new Sphere(tile.center.clone(), Math.hypot(cells * spacing / Math.SQRT2, tile.peak / 2));
    tile.shapes[level] = shape;
    return shape;
  }

  function indices(step, edges) {
    const key = [step, ...edges].join(',');
    if (indexCache.has(key)) return indexCache.get(key);
    const n = cells / step + 1;
    const snap = (value, stride) => value - value % stride;
    const corner = (x, z) => {
      if (z === 0) x = snap(x, edges[0]);
      if (z === n - 1) x = snap(x, edges[1]);
      if (x === 0) z = snap(z, edges[2]);
      if (x === n - 1) z = snap(z, edges[3]);
      return z * n + x;
    };
    const values = [];
    const triangle = (a, b, c) => {
      if (a !== b && b !== c && c !== a) values.push(a, b, c);
    };
    for (let z = 0; z < n - 1; z++) {
      for (let x = 0; x < n - 1; x++) {
        const a = corner(x, z), b = corner(x + 1, z);
        const c = corner(x, z + 1), d = corner(x + 1, z + 1);
        triangle(a, c, b);
        triangle(b, c, d);
      }
    }
    const attribute = new BufferAttribute(Uint16Array.from(values), 1);
    indexCache.set(key, attribute);
    return attribute;
  }

  for (const tile of tiles.values()) {
    tile.mesh = new Mesh(undefined, material);
    scene.add(tile.mesh);
  }

  let lastX = Infinity;
  let lastZ = Infinity;
  return {
    update(x, z) {
      if (Math.hypot(x - lastX, z - lastZ) < 14) return;
      lastX = x;
      lastZ = z;
      for (const tile of tiles.values()) {
        const radius = cells * spacing / 2;
        const distance = Math.hypot(Math.max(0, Math.abs(tile.center.x - x) - radius), Math.max(0, Math.abs(tile.center.z - z) - radius));
        const distances = tile.coastal ? coastalLodDistances : lodDistances;
        while (tile.lod < distances.length && distance > distances[tile.lod] + 90) tile.lod++;
        while (tile.lod > 0 && distance < distances[tile.lod - 1] - 90) tile.lod--;
      }
      for (const tile of tiles.values()) {
        const { column, row, lod } = tile;
        const step = steps[lod];
        const stride = (c, r) => {
          if (c < 0 || c >= count || r < 0 || r >= count) return 1;
          return Math.max(1, steps[tiles.get(r * count + c)?.lod ?? lod] / step);
        };
        const edges = [stride(column, row - 1), stride(column, row + 1), stride(column - 1, row), stride(column + 1, row)];
        const key = [lod, ...edges].join(',');
        if (key === tile.key) continue;
        const shape = geometry(tile, lod);
        shape.setIndex(indices(step, edges));
        tile.mesh.geometry = shape;
        tile.key = key;
      }
    },
    levels() {
      return [...new Set([...tiles.values()].map(({ lod }) => steps[lod]))].sort((a, b) => a - b);
    },
  };
}
