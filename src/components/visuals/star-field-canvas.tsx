"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  type ShaderMaterial,
  type Points,
} from "three";
import { sampleImageToParticles } from "@/lib/star-image/sample-image";
import type { ImageMaskMode } from "@/lib/star-image/types";

/**
 * Ambient star field that can gather into a shape.
 *
 * A fixed, non-interactive layer behind every page. It renders at `z-index: -1`:
 * because `html` carries no background, the body's gradient is painted below
 * this canvas, so stars appear over the gradient and under all content without
 * touching existing styles or stacking.
 *
 * Nothing on the page can be blocked by it - `pointer-events: none` means every
 * click, hover and focus passes straight through.
 *
 * One canvas, one geometry, one draw call. When the requested shape changes the
 * same particles are given new targets and drift to them; the scene is never
 * rebuilt, which is what keeps a morph free of flicker and free of leaks.
 */
export type StarFieldCanvasProps = {
  /** Image to gather into. Null means open sky. */
  source?: string | null;
  maskMode?: ImageMaskMode;
  threshold?: number;
  useImageColors?: boolean;
  invertMask?: boolean;
  onImageError?: (error: Error) => void;
};

const SPREAD = 44;
const FORMATION_DEPTH = 0.3;
const CAMERA_Z = 18;
const CAMERA_FOV = 52;
/** Fraction of the shorter visible dimension a formed shape should occupy. */
const FORMATION_FILL = 0.62;
const MORPH_SPEED = 3.2;

/**
 * How much of the sky gathers into a shape.
 *
 * Not all of it, for two reasons. Pouring every particle into a thin glyph
 * stroke produces a dense white mass that drowns the hero copy sitting behind
 * it, and it also empties the sky, so the shape stops looking like a
 * constellation and starts looking like a logo. Keeping most stars where they
 * are lets the figure emerge from the field instead of replacing it.
 */
const SHAPE_SHARE = 0.42;

/** Chosen once at mount. Rebuilding the scene on resize would be far worse. */
function particleCountForViewport(): number {
  if (typeof window === "undefined") return 6000;
  const width = window.innerWidth;
  if (width <= 480) return 4000;
  if (width <= 1024) return 6000;
  return 8000;
}

/**
 * How large a formed shape should be, in world units.
 *
 * Derived from what the camera can actually see rather than fixed, because the
 * visible width collapses on a narrow screen: a constant that frames a glyph
 * nicely on a desktop makes it overflow the viewport on a phone and sit right
 * on top of the copy. Glyph coordinates span -1..1, so the returned value is
 * half the width the shape should end up occupying.
 */
function formationScaleForViewport(): number {
  if (typeof window === "undefined") return 5.4;

  const visibleHeight = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
  const visibleWidth = visibleHeight * (window.innerWidth / window.innerHeight);

  return (Math.min(visibleWidth, visibleHeight) * FORMATION_FILL) / 2;
}

/** Mostly white, with a few blue and amber stars so the sky is not flat. */
function starColor(target: Color, random: () => number): Color {
  const variant = random();
  if (variant < 0.15) return target.setRGB(0.78, 0.86, 1);
  if (variant < 0.3) return target.setRGB(1, 0.9, 0.78);
  return target.setRGB(1, 1, 1);
}

function createStarfieldTargets(count: number) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scratch = new Color();

  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * SPREAD * 1.8;
    positions[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
    positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD * 2.5;

    starColor(scratch, Math.random);
    colors[i * 3] = scratch.r;
    colors[i * 3 + 1] = scratch.g;
    colors[i * 3 + 2] = scratch.b;
  }

  return { positions, colors };
}

