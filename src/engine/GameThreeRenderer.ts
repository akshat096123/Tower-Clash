import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GlbInstancedPool, GlbModelSpec } from './GlbInstancedPool';
import { createBiomeGroundTexture, createStoneRoadTexture } from './TerrainTextures';
import {
  DifficultyLevel,
  GameMapConfig,
  GameStateSnapshot,
  GraphicsQuality,
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
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  gravity: number;
  drag: number;
  size: number;
  life: number;
  maxLife: number;
  color: THREE.Color;
}

interface EnemyModelInstance {
  group: THREE.Group;
  fallbackBody?: THREE.Group;
  usingGlb: boolean;
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
  fallbackBody?: THREE.Group;
  usingGlb: boolean;
  heroType: TowerType;
  level: number;
  lastShotsFired: number;
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
  private projectileMeta = new Map<number, { x: number; z: number; color: number; isSplash: boolean; isLaser: boolean }>();

  private floatingTexts: FloatingText3D[] = [];
  private particles: Particle3D[] = [];
  private particleInstancedMesh!: THREE.InstancedMesh;
  private readonly maxParticles = 900;
  private particleDensity = 1.0;
  private animatedWindmillBlades: THREE.Mesh[] = [];
  private animatedBanners: THREE.Mesh[] = [];
  private lobbyClouds: Array<{ group: THREE.Group; speed: number; baseZ: number }> = [];
  private lobbyDecorGroup = new THREE.Group();
  private lobbyMode = false;
  private lobbyAmbientTimer = 0;
  private lobbySkirmishTimer = 0;

  // Hover & selection helpers
  private hoverRuneMesh: THREE.Mesh | null = null;
  private hoverTileMesh: THREE.Mesh | null = null;
  private rangeIndicatorMesh: THREE.Mesh | null = null;

  // Camera, OrbitControls & screen shake
  private controls!: OrbitControls;
  private mapBounds = new THREE.Box3(
    new THREE.Vector3(-420, 0, -280),
    new THREE.Vector3(440, 95, 280)
  );
  private cameraTarget = new THREE.Vector3(0, 8, 0);
  private cameraOffset = new THREE.Vector3(-110, 490, 560);
  private shakeTimer = 0;
  private shakeIntensity = 0;
  private shakeOffset = new THREE.Vector3();

  private animClock = 0;
  private isDisposed = false;

  // Lighting, Environment & Post-Processing
  private sunLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private pmremGenerator: THREE.PMREMGenerator;
  private envRT: THREE.WebGLRenderTarget | null = null;
  private composer!: EffectComposer;
  private renderPass!: RenderPass;
  private bloomPass!: UnrealBloomPass;
  private smaaPass!: SMAAPass;
  private outputPass!: OutputPass;
  private usePostProcessing = true;
  private graphicsQuality: GraphicsQuality = 'high';
  private glbPool!: GlbInstancedPool;
  private tmpMatrix = new THREE.Matrix4();
  private tmpPos = new THREE.Vector3();
  private tmpQuat = new THREE.Quaternion();
  private tmpScale = new THREE.Vector3();
  private tmpEuler = new THREE.Euler();
  private tmpColor = new THREE.Color();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false, // Handled by SMAA pass when post-processing is active
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();

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
    this.scene.add(this.lobbyDecorGroup);

