import * as THREE from "three";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

export interface TerrainBackdropOptions {
  /** Camera the terrain plane sits in front of. Must be in the scene. */
  camera: THREE.PerspectiveCamera;
  /** Distance in front of the camera the terrain plane sits at. */
  distance?: number;
  /** Terrain material base color. */
  color?: number;
  /** Native size (world units) of the terrain.obj model before scaling. */
  nativeSize?: number;
  /** Extra scale factor so one tile comfortably overfills the frustum. */
  margin?: number;
  /** Path to the terrain model. */
  modelUrl?: string;
  /** Called once the model has loaded and been placed. */
  onLoad?: () => void;
}

export interface TerrainBackdrop {
  /** Size (world units) of one viewport at the terrain plane. */
  viewSize: () => { width: number; height: number };
  /** Resizes the tiles to match the current viewport. */
  fit: () => void;
  /**
   * Sets the point on the terrain (world units, within its plane) that sits
   * at the centre of the view.
   */
  setOffset: (x: number, y: number) => void;
}

// Tiles per side of the grid kept around the view centre.
const GRID = 3;

/**
 * Loads terrain.obj as a plane `distance` in front of the camera and slides
 * it within that plane via `setOffset`, so it reads as fixed ground the
 * camera travels over. The model is repeated in a small grid that follows
 * the offset, with every other tile mirrored so neighbouring edges line up —
 * it never runs out in any direction.
 */
export function createTerrainBackdrop({
  camera,
  distance = 20,
  color = 0x474359,
  nativeSize = 6,
  margin = 1.6,
  modelUrl = "/models/terrain.obj",
  onLoad,
}: TerrainBackdropOptions): TerrainBackdrop {
  const anchor = new THREE.Group();
  anchor.position.set(0, 0, -distance);
  camera.add(anchor);

  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.82,
    metalness: 0,
  });

  const tiles: THREE.Group[] = [];
  let tileSize = 1;
  let offsetX = 0;
  let offsetY = 0;

  function viewSize() {
    const height =
      2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * distance;
    return { width: height * camera.aspect, height };
  }

  function layout() {
    if (tiles.length === 0) return;
    const scale = tileSize / nativeSize;
    const centerI = Math.round(offsetX / tileSize);
    const centerJ = Math.round(offsetY / tileSize);
    const half = Math.floor(GRID / 2);

    tiles.forEach((tile, index) => {
      const i = centerI + (index % GRID) - half;
      const j = centerJ + Math.floor(index / GRID) - half;
      tile.position.set(i * tileSize - offsetX, j * tileSize - offsetY, 0);
      tile.scale.set(i & 1 ? -scale : scale, j & 1 ? -scale : scale, scale);
    });
  }

  function fit() {
    const { width, height } = viewSize();
    tileSize = Math.max(width, height) * margin;
    layout();
  }

  function setOffset(x: number, y: number) {
    offsetX = x;
    offsetY = y;
    layout();
  }

  new OBJLoader().load(modelUrl, (obj) => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.computeVertexNormals();
        child.material = material;
      }
    });
    obj.rotation.x = -Math.PI / 2;

    for (let index = 0; index < GRID * GRID; index++) {
      const tile = new THREE.Group();
      tile.add(index === 0 ? obj : obj.clone());
      tiles.push(tile);
      anchor.add(tile);
    }
    fit();
    onLoad?.();
  });

  return { viewSize, fit, setOffset };
}
