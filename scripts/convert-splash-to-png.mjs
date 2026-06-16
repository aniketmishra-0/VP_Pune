/**
 * Convert SVG splash screens to PNG format for iOS PWA compatibility.
 * iOS requires PNG images for apple-touch-startup-image.
 *
 * Prerequisites: npm install sharp
 * Usage: node scripts/convert-splash-to-png.mjs
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const splashDir = join(__dirname, '..', 'public', 'splash');

async function convert() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.error('❌ "sharp" is not installed. Run: npm install --save-dev sharp');
    process.exit(1);
  }

  const svgFiles = readdirSync(splashDir).filter(f => f.endsWith('.svg'));

  console.log(`Converting ${svgFiles.length} SVG splash screens to PNG...`);

  for (const file of svgFiles) {
    const svgPath = join(splashDir, file);
    const pngName = file.replace('.svg', '.png');
    const pngPath = join(splashDir, pngName);

    const svgBuffer = readFileSync(svgPath);

    // Extract width/height from SVG
    const svgStr = svgBuffer.toString();
    const wMatch = svgStr.match(/width="(\d+)"/);
    const hMatch = svgStr.match(/height="(\d+)"/);
    const w = parseInt(wMatch?.[1] || '1170');
    const h = parseInt(hMatch?.[1] || '2532');

    await sharp(svgBuffer)
      .resize(w, h)
      .png({ quality: 90, compressionLevel: 6 })
      .toFile(pngPath);

    console.log(`  ✅ ${pngName}`);
  }

  console.log('\n✅ All PNG splash screens generated!');
  console.log('\n⚠️  Remember to update index.html: change .svg → .png in all apple-touch-startup-image hrefs');
}

convert().catch(console.error);
