"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

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
  setSource: (source: string | null) => void;
};

const StarFieldSourceContext = createContext<StarFieldSourceValue | null>(null);

export function StarFieldProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<string | null>(null);
  const value = useMemo(() => ({ source, setSource }), [source]);

  return <StarFieldSourceContext.Provider value={value}>{children}</StarFieldSourceContext.Provider>;
}

export function useStarFieldSource(): StarFieldSourceValue {
  const context = useContext(StarFieldSourceContext);
  // Null rather than throwing: the star field is decorative, and a subtree
  // rendered outside the provider should still render its own content.
  return context ?? { source: null, setSource: () => {} };
}

/**
 * Declares the shape for the page that renders it.
 *
 * Renders nothing. On unmount it releases the shape, so leaving the page lets
 * the stars drift back to open sky without that page having to remember to
 * clean up.
 */
export function StarFieldSource({ source }: { source: string | null }) {
  const { setSource } = useStarFieldSource();

  const release = useCallback(() => setSource(null), [setSource]);

  useEffect(() => {
    setSource(source);
    return release;
  }, [source, setSource, release]);

  return null;
}
