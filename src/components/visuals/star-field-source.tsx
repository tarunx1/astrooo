"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { StarFieldAlign } from "@/components/visuals/star-field-canvas";

/**
 * Lets a page choose what the shared star field forms.
 *
 * The canvas lives in the root layout so that navigating between pages morphs
 * one continuous sky rather than tearing down WebGL and building it again. That
 * means a page cannot pass the shape down as a prop, so it declares it here
 * instead and the background reads it.
 *
 * A page that says nothing leaves the sky open, which is the behaviour every
 * existing page had before shapes existed.
 */
type StarFieldSourceValue = {
  source: string | null;
  /** Human name of the current shape, for UI that wants to caption it. */
  label: string | null;
  /** Which side of the frame the shape gathers on, so copy can sit opposite. */
  align: StarFieldAlign;
  setShape: (shape: { source: string | null; label?: string | null; align?: StarFieldAlign }) => void;
};

const StarFieldSourceContext = createContext<StarFieldSourceValue | null>(null);

export function StarFieldProvider({ children }: { children: ReactNode }) {
  const [shape, setShapeState] = useState<{
    source: string | null;
    label: string | null;
    align: StarFieldAlign;
  }>({ source: null, label: null, align: "center" });

  // The setter must keep a stable identity. Consumers depend on it in effects
  // whose cleanup releases the shape, so a setter that changed on every update
  // would tear those effects down and clear the shape immediately after it was
  // set - which is exactly what happened before this was memoised.
  const setShape = useCallback(
    (next: { source: string | null; label?: string | null; align?: StarFieldAlign }) => {
      setShapeState({
        source: next.source,
        label: next.label ?? null,
        align: next.align ?? "center",
      });
    },
    [],
  );

  const value = useMemo(
    () => ({ source: shape.source, label: shape.label, align: shape.align, setShape }),
    [shape, setShape],
  );

  return <StarFieldSourceContext.Provider value={value}>{children}</StarFieldSourceContext.Provider>;
}

export function useStarFieldSource(): StarFieldSourceValue {
  const context = useContext(StarFieldSourceContext);
  // Null rather than throwing: the star field is decorative, and a subtree
  // rendered outside the provider should still render its own content.
  return context ?? { source: null, label: null, align: "center" as StarFieldAlign, setShape: () => {} };
}

/**
 * Declares the shape for the page that renders it.
 *
 * Renders nothing. On unmount it releases the shape, so leaving the page lets
 * the stars drift back to open sky without that page having to remember to
 * clean up.
 */
export function StarFieldSource({
  source,
  label,
  align = "center",
}: {
  source: string | null;
  label?: string | null;
  align?: StarFieldAlign;
}) {
  const { setShape } = useStarFieldSource();

  const release = useCallback(() => setShape({ source: null }), [setShape]);

  useEffect(() => {
    setShape({ source, label, align });
    return release;
  }, [source, label, align, setShape, release]);

  return null;
}
