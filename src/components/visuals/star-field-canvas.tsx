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
import {
  formationOffsetForViewport,
  formationScaleForViewport,
  type StarFieldAlign,
  visibleExtent,
} from "@/lib/star-image/formation";

export type { StarFieldAlign };

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

/**
 * How quickly stars gather into a sign, and how slowly they let go of it.
 *
 * The two are deliberately different, and both are slow enough to watch.
 * Gathering settles in a little under two seconds; releasing takes about two
 * and a half, so the sky drifts back to open rather than snapping off.
 *
 * These are rates of an exponential approach, so the figure quoted is where
 * the journey is about 95% done - the last few percent arrive after it, which
 * is why the release is set below three seconds rather than at it.
 */
const MORPH_IN_SPEED = 1.7;
const MORPH_OUT_SPEED = 1.15;

/**
 * Size of a particle that is drawing the sign, relative to a free star.
 *
 * A balance between two things that pull against each other. Larger points
 * make a formed sign read like a cluster of real stars - dust mixed with
 * bright anchors - rather than a thin dotted logo. But the sign is now sized
 * to sit beside a section rather than fill the screen, and at close to full
 * size fifteen hundred glowing points in that smaller area merge into one
 * bright smear with no figure left in it.
 *
 * This is the largest that still leaves the glyph legible at the size it is
 * actually drawn. Raising it means giving the sign more room to be drawn in.
 */
const SHAPE_PARTICLE_SCALE = 0.5;

/**
 * How much of the sky gathers into a shape.
 *
 * Kept deliberately sparse. Too many particles packed into the glyph makes a
 * fuzzy solid rope; fewer, larger points read as individual stars.
 */
const SHAPE_SHARE = 0.19;

/** Slow, continuous rotation for the formed zodiac glyph, in radians/second. */
const FORMATION_ROTATION_SPEED = 0.035;

/** Radius of the cursor's pull through the star field's world coordinates. */
const POINTER_DISTORTION_RADIUS = 0.95;

/** How far particles are carried by the cursor's recent movement. */
const POINTER_DRAG_STRENGTH = 0.9;

/**
 * Distortion deliberately heals slower than the sign forms, so the cursor
 * leaves a visible pull that gradually settles back into the glyph.
 */
const DISTORTION_RETURN_SPEED = 2.4;

/** How fast a star catches the cursor while it is actively being pulled. */
const DISTORTION_CATCH_SPEED = 8;

/** How quickly the cursor's drag trail fades after movement stops. */
const POINTER_DRAG_DECAY = 5.2;

/** How long a dragged particle holds its displaced point before returning. */
const DISTORTION_HOLD_SECONDS = 0.18;

