/**
 * Generate PWA icons for the AdTraffic.ai webapp.
 *
 * Creates blue circle + white "K" icons at standard PWA sizes.
 * No external dependencies — raw PNG encoding via zlib.
 *
 * Sizes: 16x16, 32x32, 180x180, 192x192, 512x512
 * Output: webapp/public/icons/
 *
 * For production, replace with proper designed icons.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { deflateSync } from 'zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = resolve(__dirname, '..', 'public', 'icons');

mkdirSync(iconsDir, { recursive: true });

/**
 * Create a minimal PNG file with a solid-color circle and "K" letter.
 * Uses raw PNG encoding (no external deps).
 */
function createPNG(size) {
  const pixels = Buffer.alloc(size * size * 4, 0); // RGBA, transparent

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 1;

  // Draw filled circle (blue: #2563EB)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) {
        const i = (y * size + x) * 4;
        pixels[i] = 37;      // R
        pixels[i + 1] = 99;  // G
        pixels[i + 2] = 235; // B
        pixels[i + 3] = 255; // A
      }
    }
  }

  // Draw "K" letter in white — simple bitmap approach
  const letterScale = size / 16;
  const kPixels = [
    // Vertical bar (x=4, y=3..12)
    ...Array.from({ length: 10 }, (_, i) => [4, 3 + i]),
    // Upper diagonal
    [5, 7], [6, 6], [7, 5], [8, 4], [9, 3], [10, 3],
    // Lower diagonal
    [5, 8], [6, 9], [7, 10], [8, 11], [9, 12], [10, 12],
    // Thicken strokes
    [5, 6], [6, 5], [7, 4], [8, 3],
    [5, 9], [6, 10], [7, 11], [8, 12],
  ];

  for (const [kx, ky] of kPixels) {
    const sx = Math.round(kx * letterScale);
    const sy = Math.round(ky * letterScale);
    const thickness = Math.max(1, Math.round(letterScale));

    for (let dy = 0; dy < thickness; dy++) {
      for (let dx = 0; dx < thickness; dx++) {
        const px = sx + dx;
        const py = sy + dy;
        if (px >= 0 && px < size && py >= 0 && py < size) {
          const ddx = px - cx;
          const ddy = py - cy;
          if (ddx * ddx + ddy * ddy <= r * r) {
            const i = (py * size + px) * 4;
            pixels[i] = 255;     // R (white)
            pixels[i + 1] = 255; // G
            pixels[i + 2] = 255; // B
            pixels[i + 3] = 255; // A
          }
        }
      }
    }
  }

  return encodePNG(size, size, pixels);
}

/**
 * Minimal PNG encoder — creates a valid PNG from raw RGBA pixel data.
 */
function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 6;  // color type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = makeChunk('IHDR', ihdrData);

  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: None
    rgba.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData) >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return crc ^ 0xffffffff;
}

// PWA icon sizes: favicon (16, 32), apple-touch-icon (180), PWA (192, 512)
const sizes = [16, 32, 180, 192, 512];

for (const size of sizes) {
  const png = createPNG(size);
  const path = resolve(iconsDir, `icon-${size}x${size}.png`);
  writeFileSync(path, png);
  console.log(`Generated ${path} (${png.length} bytes)`);
}

// Copy 16x16 as favicon.ico (modern browsers accept PNG favicons)
const favicon16 = createPNG(16);
const faviconPath = resolve(iconsDir, '..', 'favicon.ico');
writeFileSync(faviconPath, favicon16);
console.log(`Generated ${faviconPath} (${favicon16.length} bytes)`);

console.log('PWA icon generation complete.');
