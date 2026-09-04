"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import type { Points } from "three";

/**
 * Ambient 3D star field.
 *
 * A fixed, non-interactive layer that sits behind every page. It renders at
 * `z-index: -1`: because `html` carries no background, the body's gradient is
 * propagated to the viewport backdrop and painted below this canvas, so the
 * stars appear over the gradient and under all content without any change to
 * existing styles or stacking.
 *
 * Nothing on the page can be blocked by it — `pointer-events: none` means every
 * click, hover and focus passes straight through.
 */
function SlowlyRotating({ reduceMotion }: { reduceMotion: boolean }) {
  const group = useRef<Points>(null);

  useFrame((_, delta) => {
    if (reduceMotion || !group.current) return;
    // Deliberately slow: a full turn takes many minutes, so the sky drifts
    // rather than spins and never competes with the content for attention.
    group.current.rotation.y += delta * 0.008;
    group.current.rotation.x += delta * 0.003;
  });

  return (
    <Stars
      ref={group}
      count={2200}
      depth={55}
      factor={3.4}
      fade
      radius={120}
      saturation={0}
      speed={0}
    />
  );
}

export default function StarFieldCanvas() {
  const [reduceMotion, setReduceMotion] = useState(true);

  // Start still and only animate once we know the visitor has not asked for
  // reduced motion, rather than animating first and correcting afterwards.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(query.matches);

    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      // Decorative only: hidden from assistive technology and inert to input.
      role="presentation"
    >
      <Canvas
        camera={{ position: [0, 0, 1], fov: 70 }}
        // Capped device pixel ratio keeps this cheap on high-density displays.
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        // The canvas is purely decorative; it must never trap focus.
        tabIndex={-1}
      >
        <SlowlyRotating reduceMotion={reduceMotion} />
      </Canvas>
    </div>
  );
}
