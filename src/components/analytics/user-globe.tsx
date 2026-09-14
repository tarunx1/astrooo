"use client";

import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  CircleGeometry,
  Color,
  MeshBasicMaterial,
  Object3D,
  ShaderMaterial,
  Vector3,
  SphereGeometry,
  type Camera,
  type InstancedMesh,
  type Mesh,
} from "three";
import {
  Component,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementRef,
  type RefObject,
} from "react";
import landPolygons from "./globe-land.json";
import styles from "./user-globe.module.css";
import type { GeographyMarker } from "@/lib/analytics/geography";

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
  marker: string;
};

type Point = readonly [longitude: number, latitude: number];

type OrbitControlsImpl = ElementRef<typeof OrbitControls>;

type AxisControlsRef = RefObject<OrbitControlsImpl | null>;

type AxisControlsHandle = {
  getAzimuthalAngle: () => number;
  getPolarAngle: () => number;
  update: () => void;
};

const LABEL_OFFSETS = [
  { x: -92, y: -18 },
  { x: 64, y: -58 },
  { x: 96, y: -20 },
  { x: -24, y: -54 },
  { x: 28, y: -92 },
] as const;

const ROUTE_LABEL_OFFSETS = [
  { x: 0, y: -22 },
  { x: 18, y: -92 },
] as const;

// Natural Earth 1:110m land, public domain. Vendored to avoid runtime map requests.
// https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson
const LAND_POLYGONS: Point[][] = landPolygons.map((polygon) =>
  polygon.map(([longitude, latitude]): Point => [longitude, latitude]),
);

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
  for (let latitude = -84; latitude <= 84; latitude += 1.5) {
    const longitudeOffset = Math.abs(Math.round(latitude / 1.5)) % 2 ? 0.75 : 0;
    for (let longitude = -180; longitude < 180; longitude += 1.5 / Math.cos(latitude * Math.PI / 180)) {
      const sampleLongitude = longitude + longitudeOffset;
      if (!LAND_POLYGONS.some((polygon) => pointInPolygon(sampleLongitude, latitude, polygon))) continue;
      const point = latLngToVector(latitude, sampleLongitude, 1.002);
      values.push(point.x, point.y, point.z);
    }
  }
  landPositionsCache = new Float32Array(values);
  return landPositionsCache;
}

function LandDots({ color }: { color: string }) {
  const ref = useRef<InstancedMesh>(null);
  const positions = useMemo(() => getLandPositions(), []);
  const geometry = useMemo(() => new CircleGeometry(0.0046, 10), []);
  const material = useMemo(() => new MeshBasicMaterial({ color }), [color]);
  useLayoutEffect(() => {
    const object = new Object3D();
    for (let i = 0; i < positions.length; i += 3) {
      object.position.fromArray(positions, i);
      object.lookAt(object.position.clone().multiplyScalar(2));
      object.updateMatrix();
      ref.current?.setMatrixAt(i / 3, object.matrix);
    }
    if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
  }, [positions]);
  useEffect(() => () => { geometry.dispose(); }, [geometry]);
  useEffect(() => () => { material.dispose(); }, [material]);
  return <instancedMesh ref={ref} args={[geometry, material, positions.length / 3]} />;
}

const routeName = (marker: UserGlobeMarker) => {
  const name = locationName(marker);
  return name.length > 10 ? name.split(/\s+/).map((word) => word[0]).join("") : name;
};

const locationName = (marker: UserGlobeMarker) => marker.city ?? marker.region ?? marker.country;

