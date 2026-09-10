"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useStarFieldSource } from "@/components/visuals/star-field-source";

/**
 * Client-only mount for the 3D star field.
 *
 * WebGL cannot render on the server and `three` is a large dependency, so the
 * canvas is code-split with `ssr: false` and no loading placeholder. The page
 * paints and is fully usable before it arrives.
 *
 * The import is also gated on `prefers-reduced-motion`. Deciding before the
 * import means the WebGL bundle is never requested for those visitors at all,
 * and the existing CSS `.star-field` background - which the rest of the site
 * already uses - shows through unchanged. Visitors who have not asked for
 * reduced motion see exactly what they saw before.
 */
const StarFieldCanvas = dynamic(() => import("@/components/visuals/star-field-canvas"), {
  ssr: false,
  loading: () => null,
});

export function StarFieldBackground() {
  // Undefined until the preference is known, so nothing is requested during the
  // first client render and the decision is never made on a guess.
  const [animate, setAnimate] = useState<boolean | undefined>(undefined);
  const { source, align } = useStarFieldSource();

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAnimate(!query.matches);

    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  /**
   * Tells the document the real sky is up.
   *
   * `.star-field` paints an opaque background with a dot pattern, which is the
   * whole star field for a reduced-motion visitor and is exactly right for
   * them. For everyone else it sits on top of the canvas and hides it - which
   * is why the hero, the one section that carries the class, had no stars in
   * it at all while every other section did.
   */
  useEffect(() => {
    if (!animate) return;
    document.documentElement.dataset.starfield = "live";
    return () => {
      delete document.documentElement.dataset.starfield;
    };
  }, [animate]);

  if (!animate) return null;

  return <StarFieldCanvas align={align} maskMode="alpha" source={source} threshold={0.1} />;
}
