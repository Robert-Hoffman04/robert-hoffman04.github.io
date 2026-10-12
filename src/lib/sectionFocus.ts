// Offsets from the viewport centre (in viewport heights) between which a
// section fades out. It is gone by half a screen, which is the point where
// the next section would be just as close — so two never show at once.
const FADE_START = 0.1;
const FADE_END = 0.5;

/**
 * How "in focus" a full-screen section is: 1 while it is centred in the
 * viewport, falling to 0 once it is half a screen away.
 */
export function sectionFocus(section: Element): number {
  const rect = section.getBoundingClientRect();
  const viewport = window.innerHeight;
  const offset =
    Math.abs(rect.top + rect.height / 2 - viewport / 2) / viewport;
  const t = Math.min(
    Math.max((offset - FADE_START) / (FADE_END - FADE_START), 0),
    1,
  );
  return 1 - t * t * (3 - 2 * t);
}
