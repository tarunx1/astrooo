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
/** Where in the frame a shape gathers. */
export type StarFieldAlign = "left" | "center" | "right";

export type StarFieldCanvasProps = {
  /** Image to gather into. Null means open sky. */
  source?: string | null;
  align?: StarFieldAlign;
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
/** How far off centre an aligned shape sits, as a fraction of visible width. */
const FORMATION_SHIFT = 0.24;
/**
 * Below this the viewport is too narrow to hold a shape beside anything, so an
 * aligned formation is centred instead of being pushed half off screen.
 */
const ALIGN_MIN_WIDTH = 768;
const MORPH_SPEED = 0.95;

/**
 * Size of a particle that is drawing the sign, relative to a free star.
 *
 * Finer than the surrounding sky on purpose: at full size the stroke reads as a
 * thick painted line, where the point of this is a figure picked out in stars.
 */
const SHAPE_PARTICLE_SCALE = 0.42;

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

/**
 * Horizontal offset in world units for an aligned formation.
 *
 * Derived from the visible width for the same reason the size is: a fixed
 * offset that clears the copy on a desktop pushes the shape off the side of a
 * laptop. Below a certain width there is no room to sit a shape beside
 * anything, so an aligned formation is centred rather than half off screen.
 */
function formationOffsetForViewport(align: StarFieldAlign): { x: number; y: number } {
  if (typeof window === "undefined") return { x: 0, y: 0 };

  const visibleHeight = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
  const visibleWidth = visibleHeight * (window.innerWidth / window.innerHeight);

  // A narrow viewport has no room to sit a shape beside anything, so it moves
  // up instead of sideways and the copy goes underneath it. Pushing it half off
  // the side would be worse than not moving it at all.
  if (window.innerWidth < ALIGN_MIN_WIDTH) {
    return { x: 0, y: align === "center" ? 0 : visibleHeight * 0.17 };
  }

  if (align === "center") return { x: 0, y: 0 };

  const shift = visibleWidth * FORMATION_SHIFT;
  return { x: align === "left" ? -shift : shift, y: 0 };
}

/**
 * Star colours, by share of the sky.
 *
 * Real stars are coloured by temperature: the hot ones burn blue-white and the
 * cool ones amber through orange. Most of the sky stays white so the tinted
 * ones read as accents rather than confetti, and the golden is the brand's own
 * premium gold lifted to starlight rather than an arbitrary yellow.
 *
 * Cumulative thresholds, so the list stays readable as the mix is tuned.
 */
const STAR_COLORS: ReadonlyArray<readonly [number, readonly [number, number, number]]> = [
  [0.56, [1, 1, 1]], // white
  [0.73, [0.31, 0.46, 0.98]], // royal blue (#4169e1, lifted to starlight)
  [0.88, [1, 0.83, 0.49]], // golden, from --premium #d6b56d
  [1, [1, 0.58, 0.29]], // orange
];

function starColor(target: Color, random: () => number): Color {
  const variant = random();

  for (const [threshold, rgb] of STAR_COLORS) {
    if (variant <= threshold) return target.setRGB(rgb[0], rgb[1], rgb[2]);
  }

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
  /** How many leading particles belong to the current shape. */
  uShapeCount: { value: 0 },
  /** Eased 0 to 1, so the size change travels with the morph rather than snapping. */
  uShapeStrength: { value: 0 },
  uShapeSize: { value: SHAPE_PARTICLE_SCALE },
};

const vertexShader = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  attribute float aSparkle;
  attribute float aIndex;
  attribute float aRate;

  varying vec3 vColor;
  varying float vTwinkle;
  varying float vSparkle;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uShapeCount;
  uniform float uShapeStrength;
  uniform float uShapeSize;

  void main() {
    vColor = color;
    vSparkle = aSparkle;

    // Each star keeps its own rate as well as its own phase. A single shared
    // rate makes the whole sky pulse in lockstep, which reads as a flicker
    // rather than as stars.
    float pulse = sin(uTime * aRate + aPhase);

    // Brightness swings further than size: that is what the eye reads as
    // twinkling. Size follows more gently, so stars breathe rather than throb.
    vTwinkle = 0.28 + 0.72 * (pulse * 0.5 + 0.5);
    float sizePulse = 0.55 + 0.45 * (pulse * 0.5 + 0.5);

    vec4 viewPosition = viewMatrix * modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewPosition;

    // The leading slice of particles is the one that draws the sign. Those are
    // rendered finer than the free stars around them, eased in with the morph.
    float inShape = step(aIndex + 0.5, uShapeCount);
    float scale = mix(1.0, uShapeSize, inShape * uShapeStrength);

    // The clamp is applied to the resting size and the pulse multiplies what
    // comes out of it. Clamping the pulsed value instead pinned every near or
    // bright star to the ceiling, where the animation had nothing left to move
    // - which is exactly why the sky looked frozen.
    float perspective = 190.0 / max(9.0, -viewPosition.z);
    float restingSize = clamp(aSize * scale * uPixelRatio * perspective, 1.0, 24.0);

    gl_PointSize = max(0.9, restingSize * sizePulse);
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
    // A wide, barely-shaded centre keeps even a three-pixel sprite crisp; the
    // halo decays fast so it reads as glow around a point rather than fog.
    float core = pow(clamp(1.0 - distanceToCentre / 0.24, 0.0, 1.0), 1.5);
    float halo = pow(clamp(1.0 - distanceToCentre / 0.5, 0.0, 1.0), 3.6);

    // Four-point diffraction spikes on the brightest stars only. This is the
    // detail that makes a point of light look like it is sparkling, and the
    // reason the sprite is not clipped to a circle: the spikes need the corners.
    float spike = 0.0;
    if (vSparkle > 0.5) {
      float horizontal = exp(-abs(offset.y) * 64.0) * exp(-abs(offset.x) * 5.0);
      float vertical = exp(-abs(offset.x) * 64.0) * exp(-abs(offset.y) * 5.0);
      // Spikes flare with the pulse, which is what catches the eye as a sparkle.
      spike = (horizontal + vertical) * 0.75 * vTwinkle;
    }

    // Clamp the resting profile, then let the twinkle scale it. Multiplying
    // first and clamping afterwards held the core at full opacity through most
    // of the cycle, so the star never visibly dimmed.
    float profile = clamp(core * 1.0 + halo * 0.3 + spike, 0.0, 1.0);
    float intensity = profile * uOpacity * vTwinkle;
    if (intensity < 0.01) discard;

    // Pushing the centre toward white is what gives it the burning look.
    // Scale the star's own colour rather than adding white to it. Adding a
    // flat amount drained the hue at the centre, which is where most of a
    // small star's pixels are, so every star looked white whatever its colour.
    gl_FragColor = vec4(vColor * (1.0 + core * 0.95 * vTwinkle), intensity);
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
  const indices = new Float32Array(count);
  const rates = new Float32Array(count);

  const shapeSlice = Math.floor(count * SHAPE_SHARE);

  for (let i = 0; i < count; i += 1) {
    // Particles in the leading slice are the ones that will draw a sign. They
    // sparkle far more often than the open sky does: they are rendered small,
    // so without spikes the glyph reads as a dull band of dust rather than a
    // figure picked out in stars. The open sky keeps its sparse handful, since
    // giving every background star spikes would turn it into glitter.
    const bright = i < shapeSlice ? Math.random() > 0.62 : Math.random() > 0.94;

    sizes[i] = bright ? 2.8 + Math.random() * 2.2 : 0.65 + Math.random() * 1.25;
    phases[i] = Math.random() * Math.PI * 2;
    sparkles[i] = bright ? 1 : 0;
    indices[i] = i;
    // Spread over roughly a 4x range, so some stars flare quickly while others
    // take several seconds to come round.
    rates[i] = 0.55 + Math.random() * 1.85;
  }

  geometry.setAttribute("position", new BufferAttribute(new Float32Array(initial.positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(initial.colors), 3));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new BufferAttribute(phases, 1));
  geometry.setAttribute("aSparkle", new BufferAttribute(sparkles, 1));
  geometry.setAttribute("aIndex", new BufferAttribute(indices, 1));
  geometry.setAttribute("aRate", new BufferAttribute(rates, 1));

  return initial;
}

function MorphingStars({
  source,
  align = "center",
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
  // 1 while a sign is held, 0 for open sky. Eased in the frame loop so the
  // particles change size over the same span as they change position.
  const shapeStrength = useRef(0);

  const { invalidate, gl } = useThree();

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

    // gl_PointSize is in physical pixels, so without this every star rendered
    // at half size on a retina display. It was left at 1 and never assigned.
    if (materialRef.current) {
      materialRef.current.uniforms.uPixelRatio.value = gl.getPixelRatio();
    }

    invalidate();

    return () => {
      geometry.dispose();
      countRef.current = 0;
    };
  }, [invalidate, gl]);

  // Resolve the requested shape into targets. The particles themselves are
  // untouched here; the frame loop walks them across.
  useEffect(() => {
    let cancelled = false;

    const driftToOpenSky = (count: number) => {
      const open = createStarfieldTargets(count);
      targetPositions.current = open.positions;
      targetColors.current = open.colors;
      shapeStrength.current = 0;
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
        const offset = formationOffsetForViewport(align);
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
          open.positions[i * 3] = sampled.positions[i * 3] * scale + offset.x;
          open.positions[i * 3 + 1] = sampled.positions[i * 3 + 1] * scale + offset.y;
          // A little depth so the shape reads as made of stars, not printed.
          open.positions[i * 3 + 2] = (Math.random() - 0.5) * FORMATION_DEPTH;

          open.colors[i * 3] = sampled.colors[i * 3];
          open.colors[i * 3 + 1] = sampled.colors[i * 3 + 1];
          open.colors[i * 3 + 2] = sampled.colors[i * 3 + 2];
        }

        targetPositions.current = open.positions;
        targetColors.current = open.colors;

        if (materialRef.current) {
          materialRef.current.uniforms.uShapeCount.value = shaped;
        }
        shapeStrength.current = 1;
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
  }, [source, align, maskMode, threshold, invertMask, useImageColors, onImageError, invalidate]);

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

      const strength = material.uniforms.uShapeStrength;
      strength.value += (shapeStrength.current - strength.value) * damping;
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
        dpr={[1, 2]}
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
