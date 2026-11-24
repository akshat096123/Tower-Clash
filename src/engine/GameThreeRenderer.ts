import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  DifficultyLevel,
  GameMapConfig,
  GameStateSnapshot,
  GridCoord,
  ProjectileSnapshot,
  TowerSnapshot,
  TowerType,
} from '../types/game';

// ---------------------------------------------------------------------------
// Camera & Visual Types
// ---------------------------------------------------------------------------
export type CameraViewMode = 'isometric' | 'orbit' | 'topdown';

interface FloatingText3D {
  mesh: THREE.Sprite;
  x: number;
  y: number;
  z: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface Particle3D {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

interface EnemyModelInstance {
  group: THREE.Group;
  enemyType: string;
  isFlying: boolean;
  limbs: {
    leftLeg?: THREE.Mesh;
    rightLeg?: THREE.Mesh;
    leftArm?: THREE.Mesh;
    rightArm?: THREE.Mesh;
    leftWing?: THREE.Mesh;
    rightWing?: THREE.Mesh;
    head?: THREE.Mesh;
    banner?: THREE.Mesh;
    tail?: THREE.Mesh;
    staff?: THREE.Mesh;
  };
  healthBar: THREE.Group;
  healthFill: THREE.Mesh;
  shieldMesh?: THREE.Mesh;
  lastHp: number;
  flashTimer: number;
}

interface HeroModelInstance {
  group: THREE.Group;
  heroType: TowerType;
  level: number;
  auraMesh: THREE.Mesh;
  starsGroup: THREE.Group;
  bodyMesh?: THREE.Mesh;
  weaponMesh?: THREE.Mesh;
  capeMesh?: THREE.Mesh;
}

const HERO_AURA_COLORS: Record<TowerType, number> = {
  basic: 0x22c55e, // Emerald Green - Elven Marksman
  sniper: 0x06b6d4, // Cyan - Shadow Ranger
  rapid: 0xeab308, // Electric Yellow - Crossbow Gunslinger
  splash: 0xef4444, // Fiery Red - Dwarf Bombardier
  slow: 0x38bdf8, // Ice Blue - Frost Templar
  laser: 0xa855f7, // Arcane Purple - Arcane Sorceress
};

// ---------------------------------------------------------------------------
// GameThreeRenderer Class
// ---------------------------------------------------------------------------
export class GameThreeRenderer {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private gltfLoader: GLTFLoader;

  private map: GameMapConfig | null = null;
  private viewMode: CameraViewMode = 'isometric';

  // Ground plane & Raycasting
  private groundPlane: THREE.Mesh | null = null;
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();

  // Model cache
  private gltfCache = new Map<string, THREE.Group>();
  private gltfLoading = new Set<string>();

  // Scene object layers
  private terrainGroup = new THREE.Group();
  private decorGroup = new THREE.Group();
  private castleGroup = new THREE.Group();
  private heroesGroup = new THREE.Group();
  private enemiesGroup = new THREE.Group();
  private projectilesGroup = new THREE.Group();
  private vfxGroup = new THREE.Group();
  private uiGroup = new THREE.Group();

  private enemyInstances = new Map<number, EnemyModelInstance>();
  private heroInstances = new Map<number, HeroModelInstance>();
  private projectileMeshes = new Map<number, THREE.Object3D>();

  private floatingTexts: FloatingText3D[] = [];
  private particles: Particle3D[] = [];
  private animatedWindmillBlades: THREE.Mesh[] = [];

  // Hover & selection helpers
  private hoverRuneMesh: THREE.Mesh | null = null;
  private rangeIndicatorMesh: THREE.Mesh | null = null;

  // Camera & screen shake
  private cameraTarget = new THREE.Vector3(0, 0, 0);
  private cameraOffset = new THREE.Vector3(0, 390, 350);
  private shakeTimer = 0;
  private shakeIntensity = 0;

  // Free Orbit drag state
  private isDragging = false;
  private previousMouseX = 0;
  private previousMouseY = 0;
  private orbitTheta = 0;
  private orbitPhi = Math.PI / 3.8;
  private orbitRadius = 540;

  private animClock = 0;
  private isDisposed = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();

    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    this.camera = new THREE.PerspectiveCamera(40, aspect, 10, 3400);
    this.updateCameraTransform();

    this.gltfLoader = new GLTFLoader();

    this.scene.add(this.terrainGroup);
    this.scene.add(this.decorGroup);
    this.scene.add(this.castleGroup);
    this.scene.add(this.heroesGroup);
    this.scene.add(this.enemiesGroup);
    this.scene.add(this.projectilesGroup);
    this.scene.add(this.vfxGroup);
    this.scene.add(this.uiGroup);

    this.setupLighting();
    this.preloadProps();
    this.setupEventListeners();
  }

  // -------------------------------------------------------------------------
  // Lighting & Atmosphere
  // -------------------------------------------------------------------------
  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0xdce7f4, 1.15);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0xa5cbee, 0x47782b, 0.75);
    hemi.position.set(0, 350, 0);
    this.scene.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff5df, 2.3);
    sun.position.set(260, 490, 240);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 50;
    sun.shadow.camera.far = 1300;
    const d = 520;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0006;
    this.scene.add(sun);
  }

  private preloadProps(): void {
    const urls = [
      '/models/kaykit/decoration/nature/tree_single_A.gltf',
      '/models/kaykit/decoration/nature/trees_B_medium.gltf',
      '/models/kaykit/decoration/nature/rock_single_B.gltf',
      '/models/kaykit/decoration/nature/rock_single_C.gltf',
      '/models/kaykit/decoration/props/flag_blue.gltf',
      '/models/kaykit/decoration/props/flag_red.gltf',
      '/models/kaykit/decoration/props/barrel.gltf',
      '/models/kaykit/decoration/props/crate_A_big.gltf',
    ];

    for (const u of urls) {
      if (this.gltfCache.has(u) || this.gltfLoading.has(u)) continue;
      this.gltfLoading.add(u);
      this.gltfLoader.load(
        u,
        (gltf) => {
          gltf.scene.traverse((node) => {
            if ((node as THREE.Mesh).isMesh) {
              const m = node as THREE.Mesh;
              m.castShadow = true;
              m.receiveShadow = true;
            }
          });
          this.gltfCache.set(u, gltf.scene);
          this.gltfLoading.delete(u);
        },
        undefined,
        () => this.gltfLoading.delete(u)
      );
    }
  }

  // -------------------------------------------------------------------------
  // Map Terrain & Biome Setup
  // -------------------------------------------------------------------------
  public setMap(map: GameMapConfig): void {
    this.map = map;
    this.animatedWindmillBlades = [];

    // Clear old terrain, decor, and castle
    while (this.terrainGroup.children.length > 0) {
      const o = this.terrainGroup.children.pop();
      if (o) this.disposeObject(o);
    }
    while (this.decorGroup.children.length > 0) {
      const o = this.decorGroup.children.pop();
      if (o) this.disposeObject(o);
    }
    while (this.castleGroup.children.length > 0) {
      const o = this.castleGroup.children.pop();
      if (o) this.disposeObject(o);
    }

    const biome = map.biome || 'grass';
    const boardW = map.cols * map.cellSize;
    const boardH = map.rows * map.cellSize;

    // Apply Biome Atmosphere & Background Colors
    let bgColor = 0x132212;
    let groundColor = 0x488a2a; // Lush grass
    let roadColor = 0xd7b889; // Sandy dirt road
    let roadBorderColor = 0x5a6350;

    if (biome === 'desert') {
      bgColor = 0x24180c;
      groundColor = 0xd4a359; // Golden sand dunes
      roadColor = 0xb88846; // Baked sandstone path
      roadBorderColor = 0x8a6333;
    } else if (biome === 'snow') {
      bgColor = 0x0f1c2b;
      groundColor = 0xebf2f7; // Crisp snow
      roadColor = 0x9dc6e8; // Frozen slippery ice road
      roadBorderColor = 0x64748b;
    } else if (biome === 'volcano') {
      bgColor = 0x160807;
      groundColor = 0x221d24; // Obsidian volcanic ash
      roadColor = 0x422017; // Scorched lava path
      roadBorderColor = 0x7c2d12;
    }

    this.scene.background = new THREE.Color(bgColor);
    this.scene.fog = new THREE.FogExp2(bgColor, 0.00065);

    // Natural Land Surface Plane (Clean, continuous terrain with NO stone discs!)
    const groundGeo = new THREE.PlaneGeometry(boardW + 420, boardH + 420);
    const groundMat = new THREE.MeshStandardMaterial({
      color: groundColor,
      roughness: biome === 'snow' ? 0.35 : 0.85,
      metalness: biome === 'snow' ? 0.15 : 0.05,
    });
    this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.set(0, -0.5, 0);
    this.groundPlane.receiveShadow = true;
    this.terrainGroup.add(this.groundPlane);

    // Build Cobblestone Road Segments
    const cellW = map.cellSize;
    const halfW = boardW / 2;
    const halfH = boardH / 2;

    const roadMat = new THREE.MeshStandardMaterial({
      color: roadColor,
      roughness: biome === 'snow' ? 0.3 : 0.85,
    });
    const slowZoneMat = new THREE.MeshStandardMaterial({
      color: biome === 'volcano' ? 0xef4444 : 0x3d3522,
      emissive: biome === 'volcano' ? 0x991b1b : 0x000000,
      roughness: 0.95,
    });

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const terrain = map.grid[r][c];
        const worldX = c * cellW + cellW / 2 - halfW;
        const worldZ = r * cellW + cellW / 2 - halfH;

        if (terrain === 'path' || terrain === 'entry' || terrain === 'base' || terrain === 'slow_zone') {
          // Seamless continuous road slab (1.02x cellW ensures zero gaps/seams)
          const roadGeo = new THREE.BoxGeometry(cellW * 1.02, 2.6, cellW * 1.02);
          const roadMesh = new THREE.Mesh(roadGeo, terrain === 'slow_zone' ? slowZoneMat : roadMat);
          roadMesh.position.set(worldX, 1.2, worldZ);
          roadMesh.receiveShadow = true;
          this.terrainGroup.add(roadMesh);

          // Natural roadside curbstones and wooden fence posts along corners
          if ((r + c) % 2 === 0) {
            const curb = new THREE.Mesh(
              new THREE.BoxGeometry(cellW * 0.96, 3.8, 3.2),
              new THREE.MeshStandardMaterial({ color: roadBorderColor, roughness: 0.9 })
            );
            curb.position.set(worldX, 2.0, worldZ + cellW * 0.47);
            curb.castShadow = true;
            this.terrainGroup.add(curb);
          }

          // Random cobblestone relief paver details for realistic textured road
          if ((r * 3 + c * 5) % 3 === 0) {
            const stoneDetail = new THREE.Mesh(
              new THREE.DodecahedronGeometry(2.5, 0),
              new THREE.MeshStandardMaterial({ color: roadBorderColor, roughness: 0.9 })
            );
            stoneDetail.position.set(worldX + ((c % 3) - 1) * 8, 2.6, worldZ + ((r % 3) - 1) * 8);
            stoneDetail.scale.set(1.4, 0.4, 1.2);
            stoneDetail.receiveShadow = true;
            this.terrainGroup.add(stoneDetail);
          }
        }
      }
    }

    // Portal Spawner Arch at Entry Waypoint
    const startPoint = map.groundPath[0];
    if (startPoint) {
      const spawnerGroup = new THREE.Group();
      const sx = startPoint.col * cellW + cellW / 2 - halfW;
      const sz = startPoint.row * cellW + cellW / 2 - halfH;
      spawnerGroup.position.set(sx, 0, sz);

      const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 });
      const p1 = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 36, 8), pillarMat);
      p1.position.set(-16, 18, 0);
      p1.castShadow = true;
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, 36, 8), pillarMat);
      p2.position.set(16, 18, 0);
      p2.castShadow = true;
      const arch = new THREE.Mesh(new THREE.BoxGeometry(40, 8, 10), pillarMat);
      arch.position.set(0, 36, 0);
      arch.castShadow = true;
      spawnerGroup.add(p1, p2, arch);

      const rift = new THREE.Mesh(
        new THREE.TorusGeometry(12, 3, 12, 24),
        new THREE.MeshBasicMaterial({ color: 0x9333ea })
      );
      rift.position.set(0, 18, 0);
      spawnerGroup.add(rift);

      this.decorGroup.add(spawnerGroup);
    }

    // Grand 3D Royal Citadel / Castle Keep at Road End
    const endPoint = map.groundPath[map.groundPath.length - 1];
    if (endPoint) {
      const ex = endPoint.col * cellW + cellW / 2 - halfW;
      const ez = endPoint.row * cellW + cellW / 2 - halfH;
      this.buildGrandCitadel(ex, ez, biome);
    }

    // Biome-specific Decor & 3D Elements (Cacti in Desert, Snowmen in Snow, Windmills in Grass)
    this.populateBiomeDecor(boardW, boardH, biome, map);

    // Sleek Hover Summoning Rune Ring
    const hoverGeo = new THREE.RingGeometry(cellW * 0.32, cellW * 0.42, 28);
    const hoverMat = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.hoverRuneMesh = new THREE.Mesh(hoverGeo, hoverMat);
    this.hoverRuneMesh.rotation.x = -Math.PI / 2;
    this.hoverRuneMesh.position.y = 2.2;
    this.uiGroup.add(this.hoverRuneMesh);

    // Range Circle Indicator for selected hero
    const rangeGeo = new THREE.RingGeometry(1, 2, 64);
    const rangeMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.rangeIndicatorMesh = new THREE.Mesh(rangeGeo, rangeMat);
    this.rangeIndicatorMesh.rotation.x = -Math.PI / 2;
    this.rangeIndicatorMesh.position.y = 1.6;
    this.uiGroup.add(this.rangeIndicatorMesh);
  }

  // -------------------------------------------------------------------------
  // Grand 3D Castle Fortress at the End of the Path
  // -------------------------------------------------------------------------
  private buildGrandCitadel(ex: number, ez: number, biome: string): void {
    const castle = new THREE.Group();
    castle.position.set(ex, 0, ez);

    const stoneColor = biome === 'desert' ? 0xd4b27a : biome === 'volcano' ? 0x2b2b36 : 0x64748b;
    const roofColor = biome === 'snow' ? 0x1e3a8a : biome === 'volcano' ? 0x991b1b : 0x1d4ed8;

    const stoneMat = new THREE.MeshStandardMaterial({ color: stoneColor, roughness: 0.65 });
    const roofMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.4 });
    const gateMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.8, roughness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 });

    // Main Central Keep (Large imposing fortress)
    const keep = new THREE.Mesh(new THREE.BoxGeometry(52, 54, 46), stoneMat);
    keep.position.y = 27;
    keep.castShadow = true;
    keep.receiveShadow = true;
    castle.add(keep);

    // Keep Upper Parapets / Battlements
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(56, 10, 50), stoneMat);
    parapet.position.y = 57;
    parapet.castShadow = true;
    castle.add(parapet);

    // 4 Corner Defensive Bastion Towers
    const towerGeo = new THREE.CylinderGeometry(9, 11, 68, 10);
    const roofGeo = new THREE.ConeGeometry(13, 26, 10);

    const towerOffsets = [
      { x: -26, z: -20 },
      { x: 26, z: -20 },
      { x: -26, z: 20 },
      { x: 26, z: 20 },
    ];

    towerOffsets.forEach((off) => {
      const tower = new THREE.Mesh(towerGeo, stoneMat);
      tower.position.set(off.x, 34, off.z);
      tower.castShadow = true;
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(off.x, 80, off.z);
      roof.castShadow = true;
      castle.add(tower, roof);
    });

    // Grand Fortified Portcullis Gate
    const gate = new THREE.Mesh(new THREE.BoxGeometry(24, 30, 4), gateMat);
    gate.position.set(0, 15, 23.5);
    gate.castShadow = true;
    castle.add(gate);

    // Royal Banners Fluttering
    const bannerMat = new THREE.MeshBasicMaterial({ color: 0x2563eb, side: THREE.DoubleSide });
    const b1 = new THREE.Mesh(new THREE.PlaneGeometry(12, 24), bannerMat);
    b1.position.set(-26, 56, 22);
    const b2 = new THREE.Mesh(new THREE.PlaneGeometry(12, 24), bannerMat);
    b2.position.set(26, 56, 22);
    castle.add(b1, b2);

    // Golden Royal Crest Plate
    const crest = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 2), goldMat);
    crest.position.set(0, 38, 24);
    castle.add(crest);

    // Burning Gate Torches
    const torchMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
    const t1 = new THREE.Mesh(new THREE.SphereGeometry(2.5, 6, 6), torchMat);
    t1.position.set(-15, 24, 24);
    const t2 = new THREE.Mesh(new THREE.SphereGeometry(2.5, 6, 6), torchMat);
    t2.position.set(15, 24, 24);
    castle.add(t1, t2);

    this.castleGroup.add(castle);
  }

  // -------------------------------------------------------------------------
  // Biome-Specific 3D Procedural Elements (Cactus in Desert, Snowman in Snow)
  // -------------------------------------------------------------------------
  private createSaguaroCactus(): THREE.Group {
    const group = new THREE.Group();
    const cactusMat = new THREE.MeshStandardMaterial({ color: 0x2d6a4f, roughness: 0.8 }); // Rich green
    const flowerMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b }); // Yellow blossom

    // Main ribbed trunk
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 28, 8), cactusMat);
    trunk.position.y = 14;
    trunk.castShadow = true;
    group.add(trunk);

    // Left arm
    const leftArmH = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 7, 6), cactusMat);
    leftArmH.rotation.z = Math.PI / 2;
    leftArmH.position.set(-4.5, 14, 0);
    const leftArmV = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 12, 6), cactusMat);
    leftArmV.position.set(-8, 19, 0);
    leftArmV.castShadow = true;
    group.add(leftArmH, leftArmV);

    // Right arm
    const rightArmH = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 7, 6), cactusMat);
    rightArmH.rotation.z = Math.PI / 2;
    rightArmH.position.set(4.5, 18, 0);
    const rightArmV = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 11, 6), cactusMat);
    rightArmV.position.set(8, 22.5, 0);
    rightArmV.castShadow = true;
    group.add(rightArmH, rightArmV);

    // Blossom buds on top
    const bud = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 6), flowerMat);
    bud.position.set(0, 28.5, 0);
    group.add(bud);

    return group;
  }

  private createSnowman(): THREE.Group {
    const group = new THREE.Group();
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const coalMat = new THREE.MeshBasicMaterial({ color: 0x18181b });
    const carrotMat = new THREE.MeshBasicMaterial({ color: 0xf97316 }); // Orange nose
    const scarfMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 }); // Red scarf
    const hatMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.5 }); // Black top hat
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 }); // Stick arms

    // 1. Bottom Snowball
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 10), snowMat);
    bottom.position.y = 7;
    bottom.castShadow = true;

    // 2. Middle Snowball
    const middle = new THREE.Mesh(new THREE.SphereGeometry(5.2, 10, 10), snowMat);
    middle.position.y = 16.5;
    middle.castShadow = true;

    // 3. Head Snowball
    const head = new THREE.Mesh(new THREE.SphereGeometry(3.8, 10, 10), snowMat);
    head.position.y = 23.5;
    head.castShadow = true;

    group.add(bottom, middle, head);

    // Carrot Nose
    const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4, 6), carrotMat);
    carrot.rotation.x = Math.PI / 2;
    carrot.position.set(0, 23.5, 4.5);
    group.add(carrot);

    // Coal Eyes
    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 5, 5), coalMat);
    eye1.position.set(-1.2, 24.5, 3.4);
    const eye2 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 5, 5), coalMat);
    eye2.position.set(1.2, 24.5, 3.4);
    group.add(eye1, eye2);

    // Red Winter Scarf
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(3.8, 0.8, 6, 16), scarfMat);
    scarf.rotation.x = Math.PI / 2;
    scarf.position.set(0, 20.2, 0);
    const scarfEnd = new THREE.Mesh(new THREE.BoxGeometry(1.4, 6, 0.5), scarfMat);
    scarfEnd.position.set(2, 18, 3.6);
    scarfEnd.rotation.z = -0.3;
    group.add(scarf, scarfEnd);

    // Black Top Hat with red ribbon
    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 0.6, 12), hatMat);
    hatBrim.position.set(0, 26.8, 0);
    const hatCylinder = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 6, 12), hatMat);
    hatCylinder.position.set(0, 29.8, 0);
    const hatRibbon = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.7, 1.2, 12), scarfMat);
    hatRibbon.position.set(0, 27.8, 0);
    group.add(hatBrim, hatCylinder, hatRibbon);

    // Stick Arms
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 10, 5), woodMat);
    leftArm.position.set(-7, 18, 0);
    leftArm.rotation.z = Math.PI / 3;
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 10, 5), woodMat);
    rightArm.position.set(7, 18, 0);
    rightArm.rotation.z = -Math.PI / 3;
    group.add(leftArm, rightArm);

    return group;
  }

  private createWindmill(): THREE.Group {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 });
    const bladeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a, side: THREE.DoubleSide });

    // Windmill Base Tower
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(6, 8.5, 26, 8), stoneMat);
    tower.position.y = 13;
    tower.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 12, 8), roofMat);
    roof.position.y = 31;
    roof.castShadow = true;
    group.add(tower, roof);

    // Center Rotor Hub & 4 Rotating Lattice Blades
    const rotor = new THREE.Group();
    rotor.position.set(0, 25, 7.5);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 3, 8), woodMat);
    hub.rotation.x = Math.PI / 2;
    rotor.add(hub);

    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(2.5, 16, 0.5), bladeMat);
      blade.position.set(Math.cos(angle) * 8, Math.sin(angle) * 8, 0);
      blade.rotation.z = angle;
      rotor.add(blade);
    }

    group.add(rotor);
    this.animatedWindmillBlades.push(rotor as unknown as THREE.Mesh);

    return group;
  }

  private createVolcanicCrag(): THREE.Group {
    const group = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.9 });
    const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff3b00 }); // Glowing molten magma

    const crag = new THREE.Mesh(new THREE.ConeGeometry(12, 28, 6), rockMat);
    crag.position.y = 14;
    crag.castShadow = true;

    // Glowing crater on top
    const crater = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 1, 2, 8), lavaMat);
    crater.position.y = 27;

    group.add(crag, crater);
    return group;
  }

  private createEgyptianPyramid(): THREE.Group {
    const group = new THREE.Group();
    const sandMat = new THREE.MeshStandardMaterial({ color: 0xd4a359, roughness: 0.75 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 });

    const pyr = new THREE.Mesh(new THREE.ConeGeometry(18, 22, 4), sandMat);
    pyr.position.y = 11;
    pyr.rotation.y = Math.PI / 4;
    pyr.castShadow = true;

    const cap = new THREE.Mesh(new THREE.ConeGeometry(5, 6, 4), goldMat);
    cap.position.y = 20;
    cap.rotation.y = Math.PI / 4;

    group.add(pyr, cap);
    return group;
  }

  private createSnowPine(): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.6 });
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 12, 6), trunkMat);
    trunk.position.y = 6;
    trunk.castShadow = true;
    group.add(trunk);

    // 3 tiered pine layers with white snow on top
    for (let i = 0; i < 3; i++) {
      const radius = 13 - i * 3.5;
      const height = 14 - i * 2;
      const y = 14 + i * 8;

      const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), pineMat);
      cone.position.y = y;
      cone.castShadow = true;

      const snow = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.92, height * 0.45, 7), snowCapMat);
      snow.position.y = y + height * 0.3;
      group.add(cone, snow);
    }

    return group;
  }

  private createFrostCrystalCluster(): THREE.Group {
    const group = new THREE.Group();
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.4,
      roughness: 0.15,
      metalness: 0.6,
      transparent: true,
      opacity: 0.85,
    });

    const counts = [
      { r: 3.5, h: 26, x: 0, z: 0, rotX: 0, rotZ: 0 },
      { r: 2.5, h: 18, x: -5, z: 3, rotX: 0.2, rotZ: -0.3 },
      { r: 2.2, h: 16, x: 5, z: -2, rotX: -0.2, rotZ: 0.25 },
      { r: 1.8, h: 12, x: 2, z: 5, rotX: 0.3, rotZ: 0.1 },
    ];

    counts.forEach((c) => {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(c.r, c.h, 6), crystalMat);
      spike.position.set(c.x, c.h / 2, c.z);
      spike.rotation.set(c.rotX, 0, c.rotZ);
      spike.castShadow = true;
      group.add(spike);
    });

    return group;
  }

  // -------------------------------------------------------------------------
  // Additional Biome Props (Desert Palms, Oasis, Igloos, Cottages, etc.)
  // -------------------------------------------------------------------------
  private createPalmTree(): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 }); // Ringed brown trunk
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6, side: THREE.DoubleSide });
    const nutMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9 });

    // Curved natural trunk segments
    const segments = 5;
    for (let i = 0; i < segments; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(2.4 - i * 0.2, 2.7 - i * 0.2, 5.5, 7), trunkMat);
      seg.position.set(Math.sin(i * 0.28) * 3, 2.5 + i * 5, 0);
      seg.rotation.z = -i * 0.08;
      seg.castShadow = true;
      group.add(seg);
    }

    // Tropical Palm Fronds radiating in a dome
    const frondCount = 7;
    for (let i = 0; i < frondCount; i++) {
      const angle = (i * Math.PI * 2) / frondCount;
      const frond = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.4, 16), frondMat);
      frond.position.set(
        Math.sin((segments - 1) * 0.28) * 3 + Math.cos(angle) * 7,
        segments * 5 + 0.5,
        Math.sin(angle) * 7
      );
      frond.rotation.y = angle;
      frond.rotation.x = 0.4;
      frond.castShadow = true;
      group.add(frond);
    }

    // Cluster of 3 Coconuts
    for (let i = 0; i < 3; i++) {
      const coconut = new THREE.Mesh(new THREE.SphereGeometry(1.2, 5, 5), nutMat);
      coconut.position.set(
        Math.sin((segments - 1) * 0.28) * 3 + ((i - 1) * 1.4),
        segments * 5 - 1.2,
        ((i % 2) - 0.5) * 1.4
      );
      group.add(coconut);
    }

    return group;
  }

  private createDesertOasis(): THREE.Group {
    const group = new THREE.Group();
    // Shimmering blue water pool
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      roughness: 0.1,
      metalness: 0.8,
      transparent: true,
      opacity: 0.88,
    });
    const sandRimMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.9 });

    const poolRim = new THREE.Mesh(new THREE.CylinderGeometry(17, 18, 2, 20), sandRimMat);
    poolRim.position.y = 1;
    const water = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 2.4, 20), waterMat);
    water.position.y = 1.3;
    group.add(poolRim, water);

    // 2 Palm trees on oasis shores
    const palm1 = this.createPalmTree();
    palm1.position.set(-11, 0, 4);
    palm1.scale.set(0.9, 0.9, 0.9);

    const palm2 = this.createPalmTree();
    palm2.position.set(10, 0, -5);
    palm2.scale.set(0.75, 0.75, 0.75);

    group.add(palm1, palm2);
    return group;
  }

  private createPricklyPearCactus(): THREE.Group {
    const group = new THREE.Group();
    const padMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.7 });
    const flowerMat = new THREE.MeshBasicMaterial({ color: 0xfacc15 });

    // Cluster of flattened round pads
    const pads = [
      { rx: 5, ry: 6.5, rz: 1.4, x: 0, y: 5.5, z: 0, rotZ: 0 },
      { rx: 4, ry: 5, rz: 1.2, x: -3.8, y: 11, z: 0.5, rotZ: 0.4 },
      { rx: 3.8, ry: 4.8, rz: 1.2, x: 3.5, y: 10.5, z: -0.5, rotZ: -0.35 },
      { rx: 3, ry: 3.8, rz: 1, x: -1, y: 15, z: 0, rotZ: 0.1 },
    ];

    pads.forEach((p) => {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(p.rx, p.ry, p.rz), padMat);
      pad.position.set(p.x, p.y, p.z);
      pad.rotation.z = p.rotZ;
      pad.castShadow = true;
      group.add(pad);
    });

    const flower = new THREE.Mesh(new THREE.SphereGeometry(1.2, 5, 5), flowerMat);
    flower.position.set(-1, 18, 0);
    group.add(flower);

    return group;
  }

  private createDesertRockArch(): THREE.Group {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });

    const leftCol = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 24, 7), stoneMat);
    leftCol.position.set(-10, 12, 0);
    leftCol.castShadow = true;

    const rightCol = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 24, 7), stoneMat);
    rightCol.position.set(10, 12, 0);
    rightCol.castShadow = true;

    const archTop = new THREE.Mesh(new THREE.BoxGeometry(26, 7, 7), stoneMat);
    archTop.position.set(0, 24, 0);
    archTop.castShadow = true;

    group.add(leftCol, rightCol, archTop);
    return group;
  }

  private createDesertBones(): THREE.Group {
    const group = new THREE.Group();
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.7 });

    // Ancient beast skull half-buried in sand
    const skull = new THREE.Mesh(new THREE.ConeGeometry(6, 14, 5), boneMat);
    skull.rotation.x = Math.PI / 2.3;
    skull.rotation.z = 0.3;
    skull.position.set(0, 3, 0);
    skull.castShadow = true;

    const horn1 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 4), boneMat);
    horn1.position.set(-4, 9, -2);
    horn1.rotation.z = 0.5;

    const horn2 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 4), boneMat);
    horn2.position.set(4, 9, -2);
    horn2.rotation.z = -0.5;

    // Rib cage arches
    for (let i = 0; i < 3; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(5, 0.7, 5, 12, Math.PI), boneMat);
      rib.position.set(0, 3, -7 - i * 4);
      rib.rotation.y = Math.PI;
      group.add(rib);
    }

    group.add(skull, horn1, horn2);
    return group;
  }

  private createIgloo(): THREE.Group {
    const group = new THREE.Group();
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
    const warmLight = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

    // Main snow dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), snowMat);
    dome.castShadow = true;
    dome.receiveShadow = true;

    // Entry tunnel arch
    const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 8, 8, 1, false, 0, Math.PI), snowMat);
    tunnel.rotation.x = Math.PI / 2;
    tunnel.rotation.z = Math.PI / 2;
    tunnel.position.set(0, 4, 13);
    tunnel.castShadow = true;

    // Glowing warm door opening
    const door = new THREE.Mesh(new THREE.PlaneGeometry(5, 6), warmLight);
    door.position.set(0, 3.5, 17);

    // Chimney pipe with smoke
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 6, 6), woodMat);
    pipe.position.set(6, 14, 0);

    group.add(dome, tunnel, door, pipe);
    return group;
  }

  private createFrozenPond(): THREE.Group {
    const group = new THREE.Group();
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x7dd3fc,
      roughness: 0.1,
      metalness: 0.7,
      transparent: true,
      opacity: 0.9,
    });
    const snowBankMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(16, 17, 2, 16), snowBankMat);
    rim.position.y = 0.8;
    const ice = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 14.5, 2.2, 16), iceMat);
    ice.position.y = 1.0;
    group.add(rim, ice);
    return group;
  }

  private createVillageCottage(): THREE.Group {
    const group = new THREE.Group();
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 }); // White plaster
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.85 }); // Timber frame
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.5 }); // Red clay tiles
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const winMat = new THREE.MeshBasicMaterial({ color: 0xfef08a }); // Lit window

    // House walls
    const house = new THREE.Mesh(new THREE.BoxGeometry(16, 13, 14), wallMat);
    house.position.y = 6.5;
    house.castShadow = true;

    // Timber corner posts
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 13.2, 1.6), beamMat);
    p1.position.set(-7.5, 6.5, -6.5);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 13.2, 1.6), beamMat);
    p2.position.set(7.5, 6.5, -6.5);
    const p3 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 13.2, 1.6), beamMat);
    p3.position.set(-7.5, 6.5, 6.5);
    const p4 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 13.2, 1.6), beamMat);
    p4.position.set(7.5, 6.5, 6.5);

    // Steep pitched gable roof
    const roof = new THREE.Mesh(new THREE.ConeGeometry(14, 10, 4), roofMat);
    roof.position.y = 18;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;

    // Stone chimney
    const chimney = new THREE.Mesh(
      new THREE.BoxGeometry(3, 12, 3),
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 })
    );
    chimney.position.set(4.5, 17, -2);
    chimney.castShadow = true;

    // Wooden front door & glowing windows
    const door = new THREE.Mesh(new THREE.BoxGeometry(3.6, 6.5, 0.5), doorMat);
    door.position.set(0, 3.5, 7.1);
    const win1 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3, 0.4), winMat);
    win1.position.set(-4.5, 6.5, 7.1);
    const win2 = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3, 0.4), winMat);
    win2.position.set(4.5, 6.5, 7.1);

    group.add(house, p1, p2, p3, p4, roof, chimney, door, win1, win2);
    return group;
  }

  private createOakTree(): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 14, 7), trunkMat);
    trunk.position.y = 7;
    trunk.castShadow = true;

    // Puffy deciduous leaf clusters
    const c1 = new THREE.Mesh(new THREE.DodecahedronGeometry(8.5, 1), leavesMat);
    c1.position.set(0, 18, 0);
    c1.castShadow = true;
    const c2 = new THREE.Mesh(new THREE.DodecahedronGeometry(6.5, 1), leavesMat);
    c2.position.set(-4, 16, 2);
    const c3 = new THREE.Mesh(new THREE.DodecahedronGeometry(6.5, 1), leavesMat);
    c3.position.set(4, 16, -2);

    group.add(trunk, c1, c2, c3);
    return group;
  }

  private createStoneWell(): THREE.Group {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.1 });

    const wall = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 7, 10), stoneMat);
    wall.position.y = 3.5;
    wall.castShadow = true;

    const water = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.2, 2, 10), waterMat);
    water.position.y = 2.5;

    // Roof supports & canopy
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 12, 5), woodMat);
    p1.position.set(-5, 9, 0);
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 12, 5), woodMat);
    p2.position.set(5, 9, 0);

    const roof = new THREE.Mesh(new THREE.ConeGeometry(7.5, 5, 8), woodMat);
    roof.position.y = 17;
    roof.castShadow = true;

    group.add(wall, water, p1, p2, roof);
    return group;
  }

  private createFlowerPatch(): THREE.Group {
    const group = new THREE.Group();
    const stemMat = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const colors = [0xef4444, 0xfacc15, 0xa855f7, 0x38bdf8, 0xffffff];

    for (let i = 0; i < 9; i++) {
      const col = colors[i % colors.length];
      const petalMat = new THREE.MeshBasicMaterial({ color: col });
      const ox = ((i % 3) - 1) * 3 + ((i * 3) % 2);
      const oz = (Math.floor(i / 3) - 1) * 3 + ((i * 5) % 2);

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.5, 4), stemMat);
      stem.position.set(ox, 1.7, oz);
      const bloom = new THREE.Mesh(new THREE.SphereGeometry(1.1, 5, 5), petalMat);
      bloom.position.set(ox, 3.8, oz);

      group.add(stem, bloom);
    }
    return group;
  }

  private createLavaPool(): THREE.Group {
    const group = new THREE.Group();
    const basaltMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const lavaMat = new THREE.MeshStandardMaterial({
      color: 0xff4500,
      emissive: 0xff2200,
      emissiveIntensity: 0.85,
      roughness: 0.3,
    });

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(15, 16, 2, 12), basaltMat);
    rim.position.y = 0.8;
    const lava = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 13.5, 2.2, 12), lavaMat);
    lava.position.y = 1.1;

    // Floating cooled obsidian crust islands
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(3.5, 0), basaltMat);
    rock.position.set(2, 2, -1);
    rock.scale.set(1.4, 0.4, 1.2);

    group.add(rim, lava, rock);
    return group;
  }

  private createBasaltPillars(): THREE.Group {
    const group = new THREE.Group();
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.85 });

    const heights = [28, 22, 16, 24, 18, 12];
    const offsets = [
      { x: 0, z: 0 },
      { x: 6, z: 3 },
      { x: -5, z: 4 },
      { x: 5, z: -4 },
      { x: -6, z: -3 },
      { x: 1, z: 7 },
    ];

    offsets.forEach((off, idx) => {
      const h = heights[idx];
      const col = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, h, 6), stoneMat);
      col.position.set(off.x, h / 2, off.z);
      col.castShadow = true;
      group.add(col);
    });

    return group;
  }

  // -------------------------------------------------------------------------
  // Populate Biome-Specific Interior & Perimeter Decor
  // -------------------------------------------------------------------------
  private populateBiomeDecor(boardW: number, boardH: number, biome: string, map: GameMapConfig): void {
    const cellW = map.cellSize;
    const halfW = boardW / 2;
    const halfH = boardH / 2;

    // 1. PLACE PROPS DIRECTLY ON ALL INTERIOR OBSTACLE CELLS INSIDE THE MAP!
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const terrain = map.grid[r][c];
        const worldX = c * cellW + cellW / 2 - halfW;
        const worldZ = r * cellW + cellW / 2 - halfH;

        if (terrain === 'obstacle') {
          let prop: THREE.Group | THREE.Mesh | null = null;

          if (biome === 'desert') {
            const pick = (r * 11 + c * 17) % 6;
            if (pick === 0) prop = this.createSaguaroCactus();
            else if (pick === 1) prop = this.createEgyptianPyramid();
            else if (pick === 2) prop = this.createDesertOasis();
            else if (pick === 3) prop = this.createPricklyPearCactus();
            else if (pick === 4) prop = this.createDesertRockArch();
            else prop = this.createDesertBones();
          } else if (biome === 'snow') {
            const pick = (r * 11 + c * 17) % 5;
            if (pick === 0) prop = this.createSnowman(); // 3D Snowman with carrot nose, top hat, coal eyes, scarf!
            else if (pick === 1) prop = this.createSnowPine();
            else if (pick === 2) prop = this.createFrostCrystalCluster();
            else if (pick === 3) prop = this.createIgloo();
            else prop = this.createFrozenPond();
          } else if (biome === 'volcano') {
            const pick = (r * 11 + c * 17) % 3;
            if (pick === 0) prop = this.createVolcanicCrag();
            else if (pick === 1) prop = this.createLavaPool();
            else prop = this.createBasaltPillars();
          } else {
            // Grassy Shire
            const pick = (r * 11 + c * 17) % 6;
            if (pick === 0) prop = this.createWindmill();
            else if (pick === 1) prop = this.createVillageCottage();
            else if (pick === 2) prop = this.createOakTree();
            else if (pick === 3) prop = this.createStoneWell();
            else if (pick === 4) prop = this.createFlowerPatch();
            else prop = this.createSnowPine();
          }

          if (prop) {
            prop.position.set(worldX, prop.position.y || 0, worldZ);
            this.decorGroup.add(prop);
          }
        } else if (terrain === 'resource') {
          // Ancient Gold Mine / Crystal Geode
          const resGroup = new THREE.Group();
          resGroup.position.set(worldX, 0, worldZ);
          const geode = new THREE.Mesh(
            new THREE.OctahedronGeometry(9, 0),
            new THREE.MeshStandardMaterial({
              color: 0xfacc15,
              emissive: 0xd97706,
              emissiveIntensity: 0.6,
              metalness: 0.8,
            })
          );
          geode.position.y = 9;
          resGroup.add(geode);
          this.decorGroup.add(resGroup);
        }
      }
    }

    // 2. PLACE PERIMETER SCENERY ALONG BORDERS (DENSE BIOME ATMOSPHERE)
    const perimeterCoords: Array<{ x: number; z: number }> = [];
    for (let x = -halfW - 55; x <= halfW + 55; x += 48) {
      perimeterCoords.push({ x, z: -halfH - 42 });
      perimeterCoords.push({ x, z: halfH + 42 });
    }
    for (let z = -halfH - 32; z <= halfH + 32; z += 48) {
      perimeterCoords.push({ x: -halfW - 55, z });
      perimeterCoords.push({ x: halfW + 55, z });
    }

    perimeterCoords.forEach((pt, i) => {
      const jx = pt.x + ((i * 13) % 20) - 10;
      const jz = pt.z + ((i * 17) % 20) - 10;

      let borderProp: THREE.Group | THREE.Mesh | null = null;
      if (biome === 'desert') {
        const p = i % 5;
        if (p === 0) borderProp = this.createSaguaroCactus();
        else if (p === 1) borderProp = this.createEgyptianPyramid();
        else if (p === 2) borderProp = this.createPalmTree();
        else if (p === 3) borderProp = this.createPricklyPearCactus();
        else borderProp = this.createDesertRockArch();
      } else if (biome === 'snow') {
        const p = i % 4;
        if (p === 0) borderProp = this.createSnowman();
        else if (p === 1) borderProp = this.createSnowPine();
        else if (p === 2) borderProp = this.createIgloo();
        else borderProp = this.createFrostCrystalCluster();
      } else if (biome === 'volcano') {
        const p = i % 3;
        if (p === 0) borderProp = this.createVolcanicCrag();
        else if (p === 1) borderProp = this.createBasaltPillars();
        else borderProp = this.createLavaPool();
      } else {
        const p = i % 5;
        if (p === 0) borderProp = this.createWindmill();
        else if (p === 1) borderProp = this.createVillageCottage();
        else if (p === 2) borderProp = this.createOakTree();
        else if (p === 3) borderProp = this.createStoneWell();
        else borderProp = this.createSnowPine();
      }

      if (borderProp) {
        borderProp.position.set(jx, borderProp.position.y || 0, jz);
        this.decorGroup.add(borderProp);
      }
    });

    // 3. BACKGROUND PERIMETER MOUNTAIN SILHOUETTE (FRAMING THE ARENA)
    const bgMountainMat = new THREE.MeshStandardMaterial({
      color: biome === 'desert' ? 0x9a652a : biome === 'snow' ? 0xdbeafe : biome === 'volcano' ? 0x18181b : 0x1e3a1e,
      roughness: 0.9,
    });
    const mountainOffsets = [
      { x: -halfW - 120, z: -halfH - 100, s: 55, h: 70 },
      { x: 0, z: -halfH - 120, s: 75, h: 90 },
      { x: halfW + 120, z: -halfH - 100, s: 60, h: 75 },
      { x: -halfW - 120, z: halfH + 100, s: 50, h: 65 },
      { x: 0, z: halfH + 120, s: 70, h: 85 },
      { x: halfW + 120, z: halfH + 100, s: 55, h: 70 },
      { x: -halfW - 130, z: 0, s: 65, h: 80 },
      { x: halfW + 130, z: 0, s: 65, h: 80 },
    ];
    mountainOffsets.forEach((m) => {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(m.s, m.h, 6), bgMountainMat);
      cone.position.set(m.x, m.h / 2, m.z);
      this.decorGroup.add(cone);
    });
  }

  // -------------------------------------------------------------------------
  // Main Render Frame
  // -------------------------------------------------------------------------
  public render(
    snap: GameStateSnapshot,
    dt: number,
    hoverCell: GridCoord | null,
    placingType: TowerType | null
  ): void {
    if (this.isDisposed || !this.map) return;

    this.animClock += dt;

    // Rotate windmill blades
    for (const b of this.animatedWindmillBlades) {
      b.rotation.z += dt * 1.5;
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const shakeMag = this.shakeIntensity * (this.shakeTimer / 0.3);
      this.camera.position.x += (Math.random() - 0.5) * shakeMag;
      this.camera.position.y += (Math.random() - 0.5) * shakeMag;
    } else {
      this.updateCameraTransform();
    }

    // 1. Sync & Animate 3D Hero Champions
    this.syncHeroes(snap.towers, snap.selectedTowerId);

    // 2. Sync & Animate 3D Villains (Dragon, Witch, Golem, Overlord)
    this.syncEnemies(snap.enemies, dt);

    // 3. Sync 3D Projectiles & Beams
    this.syncProjectiles(snap.projectiles, dt);

    // 4. Active Spell VFX (Meteors & Frost)
    this.syncSpellEffects(snap.spellEffects);

    // 5. Update Floating Text & Particles
    this.updateVfx(dt);

    // 6. Update Hover Summoning Rune & Range Circle
    this.updateHoverAndRange(hoverCell, placingType, snap);

    // 7. Render Three.js Scene
    this.renderer.render(this.scene, this.camera);
  }

  // -------------------------------------------------------------------------
  // Hero Champion Synchronization (Player's Army as Animated Characters)
  // -------------------------------------------------------------------------
  private syncHeroes(towers: TowerSnapshot[], selectedTowerId: number | null): void {
    if (!this.map) return;
    const boardW = this.map.cols * this.map.cellSize;
    const boardH = this.map.rows * this.map.cellSize;
    const activeIds = new Set<number>();

    for (const t of towers) {
      activeIds.add(t.id);
      let inst = this.heroInstances.get(t.id);

      const worldX = t.col * this.map.cellSize + this.map.cellSize / 2 - boardW / 2;
      const worldZ = t.row * this.map.cellSize + this.map.cellSize / 2 - boardH / 2;

      if (!inst) {
        inst = this.createHeroRig(t.type, t.level);
        inst.group.position.set(worldX, 0, worldZ);
        this.heroesGroup.add(inst.group);
        this.heroInstances.set(t.id, inst);
      }

      if (inst.level !== t.level) {
        inst.level = t.level;
        this.updateHeroLevelVisuals(inst, t.level);
      }

      const breath = Math.sin(this.animClock * 3 + t.id) * 0.4;
      if (inst.bodyMesh) inst.bodyMesh.position.y = 8 + breath;

      if (selectedTowerId === t.id) {
        const pulse = 0.8 + Math.sin(this.animClock * 6) * 0.2;
        inst.auraMesh.scale.set(1 + pulse * 0.12, 1 + pulse * 0.12, 1);
        (inst.auraMesh.material as THREE.MeshBasicMaterial).opacity = 0.95;
      } else {
        inst.auraMesh.scale.set(1, 1, 1);
        (inst.auraMesh.material as THREE.MeshBasicMaterial).opacity = 0.65;
      }
    }

    for (const [id, inst] of this.heroInstances.entries()) {
      if (!activeIds.has(id)) {
        this.heroesGroup.remove(inst.group);
        this.disposeObject(inst.group);
        this.heroInstances.delete(id);
      }
    }
  }

  private createHeroRig(type: TowerType, level: number): HeroModelInstance {
    const group = new THREE.Group();

    const auraColor = HERO_AURA_COLORS[type] ?? 0x22c55e;
    const auraGeo = new THREE.RingGeometry(12, 17, 28);
    const auraMat = new THREE.MeshBasicMaterial({
      color: auraColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    auraMesh.rotation.x = -Math.PI / 2;
    auraMesh.position.y = 0.6;
    group.add(auraMesh);

    const starsGroup = new THREE.Group();
    starsGroup.position.set(0, 28, 0);
    group.add(starsGroup);

    let bodyMesh: THREE.Mesh | undefined;
    let weaponMesh: THREE.Mesh | undefined;
    let capeMesh: THREE.Mesh | undefined;

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.6 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.6 });

    if (type === 'basic') {
      // 1. Elven Marksman (Archer in green cloak with recurve bow)
      const tunicMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7 });
      bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4.5, 12, 8), tunicMat);
      bodyMesh.position.y = 8;
      bodyMesh.castShadow = true;

      const head = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 8), skinMat);
      head.position.y = 15;
      head.castShadow = true;

      const bow = new THREE.Mesh(new THREE.TorusGeometry(6, 0.7, 6, 16, Math.PI), goldMat);
      bow.position.set(5, 10, 3);
      bow.rotation.y = -Math.PI / 3;
      weaponMesh = bow;

      group.add(bodyMesh, head, bow);
    } else if (type === 'sniper') {
      // 2. Shadow Ranger (Cloaked sniper kneeling with long arbalest)
      const cowlMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
      bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(7, 10, 6), cowlMat);
      bodyMesh.position.y = 7;
      bodyMesh.castShadow = true;

      const cowl = new THREE.Mesh(new THREE.ConeGeometry(4, 7, 6), cowlMat);
      cowl.position.y = 15;

      const arbalest = new THREE.Mesh(
        new THREE.BoxGeometry(3, 3, 20),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8, roughness: 0.3 })
      );
      arbalest.position.set(3, 9, 7);
      weaponMesh = arbalest;

      group.add(bodyMesh, cowl, arbalest);
    } else if (type === 'rapid') {
      // 3. Crossbow Gunslinger (Dual repeating hand crossbows & duster coat)
      const coatMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
      bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 13, 8), coatMat);
      bodyMesh.position.y = 8;

      const hat = new THREE.Mesh(new THREE.ConeGeometry(6, 4, 8), coatMat);
      hat.position.y = 17;

      const leftXbow = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 8), goldMat);
      leftXbow.position.set(-6, 10, 4);
      const rightXbow = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 8), goldMat);
      rightXbow.position.set(6, 10, 4);

      group.add(bodyMesh, hat, leftXbow, rightXbow);
    } else if (type === 'splash') {
      // 4. Dwarf Bombardier (Stout bearded dwarf with mortar cannon)
      const dwarfMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.8 });
      bodyMesh = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 6, 9, 8), dwarfMat);
      bodyMesh.position.y = 6;

      const beard = new THREE.Mesh(
        new THREE.ConeGeometry(4, 6, 6),
        new THREE.MeshStandardMaterial({ color: 0xd97706 })
      );
      beard.position.set(0, 8, 3.5);
      beard.rotation.x = Math.PI / 4;

      const cannon = new THREE.Mesh(
        new THREE.CylinderGeometry(4, 5.5, 14, 8),
        new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.8, roughness: 0.4 })
      );
      cannon.position.set(0, 7, 7);
      cannon.rotation.x = Math.PI / 3.5;
      weaponMesh = cannon;

      group.add(bodyMesh, beard, cannon);
    } else if (type === 'slow') {
      // 5. Frost Templar (Paladin in frosty plate with runic frost blade)
      const plateMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        metalness: 0.7,
        roughness: 0.3,
      });
      bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(8, 12, 6), plateMat);
      bodyMesh.position.y = 8;

      const helm = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), plateMat);
      helm.position.y = 16;

      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(2, 22, 1),
        new THREE.MeshBasicMaterial({ color: 0xbae6fd })
      );
      blade.position.set(0, 11, 5);
      weaponMesh = blade;

      group.add(bodyMesh, helm, blade);
    } else {
      // 6. Arcane Sorceress (Hovering in starry purple robes with mystic staff)
      const robeMat = new THREE.MeshStandardMaterial({
        color: 0x7e22ce,
        roughness: 0.5,
      });
      bodyMesh = new THREE.Mesh(new THREE.ConeGeometry(5, 14, 8), robeMat);
      bodyMesh.position.y = 10;

      const hat = new THREE.Mesh(new THREE.ConeGeometry(5, 10, 8), robeMat);
      hat.position.y = 19;

      const staff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.8, 22, 6),
        new THREE.MeshStandardMaterial({ color: 0xd97706 })
      );
      staff.position.set(5, 11, 2);

      const staffOrb = new THREE.Mesh(
        new THREE.SphereGeometry(3, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xc084fc })
      );
      staffOrb.position.set(5, 22, 2);
      weaponMesh = staffOrb;

      group.add(bodyMesh, hat, staff, staffOrb);
    }

    const inst: HeroModelInstance = {
      group,
      heroType: type,
      level,
      auraMesh,
      starsGroup,
      bodyMesh,
      weaponMesh,
      capeMesh,
    };

    this.updateHeroLevelVisuals(inst, level);
    return inst;
  }

  private updateHeroLevelVisuals(inst: HeroModelInstance, level: number): void {
    while (inst.starsGroup.children.length > 0) {
      const c = inst.starsGroup.children.pop();
      if (c) this.disposeObject(c);
    }

    const scale = 1.0 + (level - 1) * 0.18;
    inst.group.scale.set(scale, scale, scale);

    const starMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      emissive: 0xd97706,
      emissiveIntensity: 0.6,
      roughness: 0.3,
    });

    const starCount = Math.min(3, level);
    for (let i = 0; i < starCount; i++) {
      const angle = (i * (2 * Math.PI)) / starCount;
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(2.4, 0), starMat);
      star.position.set(Math.cos(angle) * 12, 0, Math.sin(angle) * 12);
      inst.starsGroup.add(star);
    }
  }

  // -------------------------------------------------------------------------
  // Villain Synchronization (Dragon, Witch, Golem, Boss Warlord)
  // -------------------------------------------------------------------------
  private syncEnemies(enemies: GameStateSnapshot['enemies'], dt: number): void {
    if (!this.map) return;
    const boardW = this.map.cols * this.map.cellSize;
    const boardH = this.map.rows * this.map.cellSize;
    const activeIds = new Set<number>();

    for (const e of enemies) {
      activeIds.add(e.id);
      let inst = this.enemyInstances.get(e.id);

      const targetX = e.x - boardW / 2;
      const targetZ = e.y - boardH / 2;
      const elevation = e.isFlying ? 38 + Math.sin(this.animClock * 4 + e.id) * 3 : 6;

      if (!inst) {
        inst = this.createEnemyRig(e.type, e.isFlying);
        this.enemiesGroup.add(inst.group);
        this.enemyInstances.set(e.id, inst);
        inst.group.position.set(targetX, elevation, targetZ);
        inst.lastHp = e.health;
      }

      if (inst.lastHp > e.health) {
        const dmg = inst.lastHp - e.health;
        const isCrit = dmg >= 70;
        this.spawnFloatingText(`-${dmg}`, targetX, elevation + 15, targetZ, isCrit ? '#facc15' : '#ffffff');
        inst.lastHp = e.health;
        inst.flashTimer = 0.12;
      }

      const prevX = inst.group.position.x;
      const prevZ = inst.group.position.z;
      inst.group.position.set(targetX, elevation, targetZ);

      const dx = targetX - prevX;
      const dz = targetZ - prevZ;
      if (Math.hypot(dx, dz) > 0.05) {
        inst.group.rotation.y = Math.atan2(dx, dz);
      }

      const walkCycle = Math.sin(this.animClock * 14 * (e.speed / 70));
      if (inst.isFlying) {
        const wingFlap = Math.sin(this.animClock * 18);
        if (inst.limbs.leftWing) inst.limbs.leftWing.rotation.z = wingFlap * 0.6;
        if (inst.limbs.rightWing) inst.limbs.rightWing.rotation.z = -wingFlap * 0.6;
        if (inst.limbs.tail) inst.limbs.tail.rotation.y = Math.sin(this.animClock * 8) * 0.3;
      } else {
        if (inst.limbs.leftLeg) inst.limbs.leftLeg.rotation.x = walkCycle * 0.7;
        if (inst.limbs.rightLeg) inst.limbs.rightLeg.rotation.x = -walkCycle * 0.7;
        if (inst.limbs.leftArm) inst.limbs.leftArm.rotation.x = -walkCycle * 0.5;
        if (inst.limbs.rightArm) inst.limbs.rightArm.rotation.x = walkCycle * 0.5;
        if (inst.limbs.head) inst.limbs.head.position.y = 12 + Math.abs(walkCycle) * 1.2;
      }

      if (e.type === 'witch') {
        inst.group.position.y = 10 + Math.sin(this.animClock * 4) * 2;
      }
      if (inst.shieldMesh) {
        inst.shieldMesh.visible = e.shieldActive;
        if (e.shieldActive) {
          inst.shieldMesh.rotation.y += dt * 3;
        }
      }

      const hpPct = Math.max(0, Math.min(1, e.health / Math.max(1, e.maxHealth)));
      inst.healthFill.scale.x = hpPct;
      inst.healthFill.position.x = -(1 - hpPct) * 6;
      const fillMat = inst.healthFill.material as THREE.MeshBasicMaterial;
      if (hpPct > 0.5) fillMat.color.setHex(0x22c55e);
      else if (hpPct > 0.25) fillMat.color.setHex(0xeab308);
      else fillMat.color.setHex(0xef4444);

      inst.healthBar.quaternion.copy(this.camera.quaternion);
    }

    for (const [id, inst] of this.enemyInstances.entries()) {
      if (!activeIds.has(id)) {
        this.spawnExplosionParticles(
          inst.group.position.x,
          inst.group.position.y,
          inst.group.position.z,
          0xef4444,
          10
        );
        this.enemiesGroup.remove(inst.group);
        this.disposeObject(inst.group);
        this.enemyInstances.delete(id);
      }
    }
  }

  private createEnemyRig(type: string, isFlying: boolean): EnemyModelInstance {
    const group = new THREE.Group();
    const limbs: EnemyModelInstance['limbs'] = {};
    let shieldMesh: THREE.Mesh | undefined;

    let scale = 1.0;

    if (type === 'dragon') {
      // 1. Ancient Fire Wyvern / Dragon
      scale = 1.7;
      const dragonMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.5 });
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, side: THREE.DoubleSide });

      const head = new THREE.Mesh(new THREE.ConeGeometry(5, 12, 6), dragonMat);
      head.rotation.x = Math.PI / 2.2;
      head.position.set(0, 0, 7);
      group.add(head);
      limbs.head = head;

      const body = new THREE.Mesh(new THREE.CylinderGeometry(5, 4, 18, 8), dragonMat);
      body.rotation.x = Math.PI / 2;
      group.add(body);

      const wingGeo = new THREE.PlaneGeometry(24, 16);
      const lw = new THREE.Mesh(wingGeo, wingMat);
      lw.position.set(-14, 2, 0);
      const rw = new THREE.Mesh(wingGeo, wingMat);
      rw.position.set(14, 2, 0);
      group.add(lw, rw);
      limbs.leftWing = lw;
      limbs.rightWing = rw;

      const tail = new THREE.Mesh(new THREE.ConeGeometry(2.5, 16, 5), dragonMat);
      tail.position.set(0, 0, -14);
      tail.rotation.x = -Math.PI / 2;
      group.add(tail);
      limbs.tail = tail;
    } else if (type === 'witch') {
      // 2. Shadow Witch (Floating in dark robe, pointed witch hat, skull staff)
      scale = 1.15;
      const robeMat = new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.6 });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.6 });

      const robe = new THREE.Mesh(new THREE.ConeGeometry(5, 14, 8), robeMat);
      robe.position.y = 7;
      group.add(robe);

      const head = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), skinMat);
      head.position.y = 15;
      const hat = new THREE.Mesh(new THREE.ConeGeometry(6, 9, 8), robeMat);
      hat.position.y = 21;
      group.add(head, hat);

      const wand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 16, 6),
        new THREE.MeshStandardMaterial({ color: 0x18181b })
      );
      wand.position.set(5, 10, 3);
      group.add(wand);
      limbs.staff = wand;

      const bubbleGeo = new THREE.SphereGeometry(14, 16, 16);
      const bubbleMat = new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        transparent: true,
        opacity: 0.45,
        wireframe: true,
      });
      shieldMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
      shieldMesh.position.y = 8;
      shieldMesh.visible = false;
      group.add(shieldMesh);
    } else if (type === 'boss') {
      // 3. Kernel Overlord / Demon Warlord (Colossal 2.3x scale)
      scale = 2.3;
      const armorMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.4, metalness: 0.7 });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.6 });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(8, 10, 6), armorMat);
      torso.position.y = 8;
      torso.castShadow = true;
      group.add(torso);

      const head = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 8), skinMat);
      head.position.y = 15;
      group.add(head);
      limbs.head = head;

      const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 26, 6), armorMat);
      axeHandle.position.set(7, 12, 3);
      const axeBlade = new THREE.Mesh(
        new THREE.BoxGeometry(10, 8, 1),
        new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 })
      );
      axeBlade.position.set(7, 21, 3);
      group.add(axeHandle, axeBlade);

      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 20),
        new THREE.MeshBasicMaterial({ color: 0xb91c1c, side: THREE.DoubleSide })
      );
      banner.position.set(7, 18, -4);
      group.add(banner);
      limbs.banner = banner;
    } else if (type === 'heavy') {
      // 4. Stone Golem (Bulky rock titan)
      scale = 1.7;
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
      const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(8, 0), rockMat);
      torso.position.y = 9;
      torso.castShadow = true;
      group.add(torso);
    } else if (type === 'armored') {
      // 5. Orc Vanguard (Heavy plate armor & tower shield)
      scale = 1.2;
      const plateMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(7, 9, 5), plateMat);
      torso.position.y = 8;
      const shield = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 1.5), plateMat);
      shield.position.set(-5, 8, 3);
      group.add(torso, shield);
    } else if (type === 'fast') {
      // 6. Shadow Wolf (4-legged beast)
      scale = 0.95;
      const furMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.8 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 16), furMat);
      body.position.y = 6;
      group.add(body);
    } else {
      // 7. Goblin Raider
      const skinMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 5), skinMat);
      torso.position.y = 7;
      group.add(torso);
    }

    group.scale.set(scale, scale, scale);

    const healthBar = new THREE.Group();
    healthBar.position.set(0, (isFlying ? 17 : 20) * scale, 0);

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 2.2),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    const healthFill = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 1.6),
      new THREE.MeshBasicMaterial({ color: 0x22c55e })
    );
    healthFill.position.z = 0.05;
    healthBar.add(bg, healthFill);
    group.add(healthBar);

    return {
      group,
      enemyType: type,
      isFlying,
      limbs,
      healthBar,
      healthFill,
      shieldMesh,
      lastHp: 100,
      flashTimer: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Projectiles & Laser Beams
  // -------------------------------------------------------------------------
  private syncProjectiles(projectiles: ProjectileSnapshot[], dt: number): void {
    if (!this.map) return;
    const boardW = this.map.cols * this.map.cellSize;
    const boardH = this.map.rows * this.map.cellSize;
    const activeIds = new Set<number>();

    for (const p of projectiles) {
      activeIds.add(p.id);
      let mesh = this.projectileMeshes.get(p.id);

      const startX = p.x - boardW / 2;
      const startZ = p.y - boardH / 2;
      const targetX = p.targetX - boardW / 2;
      const targetZ = p.targetY - boardH / 2;

      if (p.isLaser) {
        if (!mesh) {
          const beamGeo = new THREE.CylinderGeometry(1.8, 1.8, 1, 8);
          const beamMat = new THREE.MeshBasicMaterial({
            color: 0xa855f7,
            transparent: true,
            opacity: 0.9,
          });
          mesh = new THREE.Mesh(beamGeo, beamMat);
          this.projectilesGroup.add(mesh);
          this.projectileMeshes.set(p.id, mesh);
        }

        const startV = new THREE.Vector3(startX, 18, startZ);
        const endV = new THREE.Vector3(targetX, 10, targetZ);
        const dist = startV.distanceTo(endV);

        mesh.position.copy(startV.clone().lerp(endV, 0.5));
        mesh.scale.set(1, dist, 1);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), endV.clone().sub(startV).normalize());

        if (Math.random() < 0.4) {
          this.spawnExplosionParticles(targetX, 10, targetZ, 0xa855f7, 2);
        }
      } else {
        if (!mesh) {
          const colorHex = p.color ? parseInt(p.color.replace('#', '0x'), 16) : 0xf97316;
          const isBomb = p.splashRadius > 0;
          const geo = isBomb ? new THREE.SphereGeometry(3.5, 8, 8) : new THREE.CylinderGeometry(0.8, 0.8, 8, 6);
          const mat = new THREE.MeshBasicMaterial({ color: colorHex });
          mesh = new THREE.Mesh(geo, mat);
          this.projectilesGroup.add(mesh);
          this.projectileMeshes.set(p.id, mesh);
        }

        mesh.position.set(startX, 16, startZ);
        mesh.lookAt(targetX, 10, targetZ);
      }
    }

    for (const [id, mesh] of this.projectileMeshes.entries()) {
      if (!activeIds.has(id)) {
        this.projectilesGroup.remove(mesh);
        this.disposeObject(mesh);
        this.projectileMeshes.delete(id);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Active Spell VFX: Meteor Strike & Frost Nova
  // -------------------------------------------------------------------------
  private syncSpellEffects(spellEffects: GameStateSnapshot['spellEffects']): void {
    if (!this.map || !spellEffects) return;
    const boardW = this.map.cols * this.map.cellSize;
    const boardH = this.map.rows * this.map.cellSize;

    for (const fx of spellEffects) {
      const worldX = fx.x - boardW / 2;
      const worldZ = fx.y - boardH / 2;

      if (fx.kind === 'meteor') {
        if (fx.progress < 0.4) {
          const fallH = (1 - fx.progress / 0.4) * 220;
          this.spawnExplosionParticles(worldX, fallH, worldZ, 0xf97316, 4);
        } else if (fx.progress < 0.55) {
          this.triggerScreenShake(0.35, 16);
          this.spawnExplosionParticles(worldX, 6, worldZ, 0xef4444, 28);
        }
      } else if (fx.kind === 'frost') {
        if (fx.progress < 0.6) {
          this.spawnExplosionParticles(worldX, 4, worldZ, 0x38bdf8, 8);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // Particles & Floating Text
  // -------------------------------------------------------------------------
  private spawnFloatingText(text: string, x: number, y: number, z: number, color: string): void {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000000';
    ctx.fillText(text, 66, 34);
    ctx.fillStyle = color;
    ctx.fillText(text, 64, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(16, 8, 1);
    sprite.position.set(x, y, z);
    this.vfxGroup.add(sprite);

    this.floatingTexts.push({
      mesh: sprite,
      x,
      y,
      z,
      vy: 24,
      life: 0,
      maxLife: 0.9,
    });
  }

  private spawnExplosionParticles(x: number, y: number, z: number, colorHex: number, count = 12): void {
    const geo = new THREE.DodecahedronGeometry(2, 0);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.vfxGroup.add(mesh);

      const angle = Math.random() * Math.PI * 2;
      const speed = 25 + Math.random() * 45;
      this.particles.push({
        mesh,
        vx: Math.cos(angle) * speed,
        vy: 20 + Math.random() * 35,
        vz: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
        color: new THREE.Color(colorHex),
      });
    }
  }

  private updateVfx(dt: number): void {
    const remainingTexts: FloatingText3D[] = [];
    for (const ft of this.floatingTexts) {
      ft.life += dt;
      ft.y += ft.vy * dt;
      ft.mesh.position.y = ft.y;
      const progress = ft.life / ft.maxLife;
      (ft.mesh.material as THREE.SpriteMaterial).opacity = Math.max(0, 1 - progress);

      if (ft.life < ft.maxLife) {
        remainingTexts.push(ft);
      } else {
        this.vfxGroup.remove(ft.mesh);
        this.disposeObject(ft.mesh);
      }
    }
    this.floatingTexts = remainingTexts;

    const remainingParticles: Particle3D[] = [];
    for (const p of this.particles) {
      p.life += dt;
      p.vy -= 80 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      const progress = p.life / p.maxLife;
      const scale = Math.max(0.1, 1 - progress);
      p.mesh.scale.set(scale, scale, scale);
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 1 - progress);

      if (p.life < p.maxLife) {
        remainingParticles.push(p);
      } else {
        this.vfxGroup.remove(p.mesh);
        this.disposeObject(p.mesh);
      }
    }
    this.particles = remainingParticles;
  }

  // -------------------------------------------------------------------------
  // Hover Summoning Rune & Range Indicators
  // -------------------------------------------------------------------------
  private updateHoverAndRange(
    hoverCell: GridCoord | null,
    placingType: TowerType | null,
    snap: GameStateSnapshot
  ): void {
    if (!this.map) return;
    const boardW = this.map.cols * this.map.cellSize;
    const boardH = this.map.rows * this.map.cellSize;

    if (hoverCell && this.hoverRuneMesh) {
      const terrain = this.map.grid[hoverCell.row]?.[hoverCell.col];
      const isBuildable = terrain === 'buildable';
      const hasHero = snap.towers.some((t) => t.row === hoverCell.row && t.col === hoverCell.col);

      if (isBuildable && !hasHero) {
        const wx = hoverCell.col * this.map.cellSize + this.map.cellSize / 2 - boardW / 2;
        const wz = hoverCell.row * this.map.cellSize + this.map.cellSize / 2 - boardH / 2;
        this.hoverRuneMesh.position.set(wx, 2.2, wz);
        (this.hoverRuneMesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
      } else {
        (this.hoverRuneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    } else if (this.hoverRuneMesh) {
      (this.hoverRuneMesh.material as THREE.MeshBasicMaterial).opacity = 0;
    }

    const selected = snap.towers.find((t) => t.id === snap.selectedTowerId);
    if (selected && this.rangeIndicatorMesh) {
      const wx = selected.col * this.map.cellSize + this.map.cellSize / 2 - boardW / 2;
      const wz = selected.row * this.map.cellSize + this.map.cellSize / 2 - boardH / 2;
      this.rangeIndicatorMesh.position.set(wx, 2.0, wz);

      const r = selected.range;
      this.rangeIndicatorMesh.geometry.dispose();
      this.rangeIndicatorMesh.geometry = new THREE.RingGeometry(r - 3, r, 64);
      (this.rangeIndicatorMesh.material as THREE.MeshBasicMaterial).opacity = 0.7;
    } else if (this.rangeIndicatorMesh) {
      (this.rangeIndicatorMesh.material as THREE.MeshBasicMaterial).opacity = 0;
    }
  }

  // -------------------------------------------------------------------------
  // Raycasting: 2D Screen Event -> 3D Coordinates
  // -------------------------------------------------------------------------
  public raycast(clientX: number, clientY: number): { row: number; col: number; worldX: number; worldZ: number } | null {
    if (!this.map || !this.groundPlane) return null;

    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.groundPlane);

    if (intersects.length > 0 && intersects[0]) {
      const hit = intersects[0].point;
      const boardW = this.map.cols * this.map.cellSize;
      const boardH = this.map.rows * this.map.cellSize;

      const canvasX = hit.x + boardW / 2;
      const canvasY = hit.z + boardH / 2;

      const col = Math.floor(canvasX / this.map.cellSize);
      const row = Math.floor(canvasY / this.map.cellSize);

      if (row >= 0 && row < this.map.rows && col >= 0 && col < this.map.cols) {
        return { row, col, worldX: hit.x, worldZ: hit.z };
      }
    }
    return null;
  }

  public projectToScreen(row: number, col: number): { screenX: number; screenY: number } | null {
    if (!this.map) return null;
    const boardW = this.map.cols * this.map.cellSize;
    const boardH = this.map.rows * this.map.cellSize;

    const worldX = col * this.map.cellSize + this.map.cellSize / 2 - boardW / 2;
    const worldZ = row * this.map.cellSize + this.map.cellSize / 2 - boardH / 2;
    const pos = new THREE.Vector3(worldX, 20, worldZ);

    pos.project(this.camera);

    const rect = this.canvas.getBoundingClientRect();
    const screenX = ((pos.x + 1) / 2) * rect.width;
    const screenY = ((-pos.y + 1) / 2) * rect.height;

    return { screenX, screenY };
  }

  // -------------------------------------------------------------------------
  // Camera Controls
  // -------------------------------------------------------------------------
  public setViewMode(mode: CameraViewMode): void {
    this.viewMode = mode;
    this.updateCameraTransform();
  }

  public getViewMode(): CameraViewMode {
    return this.viewMode;
  }

  public triggerScreenShake(duration = 0.25, intensity = 12): void {
    this.shakeTimer = duration;
    this.shakeIntensity = intensity;
  }

  private updateCameraTransform(): void {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    if (this.viewMode === 'topdown') {
      this.camera.position.set(0, 580, 20);
      this.camera.lookAt(0, 0, 0);
    } else if (this.viewMode === 'orbit') {
      const x = this.orbitRadius * Math.sin(this.orbitPhi) * Math.sin(this.orbitTheta);
      const y = this.orbitRadius * Math.cos(this.orbitPhi);
      const z = this.orbitRadius * Math.sin(this.orbitPhi) * Math.cos(this.orbitTheta);
      this.camera.position.set(x, y, z);
      this.camera.lookAt(0, 0, 0);
    } else {
      this.camera.position.copy(this.cameraOffset);
      this.camera.lookAt(this.cameraTarget);
    }
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.viewMode === 'orbit' && e.button === 0) {
        this.isDragging = true;
        this.previousMouseX = e.clientX;
        this.previousMouseY = e.clientY;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isDragging && this.viewMode === 'orbit') {
        const dx = e.clientX - this.previousMouseX;
        const dy = e.clientY - this.previousMouseY;
        this.orbitTheta -= dx * 0.006;
        this.orbitPhi = Math.max(0.2, Math.min(Math.PI / 2.2, this.orbitPhi - dy * 0.006));
        this.previousMouseX = e.clientX;
        this.previousMouseY = e.clientY;
        this.updateCameraTransform();
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      if (this.viewMode === 'orbit') {
        e.preventDefault();
        this.orbitRadius = Math.max(250, Math.min(850, this.orbitRadius + e.deltaY * 0.5));
        this.updateCameraTransform();
      }
    });
  }

  public resize(width: number, height: number): void {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  public dispose(): void {
    this.isDisposed = true;
    this.renderer.dispose();
    this.scene.traverse((obj) => {
      this.disposeObject(obj);
    });
  }

  private disposeObject(obj: THREE.Object3D): void {
    if ((obj as THREE.Mesh).geometry) {
      (obj as THREE.Mesh).geometry.dispose();
    }
    if ((obj as THREE.Mesh).material) {
      const mat = (obj as THREE.Mesh).material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else {
        mat.dispose();
      }
    }
  }
}
