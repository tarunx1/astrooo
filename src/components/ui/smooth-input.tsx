"use client";

import { useEffect, useRef, type ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A text input whose caret glides between positions instead of jumping.
 *
 * Deliberately a drop-in for `<input>`: it takes the same props, applies no
 * styling of its own, and passes `className` straight through. Every call site
 * keeps the appearance it already had, so this can be adopted across the app
 * without touching a single existing design.
 *
 * The caret is a real element positioned over the field while the native one is
 * hidden. That is only safe under specific conditions, so the component falls
 * back to the browser's own caret whenever they are not met:
 *
 * - Only text-like fields. A date or number field has native affordances a
 *   painted bar would sit awkwardly against.
 * - Only pointer-fine devices. On touch, the caret is bound up with the drag
 *   handle and magnifier used to position it, and replacing it there costs more
 *   than the animation is worth.
 * - Never mid-composition. An IME builds a character over several keystrokes
 *   and reports selection offsets that do not correspond to rendered glyphs, so
 *   the native caret is handed back until composition ends. This matters here:
 *   people type names in Devanagari.
 *
 * In each of those cases the field behaves exactly as it did before.
 */
type SmoothInputProps = ComponentPropsWithoutRef<"input">;

/**
 * Types that expose a caret offset.
 *
 * The selection API is only defined for these. `email`, `number` and `date`
 * return null from `selectionStart` however text-like they look, so there is no
 * offset to place a caret at and those fields keep the browser's own.
 */
const TEXT_LIKE = new Set(["text", "password", "search", "tel", "url", undefined, ""]);

/** Matches the spring in the original design: stiffness 500, damping 30, mass 0.5. */
const STIFFNESS = 500;
const DAMPING = 30;
const MASS = 0.5;
/** Below this the caret has arrived; running the loop further burns frames. */
const REST = 0.05;

function passwordChar(): string {
  return /firefox|fxios/i.test(navigator.userAgent) ? "●" : "•";
}

export function SmoothInput({ className, type, style, ...props }: SmoothInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const caretRef = useRef<HTMLSpanElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  // Animation state lives in refs: it changes every frame and must never
  // trigger a React render.
  const target = useRef(0);
  const current = useRef(0);
  const velocity = useRef(0);
  const frame = useRef(0);
  const composing = useRef(false);

  const isTextLike = TEXT_LIKE.has(type);

  useEffect(() => {
    const input = inputRef.current;
    const caret = caretRef.current;
    const measure = measureRef.current;
    if (!input || !caret || !measure || !isTextLike) return;

    // Touch devices keep their own caret, along with the handle used to drag it.
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const bullet = passwordChar();

    input.style.caretColor = "transparent";

    /** Copies the input's typography onto the measuring span. */
    const syncMeasure = () => {
      const styles = window.getComputedStyle(input);
      let fontSize = styles.fontSize;

      // Non-Chromium browsers render the password bullet larger than the
      // declared size, so measuring at face value drifts along the field.
      if (bullet === "•" && input.type === "password" && !/chrome|chromium|crios/i.test(navigator.userAgent)) {
        fontSize = `${parseFloat(fontSize) + 6.25}px`;
      }

      measure.style.font = `${styles.fontStyle} ${styles.fontWeight} ${fontSize} ${styles.fontFamily}`;
      measure.style.letterSpacing = styles.letterSpacing;
      measure.style.fontFeatureSettings = styles.fontFeatureSettings;
      measure.style.fontVariationSettings = styles.fontVariationSettings;
    };

    /** Width of the text before the caret, plus the field's left padding. */
    const prefixWidth = (text: string) => {
      syncMeasure();
      measure.textContent = text;
      const paddingLeft = parseFloat(window.getComputedStyle(input).paddingLeft) || 0;
      return text.length > 0 ? measure.offsetWidth + paddingLeft : paddingLeft - 1;
    };

    /** Keeps a caret that has run past either edge inside the visible field. */
    const scrollIntoView = (absolute: number) => {
      const styles = window.getComputedStyle(input);
      const paddingLeft = parseFloat(styles.paddingLeft) || 0;
      const paddingRight = parseFloat(styles.paddingRight) || 0;
      const maxScroll = Math.max(0, input.scrollWidth - input.clientWidth);

      if (absolute > input.scrollLeft + input.clientWidth - paddingRight) {
        input.scrollLeft = Math.min(absolute - input.clientWidth + paddingRight, maxScroll);
      } else if (absolute < input.scrollLeft + paddingLeft) {
        input.scrollLeft = Math.max(0, absolute - paddingLeft);
      }
    };

    const tick = () => {
      frame.current = 0;
      const distance = target.current - current.current;

      if (reduceMotion) {
        current.current = target.current;
        velocity.current = 0;
      } else {
        // A spring rather than a tween, so a caret already in flight redirects
        // smoothly instead of restarting.
        const acceleration = (STIFFNESS * distance - DAMPING * velocity.current) / MASS;
        velocity.current += acceleration * (1 / 60);
        current.current += velocity.current * (1 / 60);
      }

      caret.style.transform = `translateX(${current.current}px)`;

      const settled = Math.abs(target.current - current.current) < REST && Math.abs(velocity.current) < REST;
      if (settled) {
        current.current = target.current;
        velocity.current = 0;
        caret.style.transform = `translateX(${current.current}px)`;
        return;
      }

      frame.current = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!frame.current) frame.current = requestAnimationFrame(tick);
    };

    const update = () => {
      if (document.activeElement !== input || composing.current) return;

      const selectionStart = input.selectionStart ?? 0;
      const selectionEnd = input.selectionEnd ?? 0;
      const hasSelection = selectionStart !== selectionEnd;
      const index =
        selectionStart === selectionEnd
          ? selectionStart
          : input.selectionDirection === "backward"
            ? selectionStart
            : selectionEnd;

      const before = input.type === "password" ? bullet.repeat(index) : input.value.slice(0, index);
      const absolute = prefixWidth(before);
      scrollIntoView(absolute);

      const styles = window.getComputedStyle(input);
      const paddingLeft = parseFloat(styles.paddingLeft) || 0;
      const paddingRight = parseFloat(styles.paddingRight) || 0;
      const x = absolute - input.scrollLeft;
      const maxX = input.clientWidth - paddingRight;
      const visible = x >= paddingLeft - 1 && x <= maxX + 1;

      target.current = Math.min(x, maxX);

      // While a range is selected the browser shows no caret, and neither
      // should this. Same when the position has scrolled out of the field.
      caret.style.opacity = !visible || hasSelection ? "0" : "1";
      start();
    };

    /** A caret that animates in from the wrong place looks like a glitch. */
    const onFocus = () => {
      composing.current = false;
      update();
      current.current = target.current;
      velocity.current = 0;
      caret.style.transform = `translateX(${current.current}px)`;
    };

    const onBlur = () => {
      caret.style.opacity = "0";
    };

    const onSelectionChange = () => {
      if (document.activeElement !== input) return;
      // Selection is reported before the field has scrolled to follow it.
      requestAnimationFrame(update);
    };

    const onCompositionStart = () => {
      composing.current = true;
      caret.style.opacity = "0";
      input.style.caretColor = "";
    };

    const onCompositionEnd = () => {
      composing.current = false;
      input.style.caretColor = "transparent";
      requestAnimationFrame(update);
    };

    input.addEventListener("focus", onFocus);
    input.addEventListener("blur", onBlur);
    input.addEventListener("input", update);
    input.addEventListener("scroll", update);
    input.addEventListener("compositionstart", onCompositionStart);
    input.addEventListener("compositionend", onCompositionEnd);
    document.addEventListener("selectionchange", onSelectionChange);

    // Text metrics change when the webfont lands or the field is resized.
    const resizeObserver = new ResizeObserver(() => {
      if (document.activeElement === input) update();
    });
    resizeObserver.observe(input);
    void document.fonts?.ready.then(() => {
      if (document.activeElement === input) update();
    });

    if (document.activeElement === input) onFocus();

    return () => {
      input.removeEventListener("focus", onFocus);
      input.removeEventListener("blur", onBlur);
      input.removeEventListener("input", update);
      input.removeEventListener("scroll", update);
      input.removeEventListener("compositionstart", onCompositionStart);
      input.removeEventListener("compositionend", onCompositionEnd);
      document.removeEventListener("selectionchange", onSelectionChange);
      resizeObserver.disconnect();
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
      input.style.caretColor = "";
    };
  }, [isTextLike]);

  // Anything without a caret offset is rendered exactly as before, with no
  // wrapper and no overlay, so email fields, date pickers and steppers keep
  // their native behaviour.
  if (!isTextLike) {
    return <input className={className} style={style} type={type} {...props} />;
  }

  return (
    <span className="relative block w-full min-w-0 flex-1">
      <input className={className} ref={inputRef} style={style} type={type} {...props} />

      {/* Off-screen ruler used to measure the text before the caret. */}
      <span
        aria-hidden="true"
        className="pointer-events-none invisible absolute left-0 top-0 whitespace-pre"
        ref={measureRef}
      />

      {/* The caret itself. Decorative: the real one is only hidden visually. */}
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute left-0 top-1/2 h-[1.05em] w-0.5 -translate-y-1/2 rounded-full",
          "bg-foreground opacity-0 will-change-transform",
        )}
        ref={caretRef}
      />
    </span>
  );
}
