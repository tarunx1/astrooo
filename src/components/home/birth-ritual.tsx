"use client";
import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import styles from "./birth-ritual.module.css";
export function BirthRitual() {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState([false,false,false]);
  const { pending } = useFormStatus();
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    let timeout: ReturnType<typeof setTimeout>;
    const refresh = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const data = new FormData(form);
        setReady([Boolean(data.get("dateOfBirth")), Boolean(data.get("timeOfBirth")), Boolean(data.get("placeId"))]);
      }, 0);
    };
    refresh();
    form.addEventListener("reset", refresh);
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    form.addEventListener("click", refresh);
    return () => { clearTimeout(timeout); form.removeEventListener("reset", refresh); form.removeEventListener("input", refresh); form.removeEventListener("change", refresh); form.removeEventListener("click", refresh); };
  }, [pending]);
  return <div ref={ref} className={styles.ritual} data-pending={pending} aria-label="Birth detail progress">
    <svg viewBox="0 0 300 92" aria-hidden="true">{["Date","Time","Place"].map((name,i)=><g key={name} className={styles.ring} data-ready={ready[i]} style={{transformOrigin:`${60+i*90}px 36px`}}><circle cx={60+i*90} cy="36" r="24"/><ellipse cx={60+i*90} cy="36" rx="30" ry="11" transform={`rotate(${i*35-30} ${60+i*90} 36)`}/><circle className={styles.marker} cx={60+i*90} cy="12" r="2.5"/><text x={60+i*90} y="84" textAnchor="middle">{name}</text></g>)}</svg>
    <span className="sr-only">{pending ? "Calculating your chart" : ["Date", "Time", "Place"].filter((_,i)=>ready[i]).join(", ")+" entered"}</span>
  </div>;
}
