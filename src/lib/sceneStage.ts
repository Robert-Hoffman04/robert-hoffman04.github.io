import * as THREE from "three";
import { createTerrainBackdrop } from "./terrainBackdrop";
import {
  createScrollTimeline,
  onLayoutChange,
  type ItemKeyframe,
  type ItemProps,
  type ScrollTimeline,
} from "./scrollTimeline";
import { sectionFocus } from "./sectionFocus";

const BASE_FOV = 38;
const REFERENCE_CANVAS_HEIGHT = 820;
const AMBIENT_INTENSITY = 0.5;
const KEY_INTENSITY = 1.2;

/** One module of the page's scene: an object, plus how it fades and glows. */
export interface StageItem {
  /**
   * Added to the scene at the origin (the centre of the view). The stage
   * drives its position and scale from the keyframes' x/y/scale.
   */
  object: THREE.Object3D;
  keyframes?: ItemKeyframe[];
  /**
   * Page element the item is pinned to. The item follows that element's
   * centre vertically, so it scrolls with the page exactly like the terrain.
   */
  anchor?: HTMLElement | null;
  /** Fades the item out as its anchor leaves the centre of the viewport. */
  anchorFade?: boolean;
  /** Applies the keyframed opacity (0–1) to the item's visible parts. */
  setOpacity?: (opacity: number) => void;
  /** Applies the keyframed light level (0–1) to the item's lights. */
  setLight?: (light: number) => void;
}

export interface SceneStage {
  canvas: HTMLCanvasElement;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** Adds an item to the scene and starts driving it from its keyframes. */
  addItem: (item: StageItem) => void;
  /** World units covered by one screen pixel at the items' depth. */
  unitsPerPixel: () => number;
  /**
   * Width in pixels of the clear area items sit in: the gap between the page
   * content and the nav, or the whole viewport if a page has neither.
   */
  freeWidth: () => number;
  /**
   * Strength (0–1) of the stage's own ambient + key light. Items that light
   * the terrain themselves turn this down.
   */
  setDefaultLight: (amount: number) => void;
  /** Runs now and on every viewport resize, before the terrain is refit. */
  onResize: (callback: (width: number, height: number) => void) => void;
  /** Runs every animation frame, before rendering. */
  onFrame: (callback: () => void) => void;
  /** Replaces the plain render call (e.g. with a post-processing composer). */
  setRender: (render: () => void) => void;
  /** Requests a render on the next frame. */
  invalidate: () => void;
}

let stage: SceneStage | null = null;

/**
 * The one WebGL scene behind the page: the terrain plus every item the page
 * adds to it, so all of their lights fall on the rock and on each other. Created on
 * first use from the page's `.scene-backdrop` canvas.
 */