    this.setupLighting();
    this.setupEnvironment();
    this.setupPostProcessing();
    this.setupGlbInstancedModels();
    this.setupParticleSystem();
    this.setupControls();
    this.preloadProps();
  }

  private setupControls(): void {
    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = Math.PI / 2.25;
    this.controls.enableRotate = false;
    this.controls.enableZoom = true;
    this.controls.enablePan = true;
    this.controls.zoomSpeed = 0.85;
    this.controls.panSpeed = 0.8;
    this.controls.target.copy(this.cameraTarget);
    this.controls.update();
  }

  private setupParticleSystem(): void {
    const geo = new THREE.DodecahedronGeometry(1.6, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.25,
      metalness: 0.1,
    });
    this.particleInstancedMesh = new THREE.InstancedMesh(geo, mat, this.maxParticles);
    this.particleInstancedMesh.count = 0;
    this.particleInstancedMesh.visible = false;
    this.particleInstancedMesh.frustumCulled = false;
    const white = new THREE.Color(0xffffff);
    for (let i = 0; i < this.maxParticles; i++) {
      this.particleInstancedMesh.setColorAt(i, white);
    }
    if (this.particleInstancedMesh.instanceColor) {
      this.particleInstancedMesh.instanceColor.needsUpdate = true;
    }
    this.vfxGroup.add(this.particleInstancedMesh);
  }

  private setupGlbInstancedModels(): void {
    this.glbPool = new GlbInstancedPool(this.gltfLoader, this.scene);
    const advBase = '/models/heroes';
    const skelBase = '/models/enemies';

    const specs: GlbModelSpec[] = [
      {
        key: 'hero_basic',
        url: `${advBase}/Rogue.glb`,
        targetHeight: 28,
        excludeMeshes: ['Knife_Offhand', '2H_Crossbow', 'Knife', 'Throwable'],
        poseClipNames: ['1H_Ranged_Aiming', 'Idle'],
        poseTime: 0.1,
      },
      {
        key: 'hero_sniper',
        url: `${advBase}/Rogue_Hooded.glb`,
        targetHeight: 29,
        excludeMeshes: ['Knife_Offhand', '1H_Crossbow', 'Knife', 'Throwable'],
        poseClipNames: ['2H_Ranged_Aiming', '1H_Ranged_Aiming', 'Idle'],
        poseTime: 0.1,
      },
      {
        key: 'hero_rapid',
        url: `${advBase}/Knight.glb`,
        targetHeight: 29,
        excludeMeshes: ['1H_Sword_Offhand', 'Rectangle_Shield', 'Round_Shield', 'Spike_Shield', '2H_Sword'],
        poseClipNames: ['Idle'],
        poseTime: 0.1,
      },
      {
        key: 'hero_splash',
        url: `${advBase}/Barbarian.glb`,
        targetHeight: 30,
        excludeMeshes: ['1H_Axe_Offhand', 'Barbarian_Round_Shield', '1H_Axe', 'Mug'],
        poseClipNames: ['Idle'],
        poseTime: 0.1,
      },
      {
        key: 'hero_slow',
        url: `${advBase}/Knight.glb`,
        targetHeight: 29,
        excludeMeshes: ['1H_Sword_Offhand', 'Badge_Shield', 'Rectangle_Shield', 'Spike_Shield', '1H_Sword'],
        poseClipNames: ['Idle'],
        poseTime: 0.1,
      },
      {
        key: 'hero_laser',
        url: `${advBase}/Mage.glb`,
        targetHeight: 29,
        excludeMeshes: ['Spellbook', 'Spellbook_open', '1H_Wand'],
        poseClipNames: ['Idle'],
        poseTime: 0.1,
      },
      {
        key: 'enemy_normal',
        url: `${skelBase}/Skeleton_Minion.glb`,
        targetHeight: 24,
        poseClipNames: ['Running_A', 'Walking_A', 'Idle'],
        poseTime: 0.2,
        emissiveBoost: 1.5,
      },
      {
        key: 'enemy_fast',
        url: `${skelBase}/Skeleton_Rogue.glb`,
        targetHeight: 23,
        poseClipNames: ['Running_A', 'Walking_A', 'Idle'],
        poseTime: 0.25,
        emissiveBoost: 1.5,
      },
      {
        key: 'enemy_warrior',
        url: `${skelBase}/Skeleton_Warrior.glb`,
        targetHeight: 27,
        poseClipNames: ['Running_A', 'Walking_A', 'Idle'],
        poseTime: 0.18,
        emissiveBoost: 1.6,
      },
      {
        key: 'enemy_mage',
        url: `${skelBase}/Skeleton_Mage.glb`,
        targetHeight: 26,
        poseClipNames: ['Idle_Combat', 'Walking_A', 'Idle'],
        poseTime: 0.15,
        emissiveBoost: 1.8,
      },
    ];
    this.glbPool.preload(specs);
  }

  private setupPostProcessing(): void {
    const w = Math.max(1, this.canvas.clientWidth || 1024);
    const h = Math.max(1, this.canvas.clientHeight || 640);

    const rt = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType,
      samples: 0,
    });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(1);
    this.composer.setSize(w, h);

    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.30, 0.30, 1.18);
    this.composer.addPass(this.bloomPass);

    this.smaaPass = new SMAAPass();
    this.composer.addPass(this.smaaPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  // -------------------------------------------------------------------------
  // Lighting, HDRI Environment & Atmosphere
  // -------------------------------------------------------------------------
  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0xdce7f4, 0.28);
    this.scene.add(ambient);

    this.hemiLight = new THREE.HemisphereLight(0xbbe0ff, 0x3b5d21, 0.48);
    this.hemiLight.position.set(0, 350, 0);
    this.scene.add(this.hemiLight);

    // Warm sun positioned to cast crisp angled 3D shadows across terrain and path
    this.sunLight = new THREE.DirectionalLight(0xfff1d4, 2.35);
    this.sunLight.position.set(320, 440, 260);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 60;
    this.sunLight.shadow.camera.far = 1550;
    const d = 620;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.00035;
    this.sunLight.shadow.normalBias = 0.03;
    this.sunLight.shadow.radius = 2.6;
    this.scene.add(this.sunLight);
  }

  private setupEnvironment(): void {
    // Immediate procedural RoomEnvironment fallback while HDRI loads
    const fallbackEnv = this.pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    this.envRT = fallbackEnv;
    this.scene.environment = fallbackEnv.texture;
    this.scene.environmentIntensity = 0.75;

    const hdrLoader = new HDRLoader();
    hdrLoader.load(
      '/env/arena_sky.hdr',
      (texture) => {
        if (this.isDisposed) {
          texture.dispose();
          return;
        }
        texture.mapping = THREE.EquirectangularReflectionMapping;
        const envMap = this.pmremGenerator.fromEquirectangular(texture);
        texture.dispose();
        if (this.envRT) {
          this.envRT.dispose();
        }
        this.envRT = envMap;
        this.scene.environment = envMap.texture;
        this.scene.environmentIntensity = 0.9;
      },
      undefined,
      () => {
        // Keep RoomEnvironment fallback if HDRI fails to fetch
      }
    );
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
    this.animatedBanners = [];

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
    this.scene.fog = new THREE.FogExp2(bgColor, biome === 'volcano' ? 0.00052 : 0.00042);
    if (this.hemiLight) {
      this.hemiLight.groundColor.setHex(groundColor);
    }

    // Rich Textured Biome Terrain Plane (Edge-to-Edge 100vw x 100vh)
    const groundTex = createBiomeGroundTexture(biome);
    const groundGeo = new THREE.PlaneGeometry(boardW + 1800, boardH + 1800);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      color: 0xffffff,
      roughness: biome === 'snow' ? 0.88 : 0.94,
      metalness: 0.02,
    });
    this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
    this.groundPlane.rotation.x = -Math.PI / 2;
    this.groundPlane.position.set(0, -0.5, 0);
    this.groundPlane.receiveShadow = true;
    this.terrainGroup.add(this.groundPlane);

    // Subtle Arena Border Frame + Buildable Tile Pads
    const cellW = map.cellSize;
    const halfW = boardW / 2;
    const halfH = boardH / 2;

    const arenaApron = new THREE.Mesh(
      new THREE.PlaneGeometry(boardW + 16, boardH + 16),
      new THREE.MeshStandardMaterial({
        color: biome === 'snow' ? 0x64748b : biome === 'volcano' ? 0x18181b : 0x1e3a1a,
        roughness: 0.95,
        transparent: true,
        opacity: 0.22,
      })
    );
    arenaApron.rotation.x = -Math.PI / 2;
    arenaApron.position.set(0, -0.2, 0);
    arenaApron.receiveShadow = true;
    this.terrainGroup.add(arenaApron);

    // Build Beveled Cobblestone Road Segments
    const roadTex = createStoneRoadTexture(biome);
    const roadMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      color: 0xffffff,
      roughness: biome === 'snow' ? 0.65 : 0.84,
      metalness: 0.04,
    });
    const curbMat = new THREE.MeshStandardMaterial({
      color: roadBorderColor,
      roughness: 0.88,
      metalness: 0.05,
    });
    const slowZoneMat = new THREE.MeshStandardMaterial({
      map: roadTex,
      color: biome === 'volcano' ? 0xfb7185 : 0x9ca3af,
      emissive: biome === 'volcano' ? 0x7f1d1d : 0x000000,
      emissiveIntensity: biome === 'volcano' ? 0.55 : 0,
      roughness: 0.92,
    });
    const buildPadMat = new THREE.MeshStandardMaterial({
      color: biome === 'snow' ? 0xe2e8f0 : biome === 'desert' ? 0xeab308 : biome === 'volcano' ? 0x475569 : 0x86efac,
      roughness: 0.95,
      transparent: true,
      opacity: 0.09,
    });
    const buildPadGeo = new THREE.PlaneGeometry(cellW * 0.86, cellW * 0.86);

    const isRoadCell = (rr: number, cc: number): boolean => {
      const t = map.grid[rr]?.[cc];
      return t === 'path' || t === 'entry' || t === 'base' || t === 'slow_zone';
    };

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const terrain = map.grid[r][c];
        const worldX = c * cellW + cellW / 2 - halfW;
        const worldZ = r * cellW + cellW / 2 - halfH;

        if (terrain === 'buildable') {
          const pad = new THREE.Mesh(buildPadGeo, buildPadMat);
          pad.rotation.x = -Math.PI / 2;
          pad.position.set(worldX, -0.1, worldZ);
          pad.receiveShadow = true;
          this.terrainGroup.add(pad);
        } else if (isRoadCell(r, c)) {
          // Beveled multi-tier road slab: lower stone apron + upper paver surface
          const baseBevel = new THREE.Mesh(
            new THREE.BoxGeometry(cellW * 1.04, 1.4, cellW * 1.04),
            curbMat
          );
          baseBevel.position.set(worldX, 0.4, worldZ);
          baseBevel.receiveShadow = true;
          this.terrainGroup.add(baseBevel);

          const roadMesh = new THREE.Mesh(
            new THREE.BoxGeometry(cellW * 0.96, 1.8, cellW * 0.96),
            terrain === 'slow_zone' ? slowZoneMat : roadMat
          );
          roadMesh.position.set(worldX, 1.3, worldZ);
          roadMesh.receiveShadow = true;
          roadMesh.castShadow = true;
          this.terrainGroup.add(roadMesh);

          // Place beveled stone curb borders ONLY along outer road edges
          const curbH = 2.8;
          const curbThick = 3.2;
          if (!isRoadCell(r - 1, c)) {
            const nCurb = new THREE.Mesh(new THREE.BoxGeometry(cellW * 1.02, curbH, curbThick), curbMat);
            nCurb.position.set(worldX, 1.4, worldZ - cellW * 0.5);
            nCurb.castShadow = true;
            nCurb.receiveShadow = true;
            this.terrainGroup.add(nCurb);
          }
          if (!isRoadCell(r + 1, c)) {
            const sCurb = new THREE.Mesh(new THREE.BoxGeometry(cellW * 1.02, curbH, curbThick), curbMat);
            sCurb.position.set(worldX, 1.4, worldZ + cellW * 0.5);
            sCurb.castShadow = true;
            sCurb.receiveShadow = true;
            this.terrainGroup.add(sCurb);
          }
          if (!isRoadCell(r, c - 1)) {
            const wCurb = new THREE.Mesh(new THREE.BoxGeometry(curbThick, curbH, cellW * 1.02), curbMat);
            wCurb.position.set(worldX - cellW * 0.5, 1.4, worldZ);
            wCurb.castShadow = true;
            wCurb.receiveShadow = true;
            this.terrainGroup.add(wCurb);
          }
          if (!isRoadCell(r, c + 1)) {
            const eCurb = new THREE.Mesh(new THREE.BoxGeometry(curbThick, curbH, cellW * 1.02), curbMat);
            eCurb.position.set(worldX + cellW * 0.5, 1.4, worldZ);
            eCurb.castShadow = true;
            eCurb.receiveShadow = true;
            this.terrainGroup.add(eCurb);
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
        new THREE.MeshStandardMaterial({
          color: 0x9333ea,
          emissive: 0xa855f7,
          emissiveIntensity: 2.2,
          roughness: 0.25,
          metalness: 0.2,
        })
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

    // Sleek Hover Summoning Rune Ring + Buildable Tile Highlight
    const hoverTileGeo = new THREE.PlaneGeometry(cellW * 0.92, cellW * 0.92);
    const hoverTileMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x22c55e,
      emissiveIntensity: 0.45,
      roughness: 0.5,
      transparent: true,
      opacity: 0,
    });
    this.hoverTileMesh = new THREE.Mesh(hoverTileGeo, hoverTileMat);
    this.hoverTileMesh.rotation.x = -Math.PI / 2;
    this.hoverTileMesh.position.y = 0.25;
    this.uiGroup.add(this.hoverTileMesh);

    const hoverGeo = new THREE.RingGeometry(cellW * 0.34, cellW * 0.43, 32);
    const hoverMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      emissive: 0x4ade80,
      emissiveIntensity: 1.4,
      roughness: 0.4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.hoverRuneMesh = new THREE.Mesh(hoverGeo, hoverMat);
    this.hoverRuneMesh.rotation.x = -Math.PI / 2;
    this.hoverRuneMesh.position.y = 0.55;
    this.uiGroup.add(this.hoverRuneMesh);

    // Range Circle Indicator for selected hero
    const rangeGeo = new THREE.RingGeometry(1, 2, 64);
    const rangeMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 1.3,
      roughness: 0.4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.rangeIndicatorMesh = new THREE.Mesh(rangeGeo, rangeMat);
    this.rangeIndicatorMesh.rotation.x = -Math.PI / 2;
    this.rangeIndicatorMesh.position.y = 1.6;
    this.uiGroup.add(this.rangeIndicatorMesh);

    // Compute Bounding Box of entire playable map (left spawner -> right castle)
    this.mapBounds.set(
      new THREE.Vector3(-boardW / 2 - 42, 0, -boardH / 2 - 36),
      new THREE.Vector3(boardW / 2 + 52, 92, boardH / 2 + 36)
    );
    if (this.castleGroup.children.length > 0) {
      this.castleGroup.updateMatrixWorld(true);
      const castleBox = new THREE.Box3().setFromObject(this.castleGroup);
      this.mapBounds.union(castleBox);
    }

    this.updateCameraTransform();
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
    const bannerMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7, side: THREE.DoubleSide });
    const b1 = new THREE.Mesh(new THREE.PlaneGeometry(12, 24), bannerMat);
    b1.position.set(-26, 56, 22);
    const b2 = new THREE.Mesh(new THREE.PlaneGeometry(12, 24), bannerMat);
    b2.position.set(26, 56, 22);
    castle.add(b1, b2);
    this.animatedBanners.push(b1, b2);

    // Golden Royal Crest Plate
    const crest = new THREE.Mesh(new THREE.BoxGeometry(18, 7, 2), goldMat);
    crest.position.set(0, 38, 24);
    castle.add(crest);

    // Burning Gate Torches
    const torchMat = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      emissive: 0xff6a00,
      emissiveIntensity: 2.5,
      roughness: 0.3,
    });
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
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5, emissive: 0xd97706, emissiveIntensity: 0.3 }); // Yellow blossom

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
    const coalMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
    const carrotMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 }); // Orange nose
    const scarfMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.75 }); // Red scarf
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
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe5d8b2, roughness: 0.78, side: THREE.DoubleSide });

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
    const lavaMat = new THREE.MeshStandardMaterial({
      color: 0xff3b00,
      emissive: 0xff4500,
      emissiveIntensity: 2.2,
      roughness: 0.3,
    }); // Glowing molten magma

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

  private createPineTree(): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.92 });
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.85 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.2, 13, 7), trunkMat);
    trunk.position.y = 6.5;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    for (let i = 0; i < 3; i++) {
      const radius = 12.5 - i * 3.2;
      const height = 14 - i * 2;
      const y = 14 + i * 7.5;

      const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), pineMat);
      cone.position.y = y;
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);
    }

    return group;
  }

  private createRockCluster(): THREE.Group {
    const group = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.92, flatShading: true });
    const rocks = [
      { r: 7.5, x: 0, y: 4.5, z: 0, sy: 0.75 },
      { r: 5.0, x: -6, y: 3.0, z: 4, sy: 0.7 },
      { r: 4.2, x: 5.5, y: 2.5, z: -3, sy: 0.65 },
    ];
    for (const rk of rocks) {
      const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(rk.r, 0), rockMat);
      mesh.position.set(rk.x, rk.y, rk.z);
      mesh.scale.set(1.15, rk.sy, 1.0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }

  private createWoodenFence(length = 34): THREE.Group {
    const group = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.9 });
    const postCount = 4;
    for (let i = 0; i < postCount; i++) {
      const px = -length / 2 + (i * length) / (postCount - 1);
      const post = new THREE.Mesh(new THREE.BoxGeometry(2.2, 10, 2.2), woodMat);
      post.position.set(px, 5, 0);
      post.castShadow = true;
      group.add(post);
    }
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(length + 2, 1.4, 1.0), woodMat);
    rail1.position.set(0, 7.2, 0);
    rail1.castShadow = true;
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(length + 2, 1.4, 1.0), woodMat);
    rail2.position.set(0, 3.8, 0);
    rail2.castShadow = true;
    group.add(rail1, rail2);
    return group;
  }

  private createMountainRidge(biome: string, baseWidth: number, height: number): THREE.Group {
    const group = new THREE.Group();
    const rockColor =
      biome === 'desert' ? 0x8d5b2b : biome === 'snow' ? 0x64748b : biome === 'volcano' ? 0x1c1917 : 0x263f27;
    const capColor = biome === 'snow' ? 0xcbd5e1 : biome === 'volcano' ? 0x3f231e : 0x365536;

    const ridgeMat = new THREE.MeshStandardMaterial({
      color: rockColor,
      roughness: 0.95,
      flatShading: true,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: capColor,
      roughness: 0.92,
      flatShading: true,
    });

    const peaks = [
      { ox: 0, oz: 0, s: baseWidth, h: height, rot: 0.2 },
      { ox: -baseWidth * 0.48, oz: baseWidth * 0.14, s: baseWidth * 0.72, h: height * 0.72, rot: 0.8 },
      { ox: baseWidth * 0.46, oz: -baseWidth * 0.1, s: baseWidth * 0.68, h: height * 0.66, rot: 1.4 },
    ];
    for (const pk of peaks) {
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(pk.s * 0.6, pk.h, 7), ridgeMat);
      mesh.position.set(pk.ox, pk.h * 0.45, pk.oz);
      mesh.rotation.y = pk.rot;
      mesh.scale.set(1.25, 1, 0.9);
      mesh.receiveShadow = true;
      group.add(mesh);

      const cap = new THREE.Mesh(new THREE.ConeGeometry(pk.s * 0.25, pk.h * 0.34, 7), capMat);
      cap.position.set(pk.ox, pk.h * 0.76, pk.oz);
      cap.rotation.y = pk.rot;
      cap.scale.set(1.25, 1, 0.9);
      group.add(cap);
    }
    return group;
  }

  private createSnowPine(): THREE.Group {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
    const pineMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85 });
    const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.92, metalness: 0.0 });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 12, 6), trunkMat);
    trunk.position.y = 6;
    trunk.castShadow = true;
    group.add(trunk);

    // 3 tiered pine layers with matte snow on top (no bloom blow-out)
    for (let i = 0; i < 3; i++) {
      const radius = 13 - i * 3.5;
      const height = 14 - i * 2;
      const y = 14 + i * 8;

      const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 7), pineMat);
      cone.position.y = y;
      cone.castShadow = true;
      cone.receiveShadow = true;

      const snow = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.88, height * 0.38, 7), snowCapMat);
      snow.position.y = y + height * 0.34;
      snow.receiveShadow = true;
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
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, emissive: 0xeab308, emissiveIntensity: 0.3 });

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
    const warmLight = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.8,
      roughness: 0.4,
    });

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
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xded7c8, roughness: 0.88 }); // Matte plaster
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.88 }); // Timber frame
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.65 }); // Red clay tiles
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const winMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xd97706,
      emissiveIntensity: 0.35,
      roughness: 0.5,
    }); // Cozy warm window (below bloom threshold)

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
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 });
    const colors = [0xef4444, 0xfacc15, 0xa855f7, 0x38bdf8, 0xffffff];

    for (let i = 0; i < 9; i++) {
      const col = colors[i % colors.length];
      const petalMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 });
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
  // Populate Biome-Specific Interior Obstacles & Intentional Perimeter Scenery
  // -------------------------------------------------------------------------
  private populateBiomeDecor(boardW: number, boardH: number, biome: string, map: GameMapConfig): void {
    const cellW = map.cellSize;
    const halfW = boardW / 2;
    const halfH = boardH / 2;

    // 1. INTERIOR OBSTACLE CELLS: Natural biome terrain features only (no scattered cottages)
    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const terrain = map.grid[r][c];
        const worldX = c * cellW + cellW / 2 - halfW;
        const worldZ = r * cellW + cellW / 2 - halfH;

        if (terrain === 'obstacle') {
          let prop: THREE.Group | THREE.Mesh | null = null;
          const pick = (r * 11 + c * 17) % 3;

          if (biome === 'desert') {
            if (pick === 0) prop = this.createSaguaroCactus();
            else if (pick === 1) prop = this.createPricklyPearCactus();
            else prop = this.createDesertRockArch();
          } else if (biome === 'snow') {
            if (pick === 0) prop = this.createSnowPine();
            else if (pick === 1) prop = this.createFrostCrystalCluster();
            else prop = this.createRockCluster();
          } else if (biome === 'volcano') {
            if (pick === 0) prop = this.createVolcanicCrag();
            else if (pick === 1) prop = this.createBasaltPillars();
            else prop = this.createLavaPool();
          } else {
            // Grassy Shire: natural trees & boulder clusters only
            if (pick === 0) prop = this.createOakTree();
            else if (pick === 1) prop = this.createPineTree();
            else prop = this.createRockCluster();
          }

          if (prop) {
            prop.position.set(worldX, prop.position.y || 0, worldZ);
            prop.rotation.y = ((r * 7 + c * 13) % 6) * 0.52;
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
              emissive: 0xb45309,
              emissiveIntensity: 0.45,
              metalness: 0.8,
              roughness: 0.25,
            })
          );
          geode.position.y = 9;
          geode.castShadow = true;
          resGroup.add(geode);
          this.decorGroup.add(resGroup);
        }
      }
    }

    // 2. INTENTIONAL PERIMETER CLUSTERS & CORNER GROVES (Framing the Battlefield)
    const addProp = (node: THREE.Group, x: number, z: number, rotY = 0, scale = 1) => {
      node.position.set(x, 0, z);
      node.rotation.y = rotY;
      if (scale !== 1) node.scale.setScalar(scale);
      this.decorGroup.add(node);
    };

    const makeCornerTree = (idx: number) => {
      if (biome === 'desert') return idx % 2 === 0 ? this.createPalmTree() : this.createSaguaroCactus();
      if (biome === 'snow') return idx % 2 === 0 ? this.createSnowPine() : this.createFrostCrystalCluster();
      if (biome === 'volcano') return idx % 2 === 0 ? this.createVolcanicCrag() : this.createBasaltPillars();
      return idx % 2 === 0 ? this.createPineTree() : this.createOakTree();
    };

    // 4 Corner Forest/Biome Groves
    const corners = [
      { cx: -halfW - 55, cz: -halfH - 48 },
      { cx: halfW + 55, cz: -halfH - 48 },
      { cx: -halfW - 55, cz: halfH + 48 },
      { cx: halfW + 55, cz: halfH + 48 },
    ];
    corners.forEach((corner, cIdx) => {
      const groveOffsets = [
        { dx: 0, dz: 0, s: 1.15 },
        { dx: -26, dz: 14, s: 0.95 },
        { dx: 24, dz: -12, s: 1.0 },
        { dx: 12, dz: 24, s: 0.85 },
      ];
      groveOffsets.forEach((off, i) => {
        addProp(makeCornerTree(cIdx + i), corner.cx + off.dx, corner.cz + off.dz, i * 1.1, off.s);
      });
      addProp(this.createRockCluster(), corner.cx - 12, corner.cz - 22, cIdx * 0.7, 0.9);
    });

    // Intentional Citadel Village / Oasis / Outpost Cluster near Right Flank
    if (biome === 'grass') {
      addProp(this.createVillageCottage(), halfW + 52, -halfH + 45, -0.45, 1.1);
      addProp(this.createVillageCottage(), halfW + 70, -halfH + 88, -0.85, 1.0);
      addProp(this.createWindmill(), halfW + 76, -12, -0.35, 1.05);
      addProp(this.createStoneWell(), halfW + 46, -halfH + 68, 0, 0.95);

      // Perimeter wooden fences framing top and bottom lanes
      for (let x = -halfW + 45; x <= halfW - 45; x += 92) {
        addProp(this.createWoodenFence(38), x, -halfH - 22, 0);
        addProp(this.createWoodenFence(38), x, halfH + 22, 0);
      }
      // Flanking woodland clusters along top & bottom borders
      for (let x = -halfW + 10; x <= halfW - 10; x += 110) {
        addProp(this.createPineTree(), x - 18, -halfH - 46, 0.4, 1.1);
        addProp(this.createOakTree(), x + 16, -halfH - 52, 1.1, 0.95);
        addProp(this.createOakTree(), x - 12, halfH + 48, 0.8, 1.0);
        addProp(this.createPineTree(), x + 22, halfH + 44, 1.7, 1.05);
      }
    } else if (biome === 'desert') {
      addProp(this.createDesertOasis(), halfW + 64, -halfH + 64, 0.3, 1.05);
      addProp(this.createEgyptianPyramid(), -halfW - 72, -halfH + 56, 0.2, 1.35);
      addProp(this.createDesertBones(), -halfW + 80, halfH + 44, 0.6, 1.1);
      for (let x = -halfW + 20; x <= halfW - 20; x += 120) {
        addProp(this.createSaguaroCactus(), x, -halfH - 42, x * 0.05, 1.0);
        addProp(this.createPricklyPearCactus(), x + 30, halfH + 42, 0.5, 1.0);
      }
    } else if (biome === 'snow') {
      addProp(this.createIgloo(), halfW + 58, -halfH + 60, -0.5, 1.1);
      addProp(this.createFrozenPond(), halfW + 64, halfH - 60, 0, 1.05);
      addProp(this.createSnowman(), -halfW - 44, 18, 0.6, 1.0);
      for (let x = -halfW + 20; x <= halfW - 20; x += 110) {
        addProp(this.createSnowPine(), x, -halfH - 46, 0.3, 1.1);
        addProp(this.createSnowPine(), x + 24, halfH + 46, 1.1, 1.05);
      }
    } else {
      addProp(this.createLavaPool(), halfW + 64, -halfH + 58, 0, 1.15);
      addProp(this.createVolcanicCrag(), -halfW - 64, 0, 0.5, 1.2);
      for (let x = -halfW + 20; x <= halfW - 20; x += 115) {
        addProp(this.createBasaltPillars(), x, -halfH - 46, 0.4, 1.1);
        addProp(this.createVolcanicCrag(), x + 24, halfH + 46, 0.9, 1.05);
      }
    }

    // 3. NATURAL HORIZON MOUNTAIN RIDGES (Framing the Arena Beyond Perimeter)
    const ridgeOffsets = [
      { x: -halfW - 230, z: -halfH - 180, w: 200, h: 135, rot: 0.3 },
      { x: -halfW * 0.35, z: -halfH - 210, w: 230, h: 150, rot: -0.2 },
      { x: halfW * 0.38, z: -halfH - 205, w: 215, h: 140, rot: 0.4 },
      { x: halfW + 235, z: -halfH - 175, w: 195, h: 130, rot: -0.5 },
      { x: -halfW - 245, z: 10, w: 190, h: 120, rot: 1.4 },
      { x: halfW + 250, z: 20, w: 195, h: 125, rot: -1.3 },
      { x: -halfW - 220, z: halfH + 190, w: 185, h: 115, rot: 0.6 },
      { x: 0, z: halfH + 225, w: 240, h: 130, rot: 0.1 },
      { x: halfW + 225, z: halfH + 190, w: 195, h: 120, rot: -0.4 },
    ];
    ridgeOffsets.forEach((m) => {
      const ridge = this.createMountainRidge(biome, m.w, m.h);
      ridge.position.set(m.x, -1, m.z);
      ridge.rotation.y = m.rot;
      this.decorGroup.add(ridge);
    });
  }

  // -------------------------------------------------------------------------
  // Main Render Frame
  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Lobby Flyover Mode (Full-Bleed Live 3D Battlefield Backdrop)
  // -------------------------------------------------------------------------
  public setLobbyMode(enabled: boolean): void {
    this.lobbyMode = enabled;
    if (this.controls) {
      this.controls.enabled = !enabled;
    }

    while (this.lobbyDecorGroup.children.length > 0) {
      const o = this.lobbyDecorGroup.children.pop();
      if (o) this.disposeObject(o);
    }
    this.lobbyClouds = [];

    if (enabled) {
      // Warm golden-hour fantasy lighting for the War Room backdrop
      this.sunLight.color.setHex(0xffd79a);
      this.sunLight.intensity = 2.65;
      this.sunLight.position.set(360, 260, 240);

      // Spawn soft drifting 3D cloud puffs high above the arena
      const cloudMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.96,
        metalness: 0.0,
        transparent: true,
        opacity: 0.85,
      });
      for (let i = 0; i < 6; i++) {
        const cloud = new THREE.Group();
        const puffs = [
          { x: 0, y: 0, z: 0, r: 22 },
          { x: -18, y: -3, z: 4, r: 16 },
          { x: 19, y: -2, z: -3, r: 17 },
          { x: 4, y: 4, z: 8, r: 14 },
        ];
        for (const pf of puffs) {
          const m = new THREE.Mesh(new THREE.DodecahedronGeometry(pf.r, 1), cloudMat);
          m.position.set(pf.x, pf.y, pf.z);
          m.scale.set(1.3, 0.55, 1.0);
          cloud.add(m);
        }
        const startX = -460 + i * 190;
        const baseZ = -210 + (i % 3) * 165;
        cloud.position.set(startX, 145 + (i % 2) * 26, baseZ);
        this.lobbyDecorGroup.add(cloud);
        this.lobbyClouds.push({ group: cloud, speed: 12 + (i % 3) * 5, baseZ });
      }
    } else {
      this.sunLight.color.setHex(0xfff1d4);
      this.sunLight.intensity = 2.35;
      this.sunLight.position.set(320, 440, 260);
      this.updateCameraTransform();
    }
  }

  public renderLobbyFrame(dt: number): void {
    if (this.isDisposed || !this.map) return;

    this.animClock += dt;
    this.lobbyAmbientTimer += dt;
    this.lobbySkirmishTimer += dt;

    // 1. Animate windmills, castle banners & drifting clouds
    for (const b of this.animatedWindmillBlades) {
      b.rotation.z += dt * 1.6;
    }
    for (let i = 0; i < this.animatedBanners.length; i++) {
      const bn = this.animatedBanners[i];
      bn.rotation.y = Math.sin(this.animClock * 3.4 + i * 1.1) * 0.16;
      bn.rotation.x = Math.cos(this.animClock * 2.5 + i) * 0.07;
    }
    for (const cl of this.lobbyClouds) {
      cl.group.position.x += cl.speed * dt;
      cl.group.position.z = cl.baseZ + Math.sin(this.animClock * 0.25 + cl.baseZ) * 12;
      if (cl.group.position.x > 650) {
        cl.group.position.x = -650;
      }
    }

    // 2. Smooth atmospheric flyover orbit across the valley
    const viewW = this.canvas.clientWidth || window.innerWidth || 1280;
    const viewH = this.canvas.clientHeight || window.innerHeight || 720;
    const aspect = viewW / Math.max(1, viewH);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    const center = new THREE.Vector3();
    this.mapBounds.getCenter(center);
    const flyYaw = Math.sin(this.animClock * 0.14) * 0.55 - 0.12;
    const flyPitch = 0.54 + Math.sin(this.animClock * 0.1) * 0.05;
    const flyDir = new THREE.Vector3(
      Math.sin(flyYaw) * Math.cos(flyPitch),
      Math.sin(flyPitch),
      Math.cos(flyYaw) * Math.cos(flyPitch)
    ).normalize();
    const fitDist = this.computeBoxFitDistance(this.mapBounds, center, flyDir, aspect, 1.02);
    const orbitDist = fitDist * (0.86 + Math.sin(this.animClock * 0.18) * 0.06);
    this.camera.position.copy(center).addScaledVector(flyDir, orbitDist);
    this.camera.lookAt(center.x, 12, center.z);

    // 3. Ambient guardian heroes & patrol units marching the road
    const boardW = this.map.cols * this.map.cellSize;
    const boardH = this.map.rows * this.map.cellSize;
    const cellW = this.map.cellSize;

    this.glbPool.beginFrame();

    // Find 3 buildable tiles near middle bends for guardian heroes
    const guardTypes: TowerType[] = ['basic', 'laser', 'rapid'];
    const guardSpots: Array<{ x: number; z: number; type: TowerType }> = [];
    const candidateCoords = [
      { r: 2, c: 3 },
      { r: 5, c: 7 },
      { r: 6, c: 12 },
    ];
    candidateCoords.forEach((pt, idx) => {
      let r = pt.r;
      let c = pt.c;
      if (this.map && this.map.grid[r]?.[c] !== 'buildable') {
        // Fallback scan for nearest buildable cell
        outer: for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const rr = THREE.MathUtils.clamp(r + dr, 0, this.map.rows - 1);
            const cc = THREE.MathUtils.clamp(c + dc, 0, this.map.cols - 1);
            if (this.map.grid[rr][cc] === 'buildable') {
              r = rr;
              c = cc;
              break outer;
            }
          }
        }
      }
      guardSpots.push({
        x: c * cellW + cellW / 2 - boardW / 2,
        z: r * cellW + cellW / 2 - boardH / 2,
        type: guardTypes[idx % guardTypes.length],
      });
    });

    guardSpots.forEach((g, idx) => {
      const key = `hero_${g.type}`;
      if (!this.glbPool.isReady(key)) return;
      const yaw = Math.sin(this.animClock * 0.9 + idx * 2.0) * 0.8;
      this.tmpPos.set(g.x, 0.5 + Math.sin(this.animClock * 3 + idx) * 0.4, g.z);
      this.tmpEuler.set(0, yaw, 0);
      this.tmpQuat.setFromEuler(this.tmpEuler);
      this.tmpScale.set(1.15, 1.15, 1.15);
      this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
      this.tmpColor.setHex(g.type === 'laser' ? 0xe9d5ff : 0xffffff);
      this.glbPool.pushInstance(key, this.tmpMatrix, this.tmpColor);
    });

    // Patrol raiders walking smoothly along the road
    const path = this.map.groundPath;
    if (path.length >= 2) {
      const patrolConfigs = [
        { key: 'enemy_normal', offset: 0.08, scale: 1.05, tint: 0xffffff },
        { key: 'enemy_fast', offset: 0.24, scale: 0.98, tint: 0xfde68a },
        { key: 'enemy_warrior', offset: 0.46, scale: 1.25, tint: 0xcbd5e1 },
        { key: 'enemy_mage', offset: 0.68, scale: 1.15, tint: 0xd8b4fe },
        { key: 'enemy_normal', offset: 0.84, scale: 1.0, tint: 0xffffff },
      ];

      let leadPatrolPos: { x: number; z: number } | null = null;
      for (let idx = 0; idx < patrolConfigs.length; idx++) {
        const patrol = patrolConfigs[idx];
        if (!this.glbPool.isReady(patrol.key)) continue;
        const tNorm = ((this.animClock * 0.045 + patrol.offset) % 0.92);
        const fIdx = tNorm * (path.length - 1);
        const i0 = Math.floor(fIdx);
        const i1 = Math.min(path.length - 1, i0 + 1);
        const frac = fIdx - i0;

        const p0 = path[i0];
        const p1 = path[i1];
        const x0 = p0.col * cellW + cellW / 2 - boardW / 2;
        const z0 = p0.row * cellW + cellW / 2 - boardH / 2;
        const x1 = p1.col * cellW + cellW / 2 - boardW / 2;
        const z1 = p1.row * cellW + cellW / 2 - boardH / 2;

        const px = THREE.MathUtils.lerp(x0, x1, frac);
        const pz = THREE.MathUtils.lerp(z0, z1, frac);
        if (idx === 1) leadPatrolPos = { x: px, z: pz };

        const yaw = Math.atan2(x1 - x0, z1 - z0);
        const hopY = Math.abs(Math.sin(this.animClock * 10 + idx)) * 1.4;
        this.tmpPos.set(px, 2.2 + hopY, pz);
        this.tmpEuler.set(0, yaw, Math.sin(this.animClock * 10 + idx) * 0.07);
        this.tmpQuat.setFromEuler(this.tmpEuler);
        this.tmpScale.set(patrol.scale, patrol.scale, patrol.scale);
        this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
        this.tmpColor.setHex(patrol.tint);
        this.glbPool.pushInstance(patrol.key, this.tmpMatrix, this.tmpColor);
      }

      // Occasional ambient hero sparks toward patrol units
      if (this.lobbySkirmishTimer >= 1.35 && guardSpots.length > 0 && leadPatrolPos) {
        this.lobbySkirmishTimer = 0;
        const shooter = guardSpots[Math.floor(this.animClock) % guardSpots.length];
        this.spawnAttackParticles(shooter.type, shooter.x, 18, shooter.z, leadPatrolPos.x, leadPatrolPos.z);
      }
    }

    this.glbPool.endFrame();

    // 4. Ambient golden-hour firefly motes drifting across the battlefield
    if (this.lobbyAmbientTimer >= 0.18 && this.particles.length < 120) {
      this.lobbyAmbientTimer = 0;
      const rx = (Math.random() - 0.5) * boardW;
      const rz = (Math.random() - 0.5) * boardH;
      const moteColor =
        this.map.biome === 'snow'
          ? 0x7dd3fc
          : this.map.biome === 'volcano'
          ? 0xf97316
          : 0xfde047;
      this.particles.push({
        x: rx,
        y: 6 + Math.random() * 24,
        z: rz,
        vx: (Math.random() - 0.5) * 14,
        vy: 5 + Math.random() * 8,
        vz: (Math.random() - 0.5) * 14,
        rx: 0,
        ry: 0,
        rz: 0,
        gravity: -2,
        drag: 0.99,
        size: 0.65,
        life: 0,
        maxLife: 2.0 + Math.random() * 1.4,
        color: new THREE.Color(moteColor).multiplyScalar(2.0),
      });
    }

    this.updateVfx(dt);

    if (this.usePostProcessing && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  public render(
    snap: GameStateSnapshot,
    dt: number,
    hoverCell: GridCoord | null,
    placingType: TowerType | null
  ): void {
    if (this.isDisposed || !this.map) return;

    this.animClock += dt;

    // Rotate windmill blades & flutter royal banners
    for (const b of this.animatedWindmillBlades) {
      b.rotation.z += dt * 1.5;
    }
    for (let i = 0; i < this.animatedBanners.length; i++) {
      const bn = this.animatedBanners[i];
      bn.rotation.y = Math.sin(this.animClock * 3.2 + i * 1.3) * 0.14;
      bn.rotation.x = Math.cos(this.animClock * 2.4 + i) * 0.06;
    }

    // Undo previous frame shake before OrbitControls update
    if (this.shakeOffset.lengthSq() > 0) {
      this.camera.position.sub(this.shakeOffset);
      this.shakeOffset.set(0, 0, 0);
    }

    if (this.controls) {
      this.controls.update();
      // Clamp panning target within playable arena bounds
      const maxPanX = (this.map.cols * this.map.cellSize) * 0.48;
      const maxPanZ = (this.map.rows * this.map.cellSize) * 0.48;
      this.controls.target.x = THREE.MathUtils.clamp(this.controls.target.x, -maxPanX, maxPanX);
      this.controls.target.z = THREE.MathUtils.clamp(this.controls.target.z, -maxPanZ, maxPanZ);
      this.controls.target.y = THREE.MathUtils.clamp(this.controls.target.y, 0, 24);
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      const shakeMag = this.shakeIntensity * (this.shakeTimer / 0.3);
      this.shakeOffset.set(
        (Math.random() - 0.5) * shakeMag,
        (Math.random() - 0.5) * shakeMag,
        0
      );
      this.camera.position.add(this.shakeOffset);
    }

    this.glbPool.beginFrame();

    // 1. Sync & Animate 3D Hero Champions (.glb InstancedMesh + Aura/Stars)
    this.syncHeroes(snap.towers, snap.selectedTowerId, snap.enemies);

    // 2. Sync & Animate 3D Villains (.glb InstancedMesh + Health Bars)
    this.syncEnemies(snap.enemies, dt);

    this.glbPool.endFrame();

    // 3. Sync 3D Projectiles & Beams
    this.syncProjectiles(snap.projectiles, dt);

    // 4. Active Spell VFX (Meteors & Frost)
    this.syncSpellEffects(snap.spellEffects);

    // 5. Update Floating Text & Particles
    this.updateVfx(dt);

    // 6. Update Hover Summoning Rune & Range Circle
    this.updateHoverAndRange(hoverCell, placingType, snap);

    // 7. Render Three.js Scene (Post-Processing Composer or Direct Fallback)
    if (this.usePostProcessing && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // -------------------------------------------------------------------------
  // Hero Champion Synchronization (GLB InstancedMesh + Aura/Stars)
  // -------------------------------------------------------------------------
  private syncHeroes(
    towers: TowerSnapshot[],
    selectedTowerId: number | null,
    enemies: GameStateSnapshot['enemies']
  ): void {
    if (!this.map) return;
    const boardW = this.map.cols * this.map.cellSize;
    const boardH = this.map.rows * this.map.cellSize;
    const activeIds = new Set<number>();

    const enemyPosById = new Map<number, { x: number; z: number }>();
    for (const e of enemies) {
      enemyPosById.set(e.id, { x: e.x - boardW / 2, z: e.y - boardH / 2 });
    }

    for (const t of towers) {
      activeIds.add(t.id);
      let inst = this.heroInstances.get(t.id);

      const worldX = t.col * this.map.cellSize + this.map.cellSize / 2 - boardW / 2;
      const worldZ = t.row * this.map.cellSize + this.map.cellSize / 2 - boardH / 2;

      if (!inst) {
        inst = this.createHeroRig(t.type, t.level);
        inst.lastShotsFired = t.shotsFired;
        inst.group.position.set(worldX, 0, worldZ);
        this.heroesGroup.add(inst.group);
        this.heroInstances.set(t.id, inst);
      }

      if (t.shotsFired > inst.lastShotsFired) {
        inst.lastShotsFired = t.shotsFired;
        const targetPos = t.lastTargetId !== null ? enemyPosById.get(t.lastTargetId) : undefined;
        this.spawnAttackParticles(t.type, worldX, 18, worldZ, targetPos?.x, targetPos?.z);
      }

      if (inst.level !== t.level) {
        inst.level = t.level;
        this.updateHeroLevelVisuals(inst, t.level);
      }

      const modelKey = `hero_${t.type}`;
      const glbReady = this.glbPool.isReady(modelKey);
      if (glbReady) {
        if (!inst.usingGlb && inst.fallbackBody) {
          inst.group.remove(inst.fallbackBody);
          this.disposeObject(inst.fallbackBody);
          inst.fallbackBody = undefined;
          inst.bodyMesh = undefined;
          inst.weaponMesh = undefined;
          inst.usingGlb = true;
        }

        let yaw = 0;
        if (t.lastTargetId !== null) {
          const targetPos = enemyPosById.get(t.lastTargetId);
          if (targetPos) {
            yaw = Math.atan2(targetPos.x - worldX, targetPos.z - worldZ);
          }
        }
        const breathY = Math.sin(this.animClock * 3 + t.id) * 0.45;
        const levelScale = 1.0 + (t.level - 1) * 0.16;

        this.tmpPos.set(worldX, 0.5 + breathY, worldZ);
        this.tmpEuler.set(0, yaw, 0);
        this.tmpQuat.setFromEuler(this.tmpEuler);
        this.tmpScale.set(levelScale, levelScale, levelScale);
        this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);

        if (t.type === 'slow') {
          this.tmpColor.setHex(0xbae6fd);
        } else if (t.type === 'laser') {
          this.tmpColor.setHex(0xe9d5ff);
        } else {
          this.tmpColor.setHex(0xffffff);
        }
        this.glbPool.pushInstance(modelKey, this.tmpMatrix, this.tmpColor);
      } else {
        const breath = Math.sin(this.animClock * 3 + t.id) * 0.4;
        if (inst.bodyMesh) inst.bodyMesh.position.y = 8 + breath;
      }

      if (selectedTowerId === t.id) {
        const pulse = 0.8 + Math.sin(this.animClock * 6) * 0.2;
        inst.auraMesh.scale.set(1 + pulse * 0.12, 1 + pulse * 0.12, 1);
        (inst.auraMesh.material as THREE.MeshStandardMaterial).opacity = 0.95;
      } else {
        inst.auraMesh.scale.set(1, 1, 1);
        (inst.auraMesh.material as THREE.MeshStandardMaterial).opacity = 0.65;
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
    const auraMat = new THREE.MeshStandardMaterial({
      color: auraColor,
      emissive: auraColor,
      emissiveIntensity: 1.15,
      roughness: 0.4,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.75,
    });
    const auraMesh = new THREE.Mesh(auraGeo, auraMat);
    auraMesh.rotation.x = -Math.PI / 2;
    auraMesh.position.y = 0.6;
    group.add(auraMesh);

    const starsGroup = new THREE.Group();
    starsGroup.position.set(0, 32, 0);
    group.add(starsGroup);

    const fallbackBody = new THREE.Group();
    group.add(fallbackBody);

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

      fallbackBody.add(bodyMesh, head, bow);
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

      fallbackBody.add(bodyMesh, cowl, arbalest);
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

      fallbackBody.add(bodyMesh, hat, leftXbow, rightXbow);
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

      fallbackBody.add(bodyMesh, beard, cannon);
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
        new THREE.MeshStandardMaterial({
          color: 0xbae6fd,
          emissive: 0x38bdf8,
          emissiveIntensity: 1.5,
          metalness: 0.6,
          roughness: 0.2,
        })
      );
      blade.position.set(0, 11, 5);
      weaponMesh = blade;

      fallbackBody.add(bodyMesh, helm, blade);
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
        new THREE.MeshStandardMaterial({
          color: 0xc084fc,
          emissive: 0xa855f7,
          emissiveIntensity: 2.2,
          roughness: 0.2,
        })
      );
      staffOrb.position.set(5, 22, 2);
      weaponMesh = staffOrb;

      fallbackBody.add(bodyMesh, hat, staff, staffOrb);
    }

    const inst: HeroModelInstance = {
      group,
      fallbackBody,
      usingGlb: false,
      heroType: type,
      level,
      lastShotsFired: 0,
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

  private getEnemyGlbConfig(type: string, isFlying: boolean): { key: string; scale: number; tint: number } {
    switch (type) {
      case 'swarm':
        return { key: 'enemy_normal', scale: 0.72, tint: 0xa3e635 };
      case 'fast':
        return { key: 'enemy_fast', scale: 0.95, tint: 0xfde68a };
      case 'heavy':
        return { key: 'enemy_warrior', scale: 1.5, tint: 0x94a3b8 };
      case 'armored':
        return { key: 'enemy_warrior', scale: 1.25, tint: 0xcbd5e1 };
      case 'boss':
        return { key: 'enemy_warrior', scale: 2.15, tint: 0xf87171 };
      case 'witch':
        return { key: 'enemy_mage', scale: 1.15, tint: 0xd8b4fe };
      case 'dragon':
        return { key: 'enemy_mage', scale: 1.65, tint: 0xfca5a5 };
      case 'flying':
        return { key: 'enemy_fast', scale: 1.1, tint: 0x7dd3fc };
      default:
        return {
          key: isFlying ? 'enemy_fast' : 'enemy_normal',
          scale: isFlying ? 1.05 : 1.0,
          tint: 0xffffff,
        };
    }
  }

  // -------------------------------------------------------------------------
  // Villain Synchronization (GLB InstancedMesh + Health Bars & Shield)
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
      const elevation = e.isFlying ? 32 + Math.sin(this.animClock * 4 + e.id) * 3 : 2;

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
        this.spawnFloatingText(`-${dmg}`, targetX, elevation + 22, targetZ, isCrit ? '#facc15' : '#ffffff');
        this.spawnExplosionParticles(targetX, elevation + 10, targetZ, isCrit ? 0xfacc15 : 0xfb923c, isCrit ? 8 : 4, 0.7);
        inst.lastHp = e.health;
        inst.flashTimer = 0.14;
      }
      if (inst.flashTimer > 0) {
        inst.flashTimer = Math.max(0, inst.flashTimer - dt);
      }

      const prevX = inst.group.position.x;
      const prevZ = inst.group.position.z;
      inst.group.position.set(targetX, elevation, targetZ);

      const dx = targetX - prevX;
      const dz = targetZ - prevZ;
      if (Math.hypot(dx, dz) > 0.05) {
        inst.group.rotation.y = Math.atan2(dx, dz);
      }

      const glbCfg = this.getEnemyGlbConfig(e.type, e.isFlying);
      const glbReady = this.glbPool.isReady(glbCfg.key);

      if (glbReady) {
        if (!inst.usingGlb && inst.fallbackBody) {
          inst.group.remove(inst.fallbackBody);
          this.disposeObject(inst.fallbackBody);
          inst.fallbackBody = undefined;
          inst.usingGlb = true;
        }

        const stride = Math.sin(this.animClock * 12 * Math.max(0.5, e.speed / 70) + e.id);
        const hopY = e.isFlying ? 0 : Math.abs(stride) * 1.6;
        const tiltZ = e.isFlying ? Math.sin(this.animClock * 6 + e.id) * 0.12 : stride * 0.08;
        const witchBob = e.type === 'witch' ? 4 + Math.sin(this.animClock * 4 + e.id) * 2 : 0;

        this.tmpPos.set(targetX, elevation + hopY + witchBob, targetZ);
        this.tmpEuler.set(0, inst.group.rotation.y, tiltZ);
        this.tmpQuat.setFromEuler(this.tmpEuler);
        this.tmpScale.set(glbCfg.scale, glbCfg.scale, glbCfg.scale);
        this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);

        if (inst.flashTimer > 0) {
          this.tmpColor.setHex(0xffb4b4);
        } else if (e.slowTimer > 0) {
          this.tmpColor.setHex(0x7dd3fc);
        } else {
          this.tmpColor.setHex(glbCfg.tint);
        }
        this.glbPool.pushInstance(glbCfg.key, this.tmpMatrix, this.tmpColor);
      } else {
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
      }

      if (e.type === 'witch') {
        inst.group.position.y = elevation + 4 + Math.sin(this.animClock * 4 + e.id) * 2;
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
      const fillMat = inst.healthFill.material as THREE.MeshStandardMaterial;
      if (hpPct > 0.5) {
        fillMat.color.setHex(0x22c55e);
        fillMat.emissive.setHex(0x16a34a);
      } else if (hpPct > 0.25) {
        fillMat.color.setHex(0xeab308);
        fillMat.emissive.setHex(0xca8a04);
      } else {
        fillMat.color.setHex(0xef4444);
        fillMat.emissive.setHex(0xdc2626);
      }

      inst.healthBar.quaternion.copy(this.camera.quaternion);
    }

    for (const [id, inst] of this.enemyInstances.entries()) {
      if (!activeIds.has(id)) {
        const isMajor = inst.enemyType === 'boss' || inst.enemyType === 'dragon' || inst.enemyType === 'heavy';
        const burstCount = inst.enemyType === 'boss' ? 32 : isMajor ? 22 : 14;
        this.spawnExplosionParticles(
          inst.group.position.x,
          inst.group.position.y + 10,
          inst.group.position.z,
          inst.enemyType === 'witch' ? 0xa855f7 : 0xef4444,
          burstCount,
          inst.enemyType === 'boss' ? 1.6 : 1.05
        );
        this.spawnExplosionParticles(
          inst.group.position.x,
          inst.group.position.y + 12,
          inst.group.position.z,
          0xfacc15,
          Math.ceil(burstCount * 0.5),
          0.9
        );
        this.enemiesGroup.remove(inst.group);
        this.disposeObject(inst.group);
        this.enemyInstances.delete(id);
      }
    }
  }

  private createEnemyRig(type: string, isFlying: boolean): EnemyModelInstance {
    const group = new THREE.Group();
    const fallbackBody = new THREE.Group();
    group.add(fallbackBody);
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
      fallbackBody.add(head);
      limbs.head = head;

      const body = new THREE.Mesh(new THREE.CylinderGeometry(5, 4, 18, 8), dragonMat);
      body.rotation.x = Math.PI / 2;
      fallbackBody.add(body);

      const wingGeo = new THREE.PlaneGeometry(24, 16);
      const lw = new THREE.Mesh(wingGeo, wingMat);
      lw.position.set(-14, 2, 0);
      const rw = new THREE.Mesh(wingGeo, wingMat);
      rw.position.set(14, 2, 0);
      fallbackBody.add(lw, rw);
      limbs.leftWing = lw;
      limbs.rightWing = rw;

      const tail = new THREE.Mesh(new THREE.ConeGeometry(2.5, 16, 5), dragonMat);
      tail.position.set(0, 0, -14);
      tail.rotation.x = -Math.PI / 2;
      fallbackBody.add(tail);
      limbs.tail = tail;
    } else if (type === 'witch') {
      // 2. Shadow Witch (Floating in dark robe, pointed witch hat, skull staff)
      scale = 1.15;
      const robeMat = new THREE.MeshStandardMaterial({ color: 0x3b0764, roughness: 0.6 });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.6 });

      const robe = new THREE.Mesh(new THREE.ConeGeometry(5, 14, 8), robeMat);
      robe.position.y = 7;
      fallbackBody.add(robe);

      const head = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), skinMat);
      head.position.y = 15;
      const hat = new THREE.Mesh(new THREE.ConeGeometry(6, 9, 8), robeMat);
      hat.position.y = 21;
      fallbackBody.add(head, hat);

      const wand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 16, 6),
        new THREE.MeshStandardMaterial({ color: 0x18181b })
      );
      wand.position.set(5, 10, 3);
      fallbackBody.add(wand);
      limbs.staff = wand;

      const bubbleGeo = new THREE.SphereGeometry(14, 16, 16);
      const bubbleMat = new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x9333ea,
        emissiveIntensity: 1.5,
        roughness: 0.3,
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
      fallbackBody.add(torso);

      const head = new THREE.Mesh(new THREE.SphereGeometry(4, 8, 8), skinMat);
      head.position.y = 15;
      fallbackBody.add(head);
      limbs.head = head;

      const axeHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 26, 6), armorMat);
      axeHandle.position.set(7, 12, 3);
      const axeBlade = new THREE.Mesh(
        new THREE.BoxGeometry(10, 8, 1),
        new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 })
      );
      axeBlade.position.set(7, 21, 3);
      fallbackBody.add(axeHandle, axeBlade);

      const banner = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 20),
        new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.7, side: THREE.DoubleSide })
      );
      banner.position.set(7, 18, -4);
      fallbackBody.add(banner);
      limbs.banner = banner;
    } else if (type === 'heavy') {
      // 4. Stone Golem (Bulky rock titan)
      scale = 1.7;
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
      const torso = new THREE.Mesh(new THREE.DodecahedronGeometry(8, 0), rockMat);
      torso.position.y = 9;
      torso.castShadow = true;
      fallbackBody.add(torso);
    } else if (type === 'armored') {
      // 5. Orc Vanguard (Heavy plate armor & tower shield)
      scale = 1.2;
      const plateMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(7, 9, 5), plateMat);
      torso.position.y = 8;
      const shield = new THREE.Mesh(new THREE.BoxGeometry(6, 12, 1.5), plateMat);
      shield.position.set(-5, 8, 3);
      fallbackBody.add(torso, shield);
    } else if (type === 'fast') {
      // 6. Shadow Wolf (4-legged beast)
      scale = 0.95;
      const furMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.8 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 16), furMat);
      body.position.y = 6;
      fallbackBody.add(body);
    } else {
      // 7. Goblin Raider
      const skinMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.6 });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 5), skinMat);
      torso.position.y = 7;
      fallbackBody.add(torso);
    }

    const glbCfg = this.getEnemyGlbConfig(type, isFlying);
    const barHeight = Math.max(24, 28 * glbCfg.scale);

    const healthBar = new THREE.Group();
    healthBar.position.set(0, barHeight, 0);

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 2.2),
      new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 1.0 })
    );
    const healthFill = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 1.6),
      new THREE.MeshStandardMaterial({
        color: 0x22c55e,
        emissive: 0x16a34a,
        emissiveIntensity: 0.7,
        roughness: 0.6,
      })
    );
    healthFill.position.z = 0.05;
    healthBar.add(bg, healthFill);
    group.add(healthBar);

    return {
      group,
      fallbackBody,
      usingGlb: false,
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
          const beamMat = new THREE.MeshStandardMaterial({
            color: 0xa855f7,
            emissive: 0xc084fc,
            emissiveIntensity: 2.8,
            roughness: 0.2,
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
          const mat = new THREE.MeshStandardMaterial({
            color: colorHex,
            emissive: colorHex,
            emissiveIntensity: 1.8,
            roughness: 0.25,
            metalness: 0.2,
          });
          mesh = new THREE.Mesh(geo, mat);
          this.projectilesGroup.add(mesh);
          this.projectileMeshes.set(p.id, mesh);
        }

        mesh.position.set(startX, 16, startZ);
        mesh.lookAt(targetX, 10, targetZ);
      }

      const colorHex = p.color ? parseInt(p.color.replace('#', '0x'), 16) : 0xf97316;
      this.projectileMeta.set(p.id, {
        x: startX,
        z: startZ,
        color: colorHex,
        isSplash: p.splashRadius > 0,
        isLaser: p.isLaser,
      });
    }

    for (const [id, mesh] of this.projectileMeshes.entries()) {
      if (!activeIds.has(id)) {
        const meta = this.projectileMeta.get(id);
        if (meta && !meta.isLaser) {
          if (meta.isSplash) {
            this.spawnExplosionParticles(meta.x, 10, meta.z, 0xf97316, 18, 1.35);
            this.spawnExplosionParticles(meta.x, 12, meta.z, 0xfacc15, 10, 1.0);
          } else {
            this.spawnExplosionParticles(meta.x, 12, meta.z, meta.color, 6, 0.75);
          }
        }
        this.projectileMeta.delete(id);
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

  private spawnAttackParticles(
    towerType: TowerType,
    x: number,
    y: number,
    z: number,
    targetX?: number,
    targetZ?: number
  ): void {
    const colorMap: Record<TowerType, number> = {
      basic: 0x4ade80,
      sniper: 0x22d3ee,
      rapid: 0xfacc15,
      splash: 0xf97316,
      slow: 0x7dd3fc,
      laser: 0xc084fc,
    };
    const colorHex = colorMap[towerType] ?? 0xfacc15;
    const baseCount = towerType === 'splash' ? 12 : towerType === 'laser' ? 10 : 7;
    const count = Math.max(1, Math.round(baseCount * this.particleDensity));

    let dirX = 0;
    let dirZ = 1;
    if (targetX !== undefined && targetZ !== undefined) {
      const len = Math.hypot(targetX - x, targetZ - z) || 1;
      dirX = (targetX - x) / len;
      dirZ = (targetZ - z) / len;
    }

    for (let i = 0; i < count; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const spread = (Math.random() - 0.5) * 0.9;
      const cos = Math.cos(spread);
      const sin = Math.sin(spread);
      const vxDir = dirX * cos - dirZ * sin;
      const vzDir = dirX * sin + dirZ * cos;
      const speed = (35 + Math.random() * 55) * (towerType === 'sniper' ? 1.5 : 1.0);

      this.particles.push({
        x: x + dirX * 8,
        y: y + (Math.random() - 0.5) * 3,
        z: z + dirZ * 8,
        vx: vxDir * speed,
        vy: 8 + Math.random() * 20,
        vz: vzDir * speed,
        rx: Math.random() * Math.PI,
        ry: Math.random() * Math.PI,
        rz: Math.random() * Math.PI,
        gravity: 35,
        drag: 0.94,
        size: towerType === 'splash' ? 1.3 : 0.85,
        life: 0,
        maxLife: 0.22 + Math.random() * 0.16,
        color: new THREE.Color(colorHex).multiplyScalar(2.4),
      });
    }
  }

  private spawnExplosionParticles(
    x: number,
    y: number,
    z: number,
    colorHex: number,
    count = 12,
    intensityScale = 1.0
  ): void {
    const scaledCount = Math.max(1, Math.round(count * this.particleDensity));
    for (let i = 0; i < scaledCount; i++) {
      if (this.particles.length >= this.maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = (28 + Math.random() * 55) * intensityScale;
      this.particles.push({
        x,
        y,
        z,
        vx: Math.cos(angle) * speed,
        vy: (22 + Math.random() * 45) * intensityScale,
        vz: Math.sin(angle) * speed,
        rx: Math.random() * Math.PI,
        ry: Math.random() * Math.PI,
        rz: Math.random() * Math.PI,
        gravity: 95,
        drag: 0.96,
        size: (0.8 + Math.random() * 0.7) * Math.min(1.5, intensityScale),
        life: 0,
        maxLife: 0.35 + Math.random() * 0.32,
        color: new THREE.Color(colorHex).multiplyScalar(2.2),
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
      if (p.life >= p.maxLife) continue;

      p.vy -= p.gravity * dt;
      p.vx *= p.drag;
      p.vz *= p.drag;
      p.x += p.vx * dt;
      p.y = Math.max(0.5, p.y + p.vy * dt);
      p.z += p.vz * dt;
      p.rx += dt * 6;
      p.ry += dt * 5;
      remainingParticles.push(p);
    }
    this.particles = remainingParticles;

    const count = Math.min(this.particles.length, this.maxParticles);
    this.particleInstancedMesh.count = count;
    this.particleInstancedMesh.visible = count > 0;
    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const p = this.particles[i];
        const progress = p.life / p.maxLife;
        const scale = Math.max(0.08, (1 - progress) * p.size);
        this.tmpPos.set(p.x, p.y, p.z);
        this.tmpEuler.set(p.rx, p.ry, p.rz);
        this.tmpQuat.setFromEuler(this.tmpEuler);
        this.tmpScale.set(scale, scale, scale);
        this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
        this.particleInstancedMesh.setMatrixAt(i, this.tmpMatrix);
        this.particleInstancedMesh.setColorAt(i, p.color);
      }
      this.particleInstancedMesh.instanceMatrix.needsUpdate = true;
      if (this.particleInstancedMesh.instanceColor) {
        this.particleInstancedMesh.instanceColor.needsUpdate = true;
      }
    }
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

    if (hoverCell && this.hoverRuneMesh && this.hoverTileMesh) {
      const terrain = this.map.grid[hoverCell.row]?.[hoverCell.col];
      const isBuildable = terrain === 'buildable';
      const hasHero = snap.towers.some((t) => t.row === hoverCell.row && t.col === hoverCell.col);
      const wx = hoverCell.col * this.map.cellSize + this.map.cellSize / 2 - boardW / 2;
      const wz = hoverCell.row * this.map.cellSize + this.map.cellSize / 2 - boardH / 2;

      const runeMat = this.hoverRuneMesh.material as THREE.MeshStandardMaterial;
      const tileMat = this.hoverTileMesh.material as THREE.MeshStandardMaterial;

      if (isBuildable && !hasHero) {
        this.hoverTileMesh.position.set(wx, 0.25, wz);
        this.hoverRuneMesh.position.set(wx, 0.55, wz);
        tileMat.color.setHex(0x4ade80);
        tileMat.emissive.setHex(0x22c55e);
        tileMat.opacity = placingType ? 0.28 : 0.16;
        runeMat.color.setHex(0x4ade80);
        runeMat.emissive.setHex(0x4ade80);
        runeMat.opacity = 0.9;
      } else if (placingType) {
        this.hoverTileMesh.position.set(wx, 0.25, wz);
        this.hoverRuneMesh.position.set(wx, 0.55, wz);
        tileMat.color.setHex(0xf87171);
        tileMat.emissive.setHex(0xef4444);
        tileMat.opacity = 0.2;
        runeMat.color.setHex(0xf87171);
        runeMat.emissive.setHex(0xef4444);
        runeMat.opacity = 0.55;
      } else {
        tileMat.opacity = 0;
        runeMat.opacity = 0;
      }
    } else {
      if (this.hoverRuneMesh) {
        (this.hoverRuneMesh.material as THREE.MeshStandardMaterial).opacity = 0;
      }
      if (this.hoverTileMesh) {
        (this.hoverTileMesh.material as THREE.MeshStandardMaterial).opacity = 0;
      }
    }

    const selected = snap.towers.find((t) => t.id === snap.selectedTowerId);
    if (selected && this.rangeIndicatorMesh) {
      const wx = selected.col * this.map.cellSize + this.map.cellSize / 2 - boardW / 2;
      const wz = selected.row * this.map.cellSize + this.map.cellSize / 2 - boardH / 2;
      this.rangeIndicatorMesh.position.set(wx, 2.0, wz);

      const r = selected.range;
      this.rangeIndicatorMesh.geometry.dispose();
      this.rangeIndicatorMesh.geometry = new THREE.RingGeometry(r - 3, r, 64);
      (this.rangeIndicatorMesh.material as THREE.MeshStandardMaterial).opacity = 0.7;
    } else if (this.rangeIndicatorMesh) {
      (this.rangeIndicatorMesh.material as THREE.MeshStandardMaterial).opacity = 0;
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

  public setGraphicsQuality(quality: GraphicsQuality): void {
    this.graphicsQuality = quality;
    if (quality === 'low') {
      this.usePostProcessing = false;
      this.renderer.shadowMap.enabled = false;
      this.sunLight.castShadow = false;
      this.glbPool?.setCastShadows(false);
      this.scene.environmentIntensity = 0.45;
      this.particleDensity = 0.35;
    } else if (quality === 'medium') {
      this.usePostProcessing = true;
      this.bloomPass.enabled = false;
      this.smaaPass.enabled = true;
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(1024, 1024);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
      this.glbPool?.setCastShadows(true);
      this.scene.environmentIntensity = 0.7;
      this.particleDensity = 0.7;
    } else {
      this.usePostProcessing = true;
      this.bloomPass.enabled = true;
      this.smaaPass.enabled = true;
      this.renderer.shadowMap.enabled = true;
      this.sunLight.castShadow = true;
      this.sunLight.shadow.mapSize.set(2048, 2048);
      this.sunLight.shadow.map?.dispose();
      this.sunLight.shadow.map = null;
      this.glbPool?.setCastShadows(true);
      this.scene.environmentIntensity = 0.9;
      this.particleDensity = 1.0;
    }
    this.renderer.shadowMap.needsUpdate = true;
  }

  public getGraphicsQuality(): GraphicsQuality {
    return this.graphicsQuality;
  }

  public getRecommendedDpr(): number {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    if (this.graphicsQuality === 'low') return 1;
    if (this.graphicsQuality === 'medium') return Math.min(dpr, 1.5);
    return Math.min(dpr, 2);
  }

  public triggerScreenShake(duration = 0.25, intensity = 12): void {
    this.shakeTimer = duration;
    this.shakeIntensity = intensity;
  }

  private computeBoxFitDistance(
    box: THREE.Box3,
    target: THREE.Vector3,
    camDirFromTarget: THREE.Vector3,
    aspect: number,
    padding = 1.16
  ): number {
    const forward = camDirFromTarget.clone().normalize();
    const worldUp = Math.abs(forward.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(worldUp, forward).normalize();
    const up = new THREE.Vector3().crossVectors(forward, right).normalize();

    const vFov = THREE.MathUtils.degToRad(this.camera.fov);
    const tanHalfV = Math.tan(vFov / 2);
    const tanHalfH = tanHalfV * Math.max(0.4, aspect);

    const corners = [
      new THREE.Vector3(box.min.x, box.min.y, box.min.z),
      new THREE.Vector3(box.min.x, box.min.y, box.max.z),
      new THREE.Vector3(box.min.x, box.max.y, box.min.z),
      new THREE.Vector3(box.min.x, box.max.y, box.max.z),
      new THREE.Vector3(box.max.x, box.min.y, box.min.z),
      new THREE.Vector3(box.max.x, box.min.y, box.max.z),
      new THREE.Vector3(box.max.x, box.max.y, box.min.z),
      new THREE.Vector3(box.max.x, box.max.y, box.max.z),
    ];

    let requiredDist = 240;
    const rel = new THREE.Vector3();
    for (const c of corners) {
      rel.subVectors(c, target);
      const xCam = Math.abs(rel.dot(right)) * padding;
      const yCam = Math.abs(rel.dot(up)) * padding;
      const zCam = rel.dot(forward);

      const dV = zCam + yCam / tanHalfV;
      const dH = zCam + xCam / tanHalfH;
      if (dV > requiredDist) requiredDist = dV;
      if (dH > requiredDist) requiredDist = dH;
    }
    return requiredDist;
  }

  private updateCameraTransform(): void {
    const viewW = this.canvas.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const viewH = this.canvas.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 720);
    const aspect = viewW / Math.max(1, viewH);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    const center = new THREE.Vector3();
    this.mapBounds.getCenter(center);
    this.cameraTarget.set(center.x, 8, center.z);

    if (this.viewMode === 'topdown') {
      const topDir = new THREE.Vector3(0, 1, 0.04).normalize();
      const dist = this.computeBoxFitDistance(this.mapBounds, this.cameraTarget, topDir, aspect, 1.15);
      this.camera.position.copy(this.cameraTarget).addScaledVector(topDir, dist);
      if (this.controls) {
        this.controls.enableRotate = false;
        this.controls.minDistance = dist * 0.45;
        this.controls.maxDistance = dist * 1.45;
        this.controls.target.copy(this.cameraTarget);
        this.controls.update();
      } else {
        this.camera.lookAt(this.cameraTarget);
      }
    } else if (this.viewMode === 'orbit') {
      // Lower 3D pitch (~41 degrees) for strong architectural depth
      const orbitDir = new THREE.Vector3(-0.18, 0.65, 0.74).normalize();
      const dist = this.computeBoxFitDistance(this.mapBounds, this.cameraTarget, orbitDir, aspect, 1.14);
      this.camera.position.copy(this.cameraTarget).addScaledVector(orbitDir, dist);
      if (this.controls) {
        this.controls.enableRotate = true;
        this.controls.minDistance = Math.max(240, dist * 0.4);
        this.controls.maxDistance = Math.max(1150, dist * 1.55);
        this.controls.target.copy(this.cameraTarget);
        this.controls.update();
      } else {
        this.camera.lookAt(this.cameraTarget);
      }
    } else {
      // Commercial TD 3D Isometric pitch (~40 degrees elevation)
      const isoDir = new THREE.Vector3(-0.12, 0.64, 0.76).normalize();
      const dist = this.computeBoxFitDistance(this.mapBounds, this.cameraTarget, isoDir, aspect, 1.15);
      this.cameraOffset.copy(this.cameraTarget).addScaledVector(isoDir, dist);
      this.camera.position.copy(this.cameraOffset);
      if (this.controls) {
        this.controls.enableRotate = false;
        this.controls.minDistance = Math.max(260, dist * 0.45);
        this.controls.maxDistance = Math.max(1050, dist * 1.4);
        this.controls.target.copy(this.cameraTarget);
        this.controls.update();
      } else {
        this.camera.lookAt(this.cameraTarget);
      }
    }
  }

  public resize(width: number, height: number): void {
    const safeW = Math.max(1, width);
    const safeH = Math.max(1, height);
    this.renderer.setSize(safeW, safeH, false);
    this.updateCameraTransform();
    if (this.composer) {
      this.composer.setSize(safeW, safeH);
      this.bloomPass.resolution.set(safeW, safeH);
    }
  }

  public dispose(): void {
    this.isDisposed = true;
    this.controls?.dispose();
    this.glbPool?.dispose();
    this.bloomPass?.dispose();
    this.smaaPass?.dispose();
    this.outputPass?.dispose();
    this.composer?.dispose();
    this.envRT?.dispose();
    this.pmremGenerator.dispose();
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
