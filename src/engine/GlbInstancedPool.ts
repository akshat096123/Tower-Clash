import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface GlbModelSpec {
  key: string;
  url: string;
  targetHeight: number;
  excludeMeshes?: string[];
  poseClipNames?: string[];
  poseTime?: number;
  emissiveBoost?: number;
}

interface BakedPart {
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

interface InstancedBatch {
  mesh: THREE.InstancedMesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial;
}

/**
 * Loads .glb/.gltf models via GLTFLoader, bakes rigged/static meshes into
 * normalized BufferGeometries, and renders all active entities with THREE.InstancedMesh.
 */
export class GlbInstancedPool {
  private loader: GLTFLoader;
  private parentGroup: THREE.Object3D;
  private bakedModels = new Map<string, BakedPart[]>();
  private loadingKeys = new Set<string>();
  private batches = new Map<string, InstancedBatch[]>();
  private capacities = new Map<string, number>();
  private frameCounts = new Map<string, number>();
  private pendingMatrices = new Map<string, THREE.Matrix4[]>();
  private pendingColors = new Map<string, THREE.Color[]>();
  private castShadows = true;
  private isDisposed = false;

  constructor(loader: GLTFLoader, parentGroup: THREE.Object3D) {
    this.loader = loader;
    this.parentGroup = parentGroup;
  }

  public setCastShadows(enabled: boolean): void {
    this.castShadows = enabled;
    for (const list of this.batches.values()) {
      for (const b of list) {
        b.mesh.castShadow = enabled;
      }
    }
  }

  public preload(specs: GlbModelSpec[]): void {
    for (const spec of specs) {
      if (this.bakedModels.has(spec.key) || this.loadingKeys.has(spec.key)) continue;
      this.loadingKeys.add(spec.key);
      this.loader.load(
        spec.url,
        (gltf) => {
          if (this.isDisposed) return;
          const parts = this.bakeModel(gltf.scene, gltf.animations, spec);
          this.loadingKeys.delete(spec.key);
          if (parts.length > 0) {
            this.bakedModels.set(spec.key, parts);
            this.allocateBatches(spec.key, parts, 32);
          }
        },
        undefined,
        () => {
          this.loadingKeys.delete(spec.key);
        }
      );
    }
  }

  public isReady(key: string): boolean {
    return this.batches.has(key);
  }

  public beginFrame(): void {
    for (const key of this.batches.keys()) {
      this.frameCounts.set(key, 0);
      const mats = this.pendingMatrices.get(key);
      if (mats) mats.length = 0;
      const cols = this.pendingColors.get(key);
      if (cols) cols.length = 0;
    }
  }

  public pushInstance(key: string, matrix: THREE.Matrix4, color?: THREE.Color): boolean {
    if (!this.batches.has(key)) return false;

    let mats = this.pendingMatrices.get(key);
    let cols = this.pendingColors.get(key);
    if (!mats) {
      mats = [];
      this.pendingMatrices.set(key, mats);
    }
    if (!cols) {
      cols = [];
      this.pendingColors.set(key, cols);
    }

    mats.push(matrix.clone());
    cols.push(color ? color.clone() : new THREE.Color(0xffffff));
    this.frameCounts.set(key, mats.length);
    return true;
  }

