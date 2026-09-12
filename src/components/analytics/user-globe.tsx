"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import {
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  MeshBasicMaterial,
  Object3D,
  PointsMaterial,
  SphereGeometry,
  type InstancedMesh,
} from "three";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { GeographyMarker } from "@/lib/analytics/geography";
import { useTheme } from "@/components/theme/theme-provider";

export type UserGlobeMarker = GeographyMarker;

export type UserGlobeProps = {
  markers: readonly UserGlobeMarker[];
  autoRotate?: boolean;
  showLabels?: boolean;
  ariaLabel?: string;
};

type GlobePalette = {
  ocean: string;
  land: string;
  atmosphere: string;
  marker: string;
};

type Point = readonly [longitude: number, latitude: number];

// Deliberately low-detail continent silhouettes. They are sampled into one
// WebGL point cloud; no map tiles, textures, tracking SDK or DOM point field is
// involved. The renderer stays generic and receives location markers only.
const LAND_POLYGONS: readonly (readonly Point[])[] = [
  [[-168, 66], [-150, 72], [-124, 72], [-95, 80], [-57, 60], [-52, 47], [-67, 42], [-81, 25], [-97, 16], [-111, 22], [-124, 32], [-130, 50]],
  [[-81, 12], [-70, 11], [-58, 5], [-47, -18], [-54, -36], [-67, -55], [-76, -42], [-80, -10]],
  [[-18, 36], [-9, 50], [6, 58], [30, 71], [59, 70], [88, 78], [128, 53], [151, 59], [161, 45], [142, 31], [121, 20], [105, 7], [78, 8], [60, 24], [43, 12], [34, 31], [17, 40]],
  [[-17, 35], [10, 37], [33, 31], [51, 12], [42, -17], [29, -35], [15, -35], [2, -17], [-8, 7]],
  [[112, -11], [131, -11], [153, -25], [146, -42], [124, -35], [113, -23]],
  [[-54, 60], [-28, 74], [-20, 82], [-52, 84], [-73, 76]],
  [[47, -13], [51, -17], [49, -26], [44, -20]],
  [[95, 5], [106, -7], [119, -8], [132, -4], [142, -9], [129, -11], [111, -9]],
  [[130, 34], [141, 45], [146, 43], [140, 32]],
  [[166, -34], [178, -38], [176, -47], [168, -46]],
];

