import { DataTexture, LinearFilter, RedFormat, UnsignedByteType } from 'three';

export class Heightfield {
  constructor(meta, bytes) {
    this.meta = meta;
    this.size = meta.width;
    this.spacing = meta.metersPerPixel;
    this.half = meta.spanMeters / 2;
    if (meta.width !== meta.height || bytes.byteLength !== this.size ** 2 * 2) {
      throw new Error('Yükseklik verisinin boyutu geçersiz.');
    }
    const view = new DataView(bytes);
    this.samples = Float32Array.from({ length: this.size ** 2 },
      (_, index) => view.getUint16(index * 2, true) * meta.metersPerUnit);
  }

  at(column, row) {
    return this.samples[row * this.size + column];
  }

  heightAt(x, z) {
    const gx = (x + this.half) / this.spacing;
    const gz = (z + this.half) / this.spacing;
    const last = this.size - 1;
    if (gx < -1e-7 || gz < -1e-7 || gx > last + 1e-7 || gz > last + 1e-7) return 0;
    const column = Math.min(last - 1, Math.max(0, Math.floor(gx)));
    const row = Math.min(last - 1, Math.max(0, Math.floor(gz)));
    const u = gx - column;
    const v = gz - row;
    const b = this.at(column + 1, row);
    const c = this.at(column, row + 1);
    if (u + v <= 1) return this.at(column, row) * (1 - u - v) + b * u + c * v;
    return this.at(column + 1, row + 1) * (u + v - 1) + b * (1 - v) + c * (1 - u);
  }

  slopeAt(x, z, distance = 4) {
    return Math.hypot(
      this.heightAt(x + distance, z) - this.heightAt(x - distance, z),
      this.heightAt(x, z + distance) - this.heightAt(x, z - distance),
    ) / (distance * 2);
  }

  toWorld(latitude, longitude) {
    const { bbox, spanMeters } = this.meta;
    return {
      x: (longitude - bbox.west) / (bbox.east - bbox.west) * spanMeters - this.half,
      z: (bbox.north - latitude) / (bbox.north - bbox.south) * spanMeters - this.half,
    };
  }

  toDegrees(x, z) {
    const { bbox, spanMeters } = this.meta;
    return {
      latitude: bbox.north - (z + this.half) / spanMeters * (bbox.north - bbox.south),
      longitude: bbox.west + (x + this.half) / spanMeters * (bbox.east - bbox.west),
    };
  }

  shorelineTexture() {
    const n = this.size;
    const distance = Float32Array.from(this.samples, (height) => height > 0 ? 0 : 9);
    const diagonal = Math.SQRT2;
    for (const direction of [1, -1]) {
      for (let i = 0; i < distance.length; i++) {
        const index = direction === 1 ? i : distance.length - 1 - i;
        if (distance[index] === 0) continue;
        const column = index % n;
        const previousRow = index - direction * n;
        let value = distance[index];
        if (column - direction >= 0 && column - direction < n) value = Math.min(value, distance[index - direction] + 1);
        if (previousRow >= 0 && previousRow < distance.length) {
          value = Math.min(value, distance[previousRow] + 1);
          if (column > 0) value = Math.min(value, distance[previousRow - 1] + diagonal);
          if (column < n - 1) value = Math.min(value, distance[previousRow + 1] + diagonal);
        }
        distance[index] = value;
      }
    }
    const pixels = Uint8Array.from(distance, (value) => Math.round(value / 9 * 255));
    const texture = new DataTexture(pixels, n, n, RedFormat, UnsignedByteType);
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }
}

export async function loadHeightfield() {
  const root = './maps/faroe-north/';
  const [metadata, binary] = await Promise.all([fetch(`${root}meta.json`), fetch(`${root}height.bin`)]);
  if (!metadata.ok || !binary.ok) throw new Error('Faroe haritası yüklenemedi.');
  return new Heightfield(await metadata.json(), await binary.arrayBuffer());
}
