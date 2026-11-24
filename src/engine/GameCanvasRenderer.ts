import { GameMapConfig, GameStateSnapshot, GridCoord, TowerType } from '../types/game';
import { TOWER_CATALOG } from './Tower';

interface CoinPopup {
  x: number;
  y: number;
  text: string;
  age: number;
  maxAge: number;
  color: string;
}

interface BlastEffect {
  x: number;
  y: number;
  radius: number;
  age: number;
  maxAge: number;
  color: string;
}

// Per-map terrain offscreen cache so grass tufts, winding dirt road & scenery render at crisp 60fps
const terrainCache = new Map<string, HTMLCanvasElement>();

// Frame-to-frame transient VFX tracker (popups & explosion shockwaves)
const vfxState = {
  lastMapId: '',
  prevEnemyPos: new Map<number, { x: number; y: number; reward: number }>(),
  prevProjPos: new Map<number, { x: number; y: number; splashRadius: number; color: string }>(),
  popups: [] as CoinPopup[],
  blasts: [] as BlastEffect[],
  lastTime: 0,
};

function seededHash(r: number, c: number, salt = 0): number {
  let x = (r * 73856093) ^ (c * 19349663) ^ (salt * 83492791);
  x = ((x >> 16) ^ x) * 0x45d9f3b;
  x = ((x >> 16) ^ x) * 0x45d9f3b;
  x = (x >> 16) ^ x;
  return (x >>> 0) / 4294967295;
}