const SHADER_UNIFORMS = {
  uTime: { value: 0 },
  uOpacity: { value: 0.95 },
  uPixelRatio: { value: 1 },
};

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aSparkle;

  varying vec3 vColor;
  varying float vTwinkle;
  varying float vSparkle;

  uniform float uTime;
  uniform float uPixelRatio;

  void main() {
    vColor = color;
    vSparkle = aSparkle;

    // A deeper swing than a gentle fade, so the sky visibly breathes.
    float twinkle = 0.68 + sin(uTime * 1.9 + aPhase) * 0.32;
    vTwinkle = twinkle;

    vec4 viewPosition = viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    float perspective = 300.0 / max(1.0, -viewPosition.z);
    gl_PointSize = clamp(aSize * uPixelRatio * perspective * twinkle, 1.5, 14.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec3 vColor;
  varying float vTwinkle;
  varying float vSparkle;

  uniform float uOpacity;

  void main() {
    vec2 offset = gl_PointCoord - vec2(0.5);
    float distanceToCentre = length(offset);

    // A hot core inside a soft halo reads as a light source. A single flat
    // falloff reads as a printed dot, which is what this looked like before.
    float core = pow(clamp(1.0 - distanceToCentre / 0.17, 0.0, 1.0), 2.0);
    float halo = pow(clamp(1.0 - distanceToCentre / 0.5, 0.0, 1.0), 2.5);

    // Four-point diffraction spikes on the brightest stars only. This is the
    // detail that makes a point of light look like it is sparkling, and the
    // reason the sprite is not clipped to a circle: the spikes need the corners.
    float spike = 0.0;
    if (vSparkle > 0.5) {
      float horizontal = exp(-abs(offset.y) * 80.0) * exp(-abs(offset.x) * 6.0);
      float vertical = exp(-abs(offset.x) * 80.0) * exp(-abs(offset.y) * 6.0);
      spike = (horizontal + vertical) * 0.55;
    }

    float intensity = (core + halo * 0.45 + spike) * uOpacity * vTwinkle;
    if (intensity < 0.01) discard;

    // Pushing the centre toward white is what gives it the burning look.
    gl_FragColor = vec4(vColor + core * 1.15, clamp(intensity, 0.0, 1.0));
  }
`;

/**
 * Fills a geometry with a fresh particle system.
 *
 * Kept out of render on purpose: it allocates GPU buffers and uses random
 * numbers, neither of which belongs in a render pass.
 */
function initialiseGeometry(geometry: BufferGeometry, count: number) {
  const initial = createStarfieldTargets(count);

  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const sparkles = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    // A handful of genuinely bright stars carry the spikes. Giving every star
    // them would turn the sky into glitter.
    const bright = Math.random() > 0.94;
    sizes[i] = bright ? 2.6 + Math.random() * 1.8 : 0.9 + Math.random() * 0.9;
    phases[i] = Math.random() * Math.PI * 2;
    sparkles[i] = bright ? 1 : 0;
  }

  geometry.setAttribute("position", new BufferAttribute(new Float32Array(initial.positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(initial.colors), 3));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new BufferAttribute(phases, 1));
  geometry.setAttribute("aSparkle", new BufferAttribute(sparkles, 1));

  return initial;
}

function MorphingStars({
  source,
  maskMode,
  threshold,
  useImageColors,
  invertMask,
  onImageError,
  reduceMotion,
}: StarFieldCanvasProps & { reduceMotion: boolean }) {
  const pointsRef = useRef<Points>(null);
  const geometryRef = useRef<BufferGeometry>(null);
  const materialRef = useRef<ShaderMaterial>(null);

  // Everything the frame loop mutates lives behind a ref. Three objects are
  // mutable by nature, and holding them in state would mean mutating state.
  const countRef = useRef(0);
  const targetPositions = useRef<Float32Array | null>(null);
  const targetColors = useRef<Float32Array | null>(null);
  const pointer = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const { invalidate } = useThree();

  // Chosen once. Rebuilding the scene on every resize would be far worse than
  // running a desktop particle count on a window that was later made narrow.
  useEffect(() => {
    const geometry = geometryRef.current;
    if (!geometry) return;

    const count = particleCountForViewport();
    countRef.current = count;

    const initial = initialiseGeometry(geometry, count);
    targetPositions.current = initial.positions;
    targetColors.current = initial.colors;
    invalidate();

    return () => {
      geometry.dispose();
      countRef.current = 0;
    };
  }, [invalidate]);

  // Resolve the requested shape into targets. The particles themselves are
  // untouched here; the frame loop walks them across.
  useEffect(() => {
    let cancelled = false;

    const driftToOpenSky = (count: number) => {
      const open = createStarfieldTargets(count);
      targetPositions.current = open.positions;
      targetColors.current = open.colors;
      invalidate();
    };

    async function resolveTargets() {
      const count = countRef.current;
      if (count === 0) return;

      if (!source) {
        driftToOpenSky(count);
        return;
      }

      try {
        const shaped = Math.floor(count * SHAPE_SHARE);
        const scale = formationScaleForViewport();
        const sampled = await sampleImageToParticles(source, {
          count: shaped,
          mode: maskMode,
          threshold,
          invertMask,
          useImageColors,
        });
        if (cancelled) return;

        // Start from a fresh sky, then overwrite only the leading slice with the
        // shape. The rest keep drifting as stars behind it.
        const open = createStarfieldTargets(count);

        for (let i = 0; i < shaped; i += 1) {
          open.positions[i * 3] = sampled.positions[i * 3] * scale;
          open.positions[i * 3 + 1] = sampled.positions[i * 3 + 1] * scale;
          // A little depth so the shape reads as made of stars, not printed.
          open.positions[i * 3 + 2] = (Math.random() - 0.5) * FORMATION_DEPTH;

          open.colors[i * 3] = sampled.colors[i * 3];
          open.colors[i * 3 + 1] = sampled.colors[i * 3 + 1];
          open.colors[i * 3 + 2] = sampled.colors[i * 3 + 2];
        }

        targetPositions.current = open.positions;
        targetColors.current = open.colors;
        invalidate();
      } catch (error) {
        if (cancelled) return;

        const normalized = error instanceof Error ? error : new Error("Unknown particle image error.");
        onImageError?.(normalized);

        // Drifting back to open sky is a better failure than a broken shape.
        driftToOpenSky(count);
      }
    }

    void resolveTargets();
    return () => {
      cancelled = true;
    };
  }, [source, maskMode, threshold, invertMask, useImageColors, onImageError, invalidate]);

  useEffect(() => {
    if (reduceMotion) return;

    const onPointerMove = (event: PointerEvent) => {
      const current = pointer.current;
      current.targetX = (event.clientX / window.innerWidth - 0.5) * 2;
      current.targetY = (event.clientY / window.innerHeight - 0.5) * 2;
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [reduceMotion]);

  useFrame((state, delta) => {
    const geometry = geometryRef.current;
    const material = materialRef.current;
    const points = pointsRef.current;
    if (!geometry || !material || !points) return;

    const positionAttribute = geometry.getAttribute("position") as BufferAttribute | undefined;
    const colorAttribute = geometry.getAttribute("color") as BufferAttribute | undefined;
    const nextPositions = targetPositions.current;
    const nextColors = targetColors.current;

    if (positionAttribute && colorAttribute && nextPositions && nextColors) {
      const positions = positionAttribute.array as Float32Array;
      const colors = colorAttribute.array as Float32Array;

      // Frame-rate independent easing: the same journey takes the same time on
      // a 60Hz and a 144Hz display.
      const damping = reduceMotion ? 1 : 1 - Math.exp(-MORPH_SPEED * Math.min(delta, 0.05));

      for (let i = 0; i < positions.length; i += 1) {
        positions[i] += (nextPositions[i] - positions[i]) * damping;
        colors[i] += (nextColors[i] - colors[i]) * damping;
      }

      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
    }

    if (reduceMotion) return;

    material.uniforms.uTime.value = state.clock.elapsedTime;

    const current = pointer.current;
    current.x += (current.targetX - current.x) * 0.025;
    current.y += (current.targetY - current.y) * 0.025;
    state.camera.position.x = current.x * 0.45;
    state.camera.position.y = -current.y * 0.28;
    state.camera.lookAt(0, 0, 0);

    points.rotation.y = Math.sin(state.clock.elapsedTime * 0.06) * 0.018;
    points.rotation.x = Math.sin(state.clock.elapsedTime * 0.045) * 0.01;
  });

  return (
    <points frustumCulled={false} ref={pointsRef}>
      <bufferGeometry ref={geometryRef} />
      <shaderMaterial
        blending={AdditiveBlending}
        depthWrite={false}
        fragmentShader={fragmentShader}
        ref={materialRef}
        transparent
        uniforms={SHADER_UNIFORMS}
        vertexColors
        vertexShader={vertexShader}
      />
    </points>
  );
}

export default function StarFieldCanvas(props: StarFieldCanvasProps) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const [visible, setVisible] = useState(true);

  // Start still and only animate once we know the visitor has not asked for
  // reduced motion, rather than animating first and correcting afterwards.
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduceMotion(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // A backgrounded tab should not be spending the visitor's battery on stars.
  useEffect(() => {
    const apply = () => setVisible(!document.hidden);
    apply();
    document.addEventListener("visibilitychange", apply);
    return () => document.removeEventListener("visibilitychange", apply);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10"
      // Decorative only: hidden from assistive technology and inert to input.
      role="presentation"
    >
      <Canvas
        camera={{ position: [0, 0, 18], fov: 52 }}
        // Capped device pixel ratio keeps this cheap on high-density displays.
        dpr={[1, 1.5]}
        // Reduced motion still needs frames while a shape settles, so the loop
        // is demand-driven rather than stopped outright.
        frameloop={!visible ? "never" : reduceMotion ? "demand" : "always"}
        gl={{ antialias: false, alpha: true, powerPreference: "low-power" }}
        // The canvas is purely decorative; it must never trap focus.
        tabIndex={-1}
      >
        <MorphingStars {...props} reduceMotion={reduceMotion} />
      </Canvas>
    </div>
  );
}
