import * as THREE from 'three';

function hash2D(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Generates a tileable procedural biome ground texture for MeshStandardMaterial.
 */
export function createBiomeGroundTexture(biome: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    let base = '#47862b';
    let patchDark = '#3a7222';
    let patchLight = '#589c36';
    let speckA = '#2e5d19';
    let speckB = '#6db345';

    if (biome === 'desert') {
      base = '#d29f54';
      patchDark = '#be8b42';
      patchLight = '#e0b068';
      speckA = '#a47533';
      speckB = '#ecc481';
    } else if (biome === 'snow') {
      base = '#cfdfec';
      patchDark = '#b8cde0';
      patchLight = '#e2edf6';
      speckA = '#9bb6ce';
      speckB = '#eef5fb';
    } else if (biome === 'volcano') {
      base = '#241f26';
      patchDark = '#1a161c';
      patchLight = '#312a33';
      speckA = '#120e14';
      speckB = '#48342e';
    }

    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);

    // Organic biome patches (wrapped across tile edges for seamless tiling)
    for (let i = 0; i < 65; i++) {
      const px = hash2D(i, 1, 11) * size;
      const py = hash2D(i, 2, 17) * size;
      const r = 14 + hash2D(i, 3, 23) * 28;
      ctx.fillStyle = i % 2 === 0 ? patchDark : patchLight;
      ctx.globalAlpha = 0.22;
      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          ctx.beginPath();
          ctx.arc(px + ox, py + oy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Fine grass blades / sand grains / pebble specks
    ctx.globalAlpha = 0.28;
    for (let i = 0; i < 520; i++) {
      const x = hash2D(i, 5, 31) * size;
      const y = hash2D(i, 7, 43) * size;
      const w = biome === 'grass' ? 2 : 2.5;
      const h = biome === 'grass' ? 5 : 2.5;
      ctx.fillStyle = i % 3 === 0 ? speckA : speckB;
      ctx.fillRect(x, y, w, h);
    }
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(22, 22);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Generates a tileable stone paver / road texture for path tiles.
 */
export function createStoneRoadTexture(biome: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    let mortar = '#7c6a53';
    let stoneA = '#cbb089';
    let stoneB = '#bfa177';
    let stoneC = '#d8be98';

    if (biome === 'desert') {
      mortar = '#6e4e27';
      stoneA = '#b78646';
      stoneB = '#a8783a';
      stoneC = '#c59656';
    } else if (biome === 'snow') {
      mortar = '#5a7896';
      stoneA = '#8eb8db';
      stoneB = '#7da9ce';
      stoneC = '#a2c9e8';
    } else if (biome === 'volcano') {
      mortar = '#27120d';
      stoneA = '#46251b';
      stoneB = '#3b1d15';
      stoneC = '#572f23';
    }

    ctx.fillStyle = mortar;
    ctx.fillRect(0, 0, size, size);

    const rows = 4;
    const cols = 4;
    const cellW = size / cols;
    const cellH = size / rows;
    const tones = [stoneA, stoneB, stoneC];

    for (let r = 0; r < rows; r++) {
      const offset = (r % 2) * (cellW * 0.5);
      for (let c = -1; c <= cols; c++) {
        const x = c * cellW + offset + 3;
        const y = r * cellH + 3;
        const w = cellW - 6;
        const h = cellH - 6;
        const toneIdx = Math.floor(hash2D(c + 10, r + 10, 5) * tones.length);
        ctx.fillStyle = tones[toneIdx];
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 6);
        ctx.fill();

        // Subtle stone bevel highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
      }
    }

    // Subtle surface grain
    ctx.globalAlpha = 0.14;
    for (let i = 0; i < 240; i++) {
      const gx = hash2D(i, 9, 61) * size;
      const gy = hash2D(i, 11, 67) * size;
      ctx.fillStyle = i % 2 === 0 ? '#000000' : '#ffffff';
      ctx.fillRect(gx, gy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