function drawTree(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale = 1): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);

  // Ground shadow
  ctx.fillStyle = 'rgba(20, 38, 8, 0.32)';
  ctx.beginPath();
  ctx.ellipse(2, 13, 16, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Trunk
  ctx.fillStyle = '#6b4226';
  ctx.strokeStyle = '#24180d';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.roundRect(-4, 1, 8, 12, 2);
  ctx.fill();
  ctx.stroke();

  // Layered lush leafy crown
  const clusters: Array<[number, number, number, string]> = [
    [-7, -2, 11, '#3d7d1f'],
    [7, -2, 11, '#3d7d1f'],
    [0, -9, 13, '#4f9c27'],
    [-3, -12, 7, '#73c641'],
  ];
  for (const [ox, oy, rad, col] of clusters) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(ox, oy, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f3f10';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  ctx.restore();
}

function drawBoulderAndBush(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
  ctx.save();
  ctx.translate(cx, cy);

  ctx.fillStyle = 'rgba(20, 38, 8, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 10, 15, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rock
  ctx.fillStyle = '#7c858e';
  ctx.strokeStyle = '#262b30';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-12, 8);
  ctx.lineTo(-9, -6);
  ctx.lineTo(3, -9);
  ctx.lineTo(13, 2);
  ctx.lineTo(10, 9);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#9aa3ad';
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.lineTo(2, -7);
  ctx.lineTo(6, 0);
  ctx.lineTo(-4, 1);
  ctx.closePath();
  ctx.fill();

  // Small shrub tucked beside rock
  ctx.fillStyle = '#478b21';
  ctx.strokeStyle = '#1e3e0f';
  ctx.beginPath();
  ctx.arc(-8, 6, 7, 0, Math.PI * 2);
  ctx.arc(-1, 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function buildStaticTerrain(map: GameMapConfig): HTMLCanvasElement {
  const cs = map.cellSize;
  const width = map.cols * cs;
  const height = map.rows * cs;
  const off = document.createElement('canvas');
  off.width = width;
  off.height = height;
  const ctx = off.getContext('2d')!;

  // 1. Lush Kingdom Rush-style meadow grass base
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, '#62a42e');
  grad.addColorStop(0.5, '#599828');
  grad.addColorStop(1, '#4c8621');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle sunlit meadow blotches
  for (let i = 0; i < 42; i++) {
    const px = seededHash(i, 1, 9) * width;
    const py = seededHash(i, 2, 9) * height;
    const rx = 28 + seededHash(i, 3, 9) * 54;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(130, 198, 62, 0.20)' : 'rgba(54, 102, 22, 0.16)';
    ctx.beginPath();
    ctx.ellipse(px, py, rx, rx * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Grass tufts & tiny meadow flowers across grass
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const gx = c * cs;
      const gy = r * cs;
      for (let k = 0; k < 3; k++) {
        const tx = gx + 6 + seededHash(r, c, k * 3 + 1) * (cs - 12);
        const ty = gy + 8 + seededHash(r, c, k * 3 + 2) * (cs - 14);
        ctx.strokeStyle = 'rgba(37, 74, 15, 0.45)';
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx - 3, ty - 5);
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + 1, ty - 6);
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + 4, ty - 4);
        ctx.stroke();
      }
      if (seededHash(r, c, 77) > 0.72) {
        const fx = gx + 10 + seededHash(r, c, 78) * (cs - 20);
        const fy = gy + 10 + seededHash(r, c, 79) * (cs - 20);
        ctx.fillStyle = seededHash(r, c, 80) > 0.5 ? '#fde047' : '#f8fafc';
        ctx.beginPath();
        ctx.arc(fx, fy, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 2. Smooth curved sandy-dirt path with grassy overhang bank
  if (map.groundPath.length > 1) {
    const pts = map.groundPath.map((pt) => ({
      x: pt.col * cs + cs / 2,
      y: pt.row * cs + cs / 2,
    }));

    const traceRoad = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
    };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Dark grassy overhang outline
    traceRoad();
    ctx.strokeStyle = '#335917';
    ctx.lineWidth = cs * 0.80;
    ctx.stroke();

    // Warm earthen shoulder
    traceRoad();
    ctx.strokeStyle = '#b79862';
    ctx.lineWidth = cs * 0.70;
    ctx.stroke();

    // Sandy cream main road
    traceRoad();
    ctx.strokeStyle = '#dfd0a5';
    ctx.lineWidth = cs * 0.58;
    ctx.stroke();

    // Soft center sunlit trail
    traceRoad();
    ctx.strokeStyle = 'rgba(246, 236, 204, 0.45)';
    ctx.lineWidth = cs * 0.26;
    ctx.stroke();
    ctx.restore();

    // Pebbles & stepping stones along path
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      for (let k = 0; k < 2; k++) {
        const ox = (seededHash(i, k, 51) - 0.5) * (cs * 0.42);
        const oy = (seededHash(i, k, 52) - 0.5) * (cs * 0.42);
        ctx.fillStyle = 'rgba(150, 125, 84, 0.35)';
        ctx.beginPath();
        ctx.ellipse(p.x + ox, p.y + oy, 3.5, 2.2, seededHash(i, k, 53) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // 3. Special terrain features: stone build pads, obstacles (trees/boulders), slow bogs, resource shrines, gate & castle
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      const t = map.grid[r][c];
      const cx = c * cs + cs / 2;
      const cy = r * cs + cs / 2;

      if (t === 'buildable') {
        // Subtle flagged stone/earth build plot (like Kingdom Rush circular stone pads)
        ctx.save();
        ctx.fillStyle = 'rgba(214, 198, 152, 0.25)';
        ctx.strokeStyle = 'rgba(65, 92, 32, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 3, cs * 0.33, cs * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Tiny rune center dot
        ctx.fillStyle = 'rgba(255, 248, 220, 0.35)';
        ctx.beginPath();
        ctx.arc(cx, cy + 3, 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (t === 'obstacle') {
        if (seededHash(r, c, 12) > 0.38) {
          drawTree(ctx, cx, cy - 2, 0.92 + seededHash(r, c, 13) * 0.16);
        } else {
          drawBoulderAndBush(ctx, cx, cy);
        }
      } else if (t === 'slow_zone') {
        // Frosted mud / arcane bog on the road
        ctx.save();
        ctx.fillStyle = 'rgba(56, 189, 248, 0.34)';
        ctx.strokeStyle = 'rgba(14, 116, 144, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cs * 0.32, cs * 0.24, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#bae6fd';
        ctx.beginPath();
        ctx.arc(cx - 5, cy - 2, 2.2, 0, Math.PI * 2);
        ctx.arc(cx + 6, cy + 3, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (t === 'resource') {
        // Ancient Coin-Crystal Boost Shrine
        ctx.save();
        ctx.fillStyle = '#475569';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 4, cs * 0.34, cs * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#2dd4bf';
        ctx.strokeStyle = '#0f766e';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 14);
        ctx.lineTo(cx + 10, cy + 1);
        ctx.lineTo(cx, cy + 11);
        ctx.lineTo(cx - 10, cy + 1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } else if (t === 'entry') {
        // Crimson Raider War-Banner Archway
        ctx.save();
        ctx.fillStyle = 'rgba(127, 29, 29, 0.5)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 2, cs * 0.38, cs * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#dc2626';
        ctx.strokeStyle = '#27120c';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 16);
        ctx.lineTo(cx + 12, cy - 8);
        ctx.lineTo(cx - 12, cy);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(cx - 12, cy - 17);
        ctx.lineTo(cx - 12, cy + 12);
        ctx.stroke();
        ctx.restore();
      } else if (t === 'base') {
        // Player's Fortified Castle Keep
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.35)';
        ctx.beginPath();
        ctx.ellipse(cx, cy + 10, 22, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        // Main keep walls
        ctx.fillStyle = '#cbd5e1';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cx - 16, cy - 10, 32, 22, 3);
        ctx.fill();
        ctx.stroke();

        // Battlement crenels
        ctx.fillStyle = '#94a3b8';
        for (let b = -14; b <= 10; b += 8) {
          ctx.fillRect(cx + b, cy - 15, 5, 6);
          ctx.strokeRect(cx + b, cy - 15, 5, 6);
        }

        // Arched wooden castle gate
        ctx.fillStyle = '#78350f';
        ctx.beginPath();
        ctx.arc(cx, cy + 5, 6, Math.PI, 0);
        ctx.lineTo(cx + 6, cy + 12);
        ctx.lineTo(cx - 6, cy + 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Golden Kingdom Banner
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.moveTo(cx, cy - 23);
        ctx.lineTo(cx + 10, cy - 19);
        ctx.lineTo(cx, cy - 15);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - 24);
        ctx.lineTo(cx, cy - 10);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  // Decorative wooden fences along bottom corners like Image 1
  ctx.save();
  ctx.strokeStyle = '#3b2313';
  ctx.fillStyle = '#7c4d2b';
  ctx.lineWidth = 1.6;
  for (let fx = 28; fx < 160; fx += 44) {
    const fy = height - 10;
    ctx.fillRect(fx, fy - 12, 5, 13);
    ctx.strokeRect(fx, fy - 12, 5, 13);
    ctx.fillRect(fx, fy - 9, 44, 3);
    ctx.strokeRect(fx, fy - 9, 44, 3);
  }
  ctx.restore();

  return off;
}

function drawTowerSprite(
  ctx: CanvasRenderingContext2D,
  t: GameStateSnapshot['towers'][number],
  isSelected: boolean,
  timeMs: number
): void {
  const x = t.x;
  const y = t.y;
  const lv = t.level;
  const cfg = TOWER_CATALOG[t.type];

  ctx.save();

  // Selection / upgrade halo
  if (isSelected) {
    ctx.beginPath();
    ctx.arc(x, y, t.range, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(250, 204, 21, 0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Ground shadow
  ctx.fillStyle = 'rgba(15, 25, 10, 0.38)';
  ctx.beginPath();
  ctx.ellipse(x, y + 14, 19 + lv, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Glow aura for higher-level or crystal towers
  if (lv >= 2 || t.type === 'slow' || t.type === 'laser') {
    const pulse = 0.22 + 0.08 * Math.sin(timeMs * 0.005 + t.id);
    ctx.fillStyle =
      t.type === 'slow'
        ? `rgba(34, 211, 238, ${pulse})`
        : t.type === 'laser'
        ? `rgba(217, 70, 239, ${pulse})`
        : t.type === 'splash'
        ? `rgba(249, 115, 22, ${pulse})`
        : `rgba(250, 204, 21, ${pulse * 0.7})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 8, 22, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineWidth = 2;
  ctx.strokeStyle = isSelected ? '#fde047' : '#1b1f14';

  // Unique 2.5D stylized tower art per type
  if (t.type === 'basic') {
    // Stone Archer Watchtower
    ctx.fillStyle = lv >= 3 ? '#d4c391' : '#9ca3af';
    ctx.beginPath();
    ctx.roundRect(x - 14, y - 4, 28, 18, 5);
    ctx.fill();
    ctx.stroke();

    // Top parapet
    ctx.fillStyle = lv >= 2 ? '#e5c158' : '#cbd5e1';
    ctx.beginPath();
    ctx.roundRect(x - 16, y - 13, 32, 11, 4);
    ctx.fill();
    ctx.stroke();

    // Archer hood & crossbow
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(x, y - 16, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 13);
    ctx.lineTo(x + 8, y - 15);
    ctx.stroke();
  } else if (t.type === 'sniper') {
    // Elven Wooden Canopy Ranger Perch (like Image 2!)
    ctx.fillStyle = '#6b4226';
    ctx.beginPath();
    ctx.roundRect(x - 12, y - 3, 24, 17, 5);
    ctx.fill();
    ctx.stroke();

    // Leafy ring & platform
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.ellipse(x, y - 6, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hooded ranger with horns/feathers
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.arc(x, y - 15, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 20);
    ctx.lineTo(x - 7, y - 25);
    ctx.moveTo(x + 4, y - 20);
    ctx.lineTo(x + 7, y - 25);
    ctx.stroke();
  } else if (t.type === 'rapid') {
    // Brass & Steel Mechanical Gatling Turret
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.roundRect(x - 14, y - 2, 28, 16, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = lv >= 2 ? '#f59e0b' : '#eab308';
    ctx.beginPath();
    ctx.arc(x, y - 8, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Twin barrels
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(x - 5, y - 20, 4, 10);
    ctx.fillRect(x + 1, y - 20, 4, 10);
  } else if (t.type === 'splash') {
    // Bombard Cannon Mortar (like bottom-right of Image 1!)
    ctx.fillStyle = '#78716c';
    ctx.beginPath();
    ctx.roundRect(x - 15, y - 1, 30, 15, 5);
    ctx.fill();
    ctx.stroke();

    // Heavy iron mortar barrel
    ctx.fillStyle = '#3f3f46';
    ctx.beginPath();
    ctx.roundRect(x - 10, y - 17, 20, 18, 4);
    ctx.fill();
    ctx.stroke();

    // Glowing red mortar mouth rim
    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.ellipse(x, y - 17, 8.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (t.type === 'slow') {
    // Frost Crystal Obelisk (like bottom-left of Image 1!)
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.roundRect(x - 14, y + 1, 28, 13, 4);
    ctx.fill();
    ctx.stroke();

    const bob = Math.sin(timeMs * 0.005 + t.id) * 2.5;
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#0c4a6e';
    ctx.beginPath();
    ctx.moveTo(x, y - 24 + bob);
    ctx.lineTo(x + 9, y - 10 + bob);
    ctx.lineTo(x, y + 2 + bob);
    ctx.lineTo(x - 9, y - 10 + bob);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (t.type === 'laser') {
    // Arcane Purple Mage Spire (like top-right of Image 1!)
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(x - 15, y + 14);
    ctx.lineTo(x - 10, y - 10);
    ctx.lineTo(x + 10, y - 10);
    ctx.lineTo(x + 15, y + 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Purple glowing orb levitating atop spire
    const bob = Math.sin(timeMs * 0.006 + t.id) * 2;
    ctx.fillStyle = '#d946ef';
    ctx.shadowColor = '#e879f9';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y - 17 + bob, 7.5 + lv * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#4a044e';
    ctx.stroke();
  }

  // Upgrade stars (Lv 1 / Lv 2 / Lv 3)
  for (let s = 0; s < lv; s++) {
    const sx = x - ((lv - 1) * 8) / 2 + s * 8;
    const sy = y + 18;
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#422006';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Resource Crystal boost indicator
  if (t.resourceBoost) {
    ctx.fillStyle = '#2dd4bf';
    ctx.strokeStyle = '#042f2e';
    ctx.lineWidth = 1.5;
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeText('+20%', x + 14, y - 14);
    ctx.fillText('+20%', x + 14, y - 14);
  }

  // Keep reference to cfg unused warning away
  void cfg;
  ctx.restore();
}

function drawEnemySprite(
  ctx: CanvasRenderingContext2D,
  e: GameStateSnapshot['enemies'][number],
  timeMs: number
): void {
  const bob = Math.sin(timeMs * 0.014 + e.id * 1.7) * 2.2;
  const x = e.x;
  const y = e.isFlying ? e.y - 10 + bob * 1.4 : e.y + bob;
  const rad = e.type === 'boss' ? 16 : e.type === 'heavy' ? 13 : e.type === 'fast' ? 9 : 10.5;

  ctx.save();

  // Ground shadow
  ctx.fillStyle = 'rgba(15, 25, 10, 0.35)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + rad * 0.85, rad * 0.9, rad * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Boss shield aura or Hit Flash halo
  if (e.hitFlash) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.beginPath();
    ctx.arc(x, y, rad + 4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (e.shieldActive) {
    ctx.strokeStyle = '#e879f9';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x, y, rad + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.strokeStyle = e.slowTimer > 0 ? '#38bdf8' : '#1b1f14';
  ctx.lineWidth = 2;

  if (e.isFlying) {
    // Winged Bat / Wyvern (like top-left of Image 1!)
    const wingY = Math.sin(timeMs * 0.025 + e.id) * 5;
    ctx.fillStyle = '#4c1d95';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 15, y - 12 + wingY, x - 18, y + 3);
    ctx.lineTo(x - 5, y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 15, y - 12 + wingY, x + 18, y + 3);
    ctx.lineTo(x + 5, y + 3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#6d28d9';
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (e.type === 'fast') {
    // Grey Dire Wolf (like bottom-right of Image 1!)
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.ellipse(x, y + 2, 10, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(x + 6, y - 3, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (e.type === 'heavy') {
    // Giant Orc Titan carrying Red Banner (like center of Image 1!)
    ctx.fillStyle = '#b91c1c';
    ctx.fillRect(x - 10, y - 22, 8, 11);
    ctx.strokeRect(x - 10, y - 22, 8, 11);

    ctx.fillStyle = '#4d7c0f';
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (e.type === 'armored') {
    // Shield Knight Goblin with Iron Helmet
    ctx.fillStyle = '#65a30d';
    ctx.beginPath();
    ctx.arc(x, y + 2, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Steel dome helmet
    ctx.fillStyle = '#94a3b8';
    ctx.beginPath();
    ctx.arc(x, y - 1, rad * 0.92, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (e.type === 'boss') {
    // Crimson Armored Warlord Boss with Golden Horns
    ctx.fillStyle = '#991b1b';
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 9);
    ctx.lineTo(x - 15, y - 20);
    ctx.lineTo(x - 3, y - 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 9, y - 9);
    ctx.lineTo(x + 15, y - 20);
    ctx.lineTo(x + 3, y - 13);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Normal Green Goblin Grunt with pointy ears
    ctx.fillStyle = '#65a30d';
    ctx.beginPath();
    ctx.moveTo(x - rad, y - 2);
    ctx.lineTo(x - rad - 5, y - 6);
    ctx.lineTo(x - rad + 2, y + 3);
    ctx.moveTo(x + rad, y - 2);
    ctx.lineTo(x + rad + 5, y - 6);
    ctx.lineTo(x + rad - 2, y + 3);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Glowing angry eyes
  ctx.fillStyle = e.slowTimer > 0 ? '#bae6fd' : '#fef08a';
  ctx.beginPath();
  ctx.arc(x - 3, y - 1, 1.7, 0, Math.PI * 2);
  ctx.arc(x + 3, y - 1, 1.7, 0, Math.PI * 2);
  ctx.fill();

  // Crisp Kingdom Rush-style Health Bar
  const barW = rad * 2.5;
  const ratio = Math.max(0, Math.min(1, e.health / e.maxHealth));
  ctx.fillStyle = '#090d07';
  ctx.fillRect(x - barW / 2 - 1, y - rad - 11, barW + 2, 5.5);
  ctx.fillStyle = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#eab308' : '#ef4444';
  ctx.fillRect(x - barW / 2, y - rad - 10, barW * ratio, 3.5);

  ctx.restore();
}

export function renderGameCanvas(
  ctx: CanvasRenderingContext2D,
  map: GameMapConfig,
  state: GameStateSnapshot,
  spatialBoxes: Array<{ x: number; y: number; w: number; h: number }>,
  kdLines: Array<{ x1: number; y1: number; x2: number; y2: number; axis: 'x' | 'y' }>,
  hoverCell: GridCoord | null,
  placingType: TowerType | null,
  showSpatialOverlay: boolean,
  activeMenuCell?: GridCoord | null
): void {
  const cs = map.cellSize;
  const width = map.cols * cs;
  const height = map.rows * cs;
  const now = performance.now();
  const vfxDt = vfxState.lastTime > 0 ? Math.min(0.1, (now - vfxState.lastTime) / 1000) : 0.016;
  vfxState.lastTime = now;

  // Reset transient VFX on map reset
  if (vfxState.lastMapId !== map.id || (state.wave === 0 && state.enemiesDefeated === 0 && vfxState.prevEnemyPos.size > 0)) {
    vfxState.lastMapId = map.id;
    vfxState.prevEnemyPos.clear();
    vfxState.prevProjPos.clear();
    vfxState.popups = [];
    vfxState.blasts = [];
  }

  // Track newly defeated enemies for floating +Coins popups
  const currentEnemies = new Map<number, { x: number; y: number; reward: number }>();
  for (const e of state.enemies) {
    currentEnemies.set(e.id, { x: e.x, y: e.y, reward: e.reward });
  }
  for (const [eid, prev] of vfxState.prevEnemyPos.entries()) {
    if (!currentEnemies.has(eid) && state.enemiesDefeated > 0 && state.status !== 'idle') {
      if (prev.x < width - cs * 1.4) {
        vfxState.popups.push({
          x: prev.x,
          y: prev.y - 10,
          text: `+${prev.reward}`,
          age: 0,
          maxAge: 0.9,
          color: '#fde047',
        });
      }
    }
  }
  vfxState.prevEnemyPos = currentEnemies;

  // Track projectile explosions
  const currentProjs = new Map<number, { x: number; y: number; splashRadius: number; color: string }>();
  for (const p of state.projectiles) {
    currentProjs.set(p.id, { x: p.x, y: p.y, splashRadius: p.splashRadius, color: p.color });
  }
  for (const [pid, prev] of vfxState.prevProjPos.entries()) {
    if (!currentProjs.has(pid) && prev.splashRadius > 0) {
      vfxState.blasts.push({
        x: prev.x,
        y: prev.y,
        radius: prev.splashRadius,
        age: 0,
        maxAge: 0.35,
        color: prev.color,
      });
    }
  }
  vfxState.prevProjPos = currentProjs;

  // 1. Draw cached organic meadow + winding road terrain
  let bg = terrainCache.get(map.id);
  if (!bg || bg.width !== width || bg.height !== height) {
    bg = buildStaticTerrain(map);
    terrainCache.set(map.id, bg);
  }
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(bg, 0, 0);

  // 2. Optional QuadTree / KD-Tree spatial partition overlay
  if (showSpatialOverlay) {
    ctx.save();
    for (const b of spatialBoxes) {
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.42)';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
    for (const ln of kdLines) {
      ctx.strokeStyle = ln.axis === 'x' ? 'rgba(244, 114, 182, 0.5)' : 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(ln.x1, ln.y1);
      ctx.lineTo(ln.x2, ln.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 3. Highlight active radial build plot or hover placement preview
  const previewCell = activeMenuCell ?? hoverCell;
  if (previewCell) {
    const { row, col } = previewCell;
    if (row >= 0 && row < map.rows && col >= 0 && col < map.cols) {
      const occupied = state.towers.some((t) => t.row === row && t.col === col);
      const valid = map.grid[row][col] === 'buildable' && !occupied;
      const cx = col * cs + cs / 2;
      const cy = row * cs + cs / 2;

      if (placingType || activeMenuCell) {
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy + 3, cs * 0.38, cs * 0.28, 0, 0, Math.PI * 2);
        ctx.fillStyle = valid ? 'rgba(250, 204, 21, 0.26)' : 'rgba(244, 63, 94, 0.26)';
        ctx.fill();
        ctx.strokeStyle = valid ? '#fde047' : '#f43f5e';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        if (placingType) {
          const cfg = TOWER_CATALOG[placingType];
          ctx.beginPath();
          ctx.arc(cx, cy, cfg.range, 0, Math.PI * 2);
          ctx.fillStyle = valid ? 'rgba(250, 204, 21, 0.08)' : 'rgba(244, 63, 94, 0.08)';
          ctx.fill();
          ctx.strokeStyle = valid ? 'rgba(250, 204, 21, 0.65)' : 'rgba(244, 63, 94, 0.65)';
          ctx.setLineDash([6, 4]);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  // 4. Draw 2.5D Towers (sorted top-to-bottom by Y for natural overlap)
  const sortedTowers = [...state.towers].sort((a, b) => a.y - b.y);
  for (const t of sortedTowers) {
    drawTowerSprite(ctx, t, state.selectedTowerId === t.id, now);
  }

  // 5. Draw Animated Enemies (ground first, flying on top)
  const groundEnemies = state.enemies.filter((e) => !e.isFlying).sort((a, b) => a.y - b.y);
  const airEnemies = state.enemies.filter((e) => e.isFlying);
  for (const e of groundEnemies) drawEnemySprite(ctx, e, now);
  for (const e of airEnemies) drawEnemySprite(ctx, e, now);

  // 6. Draw Projectiles & Beams
  for (const p of state.projectiles) {
    if (p.isLaser) {
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 14);
      ctx.lineTo(p.targetX, p.targetY);
      ctx.stroke();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 14);
      ctx.lineTo(p.targetX, p.targetY);
      ctx.stroke();
      ctx.restore();
    } else if (p.splashRadius > 0) {
      // Dark cannonball shell with fiery fuse spark
      ctx.save();
      ctx.fillStyle = '#18181b';
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    } else {
      ctx.save();
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // 7. Render & advance Blast Shockwaves, Active Spells, Floating +Coin Popups & Ambient Clouds
  for (const fx of state.spellEffects ?? []) {
    ctx.save();
    const p = fx.progress;
    if (fx.kind === 'meteor') {
      const r = 135 * Math.sin(p * Math.PI * 0.85);
      const grad = ctx.createRadialGradient(fx.x, fx.y, 4, fx.x, fx.y, Math.max(12, r));
      grad.addColorStop(0, `rgba(254, 240, 138, ${1 - p})`);
      grad.addColorStop(0.45, `rgba(249, 115, 22, ${0.85 * (1 - p)})`);
      grad.addColorStop(1, 'rgba(220, 38, 38, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, Math.max(12, r), 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(253, 224, 71, ${1 - p})`;
      ctx.lineWidth = 4 * (1 - p);
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, 135 * p, 0, Math.PI * 2);
      ctx.stroke();
    } else if (fx.kind === 'frost') {
      ctx.fillStyle = `rgba(56, 189, 248, ${0.22 * (1 - p)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = `rgba(186, 230, 253, ${0.95 * (1 - p)})`;
      ctx.lineWidth = 5 * (1 - p);
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, Math.max(width, height) * 0.65 * p, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  vfxState.blasts = vfxState.blasts.filter((b) => {
    b.age += vfxDt;
    if (b.age >= b.maxAge) return false;
    const t = b.age / b.maxAge;
    ctx.save();
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = 'rgba(251, 146, 60, 0.32)';
    ctx.strokeStyle = '#fde047';
    ctx.lineWidth = 3 * (1 - t);
    ctx.beginPath();
    ctx.arc(b.x, b.y, Math.max(8, b.radius * t), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    return true;
  });

  vfxState.popups = vfxState.popups.filter((pop) => {
    pop.age += vfxDt;
    if (pop.age >= pop.maxAge) return false;
    const t = pop.age / pop.maxAge;
    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t);
    const yy = pop.y - t * 26;
    // Small shiny gold coin icon next to +amount
    ctx.fillStyle = '#facc15';
    ctx.strokeStyle = '#713f12';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(pop.x - 14, yy - 4, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = 3;
    ctx.strokeText(pop.text, pop.x - 7, yy);
    ctx.fillStyle = pop.color;
    ctx.fillText(pop.text, pop.x - 7, yy);
    ctx.restore();
    return true;
  });

  // Gentle passing cloud shadows overhead
  ctx.save();
  ctx.fillStyle = 'rgba(15, 28, 12, 0.09)';
  for (let c = 0; c < 3; c++) {
    const cx = ((now * 0.018 + c * 320) % (width + 260)) - 130;
    const cy = 70 + c * 150;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 95, 36, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// Fullscreen Animated Fantasy Battlefield Diorama for the Game Home / Title Screen
export function renderMenuBackdrop(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeMs: number
): void {
  // 1. Vibrant sunset/sunburst mountain sky (inspired by Tower Defense Clash banner)
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.56);
  sky.addColorStop(0, '#4c3575');
  sky.addColorStop(0.5, '#a878a8');
  sky.addColorStop(1, '#fce7a2');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Rotating golden sunburst rays behind center crest
  ctx.save();
  ctx.translate(w * 0.5, h * 0.42);
  ctx.rotate(timeMs * 0.00012);
  for (let i = 0; i < 16; i++) {
    ctx.rotate((Math.PI * 2) / 16);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 248, 198, 0.14)' : 'rgba(255, 255, 255, 0)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-w * 0.08, -w);
    ctx.lineTo(w * 0.08, -w);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Drifting fluffy cartoon clouds
  for (let i = 0; i < 6; i++) {
    const cx = ((timeMs * 0.016 * (1 + (i % 2) * 0.35) + i * (w / 4)) % (w + 260)) - 130;
    const cy = h * (0.09 + (i % 3) * 0.08);
    ctx.fillStyle = 'rgba(255, 252, 242, 0.72)';
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.arc(cx + 22, cy - 8, 28, 0, Math.PI * 2);
    ctx.arc(cx + 46, cy, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  // Distant Mountain Range Peaks
  ctx.fillStyle = '#475569';
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 2;
  const peaks = [0, 0.14, 0.28, 0.44, 0.62, 0.78, 0.92, 1.05];
  ctx.beginPath();
  ctx.moveTo(0, h * 0.56);
  for (let i = 0; i < peaks.length; i++) {
    const px = peaks[i] * w;
    const py = h * (i % 2 === 0 ? 0.34 : 0.43);
    ctx.lineTo(px, py);
  }
  ctx.lineTo(w, h * 0.56);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Rolling Emerald Meadow Ground
  const ground = ctx.createLinearGradient(0, h * 0.48, 0, h);
  ground.addColorStop(0, '#6db334');
  ground.addColorStop(1, '#3e7818');
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.48, w, h * 0.52);

  // Winding Fantasy Dirt Road across the foreground
  const drawRoadStroke = (color: string, widthPx: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = widthPx;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.48);
    ctx.bezierCurveTo(w * 0.64, h * 0.62, w * 0.28, h * 0.75, w * 0.42, h * 1.04);
    ctx.stroke();
  };
  drawRoadStroke('#2b4a13', Math.min(115, w * 0.12));
  drawRoadStroke('#b5955c', Math.min(98, w * 0.10));
  drawRoadStroke('#dfc995', Math.min(80, w * 0.08));

  // Flanking Lush Animated Trees
  for (let i = 0; i < 10; i++) {
    const side = i < 5 ? 0.04 + i * 0.055 : 0.74 + (i - 5) * 0.055;
    const sway = Math.sin(timeMs * 0.0025 + i) * 2;
    drawTree(ctx, w * side + sway, h * (0.55 + (i % 3) * 0.13), 1.15 + (i % 2) * 0.25);
  }

  // Animated Diorama Towers guarding the road
  const t1 = { id: 91, type: 'basic' as const, name: 'Archer', row: 0, col: 0, x: w * 0.30, y: h * 0.64, damage: 20, attackSpeed: 1, range: 120, level: 3, cost: 80, upgradeCost: 0, sellValue: 80, specialAbility: '', targetingStrategy: 'nearest' as const, kills: 0, damageDealt: 0, resourceBoost: false, lastTargetId: null, attackCooldown: 0, shotsFired: 0 };
  const t2 = { ...t1, id: 92, type: 'laser' as const, x: w * 0.72, y: h * 0.63 };
  const t3 = { ...t1, id: 93, type: 'splash' as const, x: w * 0.22, y: h * 0.80 };
  const t4 = { ...t1, id: 94, type: 'slow' as const, x: w * 0.77, y: h * 0.82 };
  drawTowerSprite(ctx, t1, false, timeMs);
  drawTowerSprite(ctx, t2, false, timeMs);
  drawTowerSprite(ctx, t3, false, timeMs);
  drawTowerSprite(ctx, t4, false, timeMs);

  // Marching & Flying Silhouettes for live motion
  for (let b = 0; b < 4; b++) {
    const bx = ((timeMs * 0.05 + b * 240) % (w + 120)) - 60;
    const by = h * (0.18 + (b % 2) * 0.07) + Math.sin(timeMs * 0.006 + b) * 8;
    const flap = Math.sin(timeMs * 0.015 + b) * 5;
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(bx - 10, by + flap);
    ctx.quadraticCurveTo(bx - 4, by - 5, bx, by);
    ctx.quadraticCurveTo(bx + 4, by - 5, bx + 10, by + flap);
    ctx.stroke();
  }

  // Animated Goblin & Bat raiders along the foreground road
  for (let g = 0; g < 3; g++) {
    const prog = ((timeMs * 0.00016 + g * 0.33) % 1);
    const gx = w * (0.50 - prog * 0.08 + Math.sin(prog * Math.PI * 2) * 0.09);
    const gy = h * (0.51 + prog * 0.45);
    drawEnemySprite(
      ctx,
      {
        id: g + 1,
        type: g === 1 ? 'flying' : g === 2 ? 'armored' : 'normal',
        name: 'Raider',
        health: 80,
        maxHealth: 100,
        speed: 60,
        baseSpeed: 60,
        armor: 0,
        x: gx,
        y: gy,
        pathIndex: 0,
        pathProgress: prog,
        reward: 12,
        status: 'Advancing',
        threatScore: 10,
        isFlying: g === 1,
        slowTimer: 0,
        shieldActive: false,
      },
      timeMs
    );
  }
}
