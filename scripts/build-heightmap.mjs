import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { fromFile } from 'geotiff';
import region from '../data/region.json' with { type: 'json' };
import { rawFile, tileUrl } from './fetch-dem.mjs';

const { bbox, samples } = region;
const metersPerDegree = 6_371_008.8 * Math.PI / 180;
const metersPerLongitude = metersPerDegree * Math.cos((bbox.south + bbox.north) * Math.PI / 360);
const span = (bbox.north - bbox.south) * metersPerDegree;
const spacing = span / (samples - 1);
if (Math.abs((bbox.east - bbox.west) * metersPerLongitude - span) > 0.01) {
  throw new Error('Bölge kutusu metrik kare olmalı.');
}

const rasters = [];
try {
  for (const name of region.tiles) {
    const file = await fromFile(fileURLToPath(rawFile(name)));
    const tile = { name, file };
    rasters.push(tile);
    const image = await file.getImage();
    if (image.getGeoKeys().GeographicTypeGeoKey !== 4326) throw new Error(`${name}: EPSG:4326 bekleniyor.`);
    const [dx, dy] = image.getResolution();
    let [west, north] = image.getOrigin();
    if (image.pixelIsArea()) {
      west += dx / 2;
      north += dy / 2;
    }
    Object.assign(tile, {
      image, west, north, dx, dy, width: image.getWidth(), height: image.getHeight(),
      nodata: image.getGDALNoData(),
    });
  }

  rasters.sort((a, b) => a.west - b.west);
  const grid = rasters[0];
  for (const tile of rasters) {
    tile.offset = Math.round((tile.west - grid.west) / grid.dx);
    if (Math.abs(grid.west + grid.dx * tile.offset - tile.west) > 1e-8 ||
        Math.abs(tile.north - grid.north) > 1e-8 ||
        Math.abs(tile.dx - grid.dx) > 1e-10 || Math.abs(tile.dy - grid.dy) > 1e-10) {
      throw new Error(`${tile.name}: kaynak ızgaraları hizalı değil.`);
    }
    const x0 = Math.max(0, Math.floor((bbox.west - tile.west) / tile.dx));
    const x1 = Math.min(tile.width, Math.ceil((bbox.east - tile.west) / tile.dx) + 1);
    const y0 = Math.max(0, Math.floor((bbox.north - tile.north) / tile.dy));
    const y1 = Math.min(tile.height, Math.ceil((bbox.south - tile.north) / tile.dy) + 1);
    if (x0 >= x1 || y0 >= y1) throw new Error(`${tile.name}: bölge kaynak karoyu kesmiyor.`);
    tile.window = [x0, y0, x1, y1];
    tile.values = await tile.image.readRasters({ window: tile.window, samples: [0], interleave: true });
    console.log(`${tile.name} · ${x1 - x0} × ${y1 - y0} kaynak piksel`);
  }

  function elevation(column, row) {
    const tile = rasters.find(({ offset, width }) => column >= offset && column < offset + width);
    if (!tile) throw new Error(`Kaynak karo eksik (sütun ${column}).`);
    const [x0, y0, x1, y1] = tile.window;
    const localX = column - tile.offset;
    if (localX < x0 || localX >= x1 || row < y0 || row >= y1) throw new Error('Kaynak pencere dışı örnek.');
    const value = tile.values[(row - y0) * (x1 - x0) + localX - x0];
    if (!Number.isFinite(value) || value === tile.nodata) throw new Error('Bölgede eksik yükseklik verisi var.');
    return Math.max(0, value);
  }

  const height = Buffer.alloc(samples * samples * 2);
  let min = Infinity;
  let max = -Infinity;
  let maxIndex = 0;
  let land = 0;
  for (let row = 0; row < samples; row++) {
    const lat = bbox.north - (bbox.north - bbox.south) * row / (samples - 1);
    const sourceY = (lat - grid.north) / grid.dy;
    const y = Math.floor(sourceY);
    const v = sourceY - y;
    for (let column = 0; column < samples; column++) {
      const lon = bbox.west + (bbox.east - bbox.west) * column / (samples - 1);
      const sourceX = (lon - grid.west) / grid.dx;
      const x = Math.floor(sourceX);
      const u = sourceX - x;
      const north = elevation(x, y) * (1 - u) + elevation(x + 1, y) * u;
      const south = elevation(x, y + 1) * (1 - u) + elevation(x + 1, y + 1) * u;
      const dm = Math.round((north * (1 - v) + south * v) * 10);
      const index = row * samples + column;
      height.writeUInt16LE(dm, index * 2);
      min = Math.min(dm, min);
      if (dm > max) {
        max = dm;
        maxIndex = index;
      }
      if (dm > 0) land++;
    }
  }

  const meta = {
    region: region.id,
    width: samples,
    height: samples,
    metersPerPixel: spacing,
    spanMeters: span,
    byteOrder: 'little-endian',
    encoding: 'uint16',
    metersPerUnit: 0.1,
    minElevation: min / 10,
    maxElevation: max / 10,
    maxLocation: {
      latitude: bbox.north - (bbox.north - bbox.south) * Math.floor(maxIndex / samples) / (samples - 1),
      longitude: bbox.west + (bbox.east - bbox.west) * (maxIndex % samples) / (samples - 1),
    },
    seaLevel: 0,
    verticalExaggeration: 1,
    bbox,
    lighthouse: region.lighthouse,
    projection: 'WGS 84 coordinates on a local equirectangular grid, longitude scaled by cos(mid-latitude)',
    source: 'Copernicus DEM GLO-30',
    sourceTiles: region.tiles.map(tileUrl),
    license: 'COP-DEM-GLO-30-F (Global 30m Full, Free & Open)',
    licenseUrl: 'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM/resources/license/License-COPDEM-30.pdf',
    attribution: 'Copernicus DEM GLO-30, © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA.',
  };
  const destination = new URL(`../public/maps/${region.id}/`, import.meta.url);
  await mkdir(destination, { recursive: true });
  await writeFile(new URL('height.bin', destination), height);
  await writeFile(new URL('meta.json', destination), `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`${samples} × ${samples} · ${spacing.toFixed(3)} m/örnek · ${height.length} bayt · ${min / 10}–${max / 10} m · %${(land / samples ** 2 * 100).toFixed(2)} kara`);
  console.log(`Maksimum: ${meta.maxLocation.latitude.toFixed(6)}, ${meta.maxLocation.longitude.toFixed(6)}`);
} finally {
  await Promise.all(rasters.map(({ file }) => file.close()));
}