  public endFrame(): void {
    for (const [key, list] of this.batches.entries()) {
      const count = this.frameCounts.get(key) ?? 0;
      const cap = this.capacities.get(key) ?? 32;

      if (count > cap) {
        const nextCap = Math.max(count, cap * 2);
        const parts = this.bakedModels.get(key);
        if (parts) {
          this.allocateBatches(key, parts, nextCap);
        }
      }

      const activeList = this.batches.get(key) ?? list;
      const mats = this.pendingMatrices.get(key) ?? [];
      const cols = this.pendingColors.get(key) ?? [];

      for (const b of activeList) {
        b.mesh.count = count;
        b.mesh.visible = count > 0;
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            b.mesh.setMatrixAt(i, mats[i]);
            b.mesh.setColorAt(i, cols[i]);
          }
          b.mesh.instanceMatrix.needsUpdate = true;
          if (b.mesh.instanceColor) {
            b.mesh.instanceColor.needsUpdate = true;
          }
        }
      }
    }
  }

  private allocateBatches(key: string, parts: BakedPart[], capacity: number): void {
    const oldList = this.batches.get(key);
    if (oldList) {
      for (const b of oldList) {
        this.parentGroup.remove(b.mesh);
        b.mesh.dispose();
      }
    }

    const nextList: InstancedBatch[] = [];
    for (const part of parts) {
      const im = new THREE.InstancedMesh(part.geometry, part.material, capacity);
      im.count = 0;
      im.visible = false;
      im.castShadow = this.castShadows;
      im.receiveShadow = true;
      im.frustumCulled = false;
      // Initialize instanceColor buffer so setColorAt works immediately
      const white = new THREE.Color(0xffffff);
      for (let i = 0; i < capacity; i++) {
        im.setColorAt(i, white);
      }
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      this.parentGroup.add(im);
      nextList.push({ mesh: im, geometry: part.geometry, material: part.material });
    }

    this.batches.set(key, nextList);
    this.capacities.set(key, capacity);
  }

  private bakeModel(
    root: THREE.Group,
    animations: THREE.AnimationClip[],
    spec: GlbModelSpec
  ): BakedPart[] {
    if (animations.length > 0 && spec.poseClipNames?.length) {
      const clip =
        spec.poseClipNames
          .map((n) => animations.find((a) => a.name === n))
          .find((c): c is THREE.AnimationClip => Boolean(c)) ?? animations[0];
      if (clip) {
        const mixer = new THREE.AnimationMixer(root);
        const action = mixer.clipAction(clip);
        action.play();
        mixer.update(spec.poseTime ?? 0.12);
        mixer.stopAllAction();
      }
    }

    root.updateMatrixWorld(true);

    const excludeSet = new Set(spec.excludeMeshes ?? []);
    const byMaterial = new Map<
      string,
      { material: THREE.MeshStandardMaterial; geometries: THREE.BufferGeometry[] }
    >();

    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (excludeSet.has(mesh.name)) return;

      const geom = mesh.geometry.clone();
      const skinned = obj as THREE.SkinnedMesh;

      if (skinned.isSkinnedMesh && skinned.skeleton) {
        const pos = geom.attributes.position;
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          skinned.applyBoneTransform(i, v);
          pos.setXYZ(i, v.x, v.y, v.z);
        }
        pos.needsUpdate = true;
        geom.deleteAttribute('skinIndex');
        geom.deleteAttribute('skinWeight');
      }

      geom.applyMatrix4(mesh.matrixWorld);
      geom.computeVertexNormals();

      // Normalize attributes so mergeGeometries succeeds cleanly across parts
      const nonIndexed = geom.index ? geom.toNonIndexed() : geom;
      if (geom.index) geom.dispose();

      // Strip extra attributes like tangent/uv1/color if inconsistent
      const keepAttrs = new Set(['position', 'normal', 'uv']);
      for (const attrName of Object.keys(nonIndexed.attributes)) {
        if (!keepAttrs.has(attrName)) {
          nonIndexed.deleteAttribute(attrName);
        }
      }
      if (!nonIndexed.attributes.uv) {
        const count = nonIndexed.attributes.position.count;
        nonIndexed.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
      }

      const rawMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
      const matKey = rawMat?.uuid ?? 'default';

      let group = byMaterial.get(matKey);
      if (!group) {
        const stdMat = this.toStandardMaterial(rawMat, spec.emissiveBoost);
        group = { material: stdMat, geometries: [] };
        byMaterial.set(matKey, group);
      }
      group.geometries.push(nonIndexed);
    });

    // Compute combined bounding box across all geometries to center X/Z and ground Y=0
    const allGeoms: THREE.BufferGeometry[] = [];
    for (const g of byMaterial.values()) {
      allGeoms.push(...g.geometries);
    }
    if (allGeoms.length === 0) return [];

    const fullBox = new THREE.Box3();
    for (const g of allGeoms) {
      g.computeBoundingBox();
      if (g.boundingBox) fullBox.union(g.boundingBox);
    }

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    fullBox.getSize(size);
    fullBox.getCenter(center);

    const scale = size.y > 0.0001 ? spec.targetHeight / size.y : 1;
    const normMatrix = new THREE.Matrix4()
      .makeScale(scale, scale, scale)
      .multiply(new THREE.Matrix4().makeTranslation(-center.x, -fullBox.min.y, -center.z));

    const parts: BakedPart[] = [];
    for (const entry of byMaterial.values()) {
      const merged =
        entry.geometries.length === 1
          ? entry.geometries[0]
          : mergeGeometries(entry.geometries, false);
      if (entry.geometries.length > 1) {
        entry.geometries.forEach((g) => g.dispose());
      }
      if (!merged) continue;
      merged.applyMatrix4(normMatrix);
      merged.computeBoundingSphere();
      parts.push({ geometry: merged, material: entry.material });
    }

    return parts;
  }

  private toStandardMaterial(
    mat: THREE.Material | undefined,
    emissiveBoost?: number
  ): THREE.MeshStandardMaterial {
    if (mat && (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
      const src = mat as THREE.MeshStandardMaterial;
      const cloned = src.clone();
      cloned.vertexColors = false;
      if (emissiveBoost && cloned.emissive.getHex() !== 0x000000) {
        cloned.emissiveIntensity = Math.max(cloned.emissiveIntensity, emissiveBoost);
      }
      return cloned;
    }

    const color =
      mat && 'color' in mat && (mat as THREE.MeshBasicMaterial).color
        ? (mat as THREE.MeshBasicMaterial).color
        : new THREE.Color(0xffffff);
    const map =
      mat && 'map' in mat ? (mat as THREE.MeshBasicMaterial).map : null;

    return new THREE.MeshStandardMaterial({
      color,
      map,
      roughness: 0.55,
      metalness: 0.1,
    });
  }

  public dispose(): void {
    this.isDisposed = true;
    for (const list of this.batches.values()) {
      for (const b of list) {
        this.parentGroup.remove(b.mesh);
        b.mesh.dispose();
      }
    }
    this.batches.clear();
    for (const parts of this.bakedModels.values()) {
      for (const p of parts) {
        p.geometry.dispose();
        p.material.dispose();
      }
    }
    this.bakedModels.clear();
  }
}
