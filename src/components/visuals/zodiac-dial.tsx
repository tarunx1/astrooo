"use client";

import { useEffect, useRef, useState } from "react";
import { SIGNS } from "@/config/astrology";
import { ZODIAC_GLYPH_PATHS } from "@/lib/star-image/zodiac-shapes";
import { ZodiacHubCycle } from "./zodiac-hub-cycle";
import styles from "./zodiac-dial.module.css";

export function ZodiacDial() {
  const [selected, setSelected] = useState(0);
  const ring = useRef<SVGGElement>(null);
  const angle = useRef(0);
  const target = useRef<number | null>(null);
  const reduced = useRef(false);
  const interacting = useRef(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce), (max-width: 639px)");
    const update = () => { reduced.current = media.matches; };
    update();
    media.addEventListener("change", update);
    let frame = 0;
    let previous = 0;
    const tick = (time: number) => {
      const delta = previous ? Math.min((time - previous) / 1000, .05) : 0;
      previous = time;
      if (target.current !== null) {
        angle.current = reduced.current || Math.abs(target.current - angle.current) < .01 ? target.current : angle.current + (target.current - angle.current) * (1 - Math.exp(-delta * 3));
      } else if (!reduced.current && !interacting.current) {
        angle.current -= delta * 2;
      }
      ring.current?.setAttribute("transform", `rotate(${angle.current} 300 300)`);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); media.removeEventListener("change", update); };
  }, []);

  const select = (index: number) => {
    const destination = -index * 30;
    const difference = ((destination - angle.current) % 360 + 540) % 360 - 180;
    target.current = angle.current + difference;
    setSelected(index);
  };

  return (
    <div className={styles.instrument} aria-label="Interactive celestial zodiac dial" onMouseEnter={() => { interacting.current = true; }} onMouseLeave={() => { interacting.current = false; }} onFocusCapture={() => { interacting.current = true; }} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) interacting.current = false; }}>
      <svg viewBox="0 0 600 600" className={styles.dial}>
        <circle className={styles.plate} cx="300" cy="300" r="278" />
        <g className={styles.degrees} aria-hidden="true">
          <circle className={styles.rim} cx="300" cy="300" r="278" />
          <circle className={styles.hairline} cx="300" cy="300" r="261" />
          {Array.from({ length: 180 }, (_, i) => (
            <path key={i} className={i % 15 === 0 ? styles.major : styles.tick} d={`M300 26V${i % 15 === 0 ? 37 : i % 5 === 0 ? 33 : 30}`} transform={`rotate(${i * 2} 300 300)`} />
          ))}
          {Array.from({ length: 24 }, (_, i) => <circle key={i} className={styles.star} cx="300" cy="44" r={i % 3 === 0 ? 1.3 : .65} transform={`rotate(${i * 15 + 7.5} 300 300)`} />)}
          {Array.from({ length: 8 }, (_, i) => (
            <g key={`glint-${i}`} transform={`rotate(${i * 45 + 12} 300 300)`}>
              <path className={styles.glint} style={{ animationDelay: `${-i * 1.7}s` }} d="M300 39L301 43L305 44L301 45L300 49L299 45L295 44L299 43Z" />
            </g>
          ))}
        </g>
        <circle className={styles.recess} cx="300" cy="300" r="175" />
        <g ref={ring}>
          {SIGNS.map((sign, i) => (
            <g key={sign} transform={`rotate(${i * 30} 300 300)`}>
              <g className={styles.sector} role="button" tabIndex={0} aria-label={`Select ${sign}`} aria-pressed={selected === i} onClick={() => select(i)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(i); } }}>
                <path className={styles.hit} d="M234 54 A255 255 0 0 1 366 54 L345 132 A174 174 0 0 0 255 132 Z" />
                <path className={styles.divider} d="M345 132L366 54" />
                <path className={styles.glyph} d={ZODIAC_GLYPH_PATHS[sign]} transform="translate(276 68) scale(.48)" />
                <text className={styles.label} x="300" y="132" textAnchor="middle">{sign.toUpperCase()}</text>
                <path className={styles.jewel} d="M300 145L302 149L300 153L298 149Z" />
              </g>
            </g>
          ))}
        </g>
        <g className={styles.orbits} aria-hidden="true">
          <circle className={styles.hairline} cx="300" cy="300" r="164" />
          <ellipse className={styles.track} cx="300" cy="300" rx="156" ry="144" transform="rotate(35 300 300)" />
          <circle className={styles.planet} cx="300" cy="136" r="3" />
          <circle className={styles.planetSmall} cx="300" cy="456" r="1.8" />
          <path className={styles.hairline} d="M136 300H145M455 300H464M300 136V145M300 455V464" />
        </g>
        <circle className={styles.center} cx="300" cy="300" r="133" />
        <path className={styles.pointer} d="M295 13L300 25L305 13Z" aria-hidden="true" />
      </svg>
      <ZodiacHubCycle selectedSign={SIGNS[selected]} />
    </div>
  );
}
