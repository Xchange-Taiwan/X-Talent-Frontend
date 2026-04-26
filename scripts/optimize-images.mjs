// Batch image optimizer for X-Talent landing / auth assets.
//
// Each input is resized to its on-screen max width @2x DPR, then re-encoded
// to WebP at q=82. The script writes a sibling .webp file and leaves the
// original alone so the diff is reviewable; remove originals manually after
// verification.
//
// Usage: node scripts/optimize-images.mjs
//
// Display widths come from src/app/(landing)/page.tsx,
// src/app/(landing)/about/page.tsx, src/app/auth/(sign)/layout.tsx,
// and src/components/landing/HomePageSlider.

import { promises as fs } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');

// targetWidth = the largest CSS pixel width the image is rendered at,
// then doubled for Retina. height is omitted to preserve aspect ratio.
const TARGETS = [
  // src/assets/landing/ — used via next/image (auto srcSet handles smaller sizes)
  { src: 'src/assets/landing/home-page-hero.png', targetWidth: 1856 },
  { src: 'src/assets/landing/landingPage_1.png', targetWidth: 832 },
  { src: 'src/assets/landing/landingPage_2.png', targetWidth: 832 },
  { src: 'src/assets/landing/landingPage_3.png', targetWidth: 832 },
  { src: 'src/assets/landing/landingPage_4.png', targetWidth: 840 }, // Image width=420
  { src: 'src/assets/landing/landingPage_5.png', targetWidth: 840 },
  { src: 'src/assets/landing/landingPage_6.png', targetWidth: 750 }, // displayed w-[363px]
  { src: 'src/assets/landing/landingPage_7.png', targetWidth: 750 },
  { src: 'src/assets/landing/aboutPage_1.png', targetWidth: 1000 }, // Image width=500

  // src/components/landing/assets/ — slider photos
  { src: 'src/components/landing/assets/slider_pin_hua.png', targetWidth: 1200 },
  { src: 'src/components/landing/assets/slider_carolina.png', targetWidth: 1200 },

  // src/assets/auth/ — sign-in cover background
  { src: 'src/assets/auth/signIn-cover.png', targetWidth: 1600 }, // covers half-screen on lg+
];

const WEBP_QUALITY = 82;

async function fileSize(p) {
  const stat = await fs.stat(p);
  return stat.size;
}

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

async function processOne(entry) {
  const inputAbs = path.join(ROOT, entry.src);
  const parsed = path.parse(entry.src);
  const outputRel = path.join(parsed.dir, `${parsed.name}.webp`);
  const outputAbs = path.join(ROOT, outputRel);

  const beforeSize = await fileSize(inputAbs);
  const meta = await sharp(inputAbs).metadata();

  // Don't upscale: use min(target, original).
  const resizeWidth = Math.min(entry.targetWidth, meta.width ?? entry.targetWidth);

  await sharp(inputAbs)
    .resize({ width: resizeWidth, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outputAbs);

  const afterSize = await fileSize(outputAbs);
  const ratio = ((1 - afterSize / beforeSize) * 100).toFixed(1);

  console.log(
    `${entry.src.padEnd(55)} ${meta.width}x${meta.height} -> ${resizeWidth}w  ` +
      `${fmtSize(beforeSize).padStart(10)} -> ${fmtSize(afterSize).padStart(10)}  (-${ratio}%)`,
  );
}

async function main() {
  console.log(`Optimizing ${TARGETS.length} images @ WebP q=${WEBP_QUALITY}\n`);
  for (const entry of TARGETS) {
    try {
      await processOne(entry);
    } catch (err) {
      console.error(`FAILED ${entry.src}:`, err.message);
      process.exitCode = 1;
    }
  }
  console.log('\nDone. Originals left in place — delete after verifying imports.');
}

main();
