import styles from "./home-experience.module.css";

export type CelestialArtKind = "chart" | "clock" | "career" | "matching" | "balance" | "timeline" | "network" | "gem";

/** Brand illustrations, never calculation results or live network telemetry. */
export function CelestialArt({ kind, className = "" }: { kind: CelestialArtKind; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 240" className={`${styles.art} ${className}`} fill="none">
      <circle cx="120" cy="120" r="94" className={styles.artFaint} />
      <g className={styles.artOrbit}>
        <circle cx="120" cy="120" r="106" strokeDasharray="1 9" className={styles.artFaint} />
        <circle cx="120" cy="14" r="3" className={styles.artPoint} />
      </g>
      {kind === "chart" && <g className={styles.chartLines}><path d="M44 44H196V196H44ZM44 44L196 196M196 44L44 196M120 44L196 120L120 196L44 120Z" /><path d="M120 44V196M44 120H196" className={styles.artFaint} /></g>}
      {kind === "clock" && <><circle cx="120" cy="120" r="73" /><circle cx="120" cy="120" r="65" className={styles.artFaint} />{Array.from({length:12},(_,i)=><path key={i} d="M120 51V58" transform={`rotate(${i*30} 120 120)`}/>)}<path d="M120 78V120L154 138" /><circle cx="120" cy="120" r="4" className={styles.artPoint}/></>}
      {kind === "career" && <><path d="M53 182H188M67 182V129H93V182M107 182V95H133V182M147 182V61H173V182M58 112L108 72L150 83L183 40M168 42L183 40L181 55" /><ellipse cx="120" cy="104" rx="90" ry="27" transform="rotate(-32 120 104)" className={styles.artFaint}/></>}
      {kind === "matching" && <g className={styles.dualOrbit}><g className={styles.matchOrbitA}><ellipse cx="94" cy="120" rx="48" ry="69" transform="rotate(-25 94 120)"/></g><g className={styles.matchOrbitB}><ellipse cx="146" cy="120" rx="48" ry="69" transform="rotate(25 146 120)"/></g><circle cx="85" cy="87" r="4" className={styles.artPoint}/><circle cx="157" cy="149" r="4" className={styles.artPoint}/><path d="M105 121L120 136L135 121C144 106 126 99 120 111C114 99 96 106 105 121Z"/></g>}
      {kind === "balance" && <><path d="M120 52V181M80 181H160M57 96H183M76 96L50 146H102ZM164 96L138 146H190Z"/><circle cx="120" cy="66" r="16"/><path d="M120 47V40M139 66H146M101 66H94"/></>}
      {kind === "timeline" && <><circle cx="120" cy="120" r="76"/><circle cx="120" cy="120" r="53" strokeDasharray="40 12"/><circle cx="120" cy="120" r="29"/><path d="M120 44V196M44 120H196" className={styles.artFaint}/><circle cx="173" cy="120" r="4" className={styles.artPoint}/><circle cx="120" cy="91" r="3" className={styles.artPoint}/></>}
      {kind === "network" && <><ellipse cx="120" cy="120" rx="45" ry="85"/><circle cx="120" cy="120" r="85"/><ellipse cx="120" cy="120" rx="85" ry="32"/><path d="M48 97Q110 25 173 85M48 97Q135 99 164 174M173 85Q107 109 164 174" className={styles.chartLines}/>{[[48,97],[173,85],[164,174]].map(([x,y])=><circle key={x} cx={x} cy={y} r="5" className={styles.artPoint}/>)}</>}
      {kind === "gem" && <><path d="M50 88L83 49H157L190 88L120 190ZM50 88H190M83 49L98 88L120 190L142 88L157 49M98 88L120 49L142 88"/><path d="M40 55V37M31 46H49M193 164V146M184 155H202" className={styles.artFaint}/></>}
      <g className={styles.artStars}>{[[44,44],[196,44],[196,196],[44,196]].map(([x,y])=><circle key={`${x}-${y}`} cx={x} cy={y} r="2" className={styles.artPoint}/>)}</g>
    </svg>
  );
}