function CityLabel({ marker, globeRef, offset, onSelect }: {
  marker: UserGlobeMarker;
  globeRef: RefObject<Mesh | null>;
  offset: { x: number; y: number };
  onSelect: (marker: UserGlobeMarker) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const world = useMemo(() => new Vector3(), []);
  const direction = useMemo(() => new Vector3(), []);
  const point = latLngToVector(marker.latitude, marker.longitude, 1.045);
  useFrame(({ camera }) => {
    if (!globeRef.current || !ref.current) return;
    world.set(point.x, point.y, point.z).applyMatrix4(globeRef.current.matrixWorld);
    direction.copy(world).sub(camera.position);
    const distance = direction.length();
    direction.normalize();
    const projection = camera.position.dot(direction);
    const discriminant = projection * projection - (camera.position.lengthSq() - 1);
    const hit = discriminant >= 0 ? -projection - Math.sqrt(discriminant) : Infinity;
    ref.current.dataset.hidden = hit > 0 && hit < distance - 0.001 ? "true" : "false";
  });
  return <Html position={[point.x, point.y, point.z]} center zIndexRange={[30, 0]}>
    <button ref={ref} className={styles.cityLabel} onClick={() => onSelect(marker)}
      aria-label={`${locationName(marker)}: ${marker.count} registered users`}
      style={{ "--label-x": `${offset.x}px`, "--label-y": `${offset.y}px` } as CSSProperties}>
      <span>{locationName(marker)}</span>
      <span className={styles.cityCount}>{marker.count.toLocaleString("en-IN")}</span>
    </button>
  </Html>;
}

function returnCameraToEquator(camera: Camera, controls: AxisControlsHandle, delta: number) {
  const radius = camera.position.length();
  const theta = controls.getAzimuthalAngle();
  const phi = controls.getPolarAngle();
  const nextPhi = phi + (Math.PI / 2 - phi) * Math.min(1, delta * 3.6);

  camera.position.set(
    radius * Math.sin(nextPhi) * Math.sin(theta),
    radius * Math.cos(nextPhi),
    radius * Math.sin(nextPhi) * Math.cos(theta),
  );
  controls.update();
}

function AxisReturn({ controlsRef, enabled }: {
  controlsRef: AxisControlsRef;
  enabled: boolean;
}) {
  useFrame(({ camera }, delta) => {
    if (!enabled || !controlsRef.current) return;
    if (Math.abs(controlsRef.current.getPolarAngle() - Math.PI / 2) < 0.002) return;
    returnCameraToEquator(camera, controlsRef.current, delta);
  });
  return null;
}

function LocationAnnotations({ markers, color, onSelect, globeRef }: {
  markers: readonly UserGlobeMarker[];
  color: string;
  globeRef: RefObject<Mesh | null>;
  onSelect: (marker: UserGlobeMarker) => void;
}) {
  const featured = markers.slice(0, 5);
  const routes = useMemo(() => markers.slice(1, 3).flatMap((end) => {
    const start = markers[0];
    if (!start) return [];
    const a = latLngToVector(start.latitude, start.longitude, 1);
    const b = latLngToVector(end.latitude, end.longitude, 1);
    const from = new Vector3(a.x, a.y, a.z);
    const to = new Vector3(b.x, b.y, b.z);
    const angle = from.angleTo(to);
    // Coincident and antipodal points have no unique connecting arc.
    if (angle < 0.05 || angle > Math.PI - 0.05) return [];
    const points = Array.from({ length: 65 }, (_, i) => {
      const t = i / 64;
      return from.clone().multiplyScalar(Math.sin((1 - t) * angle))
        .addScaledVector(to, Math.sin(t * angle)).divideScalar(Math.sin(angle))
        .multiplyScalar(1.025 + Math.sin(t * Math.PI) * Math.min(0.28, angle * 0.17));
    });
    return [{ id: end.id, points, title: `${routeName(start)} → ${routeName(end)}` }];
  }), [markers]);
  return <>
    {routes.map((route, index) => <group key={route.id}>
      <Line points={route.points} color={color} lineWidth={1.5} />
      <Html position={route.points[32]} center occlude={[globeRef as RefObject<Mesh>]} zIndexRange={[20, 0]} className={styles.routeAnchor}>
        <span
          className={styles.routeLabel}
          style={{
            "--route-x": `${ROUTE_LABEL_OFFSETS[index]?.x ?? 0}px`,
            "--route-y": `${ROUTE_LABEL_OFFSETS[index]?.y ?? -22}px`,
          } as CSSProperties}
        >
          {route.title}
        </span>
      </Html>
    </group>)}
    {featured.map((marker, index) => (
      <CityLabel
        key={marker.id}
        marker={marker}
        globeRef={globeRef}
        offset={LABEL_OFFSETS[index] ?? LABEL_OFFSETS[0]}
        onSelect={onSelect}
      />
    ))}
  </>;
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
      const point = latLngToVector(marker.latitude, marker.longitude, 1.018);
      const scale = Math.min(0.018, 0.009 + Math.log2(marker.count + 1) * 0.001);
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
  restoreAxis,
  showLabels,
  onHover,
  onSelect,
}: {
  markers: readonly UserGlobeMarker[];
  palette: GlobePalette;
  rotate: boolean;
  restoreAxis: boolean;
  showLabels: boolean;
  onHover: (marker: UserGlobeMarker | null) => void;
  onSelect: (marker: UserGlobeMarker) => void;
}) {
  const globeRef = useRef<Mesh>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  useFrame(() => { globeRef.current?.updateWorldMatrix(true, false); }, -1);
  const globeGeometry = useMemo(() => new SphereGeometry(1, 64, 64), []);
  const globeMaterial = useMemo(() => new ShaderMaterial({
    uniforms: { ocean: { value: new Color(palette.ocean) } },
    vertexShader: `varying vec3 vNormal;
      void main() { vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 ocean; varying vec3 vNormal;
      void main() { float facing = max(normalize(vNormal).z, 0.0);
        float shade = 1.0 - 0.17 * pow(1.0 - facing, 2.0);
        shade += 0.06 * smoothstep(0.0, 0.08, 1.0 - facing) * (1.0 - smoothstep(0.08, 0.2, facing));
        gl_FragColor = vec4(ocean * min(shade, 1.0), 1.0);
        #include <colorspace_fragment>
      }`,
  }), [palette.ocean]);
  useEffect(() => () => globeGeometry.dispose(), [globeGeometry]);
  useEffect(() => () => globeMaterial.dispose(), [globeMaterial]);

  return (
    <>
      <group rotation={[0, 2.79, 0]}>
        <mesh ref={globeRef} geometry={globeGeometry} material={globeMaterial} />
        <LandDots color={palette.land} />
        <LocationMarkers color={palette.marker} markers={markers} onHover={onHover} onSelect={onSelect} />
        {showLabels ? <LocationAnnotations globeRef={globeRef} markers={markers} color={palette.marker} onSelect={onSelect} /> : null}
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
        ref={controlsRef}
        rotateSpeed={0.45}
      />
      <AxisReturn controlsRef={controlsRef} enabled={restoreAxis} />
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

function readGlobePalette(): GlobePalette {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string) => styles.getPropertyValue(name).trim();
  return { ocean: token("--globe-ocean"), land: token("--globe-land"), marker: token("--globe-route") };
}

class GlobeErrorBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="grid min-h-[320px] place-items-center rounded-lg bg-muted px-6 text-center text-sm text-muted-foreground" role="status">
          Interactive globe unavailable on this device. Location totals remain available beside the visualization.
        </div>
      );
    }
    return this.props.children;
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
  const [selected, setSelected] = useState<UserGlobeMarker | null>(null);
  const [palette, setPalette] = useState<GlobePalette>(readGlobePalette);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();

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
  useEffect(() => {
    const observer = new MutationObserver(() => setPalette(readGlobePalette()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] });
    return () => observer.disconnect();
  }, []);

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
      className={styles.globe}
      onPointerDown={() => {
        setInteracting(true);
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
      }}
      onPointerLeave={stopInteractingSoon}
      onPointerUp={stopInteractingSoon}
      ref={containerRef}
      role="group"
    >
      <GlobeErrorBoundary>
        <Canvas
          camera={{ position: [0, 0, 3.65], fov: 40 }}
          dpr={[1, 2]}
          frameloop={inView && pageVisible ? "always" : "never"}
          gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
        >
          <GlobeScene
            markers={markers}
            showLabels={showLabels}
            onHover={setHovered}
            onSelect={setSelected}
            palette={palette}
            restoreAxis={!interacting && inView && pageVisible}
            rotate={autoRotate && !reducedMotion && !interacting && inView && pageVisible}
          />
        </Canvas>
      </GlobeErrorBoundary>
      <p className={styles.hint}>Drag to rotate · Arcs illustrate connections between locations</p>
      {showLabels && activeMarker ? (
        <div className={styles.selection}>
          <strong className={styles.selectionTitle}>
            {activeMarker.city ?? activeMarker.region ?? activeMarker.country}
            {activeMarker.city ? `, ${activeMarker.country}` : ""}
          </strong>
          <span>{activeMarker.count.toLocaleString("en-IN")} registered {activeMarker.count === 1 ? "user" : "users"}</span>
        </div>
      ) : null}
    </div>
  );
}
