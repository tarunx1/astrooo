"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

/**
 * Client-only mount for the 3D star field.
 *
 * WebGL cannot render on the server and `three` is a large dependency, so the
 * canvas is code-split with `ssr: false` and no loading placeholder. The page
 * paints and is fully usable before it arrives.
 *
 * The import is also gated on `prefers-reduced-motion`. The canvas already
 * stops animating for those visitors, but stopping the animation still costs
 * them the whole WebGL bundle for a static backdrop. Deciding before the import
 * means the chunk is never requested at all, and the existing CSS `.star-field`
 * background — which is what the rest of the site already uses — shows through
 * unchanged. Visitors who have not asked for reduced motion see exactly what
 * they saw before.
 */
const StarFieldCanvas = dynamic(() => import("@/components/visuals/star-field-canvas"), {
  ssr: false,
  loading: () => null,
});

export function StarFieldBackground() {
  // Undefined until the preference is known, so nothing is requested during the
  // first client render and the decision is never made on a guess.
  const [animate, setAnimate] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setAnimate(!query.matches);

    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  if (!animate) return null;

  return <StarFieldCanvas />;
}
