"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Click-and-drag panning for a scrollable element, so the board can be moved by
 * grabbing its background instead of reaching for the scrollbar.
 *
 * Deliberately stays out of the way of everything else that wants the pointer:
 * dnd-kit card/list dragging, buttons, inputs and text selection all keep
 * working, because a pan only starts on non-interactive space. Cards carry
 * `role="button"` and the list drag handle is a `<button>`, so both are already
 * covered by the selector below; anything else can opt out with `data-no-pan`.
 */

const NO_PAN_SELECTOR = [
  "a",
  "button",
  "input",
  "textarea",
  "select",
  "label",
  '[role="button"]',
  '[contenteditable="true"]',
  "[data-no-pan]",
].join(",");

/** Ignore the jitter of an ordinary click before treating it as a drag. */
const PAN_THRESHOLD_PX = 4;

/** Returns `[ref, panning]` — attach the ref to the scroll container. */
export function useDragScroll<T extends HTMLElement>(): [
  React.RefObject<T | null>,
  boolean,
] {
  const ref = useRef<T | null>(null);
  const [panning, setPanning] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let activeId: number | null = null;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let panned = false;
    let justPanned = false;

    const end = () => {
      if (activeId !== null) {
        try {
          el.releasePointerCapture(activeId);
        } catch {
          // Already released — releasing twice is not an error worth surfacing.
        }
      }
      activeId = null;
      panned = false;
      setPanning(false);
      document.body.style.removeProperty("user-select");
    };

    const onPointerDown = (e: PointerEvent) => {
      if (activeId !== null) return;
      // Touch already pans natively, with momentum we shouldn't replace.
      if (e.pointerType === "touch") return;

      if (e.button !== 0) return;
      const target = e.target as Element | null;
      if (target?.closest(NO_PAN_SELECTOR)) return;

      const scrollableX = el.scrollWidth > el.clientWidth;
      const scrollableY = el.scrollHeight > el.clientHeight;
      if (!scrollableX && !scrollableY) return;

      activeId = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = el.scrollLeft;
      startTop = el.scrollTop;
      panned = false;
      justPanned = false;
      el.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerId !== activeId) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!panned) {
        if (Math.abs(dx) < PAN_THRESHOLD_PX && Math.abs(dy) < PAN_THRESHOLD_PX) return;
        panned = true;
        setPanning(true);
        // Dragging across the board would otherwise select text along the way.
        document.body.style.setProperty("user-select", "none");
      }

      el.scrollLeft = startLeft - dx;
      el.scrollTop = startTop - dy;
      e.preventDefault();
    };

    const onPointerUp = (e: PointerEvent) => {
      if (e.pointerId !== activeId) return;
      justPanned = panned;
      end();
    };

    // A drag that finishes over something clickable shouldn't also activate it.
    const onClickCapture = (e: MouseEvent) => {
      if (!justPanned) return;
      justPanned = false;
      e.stopPropagation();
      e.preventDefault();
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("click", onClickCapture, true);
      end();
    };
  }, []);

  return [ref, panning];
}
