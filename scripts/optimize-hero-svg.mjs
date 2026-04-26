// Shrink the base64 raster payload inside public/landing/home-page-hero-md.svg.
//
// The SVG is referenced from CSS background-image, which forces the browser
// to load it in "image document" mode — external resource refs from within
// the SVG are blocked. So we must keep raster data inline as base64; the
// only lever is to shrink that raster before re-embedding.
//
// Each <image> inside the SVG is masked by a small circle (~208px in viewBox
// units, ~416px @ 2x DPR), so resizing the source to 800px wide retains
// plenty of detail while cutting the file ~99%.
//
// Usage: node scripts/optimize-hero-svg.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const SVG_PATH = path.join(ROOT, 'public/landing/home-page-hero-md.svg');

const RASTER_RESIZE_WIDTH = 800;
const WEBP_QUALITY = 82;

async function main() {
  const before = await fs.readFile(SVG_PATH, 'utf8');
  const beforeBytes = Buffer.byteLength(before, 'utf8');

  const re = /xlink:href="data:image\/([a-z]+);base64,([A-Za-z0-9+/=]+)"/g;
  const matches = [...before.matchAll(re)];
  if (matches.length === 0) {
    console.error('No base64 raster found — aborting.');
    process.exit(1);
  }

  let after = before;
  let i = 0;
  for (const m of matches) {
    i++;
    const [full, fmt, b64] = m;
    const inputBuf = Buffer.from(b64, 'base64');
    const outputBuf = await sharp(inputBuf)
      .resize({ width: RASTER_RESIZE_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();
    const newB64 = outputBuf.toString('base64');
    const newAttr = `xlink:href="data:image/webp;base64,${newB64}"`;
    after = after.replace(full, newAttr);
    console.log(
      `  raster ${i} (${fmt}): ${(inputBuf.length / 1024).toFixed(0)} KB -> ` +
        `${(outputBuf.length / 1024).toFixed(1)} KB (webp)`,
    );
  }

  await fs.writeFile(SVG_PATH, after, 'utf8');
  const afterBytes = Buffer.byteLength(after, 'utf8');
  const ratio = ((1 - afterBytes / beforeBytes) * 100).toFixed(1);
  console.log(
    `\n${path.relative(ROOT, SVG_PATH)}: ${(beforeBytes / 1024 / 1024).toFixed(2)} MB -> ` +
      `${(afterBytes / 1024).toFixed(1)} KB (-${ratio}%)`,
  );
}

main();