/** Chosen once at mount. Rebuilding the scene on resize would be far worse. */
function particleCountForViewport(): number {
  if (typeof window === "undefined") return 6000;
  const width = window.innerWidth;
  if (width <= 480) return 4000;
  if (width <= 1024) return 6000;
  return 8000;
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
    float restingSize = clamp(aSize * scale * uPixelRatio * perspective, 1.0, 36.0);

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
  const dragWeights = new Float32Array(count);
  const dragReturns = new Float32Array(count);
  const dragPhases = new Float32Array(count);

  const shapeSlice = Math.floor(count * SHAPE_SHARE);

  for (let i = 0; i < count; i += 1) {
    // Particles in the leading slice are the ones that will draw a sign. The
    // distribution is intentionally sparse and uneven: dust around the path,
    // clear mid-size beads, and a few bright anchors with glow. That keeps the
    // zodiac from becoming a dense fuzzy outline.
    const shapeParticle = i < shapeSlice;
    const variant = Math.random();
    const bright = shapeParticle ? variant > 0.8 : variant > 0.94;

    if (shapeParticle) {
      sizes[i] = variant > 0.985
        ? 10 + Math.random() * 5
        : variant > 0.8
          ? 4.5 + Math.random() * 3.6
          : variant > 0.52
            ? 1.55 + Math.random() * 1.9
            : 0.45 + Math.random() * 0.95;
    } else {
      sizes[i] = bright ? 2.8 + Math.random() * 2.2 : 0.65 + Math.random() * 1.25;
    }
    phases[i] = Math.random() * Math.PI * 2;
    sparkles[i] = bright ? 1 : 0;
    indices[i] = i;
    // Spread over roughly a 4x range, so some stars flare quickly while others
    // take several seconds to come round.
    rates[i] = 0.55 + Math.random() * 1.85;

    // Cursor movement should feel particulate, not elastic. Every formed-sign
    // particle can be picked up when the cursor passes directly over it, but
    // each one follows with a different weight so the path still breaks apart
    // like separate stars instead of bending as one surface.
    dragWeights[i] = i < shapeSlice ? 0.32 + Math.random() * 0.85 : 0;
    dragReturns[i] = 0.28 + Math.random() * 0.72;
    dragPhases[i] = Math.random() * Math.PI * 2;
  }

  geometry.setAttribute("position", new BufferAttribute(new Float32Array(initial.positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(initial.colors), 3));
  geometry.setAttribute("aSize", new BufferAttribute(sizes, 1));
  geometry.setAttribute("aPhase", new BufferAttribute(phases, 1));
  geometry.setAttribute("aSparkle", new BufferAttribute(sparkles, 1));
  geometry.setAttribute("aIndex", new BufferAttribute(indices, 1));
  geometry.setAttribute("aRate", new BufferAttribute(rates, 1));
  geometry.setAttribute("aDragWeight", new BufferAttribute(dragWeights, 1));
  geometry.setAttribute("aDragReturn", new BufferAttribute(dragReturns, 1));
  geometry.setAttribute("aDragPhase", new BufferAttribute(dragPhases, 1));

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
  const shapeCount = useRef(0);
  const shapeCentre = useRef({ x: 0, y: 0 });
  const rotationAngle = useRef(0);
  const distortionHoldUntil = useRef<Float32Array | null>(null);
  const heldDistortionOffsets = useRef<Float32Array | null>(null);
  // Where the sky sits when it is holding nothing. Generated once and returned
  // to, rather than rolled fresh each time: a new random layout on every change
  // meant every star in the field travelled somewhere, including on the very
  // first render and including the ones that had no part in the shape.
  const homePositions = useRef<Float32Array | null>(null);
  const homeColors = useRef<Float32Array | null>(null);
  const pointer = useRef({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
    dragX: 0,
    dragY: 0,
    lastTargetWorldX: 0,
    lastTargetWorldY: 0,
    hasTarget: false,
  });
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
    homePositions.current = initial.positions;
    homeColors.current = initial.colors;
    distortionHoldUntil.current = new Float32Array(count);
    heldDistortionOffsets.current = new Float32Array(count * 3);
    // The geometry was filled from these same values, so nothing has anywhere
    // to travel to on the first frame.
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

    const driftToOpenSky = () => {
      // Only the particles that were drawing the shape have moved, so only they
      // have a journey home. The rest of the sky is already there.
      targetPositions.current = homePositions.current;
      targetColors.current = homeColors.current;
      shapeCount.current = 0;
      shapeStrength.current = 0;
      rotationAngle.current = 0;
      shapeCentre.current = { x: 0, y: 0 };
      if (materialRef.current) {
        materialRef.current.uniforms.uShapeCount.value = 0;
      }
      invalidate();
    };

    async function resolveTargets() {
      const count = countRef.current;
      if (count === 0) return;

      if (!source) {
        driftToOpenSky();
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

        // Start from the sky's resting layout and overwrite only the leading
        // slice with the shape, so every other star keeps the position it
        // already holds and never moves at all.
        const home = homePositions.current;
        const homeColour = homeColors.current;
        if (!home || !homeColour) return;

        const open = {
          positions: new Float32Array(home),
          colors: new Float32Array(homeColour),
        };

        for (let i = 0; i < shaped; i += 1) {
          open.positions[i * 3] = sampled.positions[i * 3] * scale + offset.x;
          open.positions[i * 3 + 1] = sampled.positions[i * 3 + 1] * scale + offset.y;
          // A little depth so the shape reads as made of stars, not printed.
          open.positions[i * 3 + 2] = (Math.random() - 0.5) * FORMATION_DEPTH;

          // Keep the colour each particle already had as a free star, so the
          // figure is picked out in the same blues, golds and oranges as the
          // sky around it. Overwriting with the sampler's flat starlight is
          // what made every formed sign a uniform white cutout. Only an
          // explicit request for the image's own colours overrides that.
          if (useImageColors) {
            open.colors[i * 3] = sampled.colors[i * 3];
            open.colors[i * 3 + 1] = sampled.colors[i * 3 + 1];
            open.colors[i * 3 + 2] = sampled.colors[i * 3 + 2];
          }
        }

        targetPositions.current = open.positions;
        targetColors.current = open.colors;
        shapeCount.current = shaped;
        shapeCentre.current = offset;

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
        driftToOpenSky();
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
      const nextX = (event.clientX / window.innerWidth - 0.5) * 2;
      const nextY = (event.clientY / window.innerHeight - 0.5) * 2;
      const extent = visibleExtent();
      const nextWorldX = nextX * extent.width * 0.5;
      const nextWorldY = -nextY * extent.height * 0.5;

      if (current.hasTarget) {
        const deltaX = nextWorldX - current.lastTargetWorldX;
        const deltaY = nextWorldY - current.lastTargetWorldY;
        const distance = Math.hypot(deltaX, deltaY);
        const capped = distance > 0.001 ? Math.min(distance, 1.2) / distance : 0;

        current.dragX += deltaX * capped * POINTER_DRAG_STRENGTH;
        current.dragY += deltaY * capped * POINTER_DRAG_STRENGTH;
      }

      current.targetX = nextX;
      current.targetY = nextY;
      current.lastTargetWorldX = nextWorldX;
      current.lastTargetWorldY = nextWorldY;
      current.hasTarget = true;
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
    const dragWeightAttribute = geometry.getAttribute("aDragWeight") as BufferAttribute | undefined;
    const dragReturnAttribute = geometry.getAttribute("aDragReturn") as BufferAttribute | undefined;
    const dragPhaseAttribute = geometry.getAttribute("aDragPhase") as BufferAttribute | undefined;
    const nextPositions = targetPositions.current;
    const nextColors = targetColors.current;
    const holdUntil = distortionHoldUntil.current;
    const heldOffsets = heldDistortionOffsets.current;

    if (
      positionAttribute
      && colorAttribute
      && dragWeightAttribute
      && dragReturnAttribute
      && dragPhaseAttribute
      && nextPositions
      && nextColors
      && holdUntil
      && heldOffsets
    ) {
      const positions = positionAttribute.array as Float32Array;
      const colors = colorAttribute.array as Float32Array;
      const dragWeights = dragWeightAttribute.array as Float32Array;
      const dragReturns = dragReturnAttribute.array as Float32Array;
      const dragPhases = dragPhaseAttribute.array as Float32Array;

      // Frame-rate independent: the same journey takes the same time on a
      // 60Hz and a 144Hz display. Clamped so a long stall - a background tab
      // returning, say - resolves in one step instead of overshooting.
      const clampedDelta = Math.min(delta, 0.05);
      const strength = material.uniforms.uShapeStrength;
      const morphSpeed = shapeStrength.current > strength.value ? MORPH_IN_SPEED : MORPH_OUT_SPEED;
      const morphDamping = reduceMotion ? 1 : 1 - Math.exp(-morphSpeed * clampedDelta);
      const activeShapeCount = shapeCount.current;
      const formedStrength = strength.value;
      const shouldDistort = !reduceMotion && activeShapeCount > 0 && formedStrength > 0.05;
      const centre = shapeCentre.current;
      const pointerState = pointer.current;
      const extent = visibleExtent();
      const pointerWorldX = pointerState.targetX * extent.width * 0.5;
      const pointerWorldY = -pointerState.targetY * extent.height * 0.5;
      const dragX = pointerState.dragX;
      const dragY = pointerState.dragY;
      const dragAmount = Math.hypot(dragX, dragY);
      const influenceRadius = POINTER_DISTORTION_RADIUS;
      const influenceRadiusSq = influenceRadius * influenceRadius;
      const angle = rotationAngle.current;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      const now = state.clock.elapsedTime;

      for (let i = 0; i < countRef.current; i += 1) {
        const index = i * 3;
        let targetX = nextPositions[index];
        let targetY = nextPositions[index + 1];
        let targetZ = nextPositions[index + 2];
        const inShape = i < activeShapeCount;
        let activelyPulled = false;

        if (inShape) {
          let distortionOffsetX = 0;
          let distortionOffsetY = 0;
          let distortionOffsetZ = 0;

          // About the vertical axis: the glyph swivels like a sign hanging in
          // space, its width foreshortening as it turns. Rotating in the XY
          // plane instead would spin it flat like a clock hand, which reads as
          // the drawing being turned rather than the figure standing in depth.
          // The shape is laid out on the z = 0 plane with only a little depth
          // scatter, so the axis it turns about passes through z = 0.
          const localX = targetX - centre.x;
          targetX = localX * cos + targetZ * sin + centre.x;
          targetZ = -localX * sin + targetZ * cos;

          const dragWeight = dragWeights[i];
          if (shouldDistort && dragWeight > 0 && dragAmount > 0.01) {
            const fromPointerX = targetX - pointerWorldX;
            const fromPointerY = targetY - pointerWorldY;
            const distanceSq = fromPointerX * fromPointerX + fromPointerY * fromPointerY;

            if (distanceSq < influenceRadiusSq) {
              const distance = Math.sqrt(distanceSq);
              const falloff = 1 - distance / influenceRadius;
              const uneven = 0.68 + 0.32 * Math.sin(state.clock.elapsedTime * 1.7 + dragPhases[i]);
              const carried = falloff * falloff * formedStrength * dragWeight * uneven;
              const swirl = carried * (0.1 + dragWeight * 0.14);

              distortionOffsetX = dragX * carried - dragY * swirl;
              distortionOffsetY = dragY * carried + dragX * swirl;
              distortionOffsetZ = carried * (0.18 + dragWeight * 0.34);
              heldOffsets[index] = distortionOffsetX;
              heldOffsets[index + 1] = distortionOffsetY;
              heldOffsets[index + 2] = distortionOffsetZ;
              holdUntil[i] = now + DISTORTION_HOLD_SECONDS * (0.75 + dragWeight * 0.75);
              activelyPulled = true;
            }
          }

          if (holdUntil[i] > now) {
            distortionOffsetX = heldOffsets[index];
            distortionOffsetY = heldOffsets[index + 1];
            distortionOffsetZ = heldOffsets[index + 2];
          } else {
            heldOffsets[index] += (0 - heldOffsets[index]) * (1 - Math.exp(-dragReturns[i] * clampedDelta));
            heldOffsets[index + 1] += (0 - heldOffsets[index + 1]) * (1 - Math.exp(-dragReturns[i] * clampedDelta));
            heldOffsets[index + 2] += (0 - heldOffsets[index + 2]) * (1 - Math.exp(-dragReturns[i] * clampedDelta));
            distortionOffsetX = heldOffsets[index];
            distortionOffsetY = heldOffsets[index + 1];
            distortionOffsetZ = heldOffsets[index + 2];
          }

          targetX += distortionOffsetX;
          targetY += distortionOffsetY;
          targetZ += distortionOffsetZ;
        }

        const hasHeldDistortion = inShape && (
          holdUntil[i] > now
          || Math.abs(heldOffsets[index]) > 0.001
          || Math.abs(heldOffsets[index + 1]) > 0.001
          || Math.abs(heldOffsets[index + 2]) > 0.001
        );
        // Each star finds its own way back, but all of them do. Taking the
        // slower of the two rates put the return between two and four seconds
        // per star, and with the brief hold on top of it a sign that had been
        // swept through never visibly reassembled - it just stayed scattered.
        const returnSpeed = activelyPulled
          ? DISTORTION_CATCH_SPEED
          : DISTORTION_RETURN_SPEED * (0.7 + 0.3 * dragReturns[i]);
        const positionDamping = hasHeldDistortion ? 1 - Math.exp(-returnSpeed * clampedDelta) : morphDamping;
        positions[index] += (targetX - positions[index]) * positionDamping;
        positions[index + 1] += (targetY - positions[index + 1]) * positionDamping;
        positions[index + 2] += (targetZ - positions[index + 2]) * positionDamping;
        colors[index] += (nextColors[index] - colors[index]) * morphDamping;
        colors[index + 1] += (nextColors[index + 1] - colors[index + 1]) * morphDamping;
        colors[index + 2] += (nextColors[index + 2] - colors[index + 2]) * morphDamping;
      }

      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;

      strength.value += (shapeStrength.current - strength.value) * morphDamping;
    }

    if (reduceMotion) return;

    material.uniforms.uTime.value = state.clock.elapsedTime;
    if (shapeCount.current > 0) {
      rotationAngle.current += delta * FORMATION_ROTATION_SPEED;
    }

    const current = pointer.current;
    current.x += (current.targetX - current.x) * 0.025;
    current.y += (current.targetY - current.y) * 0.025;
    const dragDecay = Math.exp(-POINTER_DRAG_DECAY * Math.min(delta, 0.05));
    current.dragX *= dragDecay;
    current.dragY *= dragDecay;
    state.camera.position.x = current.x * 0.45;
    state.camera.position.y = -current.y * 0.28;
    state.camera.lookAt(0, 0, 0);

    // Turned about the vertical axis only. Tilting on x as well rocked the
    // whole sky, which on a formed sign reads as the glyph leaning rather than
    // as the field slowly turning past.
    points.rotation.y = Math.sin(state.clock.elapsedTime * 0.06) * 0.05;
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
