/* Generate PWA icons using the actual PW logo as the foreground.
 * Output:
 *   public/icons/icon-192.png        (white bg, full PW logo)
 *   public/icons/icon-512.png        (white bg, full PW logo)
 *   public/icons/icon-maskable.png   (brand gradient bg, logo centered with safe area)
 *
 * Uses: Node stdlib + pngjs (devDependency). No image libs / build extras.
 */
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const OUT_DIR = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(OUT_DIR, { recursive: true });

const LOGO_URL =
  "https://pwhr.darwinbox.in/ms/s3proxy/getFile?fileKey=INSTANCE5_a62c4003263a06_194/logo/a141188422867e404366f582__tenant-avatar-194_15638877.png";

const C1 = [0x52, 0x77, 0xf7]; // gradient top
const C2 = [0x3a, 0x56, 0xc5]; // gradient bottom

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

async function fetchLogo() {
  const res = await fetch(LOGO_URL);
  if (!res.ok) throw new Error(`Logo fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return PNG.sync.read(buf);
}

// Bilinear resample any PNG into target square `size`.
// Source PNG is normalised to RGBA before sampling.
function resampleSquare(srcPng, size) {
  // Normalise to RGBA Uint8 buffer (handles gray+alpha, RGB, etc.)
  const src = new Uint8ClampedArray(srcPng.width * srcPng.height * 4);
  if (srcPng.data.length === srcPng.width * srcPng.height * 4) {
    src.set(srcPng.data);
  } else if (srcPng.data.length === srcPng.width * srcPng.height * 2) {
    // gray+alpha → expand
    for (let i = 0, j = 0; i < srcPng.data.length; i += 2, j += 4) {
      const v = srcPng.data[i];
      src[j] = v;
      src[j + 1] = v;
      src[j + 2] = v;
      src[j + 3] = srcPng.data[i + 1];
    }
  } else if (srcPng.data.length === srcPng.width * srcPng.height * 3) {
    for (let i = 0, j = 0; i < srcPng.data.length; i += 3, j += 4) {
      src[j] = srcPng.data[i];
      src[j + 1] = srcPng.data[i + 1];
      src[j + 2] = srcPng.data[i + 2];
      src[j + 3] = 255;
    }
  } else {
    src.set(srcPng.data.slice(0, src.length));
  }

  const out = new Uint8ClampedArray(size * size * 4);
  const sw = srcPng.width;
  const sh = srcPng.height;
  for (let y = 0; y < size; y++) {
    const sy = (y / (size - 1)) * (sh - 1);
    const y0 = Math.floor(sy);
    const y1 = Math.min(y0 + 1, sh - 1);
    const fy = sy - y0;
    for (let x = 0; x < size; x++) {
      const sx = (x / (size - 1)) * (sw - 1);
      const x0 = Math.floor(sx);
      const x1 = Math.min(x0 + 1, sw - 1);
      const fx = sx - x0;
      for (let c = 0; c < 4; c++) {
        const p00 = src[(y0 * sw + x0) * 4 + c];
        const p10 = src[(y0 * sw + x1) * 4 + c];
        const p01 = src[(y1 * sw + x0) * 4 + c];
        const p11 = src[(y1 * sw + x1) * 4 + c];
        const top = p00 + (p10 - p00) * fx;
        const bot = p01 + (p11 - p01) * fx;
        out[(y * size + x) * 4 + c] = top + (bot - top) * fy;
      }
    }
  }
  return out;
}

function alphaOver(dst, di, r, g, b, a) {
  // Composite src(r,g,b,a 0..255) onto dst at index di (assumed opaque or white-ish background already in place).
  if (a === 0) return;
  if (a === 255) {
    dst[di] = r;
    dst[di + 1] = g;
    dst[di + 2] = b;
    dst[di + 3] = 255;
    return;
  }
  const af = a / 255;
  dst[di] = Math.round(r * af + dst[di] * (1 - af));
  dst[di + 1] = Math.round(g * af + dst[di + 1] * (1 - af));
  dst[di + 2] = Math.round(b * af + dst[di + 2] * (1 - af));
  dst[di + 3] = 255;
}

// Build a square icon with the logo centered.
//   bg: "white" | "gradient"
//   rounded: round the corners (any-purpose)
//   safeArea: 0..1 — fraction of the canvas devoted to padding around the logo
//   maxLogoFraction: cap how much of the canvas the logo can occupy (avoids fuzzy upscale).
function buildIcon(srcPng, size, { bg = "white", rounded = true, safeArea = 0.16, maxLogoFraction = 1 } = {}) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const cornerR = size * 0.22;

  // Paint background
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let r, g, b;
      if (bg === "gradient") {
        const t = y / size;
        r = lerp(C1[0], C2[0], t);
        g = lerp(C1[1], C2[1], t);
        b = lerp(C1[2], C2[2], t);
      } else {
        r = 255;
        g = 255;
        b = 255;
      }
      let inside = true;
      if (rounded) {
        const dx = Math.max(0, Math.abs(x - cx) - (size / 2 - cornerR));
        const dy = Math.max(0, Math.abs(y - cy) - (size / 2 - cornerR));
        if (Math.sqrt(dx * dx + dy * dy) > cornerR) inside = false;
      }
      if (inside) {
        png.data[idx] = r;
        png.data[idx + 1] = g;
        png.data[idx + 2] = b;
        png.data[idx + 3] = 255;
      } else {
        png.data[idx] = 0;
        png.data[idx + 1] = 0;
        png.data[idx + 2] = 0;
        png.data[idx + 3] = 0;
      }
    }
  }

  // Resample the logo into the safe area (capped to avoid fuzzy upscale beyond 2× source).
  const safeBox = Math.round(size * (1 - safeArea * 2));
  const sourceMax = Math.min(srcPng.width, srcPng.height);
  const logoSize = Math.min(safeBox, Math.round(sourceMax * 2), Math.round(size * maxLogoFraction));
  const logo = resampleSquare(srcPng, logoSize);
  const ox = Math.round((size - logoSize) / 2);
  const oy = Math.round((size - logoSize) / 2);

  for (let y = 0; y < logoSize; y++) {
    for (let x = 0; x < logoSize; x++) {
      const si = (y * logoSize + x) * 4;
      const di = ((oy + y) * size + (ox + x)) * 4;
      alphaOver(png.data, di, logo[si], logo[si + 1], logo[si + 2], logo[si + 3]);
    }
  }
  return png;
}

function write(filename, png) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(path.join(OUT_DIR, filename));
    png
      .pack({ deflateLevel: 9, deflateStrategy: 1 })
      .pipe(out)
      .on("finish", resolve)
      .on("error", reject);
  });
}

(async () => {
  const logo = await fetchLogo();
  console.log(`Loaded PW logo (${logo.width}x${logo.height}). Composing icons...`);

  await write("icon-192.png", buildIcon(logo, 192, { bg: "white", rounded: true, safeArea: 0.12 }));
  // Keep 512 lean: don't upscale beyond the source, lots of white compresses well — stays well under 100 KB.
  await write("icon-512.png", buildIcon(logo, 512, { bg: "white", rounded: true, safeArea: 0.12, maxLogoFraction: 0.5 }));
  // Maskable: brand gradient bg + larger safe area (OS will crop a circle/squircle)
  await write("icon-maskable.png", buildIcon(logo, 512, { bg: "gradient", rounded: false, safeArea: 0.22, maxLogoFraction: 0.5 }));

  console.log("✓ generated PWA icons in", OUT_DIR);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
