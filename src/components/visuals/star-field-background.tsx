"use client";

import dynamic from "next/dynamic";

/**
 * Client-only mount for the 3D star field.
 *
 * WebGL cannot render on the server, and `three` is a large dependency, so the
 * canvas is loaded with `ssr: false` and no loading placeholder. The page paints
 * and is fully usable before this arrives; if WebGL is unavailable the site
 * simply keeps the existing CSS background.
 */
const StarFieldCanvas = dynamic(() => import("@/components/visuals/star-field-canvas"), {
  ssr: false,
  loading: () => null,
});

export function StarFieldBackground() {
  return <StarFieldCanvas />;
}
