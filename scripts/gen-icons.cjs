/* Generate brand PWA icons (no external image dependency).
 * Produces:
 *   public/icons/icon-192.png        (any-purpose, gradient bg + white "PW")
 *   public/icons/icon-512.png        (any-purpose, gradient bg + white "PW")
 *   public/icons/icon-maskable.png   (maskable, larger safe area, same look)
 *
 * Uses only Node's stdlib + pngjs (devDependency).
 */
const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const OUT_DIR = path.join(__dirname, "..", "public", "icons");
fs.mkdirSync(OUT_DIR, { recursive: true });

// Brand colours (gradient + accent)
const C1 = [0x52, 0x77, 0xf7]; // top
const C2 = [0x3a, 0x56, 0xc5]; // bottom
const WHITE = [255, 255, 255];

// 8x10 pixel-font glyphs for "P" and "W". 1 = filled, 0 = empty.
const FONT = {
  P: [
    "11111100",
    "11111110",
    "11000111",
    "11000111",
    "11111110",
    "11111100",
    "11000000",
    "11000000",
    "11000000",
    "11000000",
  ],
  W: [
    "11000011",
    "11000011",
    "11000011",
    "11000011",
    "11000011",
    "11000011",
    "11011011",
    "11011011",
    "11111111",
    "01100110",
  ],
};

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function generateIcon(size, opts = {}) {
  const { padding = 0.08, rounded = true } = opts;
  const png = new PNG({ width: size, height: size });
  const cx = size / 2;
  const cy = size / 2;
  const radius = (size / 2) * (1 - 0.0); // for masking
  const cornerR = size * 0.22;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) * 4;
      const t = y / size;
      const r = lerp(C1[0], C2[0], t);
      const g = lerp(C1[1], C2[1], t);
      const b = lerp(C1[2], C2[2], t);

      // Optional rounded square mask (for non-maskable variants)
      let inside = true;
      if (rounded) {
        const dx = Math.max(0, Math.abs(x - cx) - (size / 2 - cornerR));
        const dy = Math.max(0, Math.abs(y - cy) - (size / 2 - cornerR));
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > cornerR) inside = false;
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
        png.data[idx + 3] = 0; // transparent corners
      }
    }
  }

  // Render "PW" centred. Each glyph is 8 cols x 10 rows. Scale to fill.
  const safe = 1 - padding * 2;
  const targetTextHeight = size * 0.46 * safe;
  const cellSize = Math.floor(targetTextHeight / 10);
  const text = "PW";
  const totalCols = text.length * 8 + (text.length - 1) * 2; // 2-cell gap
  const totalWidth = totalCols * cellSize;
  const startX = Math.round((size - totalWidth) / 2);
  const startY = Math.round((size - 10 * cellSize) / 2);

  const drawGlyph = (glyph, gx, gy) => {
    for (let row = 0; row < 10; row++) {
      const line = glyph[row];
      for (let col = 0; col < 8; col++) {
        if (line[col] !== "1") continue;
        for (let py = 0; py < cellSize; py++) {
          for (let px = 0; px < cellSize; px++) {
            const x = gx + col * cellSize + px;
            const y = gy + row * cellSize + py;
            if (x < 0 || y < 0 || x >= size || y >= size) continue;
            const i = (size * y + x) * 4;
            png.data[i] = WHITE[0];
            png.data[i + 1] = WHITE[1];
            png.data[i + 2] = WHITE[2];
            png.data[i + 3] = 255;
          }
        }
      }
    }
  };

  let cursor = startX;
  for (const ch of text) {
    drawGlyph(FONT[ch], cursor, startY);
    cursor += 8 * cellSize + 2 * cellSize;
  }

  return png;
}

function write(filename, png) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(path.join(OUT_DIR, filename));
    png.pack().pipe(out).on("finish", resolve).on("error", reject);
  });
}

(async () => {
  await write("icon-192.png", generateIcon(192, { padding: 0.12, rounded: true }));
  await write("icon-512.png", generateIcon(512, { padding: 0.12, rounded: true }));
  // Maskable: must look good when cropped to a circle/squircle by the OS — fill edges with brand colour, no rounded corners.
  await write("icon-maskable.png", generateIcon(512, { padding: 0.22, rounded: false }));
  console.log("✓ generated PWA icons in", OUT_DIR);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