function pointInPolygon(longitude: number, latitude: number, polygon: readonly Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = yi > latitude !== yj > latitude;
    const boundary = ((xj - xi) * (latitude - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (crosses && longitude < boundary) inside = !inside;
  }
  return inside;
}

function latLngToVector(latitude: number, longitude: number, radius: number) {
  const phi = (latitude * Math.PI) / 180;
  const theta = (longitude * Math.PI) / 180;
  return {
    x: radius * Math.cos(phi) * Math.sin(theta),
    y: radius * Math.sin(phi),
    z: radius * Math.cos(phi) * Math.cos(theta),
  };
}

let landPositionsCache: Float32Array | null = null;

function getLandPositions() {
  if (landPositionsCache) return landPositionsCache;
  const values: number[] = [];
  for (let latitude = -57; latitude <= 82; latitude += 3) {
    const longitudeOffset = Math.abs(Math.round(latitude / 3)) % 2 ? 1.5 : 0;
    for (let longitude = -177; longitude <= 177; longitude += 3) {
      const sampleLongitude = longitude + longitudeOffset;
      if (!LAND_POLYGONS.some((polygon) => pointInPolygon(sampleLongitude, latitude, polygon))) continue;
      const point = latLngToVector(latitude, sampleLongitude, 1.012);
      values.push(point.x, point.y, point.z);
    }
  }
  landPositionsCache = new Float32Array(values);
  return landPositionsCache;
}

function LandDots({ color }: { color: string }) {
  const geometry = useMemo(() => {
    const next = new BufferGeometry();
    next.setAttribute("position", new Float32BufferAttribute(getLandPositions(), 3));
    return next;
  }, []);
  const material = useMemo(
    () => new PointsMaterial({ color: new Color(color), size: 0.012, sizeAttenuation: true, transparent: true, opacity: 0.78 }),
    [color],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  return <points geometry={geometry} material={material} />;
}

function LocationMarkers({
  markers,
  color,
  onHover,
  onSelect,
}: {
  markers: readonly UserGlobeMarker[];
  color: string;
  onHover: (marker: UserGlobeMarker | null) => void;
  onSelect: (marker: UserGlobeMarker) => void;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new SphereGeometry(1, 12, 12), []);
  const material = useMemo(
    () => new MeshBasicMaterial({ color: new Color(color), toneMapped: false }),
    [color],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const object = new Object3D();
    markers.forEach((marker, index) => {
      const point = latLngToVector(marker.latitude, marker.longitude, 1.035);
      const scale = Math.min(0.036, 0.016 + Math.log2(marker.count + 1) * 0.0035);
      object.position.set(point.x, point.y, point.z);
      object.scale.setScalar(scale);
      object.updateMatrix();
      mesh.setMatrixAt(index, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [markers]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const markerFromEvent = (event: { instanceId?: number }) =>
    event.instanceId === undefined ? null : markers[event.instanceId] ?? null;

  return (
    <instancedMesh
      args={[geometry, material, markers.length]}
      onClick={(event) => {
        event.stopPropagation();
        const marker = markerFromEvent(event);
        if (marker) onSelect(marker);
      }}
      onPointerMove={(event) => {
        event.stopPropagation();
        onHover(markerFromEvent(event));
      }}
      onPointerOut={() => onHover(null)}
      ref={meshRef}
    />
  );
}

function GlobeScene({
  markers,
  palette,
  rotate,
  onHover,
  onSelect,
}: {
  markers: readonly UserGlobeMarker[];
  palette: GlobePalette;
  rotate: boolean;
  onHover: (marker: UserGlobeMarker | null) => void;
  onSelect: (marker: UserGlobeMarker) => void;
}) {
  const globeGeometry = useMemo(() => new SphereGeometry(1, 64, 64), []);
  const atmosphereGeometry = useMemo(() => new SphereGeometry(1.075, 64, 64), []);
  const globeMaterial = useMemo(
    () => new MeshBasicMaterial({ color: new Color(palette.ocean), transparent: true, opacity: 0.82 }),
    [palette.ocean],
  );
  const atmosphereMaterial = useMemo(
    () => new MeshBasicMaterial({ color: new Color(palette.atmosphere), transparent: true, opacity: 0.09, side: BackSide }),
    [palette.atmosphere],
  );

  useEffect(
    () => () => {
      globeGeometry.dispose();
      atmosphereGeometry.dispose();
    },
    [atmosphereGeometry, globeGeometry],
  );
  useEffect(() => () => globeMaterial.dispose(), [globeMaterial]);
  useEffect(() => () => atmosphereMaterial.dispose(), [atmosphereMaterial]);

  return (
    <>
      <group rotation={[0.12, -0.7, 0]}>
        <mesh geometry={globeGeometry} material={globeMaterial} />
        <LandDots color={palette.land} />
        <LocationMarkers color={palette.marker} markers={markers} onHover={onHover} onSelect={onSelect} />
        <mesh geometry={atmosphereGeometry} material={atmosphereMaterial} />
      </group>
      <OrbitControls
        autoRotate={rotate}
        autoRotateSpeed={0.42}
        dampingFactor={0.055}
        enableDamping
        enablePan={false}
        enableZoom={false}
        makeDefault
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI - 0.35}
        rotateSpeed={0.45}
      />
    </>
  );
}

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function UserGlobe({
  markers,
  autoRotate = true,
  showLabels = true,
  ariaLabel = "Interactive globe showing aggregated user locations",
}: UserGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webgl] = useState<boolean | null>(() =>
    typeof document === "undefined" ? null : supportsWebGL(),
  );
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const [interacting, setInteracting] = useState(false);
  const [hovered, setHovered] = useState<UserGlobeMarker | null>(null);
  const [selected, setSelected] = useState<UserGlobeMarker | null>(markers[0] ?? null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "120px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const update = () => setPageVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  const palette = useMemo<GlobePalette>(() => {
    if (typeof document === "undefined") {
      return resolvedTheme === "dark"
        ? { ocean: "navy", land: "white", atmosphere: "royalblue", marker: "goldenrod" }
        : { ocean: "white", land: "slategray", atmosphere: "royalblue", marker: "darkgoldenrod" };
    }
    const styles = getComputedStyle(document.documentElement);
    const token = (name: string) => styles.getPropertyValue(name).trim();
    return {
      ocean: token("--card"),
      land: token("--foreground-secondary"),
      atmosphere: token("--primary"),
      marker: token("--astro-gold"),
    };
  }, [resolvedTheme]);

  const stopInteractingSoon = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setInteracting(false), 1800);
  };
  const activeMarker = hovered ?? selected;

  if (webgl === false) {
    return (
      <div className="grid min-h-[320px] place-items-center rounded-lg bg-muted px-6 text-center text-sm text-muted-foreground" role="status">
        Interactive globe unavailable on this device. Location totals remain available beside the visualization.
      </div>
    );
  }

  if (webgl === null) {
    return <div aria-label="Loading globe" className="min-h-[320px] animate-pulse rounded-lg bg-muted" role="status" />;
  }

  return (
    <div
      aria-label={ariaLabel}
      className="relative mx-auto aspect-square w-full max-w-[640px] touch-none overflow-hidden rounded-full [cursor:grab] active:[cursor:grabbing]"
      onPointerDown={() => {
        setInteracting(true);
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
      }}
      onPointerLeave={stopInteractingSoon}
      onPointerUp={stopInteractingSoon}
      ref={containerRef}
      role="img"
    >
      <Canvas
        camera={{ position: [0, 0, 3.05], fov: 40 }}
        dpr={[1, 2]}
        frameloop={inView && pageVisible ? "always" : "never"}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <GlobeScene
          markers={markers}
          onHover={setHovered}
          onSelect={setSelected}
          palette={palette}
          rotate={autoRotate && !reducedMotion && !interacting && inView && pageVisible}
        />
      </Canvas>
      {showLabels && activeMarker ? (
        <div className="pointer-events-none absolute bottom-7 left-1/2 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded border border-border bg-popover/95 px-3 py-2 text-center text-[11px] text-popover-foreground shadow-md backdrop-blur">
          <strong className="block truncate font-semibold">
            {activeMarker.city ?? activeMarker.region ?? activeMarker.country}
            {activeMarker.city ? `, ${activeMarker.country}` : ""}
          </strong>
          <span className="text-muted-foreground">{activeMarker.count.toLocaleString("en-IN")} registered {activeMarker.count === 1 ? "user" : "users"}</span>
        </div>
      ) : null}
    </div>
  );
}