export function getStage(): SceneStage | null {
  if (stage) return stage;

  const canvas = document.querySelector<HTMLCanvasElement>(".scene-backdrop");
  if (!canvas) return null;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 100);
  camera.position.set(0, 2.5, 10);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  scene.add(camera);
  const cameraRight = new THREE.Vector3().setFromMatrixColumn(
    camera.matrixWorld,
    0,
  );
  const cameraUp = new THREE.Vector3().setFromMatrixColumn(
    camera.matrixWorld,
    1,
  );

  const ambient = new THREE.AmbientLight(0xffffff, AMBIENT_INTENSITY);
  scene.add(ambient);
  const keyLight = new THREE.DirectionalLight(0xffffff, KEY_INTENSITY);
  keyLight.position.set(-3, 5, 4);
  camera.add(keyLight);

  let dirty = true;
  const invalidate = () => (dirty = true);

  const terrain = createTerrainBackdrop({ camera, onLoad: invalidate });

  const resizeCallbacks: Array<(width: number, height: number) => void> = [];
  const frameCallbacks: Array<() => void> = [];
  const items: Array<{
    item: StageItem;
    timeline: ScrollTimeline<ItemProps>;
    opacity: number;
    light: number;
  }> = [];
  let render = () => renderer.render(scene, camera);
  let width = 1;
  let height = 1;
  let clearWidth = 1;
  let scrollX = NaN;
  let scrollY = NaN;

  // One page pixel scrolled moves the terrain exactly one pixel on screen.
  function syncScroll() {
    if (window.scrollX === scrollX && window.scrollY === scrollY) return;
    scrollX = window.scrollX;
    scrollY = window.scrollY;
    const unitsPerPixel = terrain.viewSize().height / height;
    terrain.setOffset(scrollX * unitsPerPixel, -scrollY * unitsPerPixel);
    dirty = true;
  }

  function unitsPerPixel() {
    return (
      (2 *
        Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) *
        camera.position.length()) /
      height
    );
  }

  function updateItems() {
    const scrollY = window.scrollY;
    const pixel = unitsPerPixel();
    for (const entry of items) {
      const sample = entry.timeline.sample(scrollY);
      const { x, y, scale, light } = sample;
      const { object, anchor, anchorFade, setOpacity, setLight } = entry.item;
      const opacity =
        anchor && anchorFade
          ? sample.opacity * sectionFocus(anchor)
          : sample.opacity;

      let offsetY = (y / 100) * height;
      if (anchor) {
        const rect = anchor.getBoundingClientRect();
        offsetY += rect.top + rect.height / 2 - height / 2;
      }

      object.position
        .copy(cameraRight)
        .multiplyScalar((x / 100) * width * pixel)
        .addScaledVector(cameraUp, -offsetY * pixel);
      object.scale.setScalar(scale);

      if (opacity !== entry.opacity) {
        entry.opacity = opacity;
        setOpacity?.(opacity);
      }
      if (light !== entry.light) {
        entry.light = light;
        setLight?.(light);
      }
    }
  }

  // Shifts the view so the scene's centre — where items sit — lands midway
  // between the page content's right edge and the nav, on every page.
  function centerView() {
    const content = document.querySelector<HTMLElement>(".page > :first-child");
    const nav = document.getElementById("page-navigation");
    clearWidth = width;
    if (!content || !nav) return;

    const left = content.getBoundingClientRect().right;
    const right = nav.getBoundingClientRect().left;
    const targetX = (left + right) / 2;
    if (!Number.isFinite(targetX)) return;
    if (right > left) clearWidth = right - left;
    camera.setViewOffset(width, height, width / 2 - targetX, 0, width, height);
  }

  function resize() {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);

    camera.fov = THREE.MathUtils.clamp(
      BASE_FOV * (height / REFERENCE_CANVAS_HEIGHT),
      20,
      75,
    );
    camera.aspect = width / height;
    camera.clearViewOffset();
    camera.updateProjectionMatrix();
    centerView();
    for (const callback of resizeCallbacks) callback(width, height);

    terrain.fit();
    renderer.setSize(width, height, false);
    scrollY = NaN;
    syncScroll();
  }

  window.addEventListener("resize", resize);
  resize();

  onLayoutChange(() => {
    for (const entry of items) entry.timeline.resolve();
    resize();
  });

  function tick() {
    syncScroll();
    updateItems();
    for (const callback of frameCallbacks) callback();
    if (dirty) {
      dirty = false;
      render();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  stage = {
    canvas,
    renderer,
    scene,
    camera,
    addItem(item) {
      scene.add(item.object);
      items.push({
        item,
        timeline: createScrollTimeline<ItemProps>(item.keyframes ?? [], {
          opacity: 1,
          x: 0,
          y: 0,
          scale: 1,
          light: 1,
        }),
        opacity: NaN,
        light: NaN,
      });
      dirty = true;
    },
    unitsPerPixel,
    freeWidth: () => clearWidth,
    setDefaultLight(amount) {
      ambient.intensity = AMBIENT_INTENSITY * amount;
      keyLight.intensity = KEY_INTENSITY * amount;
      dirty = true;
    },
    onResize(callback) {
      resizeCallbacks.push(callback);
      resize();
    },
    onFrame(callback) {
      frameCallbacks.push(callback);
    },
    setRender(next) {
      render = next;
      dirty = true;
    },
    invalidate,
  };
  return stage;
}
