import { BoxGeometry, CylinderGeometry, Float32BufferAttribute, Group, Mesh, MeshStandardMaterial, BufferGeometry } from 'three';

export function lighthouse(field) {
  const { latitude, longitude } = field.meta.lighthouse;
  const { x, z } = field.toWorld(latitude, longitude);
  const group = new Group();
  group.name = 'Kallur Feneri';
  const angle = 0.47;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const footprint = [[-1.95, -1.95], [1.95, -1.95], [1.95, 1.95], [-1.95, 1.95]];
  const heights = footprint.map(([u, v]) => field.heightAt(x + u * cosine + v * sine, z - u * sine + v * cosine));
  const floor = Math.max(field.heightAt(x, z), ...heights) + 0.1;
  group.position.set(x, floor, z);
  group.rotation.y = angle;

  const white = new MeshStandardMaterial({ color: '#fff0db', roughness: 0.79 });
  const red = new MeshStandardMaterial({ color: '#a83e2e', roughness: 0.65 });
  const base = new MeshStandardMaterial({ color: '#777068', roughness: 1 });
  const glass = new MeshStandardMaterial({ color: '#c3ab74', emissive: '#ffc36d', emissiveIntensity: 0.24, roughness: 0.24 });
  const iron = new MeshStandardMaterial({ color: '#353332', roughness: 0.84 });
  function add(geometry, material, x, y, z) {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
  }
  const footing = new BufferGeometry();
  const points = footprint.flatMap(([u, v], index) => [u, heights[index] - floor - 0.12, v]);
  points.push(...footprint.flatMap(([u, v]) => [u, 0, v]));
  const faces = [4, 6, 5, 4, 7, 6];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    faces.push(i, i + 4, j, j, i + 4, j + 4);
  }
  footing.setAttribute('position', new Float32BufferAttribute(points, 3));
  footing.setIndex(faces);
  footing.computeVertexNormals();
  add(footing, base, 0, 0, 0);
  add(new BoxGeometry(3.45, 2.15, 3.45), white, 0, 1.13, 0);
  add(new BoxGeometry(3.53, 0.42, 3.53), red, 0, 1.94, 0);
  add(new BoxGeometry(3.65, 0.22, 3.65), white, 0, 2.28, 0);
  add(new BoxGeometry(0.65, 1.43, 0.085), red, 0.35, 0.80, 1.75);
  add(new BoxGeometry(0.065, 0.55, 0.71), iron, 1.74, 1.30, 0.18);
  add(new CylinderGeometry(1.05, 1.12, 0.29, 12), white, 0, 2.52, 0);
  add(new CylinderGeometry(0.93, 0.93, 0.98, 12), glass, 0, 3.10, 0);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4;
    add(new CylinderGeometry(0.034, 0.034, 1.01, 5), iron, 0.93 * Math.sin(angle), 3.10, 0.93 * Math.cos(angle));
  }
  add(new CylinderGeometry(0.12, 1.15, 0.55, 12), red, 0, 3.82, 0);
  add(new CylinderGeometry(0.04, 0.08, 0.34, 8), iron, 0, 4.17, 0);
  return group;
}
