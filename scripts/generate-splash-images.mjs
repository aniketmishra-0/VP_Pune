/**
 * Generate iOS PWA splash screen images.
 * Uses a simple SVG → PNG approach that works in any Node.js environment.
 * 
 * Usage: node generate-splash-images.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, '..', 'public', 'splash');

// Create output directory
mkdirSync(outputDir, { recursive: true });

// Read the PW logo as base64
const logoPath = join(__dirname, '..', 'public', 'icons', 'icon-192.png');
const logoBase64 = readFileSync(logoPath).toString('base64');
const logoDataUri = `data:image/png;base64,${logoBase64}`;

// All iOS device splash screen sizes
const sizes = [
  { w: 1320, h: 2868, name: '1320x2868', media: '(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)' },
  { w: 1206, h: 2622, name: '1206x2622', media: '(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)' },
  { w: 1290, h: 2796, name: '1290x2796', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
  { w: 1179, h: 2556, name: '1179x2556', media: '(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)' },
  { w: 1284, h: 2778, name: '1284x2778', media: '(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)' },
  { w: 1170, h: 2532, name: '1170x2532', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' },
  { w: 1080, h: 2340, name: '1080x2340', media: '(device-width: 360px) and (device-height: 780px) and (-webkit-device-pixel-ratio: 3)' },
  { w: 1242, h: 2688, name: '1242x2688', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)' },
  { w: 828, h: 1792, name: '828x1792', media: '(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)' },
  { w: 1125, h: 2436, name: '1125x2436', media: '(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)' },
  { w: 1242, h: 2208, name: '1242x2208', media: '(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)' },
  { w: 750, h: 1334, name: '750x1334', media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
  { w: 640, h: 1136, name: '640x1136', media: '(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)' },
  { w: 2048, h: 2732, name: '2048x2732', media: '(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2)' },
  { w: 1668, h: 2388, name: '1668x2388', media: '(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2)' },
  { w: 1668, h: 2224, name: '1668x2224', media: '(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2)' },
  { w: 1620, h: 2160, name: '1620x2160', media: '(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2)' },
  { w: 1536, h: 2048, name: '1536x2048', media: '(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2)' },
];

function generateSVG(w, h) {
  const scale = Math.min(w, h) / 1170;
  const centerX = w / 2;
  const centerY = h * 0.42;
  const boxSize = 120 * scale;
  const boxRadius = 28 * scale;
  const boxX = centerX - boxSize / 2;
  const boxY = centerY - boxSize / 2;
  const outerPad = 6 * scale;
  const logoSize = 85 * scale;
  const logoX = centerX - logoSize / 2;
  const logoY = centerY - logoSize / 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <radialGradient id="bg" cx="40%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#a8c0ff"/>
      <stop offset="30%" stop-color="#7b9df5"/>
      <stop offset="60%" stop-color="#5f85ec"/>
      <stop offset="100%" stop-color="#4468d0"/>
    </radialGradient>
    <linearGradient id="topLight" x1="0" y1="0" x2="0" y2="${h * 0.4}">
      <stop offset="0%" stop-color="rgba(180,200,255,0.3)"/>
      <stop offset="100%" stop-color="rgba(180,200,255,0)"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="${20 * scale}" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="shadow">
      <feDropShadow dx="0" dy="${4 * scale}" stdDeviation="${12 * scale}" flood-color="rgba(0,0,0,0.15)"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h * 0.4}" fill="url(#topLight)"/>
  
  <!-- Outer glow ring -->
  <rect x="${boxX - outerPad}" y="${boxY - outerPad}" width="${boxSize + outerPad * 2}" height="${boxSize + outerPad * 2}" rx="${boxRadius + 4 * scale}" fill="rgba(255,255,255,0.25)" filter="url(#glow)"/>
  
  <!-- White logo container -->
  <rect x="${boxX}" y="${boxY}" width="${boxSize}" height="${boxSize}" rx="${boxRadius}" fill="#f5f5f5" filter="url(#shadow)"/>
  
  <!-- Logo -->
  <image href="${logoDataUri}" x="${logoX}" y="${logoY}" width="${logoSize}" height="${logoSize}"/>
  
  <!-- Title -->
  <text x="${centerX}" y="${centerY + boxSize / 2 + 50 * scale}" text-anchor="middle" font-family="'Space Grotesk','Inter',system-ui,sans-serif" font-size="${26 * scale}" font-weight="700" fill="rgba(30,40,70,0.9)">Pimpri PW Vidyapeeth</text>
  
  <!-- Subtitle -->
  <text x="${centerX}" y="${centerY + boxSize / 2 + 80 * scale}" text-anchor="middle" font-family="'Space Grotesk','Inter',system-ui,sans-serif" font-size="${15 * scale}" font-weight="500" fill="rgba(50,60,100,0.7)">Student Performance Hub</text>
  
  <!-- Dots -->
  <circle cx="${centerX - 16 * scale}" cy="${centerY + boxSize / 2 + 115 * scale}" r="${4 * scale}" fill="rgba(60,80,140,0.35)"/>
  <circle cx="${centerX}" cy="${centerY + boxSize / 2 + 115 * scale}" r="${4 * scale}" fill="rgba(60,80,140,0.6)"/>
  <circle cx="${centerX + 16 * scale}" cy="${centerY + boxSize / 2 + 115 * scale}" r="${4 * scale}" fill="rgba(60,80,140,0.35)"/>
  
  <!-- Footer -->
  <text x="${centerX}" y="${h - 60 * scale}" text-anchor="middle" font-family="'Space Grotesk','Inter',system-ui,sans-serif" font-size="${12 * scale}" font-weight="400" fill="rgba(50,60,100,0.5)">Loading your dashboard…</text>
</svg>`;
}

console.log('Generating iOS PWA splash screen SVGs...');

for (const { w, h, name } of sizes) {
  const svg = generateSVG(w, h);
  const filePath = join(outputDir, `${name}.svg`);
  writeFileSync(filePath, svg);
  console.log(`  ✅ ${name}.svg (${w}x${h})`);
}

// Generate the link tags for index.html
console.log('\n\n📋 Add these to your <head> in index.html:\n');
const linkTags = sizes.map(({ name, media }) =>
  `    <link rel="apple-touch-startup-image" href="/splash/${name}.svg" media="${media} and (orientation: portrait)" />`
).join('\n');
console.log(linkTags);

console.log('\n✅ Done! All splash screens saved to public/splash/');
