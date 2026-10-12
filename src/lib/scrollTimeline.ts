/**
 * Where on the page a keyframe sits:
 *  - number or "1.5vh": viewport heights scrolled (0 = top of page)
 *  - "50%": fraction of the page's total scrollable distance
 *  - "300px": absolute scroll offset
 *  - any other string: a CSS selector — the point where that element's
 *    top edge reaches the top of the viewport
 */
export type ScrollPosition = number | string;

export type Ease = "linear" | "in" | "out" | "inOut";

export type ScrollKeyframe<T extends Record<string, number>> = {
  at: ScrollPosition;
  /** Shifts `at` by this many viewport heights (-1 = one screen earlier). */
  offset?: number;
  /** Easing used on the way into this keyframe. */
  ease?: Ease;
} & Partial<T>;

/**
 * Properties a scene item can animate. x/y are screen offsets in vw/vh.
 * `light` scales the item's own lights and is independent of `opacity`, so
 * an item can fade out while its lighting stays on the terrain.
 */
export type ItemProps = {
  opacity: number;
  x: number;
  y: number;
  scale: number;
  light: number;
};
export type ItemKeyframe = ScrollKeyframe<ItemProps>;

export interface ScrollTimeline<T> {
  /** Re-measures keyframe positions. Call when the layout changes. */
  resolve: () => void;
  /** Interpolated values for a scroll offset in px. */
  sample: (scrollY?: number) => T;
}

const EASINGS: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  in: (t) => t * t,
  out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};

function resolvePosition(at: ScrollPosition, offset = 0): number {
  const viewport = window.innerHeight;
  let px: number;

  if (typeof at === "number") {
    px = at * viewport;
  } else if (/^-?[\d.]+vh$/.test(at)) {
    px = parseFloat(at) * viewport;
  } else if (/^-?[\d.]+px$/.test(at)) {
    px = parseFloat(at);
  } else if (/^-?[\d.]+%$/.test(at)) {
    const maxScroll = document.documentElement.scrollHeight - viewport;
    px = (parseFloat(at) / 100) * Math.max(0, maxScroll);
  } else {
    const el = document.querySelector(at);
    if (!el) console.warn(`scrollTimeline: no element matches "${at}".`);
    px = el ? el.getBoundingClientRect().top + window.scrollY : 0;
  }

  return px + offset * viewport;
}

/**
 * Builds a scroll-driven timeline. Each property is interpolated between the
 * keyframes that mention it and holds its value before the first and after
 * the last; properties no keyframe mentions stay at their default.
 */
export function createScrollTimeline<T extends Record<string, number>>(
  keyframes: ScrollKeyframe<T>[],
  defaults: T,
): ScrollTimeline<T> {
  type Stop = { pos: number; value: number; ease: Ease };
  const props = Object.keys(defaults) as Array<keyof T & string>;
  let tracks = new Map<string, Stop[]>();

  function resolve() {
    const resolved = keyframes
      .map((frame) => ({ frame, pos: resolvePosition(frame.at, frame.offset) }))
      .sort((a, b) => a.pos - b.pos);

    tracks = new Map();
    for (const prop of props) {
      const stops: Stop[] = [];
      for (const { frame, pos } of resolved) {
        const value = (frame as Partial<T>)[prop];
        if (typeof value !== "number") continue;
        stops.push({ pos, value, ease: frame.ease ?? "linear" });
      }
      tracks.set(prop, stops);
    }
  }

  function sample(scrollY = window.scrollY): T {
    const out = { ...defaults };
    for (const prop of props) {
      const stops = tracks.get(prop);
      if (!stops || stops.length === 0) continue;

      let value = stops[0].value;
      if (scrollY >= stops[stops.length - 1].pos) {
        value = stops[stops.length - 1].value;
      } else if (scrollY > stops[0].pos) {
        const next = stops.findIndex((stop) => stop.pos > scrollY);
        const from = stops[next - 1];
        const to = stops[next];
        const t = (scrollY - from.pos) / (to.pos - from.pos);
        value = from.value + (to.value - from.value) * EASINGS[to.ease](t);
      }
      (out as Record<string, number>)[prop] = value;
    }
    return out;
  }

  resolve();
  return { resolve, sample };
}

/** Calls `relayout` whenever the viewport or page size changes. */
export function onLayoutChange(relayout: () => void) {
  window.addEventListener("resize", relayout);
  window.addEventListener("load", relayout);
  new ResizeObserver(relayout).observe(document.body);
}
