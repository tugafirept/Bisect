import type { Position } from "../game/geo";

export interface Endpoints {
  a: Position;
  b: Position;
}

export interface LineDragHandle {
  readonly dragging: "a" | "b" | null;
  destroy(): void;
}

/**
 * Wire pointer events on the canvas so the two line endpoints can be dragged.
 * `endpoints` is mutated in place; `onChange` fires after every move.
 * `logical` is the fixed drawing coordinate space (the canvas may be displayed
 * at any size by CSS, so pointer coords are scaled back to it).
 */
export function attachLineDrag(
  canvas: HTMLCanvasElement,
  endpoints: Endpoints,
  onChange: () => void,
  isLocked: () => boolean = () => false,
  logical: { width: number; height: number } = { width: canvas.width, height: canvas.height },
): LineDragHandle {
  let dragging: "a" | "b" | null = null;
  const HIT_RADIUS = 24;

  const toCanvas = (e: PointerEvent): Position => {
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width > 0 ? logical.width / rect.width : 1;
    const sy = rect.height > 0 ? logical.height / rect.height : 1;
    return [(e.clientX - rect.left) * sx, (e.clientY - rect.top) * sy];
  };

  const near = (p: Position, x: number, y: number): boolean =>
    Math.hypot(p[0] - x, p[1] - y) <= HIT_RADIUS;

  const onDown = (e: PointerEvent): void => {
    if (isLocked()) return;
    const [x, y] = toCanvas(e);
    if (near(endpoints.a, x, y)) dragging = "a";
    else if (near(endpoints.b, x, y)) dragging = "b";
    if (dragging) {
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  };

  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    endpoints[dragging] = toCanvas(e);
    onChange();
  };

  const onUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = null;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);

  return {
    get dragging() {
      return dragging;
    },
    destroy() {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
    },
  };
}
