// ---------------------------------------------------------------------------
// Device Fingerprinting Utility
// Generates a multi-layer fingerprint combining persistent IDs, canvas, WebGL,
// screen metrics, and audio-context signals into a single SHA-256 hash.
// Every layer is independently guarded so a failure in one does not break the
// overall fingerprint.
// ---------------------------------------------------------------------------

const STORAGE_KEY = '_vp_did';
const IDB_DB_NAME = '_vp_fingerprint';
const IDB_STORE_NAME = 'meta';

// ---- Helpers ---------------------------------------------------------------

/** Generate a RFC-4122-style v4 UUID using crypto.getRandomValues. */
function generateUUID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Set version (4) and variant (10xx) bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

/** SHA-256 hash a string using SubtleCrypto. Returns a hex-encoded digest. */
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Simple djb2-style string hash (synchronous fallback for sub-components). */
function quickHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

// ---- IndexedDB helpers -----------------------------------------------------

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readonly');
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as string | undefined);
    req.onerror = () => reject(req.error);
  });
}

function idbPut(db: IDBDatabase, key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
    const store = tx.objectStore(IDB_STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ---- Layer 1 – Persistent UUID (localStorage + IndexedDB) ------------------

let _cachedPersistentId: string | null = null;

async function getOrCreatePersistentId(): Promise<string> {
  if (_cachedPersistentId) return _cachedPersistentId;

  let lsValue: string | null = null;
  let idbValue: string | undefined;

  // Try localStorage
  try {
    lsValue = localStorage.getItem(STORAGE_KEY);
  } catch {
    /* blocked / unavailable */
  }

  // Try IndexedDB
  try {
    const db = await idbOpen();
    idbValue = await idbGet(db, STORAGE_KEY);
    db.close();
  } catch {
    /* blocked / unavailable */
  }

  // Resolve: prefer whichever exists; generate if neither does
  const resolved = lsValue ?? idbValue ?? generateUUID();

  // Sync both stores so they stay in agreement
  try {
    localStorage.setItem(STORAGE_KEY, resolved);
  } catch {
    /* ignore */
  }

  try {
    const db = await idbOpen();
    await idbPut(db, STORAGE_KEY, resolved);
    db.close();
  } catch {
    /* ignore */
  }

  _cachedPersistentId = resolved;
  return resolved;
}

// ---- Layer 2 – Canvas fingerprint ------------------------------------------

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 256, 128);
    gradient.addColorStop(0, '#ff6b35');
    gradient.addColorStop(1, '#5277f7');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 128);

    // Text with specific font stack – renders differently per GPU/OS/font set
    ctx.fillStyle = '#1a1a2e';
    ctx.font = '18px "Arial", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText('Vidyapeeth Pune 🎓 © 2026', 4, 4);

    // Geometric shapes
    ctx.fillStyle = 'rgba(82, 119, 247, 0.7)';
    ctx.beginPath();
    ctx.arc(128, 64, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, 100);
    ctx.bezierCurveTo(60, 20, 180, 120, 240, 40);
    ctx.stroke();

    // Blending
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255, 107, 53)';
    ctx.fillRect(50, 30, 100, 60);

    return quickHash(canvas.toDataURL());
  } catch {
    return '';
  }
}

// ---- Layer 3 – WebGL fingerprint -------------------------------------------

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl') ?? canvas.getContext('experimental-webgl');
    if (!gl || !(gl instanceof WebGLRenderingContext)) return '';

    const dbgExt = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbgExt
      ? gl.getParameter(dbgExt.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR);
    const renderer = dbgExt
      ? gl.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);

    const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    const maxAnisotropy = (() => {
      const ext =
        gl.getExtension('EXT_texture_filter_anisotropic') ??
        gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
      return ext
        ? gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)
        : 'n/a';
    })();

    return quickHash(
      `${vendor}~${renderer}~${maxTextureSize}~${maxAnisotropy}`
    );
  } catch {
    return '';
  }
}

// ---- Layer 4 – Screen fingerprint ------------------------------------------

function getScreenFingerprint(): string {
  try {
    const { width, height, colorDepth } = screen;
    const dpr = window.devicePixelRatio ?? 1;
    return quickHash(`${width}x${height}x${dpr}x${colorDepth}`);
  } catch {
    return '';
  }
}

// ---- Layer 5 – Audio fingerprint -------------------------------------------

function getAudioFingerprint(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const AudioCtx =
        window.OfflineAudioContext ??
        (window as unknown as Record<string, typeof OfflineAudioContext>)
          .webkitOfflineAudioContext;

      if (!AudioCtx) {
        resolve('');
        return;
      }

      const context = new AudioCtx(1, 44100, 44100);
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(10000, context.currentTime);

      const compressor = context.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-50, context.currentTime);
      compressor.knee.setValueAtTime(40, context.currentTime);
      compressor.ratio.setValueAtTime(12, context.currentTime);
      compressor.attack.setValueAtTime(0, context.currentTime);
      compressor.release.setValueAtTime(0.25, context.currentTime);

      oscillator.connect(compressor);
      compressor.connect(context.destination);
      oscillator.start(0);

      context.startRendering().then((buffer) => {
        const data = buffer.getChannelData(0);
        // Sample a handful of values for a stable fingerprint
        let sum = 0;
        for (let i = 4500; i < 5000; i++) {
          sum += Math.abs(data[i]);
        }
        resolve(quickHash(sum.toString()));
      });

      // Safety timeout – don't block forever
      setTimeout(() => resolve(''), 3000);
    } catch {
      resolve('');
    }
  });
}

// ---- Public API ------------------------------------------------------------

/**
 * Returns the persistent device UUID. Synchronous after the first call
 * (returns cached value). Falls back to a freshly-generated UUID if storage
 * is inaccessible.
 */
export function getPersistentId(): string {
  // Return cached value if available (after first async init)
  if (_cachedPersistentId) return _cachedPersistentId;

  // Synchronous fallback: try localStorage only
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      _cachedPersistentId = stored;
      return stored;
    }
  } catch {
    /* ignore */
  }

  // Generate, cache, and attempt to persist
  const id = generateUUID();
  _cachedPersistentId = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  return id;
}

/**
 * Generate a multi-layer device fingerprint.
 *
 * Combines:
 * 1. Persistent UUID (localStorage + IndexedDB)
 * 2. Canvas rendering fingerprint
 * 3. WebGL GPU info fingerprint
 * 4. Screen metrics fingerprint
 * 5. Audio processing fingerprint
 *
 * Each layer is wrapped in try/catch — if one fails, the others still
 * contribute to the final SHA-256 hash.
 */
export async function getDeviceFingerprint(): Promise<string> {
  const [persistentId, audioFp] = await Promise.all([
    getOrCreatePersistentId(),
    getAudioFingerprint(),
  ]);

  const canvasFp = getCanvasFingerprint();
  const webglFp = getWebGLFingerprint();
  const screenFp = getScreenFingerprint();

  const raw = [persistentId, canvasFp, webglFp, screenFp, audioFp]
    .filter(Boolean)
    .join('|');

  return sha256(raw);
}
